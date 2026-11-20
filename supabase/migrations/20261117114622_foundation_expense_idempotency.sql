-- Make expense insertion atomic with its idempotency record.
create or replace function private.ledgerwise_create_expense_idempotent(
  p_business uuid, p_description text, p_category text, p_amount numeric,
  p_gst_amount numeric, p_date date, p_method text, p_key uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_old uuid; v_id uuid; v_payload jsonb;
begin
  if not private.ledgerwise_user_can_access_business(p_business, array['owner','admin','accountant']) then
    raise exception 'Finance role required' using errcode='42501';
  end if;
  if nullif(btrim(p_description),'') is null then raise exception 'Expense description is required'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Expense amount must be greater than zero'; end if;
  if p_gst_amount is null or p_gst_amount<0 then raise exception 'GST amount cannot be negative'; end if;
  if p_date is null then raise exception 'Expense date is required'; end if;
  v_payload:=jsonb_build_object('description',p_description,'category',p_category,'amount',p_amount,
    'gst_amount',p_gst_amount,'expense_date',p_date,'payment_method',p_method);
  v_old:=private.ledgerwise_idempotency_claim(p_business,'create_expense',p_key,v_payload);
  if v_old is not null then return v_old; end if;
  insert into public.expenses(business_id,description,category,amount,gst_amount,expense_date,payment_method)
  values(p_business,btrim(p_description),coalesce(nullif(btrim(p_category),''),'General'),p_amount,p_gst_amount,p_date,coalesce(nullif(p_method,''),'cash'))
  returning id into v_id;
  perform private.ledgerwise_idempotency_complete(p_business,'create_expense',p_key,v_id);
  return v_id;
end;
$$;
revoke all on function private.ledgerwise_create_expense_idempotent(uuid,text,text,numeric,numeric,date,text,uuid) from public,anon,authenticated;
grant execute on function private.ledgerwise_create_expense_idempotent(uuid,text,text,numeric,numeric,date,text,uuid) to authenticated;
create or replace function public.create_expense(p_business_id uuid,p_description text,p_category text,p_amount numeric,p_gst_amount numeric,p_expense_date date,p_payment_method text,p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.ledgerwise_create_expense_idempotent(p_business_id,p_description,p_category,p_amount,p_gst_amount,p_expense_date,p_payment_method,p_idempotency_key); $$;
revoke all on function public.create_expense(uuid,text,text,numeric,numeric,date,text,uuid) from public,anon;
grant execute on function public.create_expense(uuid,text,text,numeric,numeric,date,text,uuid) to authenticated;
revoke insert on public.expenses from authenticated;
