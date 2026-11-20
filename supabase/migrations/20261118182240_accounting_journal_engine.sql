-- Double-entry journal vouchers with immutable posting and linked reversals.

create unique index if not exists business_financial_years_id_business_uq
  on public.business_financial_years (id, business_id);
create unique index if not exists business_accounting_periods_id_business_uq
  on public.business_accounting_periods (id, business_id);

create table public.business_journal_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  financial_year_id uuid not null references public.business_financial_years(id),
  accounting_period_id uuid not null references public.business_accounting_periods(id),
  journal_number text not null,
  entry_date date not null,
  description text not null,
  source_type text not null default 'manual'
    check (source_type in ('manual','invoice','purchase','payment','expense','inventory_adjustment','opening_balance','reversal')),
  source_id uuid,
  status text not null default 'posted' check (status in ('posted','reversed')),
  reversal_of_entry_id uuid,
  reversed_by_entry_id uuid,
  posted_at timestamptz not null default now(),
  posted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (business_id, journal_number),
  unique (id, business_id),
  foreign key (financial_year_id, business_id)
    references public.business_financial_years(id, business_id),
  foreign key (accounting_period_id, business_id)
    references public.business_accounting_periods(id, business_id),
  foreign key (reversal_of_entry_id, business_id)
    references public.business_journal_entries(id, business_id),
  foreign key (reversed_by_entry_id, business_id)
    references public.business_journal_entries(id, business_id),
  check (nullif(btrim(description), '') is not null),
  check ((status = 'posted' and reversed_by_entry_id is null)
      or (status = 'reversed' and reversed_by_entry_id is not null)),
  check ((source_type = 'reversal' and reversal_of_entry_id is not null)
      or (source_type <> 'reversal' and reversal_of_entry_id is null))
);

create unique index business_journal_one_active_source_idx
  on public.business_journal_entries (business_id, source_type, source_id)
  where source_id is not null and status = 'posted';
create index business_journal_entries_date_idx
  on public.business_journal_entries (business_id, entry_date desc, id);
create index business_journal_entries_period_idx
  on public.business_journal_entries (business_id, accounting_period_id, entry_date);

create table public.business_journal_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  journal_entry_id uuid not null,
  line_number integer not null check (line_number > 0),
  account_id uuid not null,
  description text,
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  foreign key (journal_entry_id, business_id)
    references public.business_journal_entries(id, business_id) on delete restrict,
  foreign key (account_id, business_id)
    references public.business_chart_of_accounts(id, business_id) on delete restrict,
  unique (journal_entry_id, line_number),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);
create index business_journal_lines_entry_idx
  on public.business_journal_lines (journal_entry_id, line_number);
create index business_journal_lines_account_idx
  on public.business_journal_lines (business_id, account_id, journal_entry_id);

create table private.business_journal_counters (
  business_id uuid not null references public.businesses(id) on delete cascade,
  financial_year_id uuid not null references public.business_financial_years(id) on delete cascade,
  next_number bigint not null default 1 check (next_number > 0),
  primary key (business_id, financial_year_id)
);
revoke all on private.business_journal_counters from public, anon, authenticated;

alter table public.business_journal_entries enable row level security;
alter table public.business_journal_lines enable row level security;
create policy journal_entries_read on public.business_journal_entries
  for select to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']::text[]));
create policy journal_lines_read on public.business_journal_lines
  for select to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']::text[]));
revoke all on public.business_journal_entries, public.business_journal_lines
  from public, anon, authenticated;
grant select on public.business_journal_entries, public.business_journal_lines to authenticated;

drop trigger if exists ledgerwise_audit_journal_entries on public.business_journal_entries;
create trigger ledgerwise_audit_journal_entries
  after insert or update on public.business_journal_entries
  for each row execute function private.ledgerwise_capture_audit_event();
drop trigger if exists ledgerwise_audit_journal_lines on public.business_journal_lines;
create trigger ledgerwise_audit_journal_lines
  after insert on public.business_journal_lines
  for each row execute function private.ledgerwise_capture_audit_event();

create or replace function private.ledgerwise_next_journal_number(
  p_business_id uuid, p_financial_year_id uuid, p_start_date date, p_end_date date
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare v_number bigint; v_label text;
begin
  insert into private.business_journal_counters (business_id, financial_year_id, next_number)
  values (p_business_id, p_financial_year_id, 1)
  on conflict (business_id, financial_year_id) do update
    set next_number = private.business_journal_counters.next_number + 1
  returning next_number into v_number;
  v_label := to_char(p_start_date, 'YYYY') || '-' || right(to_char(p_end_date, 'YYYY'), 2);
  return 'JV/' || v_label || '/' || lpad(v_number::text, 6, '0');
end
$function$;
revoke all on function private.ledgerwise_next_journal_number(uuid,uuid,date,date) from public, anon, authenticated;

create or replace function private.ledgerwise_post_journal_entry_impl(
  p_business_id uuid,
  p_entry_date date,
  p_description text,
  p_lines jsonb,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_entry_id uuid := gen_random_uuid();
  v_old_entry_id uuid;
  v_year_id uuid;
  v_year_start date;
  v_year_end date;
  v_period_id uuid;
  v_journal_number text;
  v_debits numeric(18,2);
  v_credits numeric(18,2);
  v_line_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not private.ledgerwise_user_can_access_business(
    p_business_id, array['owner','admin','accountant']::text[]
  ) then raise exception 'Finance role required' using errcode = '42501'; end if;
  if p_entry_date is null then raise exception 'Journal date is required'; end if;
  if nullif(btrim(p_description), '') is null then raise exception 'Journal description is required'; end if;
  if p_idempotency_key is null then raise exception 'Idempotency key is required'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal needs at least two lines';
  end if;

  v_old_entry_id := private.ledgerwise_idempotency_claim(
    p_business_id, 'post_journal_entry', p_idempotency_key,
    jsonb_build_object('entry_date', p_entry_date, 'description', btrim(p_description), 'lines', p_lines)
  );
  if v_old_entry_id is not null then return v_old_entry_id; end if;

  select fy.id, fy.start_date, fy.end_date
    into v_year_id, v_year_start, v_year_end
  from public.business_financial_years fy
  where fy.business_id = p_business_id and p_entry_date between fy.start_date and fy.end_date
    and fy.status = 'open'
  for share;
  if not found then raise exception 'Journal date must belong to an open financial year'; end if;

  select ap.id into v_period_id
  from public.business_accounting_periods ap
  where ap.business_id = p_business_id and ap.financial_year_id = v_year_id
    and p_entry_date between ap.period_start and ap.period_end and ap.status = 'open'
  for share;
  if not found then raise exception 'Journal date must belong to an open accounting period'; end if;

  select count(*), coalesce(sum(x.debit), 0), coalesce(sum(x.credit), 0)
    into v_line_count, v_debits, v_credits
  from jsonb_to_recordset(p_lines) as x(line_number integer, account_id uuid, debit numeric, credit numeric, description text);
  if v_line_count < 2 then raise exception 'A journal needs at least two lines'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) as x(line_number integer, account_id uuid, debit numeric, credit numeric, description text)
    where x.line_number is null or x.account_id is null or x.debit is null or x.credit is null
      or x.debit < 0 or x.credit < 0 or x.debit > 9999999999999999.99 or x.credit > 9999999999999999.99
      or x.debit <> round(x.debit, 2) or x.credit <> round(x.credit, 2)
      or not ((x.debit > 0 and x.credit = 0) or (x.credit > 0 and x.debit = 0))
  ) then raise exception 'Each journal line must have one positive debit or credit, to two decimal places'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) as x(line_number integer, account_id uuid, debit numeric, credit numeric, description text)
    group by x.line_number having count(*) > 1
  ) then raise exception 'Journal line numbers must be unique'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) as x(line_number integer, account_id uuid, debit numeric, credit numeric, description text)
    left join public.business_chart_of_accounts a
      on a.id = x.account_id and a.business_id = p_business_id and a.is_active
    where a.id is null
  ) then raise exception 'Every journal line must use an active account in this business'; end if;
  if v_debits <= 0 or v_debits <> v_credits then
    raise exception 'Journal debits and credits must be equal and greater than zero';
  end if;

  v_journal_number := private.ledgerwise_next_journal_number(
    p_business_id, v_year_id, v_year_start, v_year_end
  );
  insert into public.business_journal_entries (
    id, business_id, financial_year_id, accounting_period_id, journal_number,
    entry_date, description, source_type, status, posted_by
  ) values (
    v_entry_id, p_business_id, v_year_id, v_period_id, v_journal_number,
    p_entry_date, btrim(p_description), 'manual', 'posted', auth.uid()
  );
  insert into public.business_journal_lines (
    business_id, journal_entry_id, line_number, account_id, description, debit, credit
  )
  select p_business_id, v_entry_id, x.line_number, x.account_id,
         nullif(btrim(x.description), ''), x.debit, x.credit
  from jsonb_to_recordset(p_lines) as x(line_number integer, account_id uuid, debit numeric, credit numeric, description text)
  order by x.line_number;
  perform private.ledgerwise_idempotency_complete(
    p_business_id, 'post_journal_entry', p_idempotency_key, v_entry_id
  );
  return v_entry_id;
end
$function$;
revoke all on function private.ledgerwise_post_journal_entry_impl(uuid,date,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function private.ledgerwise_post_journal_entry_impl(uuid,date,text,jsonb,uuid) to authenticated;

create or replace function public.post_journal_entry(
  p_business_id uuid, p_entry_date date, p_description text, p_lines jsonb, p_idempotency_key uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.ledgerwise_post_journal_entry_impl(
    p_business_id, p_entry_date, p_description, p_lines, p_idempotency_key
  );
$function$;
revoke all on function public.post_journal_entry(uuid,date,text,jsonb,uuid) from public, anon;
grant execute on function public.post_journal_entry(uuid,date,text,jsonb,uuid) to authenticated;

create or replace function private.ledgerwise_reverse_journal_entry_impl(
  p_journal_entry_id uuid, p_reversal_date date, p_reason text, p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_original public.business_journal_entries%rowtype;
  v_new_entry_id uuid := gen_random_uuid();
  v_old_entry_id uuid;
  v_year_id uuid;
  v_year_start date;
  v_year_end date;
  v_period_id uuid;
  v_journal_number text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into v_original from public.business_journal_entries
  where id = p_journal_entry_id for update;
  if not found then raise exception 'Journal entry not found'; end if;
  if not private.ledgerwise_user_can_access_business(
    v_original.business_id, array['owner','admin','accountant']::text[]
  ) then raise exception 'Finance role required' using errcode = '42501'; end if;
  if p_reversal_date is null then raise exception 'Reversal date is required'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'A reason is required for reversal'; end if;
  if v_original.reversal_of_entry_id is not null then
    raise exception 'A reversal entry cannot itself be reversed; create a correcting journal instead';
  end if;

  v_old_entry_id := private.ledgerwise_idempotency_claim(
    v_original.business_id, 'reverse_journal_entry', p_idempotency_key,
    jsonb_build_object('journal_entry_id', p_journal_entry_id, 'reversal_date', p_reversal_date, 'reason', btrim(p_reason))
  );
  if v_old_entry_id is not null then return v_old_entry_id; end if;
  if v_original.status <> 'posted' then raise exception 'This journal entry has already been reversed'; end if;

  select fy.id, fy.start_date, fy.end_date into v_year_id, v_year_start, v_year_end
  from public.business_financial_years fy
  where fy.business_id = v_original.business_id and p_reversal_date between fy.start_date and fy.end_date
    and fy.status = 'open'
  for share;
  if not found then raise exception 'Reversal date must belong to an open financial year'; end if;
  select ap.id into v_period_id from public.business_accounting_periods ap
  where ap.business_id = v_original.business_id and ap.financial_year_id = v_year_id
    and p_reversal_date between ap.period_start and ap.period_end and ap.status = 'open'
  for share;
  if not found then raise exception 'Reversal date must belong to an open accounting period'; end if;

  v_journal_number := private.ledgerwise_next_journal_number(
    v_original.business_id, v_year_id, v_year_start, v_year_end
  );
  insert into public.business_journal_entries (
    id, business_id, financial_year_id, accounting_period_id, journal_number,
    entry_date, description, source_type, source_id, status, reversal_of_entry_id, posted_by
  ) values (
    v_new_entry_id, v_original.business_id, v_year_id, v_period_id, v_journal_number,
    p_reversal_date, 'Reversal of ' || v_original.journal_number || ': ' || btrim(p_reason),
    'reversal', v_original.id, 'posted', v_original.id, auth.uid()
  );
  insert into public.business_journal_lines (
    business_id, journal_entry_id, line_number, account_id, description, debit, credit
  )
  select l.business_id, v_new_entry_id, l.line_number, l.account_id,
         coalesce(nullif(btrim(l.description), ''), v_original.description), l.credit, l.debit
  from public.business_journal_lines l
  where l.journal_entry_id = v_original.id
  order by l.line_number;
  update public.business_journal_entries
  set status = 'reversed', reversed_by_entry_id = v_new_entry_id
  where id = v_original.id;
  perform private.ledgerwise_idempotency_complete(
    v_original.business_id, 'reverse_journal_entry', p_idempotency_key, v_new_entry_id
  );
  return v_new_entry_id;
end
$function$;
revoke all on function private.ledgerwise_reverse_journal_entry_impl(uuid,date,text,uuid) from public, anon, authenticated;
grant execute on function private.ledgerwise_reverse_journal_entry_impl(uuid,date,text,uuid) to authenticated;

create or replace function public.reverse_journal_entry(
  p_journal_entry_id uuid, p_reversal_date date, p_reason text, p_idempotency_key uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.ledgerwise_reverse_journal_entry_impl(
    p_journal_entry_id, p_reversal_date, p_reason, p_idempotency_key
  );
$function$;
revoke all on function public.reverse_journal_entry(uuid,date,text,uuid) from public, anon;
grant execute on function public.reverse_journal_entry(uuid,date,text,uuid) to authenticated;
