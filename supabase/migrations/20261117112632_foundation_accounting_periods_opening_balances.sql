-- Accounting periods, starter ledger accounts, and balanced opening balances.
-- Applied to the existing production database on 2026-11-17.

create table public.business_accounting_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  financial_year_id uuid not null references public.business_financial_years(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open', 'locked')),
  locked_at timestamptz,
  locked_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  check ((status = 'open' and locked_at is null and locked_by is null)
      or (status = 'locked' and locked_at is not null and locked_by is not null)),
  unique (business_id, period_start)
);
create index business_accounting_periods_lookup_idx
  on public.business_accounting_periods (business_id, period_start, period_end);
alter table public.business_accounting_periods enable row level security;
create policy accounting_periods_read on public.business_accounting_periods for select to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, null));
grant select on public.business_accounting_periods to authenticated;

insert into public.business_accounting_periods (business_id, financial_year_id, period_start, period_end)
select fy.business_id, fy.id, greatest(gs::date, fy.start_date),
       least((gs + interval '1 month - 1 day')::date, fy.end_date)
from public.business_financial_years fy
cross join lateral generate_series(date_trunc('month', fy.start_date::timestamp),
                                   date_trunc('month', fy.end_date::timestamp), interval '1 month') gs
on conflict (business_id, period_start) do nothing;

create table public.business_chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  account_code text not null,
  account_name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','income','expense')),
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, account_code),
  unique (id, business_id)
);
create index business_chart_accounts_business_idx
  on public.business_chart_of_accounts (business_id, account_type);
alter table public.business_chart_of_accounts enable row level security;
create policy chart_accounts_read on public.business_chart_of_accounts for select to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, null));
create policy chart_accounts_insert on public.business_chart_of_accounts for insert to authenticated
  with check (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']));
create policy chart_accounts_update on public.business_chart_of_accounts for update to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']))
  with check (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']));
create policy chart_accounts_delete on public.business_chart_of_accounts for delete to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']));
grant select, insert, update, delete on public.business_chart_of_accounts to authenticated;

insert into public.business_chart_of_accounts (business_id, account_code, account_name, account_type, is_system)
select b.id, v.code, v.name, v.type, true
from public.businesses b
cross join (values
  ('1000','Cash','asset'), ('1010','Bank','asset'), ('1100','Accounts Receivable','asset'),
  ('1200','Inventory','asset'), ('1300','Input GST','asset'), ('2000','Accounts Payable','liability'),
  ('2100','Output GST','liability'), ('3000','Owner Capital','equity'), ('3100','Retained Earnings','equity'),
  ('4000','Sales Revenue','income'), ('5000','Cost of Goods Sold','expense'), ('5100','Operating Expenses','expense')
) v(code, name, type)
on conflict (business_id, account_code) do nothing;

create table public.business_opening_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  financial_year_id uuid not null references public.business_financial_years(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','posted')),
  effective_date date not null,
  posted_at timestamptz,
  posted_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check ((status = 'draft' and posted_at is null and posted_by is null)
      or (status = 'posted' and posted_at is not null and posted_by is not null)),
  unique (financial_year_id)
);
create table public.business_opening_balance_lines (
  id uuid primary key default gen_random_uuid(),
  opening_balance_id uuid not null references public.business_opening_balances(id) on delete cascade,
  business_id uuid not null,
  account_id uuid not null,
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  foreign key (account_id, business_id) references public.business_chart_of_accounts(id, business_id),
  unique (opening_balance_id, account_id)
);
create index opening_balance_lines_batch_idx on public.business_opening_balance_lines(opening_balance_id);
create index opening_balance_lines_account_business_idx on public.business_opening_balance_lines(account_id, business_id);
alter table public.business_opening_balances enable row level security;
alter table public.business_opening_balance_lines enable row level security;
create policy opening_balances_read on public.business_opening_balances for select to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']));
create policy opening_balances_insert on public.business_opening_balances for insert to authenticated
  with check (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']));
create policy opening_balances_delete on public.business_opening_balances for delete to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']));
create policy opening_lines_read on public.business_opening_balance_lines for select to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']));
create policy opening_lines_insert on public.business_opening_balance_lines for insert to authenticated
  with check (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']));
create policy opening_lines_update on public.business_opening_balance_lines for update to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']))
  with check (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']));
create policy opening_lines_delete on public.business_opening_balance_lines for delete to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner','admin','accountant']));
grant select, insert, delete on public.business_opening_balances to authenticated;
grant select, insert, update, delete on public.business_opening_balance_lines to authenticated;

create or replace function private.ledgerwise_post_opening_balance(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_business uuid; v_status text; v_debit numeric(18,2); v_credit numeric(18,2);
begin
  select business_id, status into v_business, v_status
    from public.business_opening_balances where id = p_id for update;
  if v_business is null then raise exception 'Opening balance not found'; end if;
  if not private.ledgerwise_user_can_access_business(v_business, array['owner','admin','accountant']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if v_status <> 'draft' then raise exception 'Only draft balances may be posted'; end if;
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into v_debit, v_credit
    from public.business_opening_balance_lines where opening_balance_id = p_id;
  if v_debit <= 0 or v_debit <> v_credit then
    raise exception 'Opening balance debits and credits must balance and be greater than zero';
  end if;
  if exists (select 1 from public.business_opening_balance_lines l
    join public.business_chart_of_accounts a on a.id=l.account_id and a.business_id=l.business_id
    where l.opening_balance_id=p_id and (l.business_id<>v_business or not a.is_active)) then
    raise exception 'Invalid account in opening balance';
  end if;
  update public.business_opening_balances set status='posted', posted_at=now(), posted_by=auth.uid() where id=p_id;
end;
$$;
revoke all on function private.ledgerwise_post_opening_balance(uuid) from public, anon, authenticated;
grant execute on function private.ledgerwise_post_opening_balance(uuid) to authenticated;
create or replace function public.post_opening_balance(p_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.ledgerwise_post_opening_balance(p_id); $$;
revoke all on function public.post_opening_balance(uuid) from public, anon;
grant execute on function public.post_opening_balance(uuid) to authenticated;

create or replace function private.ledgerwise_lock_accounting_period(p_id uuid, p_lock boolean)
returns void language plpgsql security definer set search_path = ''
as $$ declare v_business uuid;
begin
  select business_id into v_business from public.business_accounting_periods where id=p_id for update;
  if v_business is null then raise exception 'Period not found'; end if;
  if not private.ledgerwise_user_can_access_business(v_business,
    case when p_lock then array['owner','admin','accountant'] else array['owner','admin'] end) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  update public.business_accounting_periods
  set status=case when p_lock then 'locked' else 'open' end,
      locked_at=case when p_lock then now() else null end,
      locked_by=case when p_lock then auth.uid() else null end
  where id=p_id;
end;
$$;
revoke all on function private.ledgerwise_lock_accounting_period(uuid,boolean) from public, anon, authenticated;
grant execute on function private.ledgerwise_lock_accounting_period(uuid,boolean) to authenticated;
create or replace function public.set_accounting_period_lock(p_id uuid, p_lock boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.ledgerwise_lock_accounting_period(p_id,p_lock); $$;
revoke all on function public.set_accounting_period_lock(uuid,boolean) from public, anon;
grant execute on function public.set_accounting_period_lock(uuid,boolean) to authenticated;
