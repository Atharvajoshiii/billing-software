-- Append-only audit history for core Ledgerwise business records.
-- Run after 01_financial_years_and_gst_registrations.sql.
-- The trigger writes history in the same transaction as the underlying change.

begin;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  entity_key text not null,
  old_record jsonb,
  new_record jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_events_business_time_idx
  on public.audit_events (business_id, occurred_at desc);

create index if not exists audit_events_entity_time_idx
  on public.audit_events (business_id, table_name, entity_key, occurred_at desc);

alter table public.audit_events enable row level security;
revoke all on table public.audit_events from anon, authenticated;
grant select on table public.audit_events to authenticated;

drop policy if exists audit_events_read_finance_roles on public.audit_events;
create policy audit_events_read_finance_roles
  on public.audit_events for select to authenticated
  using (
    private.ledgerwise_user_can_access_business(
      business_id,
      array['owner', 'admin', 'accountant']::text[]
    )
  );

create or replace function private.ledgerwise_capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_business_id uuid;
  v_entity_key text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new);
  end if;
  v_row := coalesce(v_new, v_old);

  if coalesce(v_new->>'business_id', v_old->>'business_id') is not null then
    v_business_id := coalesce(v_new->>'business_id', v_old->>'business_id')::uuid;
  elsif tg_table_name = 'businesses' then
    v_business_id := coalesce(v_new->>'id', v_old->>'id')::uuid;
  elsif tg_table_name = 'invoice_lines' then
    select i.business_id into v_business_id
    from public.invoices as i
    where i.id = coalesce(v_new->>'invoice_id', v_old->>'invoice_id')::uuid;
  elsif tg_table_name = 'purchase_lines' then
    select p.business_id into v_business_id
    from public.purchases as p
    where p.id = coalesce(v_new->>'purchase_id', v_old->>'purchase_id')::uuid;
  end if;

  -- A cascaded child deletion may run after its parent is no longer visible.
  -- Skip that child event rather than write an audit row without a tenant key.
  if v_business_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- A business deletion cascades to its children. There is no surviving tenant
  -- row to satisfy audit_events.business_id for those events, so skip them.
  if not exists (
    select 1 from public.businesses as b where b.id = v_business_id
  ) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  v_entity_key := coalesce(
    v_row->>'id',
    concat_ws(':', v_row->>'business_id', v_row->>'financial_year')
  );

  insert into public.audit_events (
    business_id, actor_user_id, operation, table_name, entity_key, old_record, new_record
  ) values (
    v_business_id,
    (select auth.uid()),
    tg_op,
    tg_table_name,
    coalesce(v_entity_key, 'unknown'),
    v_old,
    v_new
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;

revoke all on function private.ledgerwise_capture_audit_event() from public, anon, authenticated;

-- Replace only these Ledgerwise audit triggers; other table triggers are preserved.
drop trigger if exists ledgerwise_audit_businesses on public.businesses;
create trigger ledgerwise_audit_businesses after insert or update or delete on public.businesses
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_business_members on public.business_members;
create trigger ledgerwise_audit_business_members after insert or update or delete on public.business_members
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_parties on public.parties;
create trigger ledgerwise_audit_parties after insert or update or delete on public.parties
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_products on public.products;
create trigger ledgerwise_audit_products after insert or update or delete on public.products
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_invoice_counters on public.invoice_counters;
create trigger ledgerwise_audit_invoice_counters after insert or update or delete on public.invoice_counters
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_invoices on public.invoices;
create trigger ledgerwise_audit_invoices after insert or update or delete on public.invoices
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_invoice_lines on public.invoice_lines;
create trigger ledgerwise_audit_invoice_lines after insert or update or delete on public.invoice_lines
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_payments on public.payments;
create trigger ledgerwise_audit_payments after insert or update or delete on public.payments
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_inventory_movements on public.inventory_movements;
create trigger ledgerwise_audit_inventory_movements after insert or update or delete on public.inventory_movements
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_purchases on public.purchases;
create trigger ledgerwise_audit_purchases after insert or update or delete on public.purchases
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_purchase_lines on public.purchase_lines;
create trigger ledgerwise_audit_purchase_lines after insert or update or delete on public.purchase_lines
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_expenses on public.expenses;
create trigger ledgerwise_audit_expenses after insert or update or delete on public.expenses
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_financial_years on public.business_financial_years;
create trigger ledgerwise_audit_financial_years after insert or update or delete on public.business_financial_years
  for each row execute function private.ledgerwise_capture_audit_event();

drop trigger if exists ledgerwise_audit_gst_registrations on public.business_gst_registrations;
create trigger ledgerwise_audit_gst_registrations after insert or update or delete on public.business_gst_registrations
  for each row execute function private.ledgerwise_capture_audit_event();

commit;
