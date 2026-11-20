-- Retry-safe overloads for financial and inventory RPCs.
-- The unique claim and resource ID are committed atomically with each transaction.

create table private.idempotency_requests (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  idempotency_key uuid not null,
  payload_hash bytea not null,
  resource_id uuid,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id, operation, idempotency_key)
);
revoke all on private.idempotency_requests from public, anon, authenticated;

create or replace function private.ledgerwise_idempotency_claim(
  p_business uuid, p_operation text, p_key uuid, p_payload jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_hash bytea; v_old_hash bytea; v_resource uuid; v_rows integer;
begin
  if auth.uid() is null or not private.ledgerwise_user_can_access_business(p_business, null) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_key is null then raise exception 'Idempotency key is required'; end if;
  v_hash := extensions.digest(convert_to(p_payload::text, 'UTF8'), 'sha256');
  insert into private.idempotency_requests(business_id,user_id,operation,idempotency_key,payload_hash)
  values (p_business,auth.uid(),p_operation,p_key,v_hash) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then return null; end if;
  select payload_hash,resource_id into v_old_hash,v_resource
  from private.idempotency_requests
  where business_id=p_business and user_id=auth.uid() and operation=p_operation and idempotency_key=p_key
  for update;
  if v_old_hash is distinct from v_hash then
    raise exception 'Idempotency key was already used with different transaction data' using errcode='22000';
  end if;
  if v_resource is null then raise exception 'Transaction with this key is still processing; retry shortly' using errcode='40001'; end if;
  return v_resource;
end;
$$;
revoke all on function private.ledgerwise_idempotency_claim(uuid,text,uuid,jsonb) from public,anon,authenticated;

create or replace function private.ledgerwise_idempotency_complete(p_business uuid,p_operation text,p_key uuid,p_resource uuid)
returns void language sql security definer set search_path = ''
as $$ update private.idempotency_requests set resource_id=p_resource
where business_id=p_business and user_id=auth.uid() and operation=p_operation and idempotency_key=p_key and resource_id is null; $$;
revoke all on function private.ledgerwise_idempotency_complete(uuid,text,uuid,uuid) from public,anon,authenticated;

create or replace function private.ledgerwise_create_sales_invoice_idempotent(p_business uuid,p_party uuid,p_date date,p_due date,p_notes text,p_items jsonb,p_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_old uuid;
begin
  v_old:=private.ledgerwise_idempotency_claim(p_business,'create_sales_invoice',p_key,jsonb_build_object('party_id',p_party,'invoice_date',p_date,'due_date',p_due,'notes',p_notes,'items',p_items));
  if v_old is not null then return v_old; end if;
  v_id:=public.create_sales_invoice(p_business,p_party,p_date,p_due,p_notes,p_items);
  perform private.ledgerwise_idempotency_complete(p_business,'create_sales_invoice',p_key,v_id);
  return v_id;
end $$;
create or replace function public.create_sales_invoice(p_business_id uuid,p_party_id uuid,p_invoice_date date,p_due_date date,p_notes text,p_items jsonb,p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.ledgerwise_create_sales_invoice_idempotent(p_business_id,p_party_id,p_invoice_date,p_due_date,p_notes,p_items,p_idempotency_key); $$;

create or replace function private.ledgerwise_create_purchase_idempotent(p_business uuid,p_party uuid,p_supplier_no text,p_date date,p_items jsonb,p_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_old uuid;
begin
  v_old:=private.ledgerwise_idempotency_claim(p_business,'create_purchase',p_key,jsonb_build_object('party_id',p_party,'supplier_invoice_number',p_supplier_no,'bill_date',p_date,'items',p_items));
  if v_old is not null then return v_old; end if;
  v_id:=public.create_purchase(p_business,p_party,p_supplier_no,p_date,p_items);
  perform private.ledgerwise_idempotency_complete(p_business,'create_purchase',p_key,v_id);
  return v_id;
end $$;
create or replace function public.create_purchase(p_business_id uuid,p_party_id uuid,p_supplier_invoice_number text,p_bill_date date,p_items jsonb,p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.ledgerwise_create_purchase_idempotent(p_business_id,p_party_id,p_supplier_invoice_number,p_bill_date,p_items,p_idempotency_key); $$;

create or replace function private.ledgerwise_adjust_inventory_idempotent(p_business uuid,p_product uuid,p_delta numeric,p_note text,p_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_old uuid;
begin
  v_old:=private.ledgerwise_idempotency_claim(p_business,'adjust_inventory',p_key,jsonb_build_object('product_id',p_product,'quantity_delta',p_delta,'note',p_note));
  if v_old is not null then return v_old; end if;
  v_id:=public.adjust_inventory(p_business,p_product,p_delta,p_note);
  perform private.ledgerwise_idempotency_complete(p_business,'adjust_inventory',p_key,v_id);
  return v_id;
end $$;
create or replace function public.adjust_inventory(p_business_id uuid,p_product_id uuid,p_quantity_delta numeric,p_note text,p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.ledgerwise_adjust_inventory_idempotent(p_business_id,p_product_id,p_quantity_delta,p_note,p_idempotency_key); $$;

create or replace function private.ledgerwise_record_payment_idempotent(p_business uuid,p_invoice uuid,p_amount numeric,p_method text,p_date date,p_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_old uuid;
begin
  v_old:=private.ledgerwise_idempotency_claim(p_business,'record_payment',p_key,jsonb_build_object('invoice_id',p_invoice,'amount',p_amount,'method',p_method,'payment_date',p_date));
  if v_old is not null then return v_old; end if;
  v_id:=public.record_payment(p_business,p_invoice,p_amount,p_method,p_date);
  perform private.ledgerwise_idempotency_complete(p_business,'record_payment',p_key,v_id);
  return v_id;
end $$;
create or replace function public.record_payment(p_business_id uuid,p_invoice_id uuid,p_amount numeric,p_method text,p_date date,p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.ledgerwise_record_payment_idempotent(p_business_id,p_invoice_id,p_amount,p_method,p_date,p_idempotency_key); $$;

create or replace function private.ledgerwise_record_purchase_payment_idempotent(p_business uuid,p_purchase uuid,p_amount numeric,p_method text,p_date date,p_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_old uuid;
begin
  v_old:=private.ledgerwise_idempotency_claim(p_business,'record_purchase_payment',p_key,jsonb_build_object('purchase_id',p_purchase,'amount',p_amount,'method',p_method,'payment_date',p_date));
  if v_old is not null then return v_old; end if;
  v_id:=public.record_purchase_payment(p_business,p_purchase,p_amount,p_method,p_date);
  perform private.ledgerwise_idempotency_complete(p_business,'record_purchase_payment',p_key,v_id);
  return v_id;
end $$;
create or replace function public.record_purchase_payment(p_business_id uuid,p_purchase_id uuid,p_amount numeric,p_method text,p_date date,p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.ledgerwise_record_purchase_payment_idempotent(p_business_id,p_purchase_id,p_amount,p_method,p_date,p_idempotency_key); $$;

revoke all on function private.ledgerwise_create_sales_invoice_idempotent(uuid,uuid,date,date,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.ledgerwise_create_purchase_idempotent(uuid,uuid,text,date,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.ledgerwise_adjust_inventory_idempotent(uuid,uuid,numeric,text,uuid) from public,anon,authenticated;
revoke all on function private.ledgerwise_record_payment_idempotent(uuid,uuid,numeric,text,date,uuid) from public,anon,authenticated;
revoke all on function private.ledgerwise_record_purchase_payment_idempotent(uuid,uuid,numeric,text,date,uuid) from public,anon,authenticated;
grant execute on function private.ledgerwise_create_sales_invoice_idempotent(uuid,uuid,date,date,text,jsonb,uuid) to authenticated;
grant execute on function private.ledgerwise_create_purchase_idempotent(uuid,uuid,text,date,jsonb,uuid) to authenticated;
grant execute on function private.ledgerwise_adjust_inventory_idempotent(uuid,uuid,numeric,text,uuid) to authenticated;
grant execute on function private.ledgerwise_record_payment_idempotent(uuid,uuid,numeric,text,date,uuid) to authenticated;
grant execute on function private.ledgerwise_record_purchase_payment_idempotent(uuid,uuid,numeric,text,date,uuid) to authenticated;
revoke all on function public.create_sales_invoice(uuid,uuid,date,date,text,jsonb,uuid) from public,anon;
revoke all on function public.create_purchase(uuid,uuid,text,date,jsonb,uuid) from public,anon;
revoke all on function public.adjust_inventory(uuid,uuid,numeric,text,uuid) from public,anon;
revoke all on function public.record_payment(uuid,uuid,numeric,text,date,uuid) from public,anon;
revoke all on function public.record_purchase_payment(uuid,uuid,numeric,text,date,uuid) from public,anon;
grant execute on function public.create_sales_invoice(uuid,uuid,date,date,text,jsonb,uuid) to authenticated;
grant execute on function public.create_purchase(uuid,uuid,text,date,jsonb,uuid) to authenticated;
grant execute on function public.adjust_inventory(uuid,uuid,numeric,text,uuid) to authenticated;
grant execute on function public.record_payment(uuid,uuid,numeric,text,date,uuid) to authenticated;
grant execute on function public.record_purchase_payment(uuid,uuid,numeric,text,date,uuid) to authenticated;
