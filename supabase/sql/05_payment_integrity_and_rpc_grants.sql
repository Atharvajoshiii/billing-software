-- Tighten payment/document links and remove anonymous execution from
-- authenticated business RPCs. Existing data is checked before constraints change.

begin;

do $preflight$
begin
  if exists (
    select 1
    from public.payments p
    where (p.invoice_id is null) = (p.purchase_id is null)
  ) then
    raise exception 'Payment integrity check failed: a payment has zero or two document targets';
  end if;

  if exists (
    select 1
    from public.payments p
    join public.parties pa on pa.id = p.party_id
    where p.business_id <> pa.business_id
  ) then
    raise exception 'Payment integrity check failed: a payment party belongs to another business';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'parties'
      and c.contype = 'u' and pg_get_constraintdef(c.oid) = 'UNIQUE (id, business_id)'
  ) and not exists (
    select 1
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'parties'
      and i.indisunique and pg_get_indexdef(i.indexrelid) like '%(id, business_id)%'
  ) then
    raise exception 'Cannot add payment party link: parties(id, business_id) is not unique';
  end if;
end;
$preflight$;

-- Require exactly one target: either an invoice or a purchase, never neither/both.
alter table public.payments
  drop constraint if exists payments_one_document_check;

alter table public.payments
  add constraint payments_one_document_check
  check ((invoice_id is null) <> (purchase_id is null));

-- Ensure any selected party belongs to the same business as the payment.
do $add_party_fk$
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.payments'::regclass
      and c.conname = 'payments_party_business_fk'
  ) then
    alter table public.payments
      add constraint payments_party_business_fk
      foreign key (party_id, business_id)
      references public.parties (id, business_id)
      on update cascade
      on delete restrict
      not valid;
  end if;
end;
$add_party_fk$;

alter table public.payments
  validate constraint payments_party_business_fk;

-- These functions perform their own authentication checks. Keep them available
-- to signed-in users and the trusted backend, but remove default PUBLIC/anon access.
revoke execute on function public.create_sales_invoice(uuid, uuid, date, date, text, jsonb)
  from public, anon;
grant execute on function public.create_sales_invoice(uuid, uuid, date, date, text, jsonb)
  to authenticated, service_role;

revoke execute on function public.create_purchase(uuid, uuid, text, date, jsonb)
  from public, anon;
grant execute on function public.create_purchase(uuid, uuid, text, date, jsonb)
  to authenticated, service_role;

revoke execute on function public.record_payment(uuid, uuid, numeric, text, date)
  from public, anon;
grant execute on function public.record_payment(uuid, uuid, numeric, text, date)
  to authenticated, service_role;

commit;
