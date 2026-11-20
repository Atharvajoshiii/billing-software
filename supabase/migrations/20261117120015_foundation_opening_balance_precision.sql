-- Reject values with fractional paise before numeric(18,2) columns round them.
create or replace function private.ledgerwise_save_opening_balance_idempotent(
  p_business uuid,
  p_financial_year uuid,
  p_effective_date date,
  p_lines jsonb,
  p_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old uuid;
  v_batch uuid;
  v_fy_business uuid;
  v_fy_start date;
  v_fy_end date;
  v_debits numeric(18,2);
  v_credits numeric(18,2);
  v_payload jsonb;
begin
  if not private.ledgerwise_user_can_access_business(p_business, array['owner','admin','accountant']) then
    raise exception 'Finance role required' using errcode='42501';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one opening balance line';
  end if;
  select business_id, start_date, end_date
    into v_fy_business, v_fy_start, v_fy_end
    from public.business_financial_years where id = p_financial_year;
  if v_fy_business is distinct from p_business then
    raise exception 'Financial year does not belong to this business';
  end if;
  if p_effective_date not between v_fy_start and v_fy_end then
    raise exception 'Opening balance date must be within the financial year';
  end if;
  if not exists (
    select 1 from public.business_accounting_periods
    where business_id = p_business and p_effective_date between period_start and period_end and status = 'open'
  ) then
    raise exception 'Opening balance date must be in an open accounting period';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) as x(account_id uuid, debit numeric, credit numeric)
    where account_id is null or debit is null or credit is null
      or debit < 0 or credit < 0
      or debit <> round(debit, 2) or credit <> round(credit, 2)
      or not ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
  ) then
    raise exception 'Each opening balance line must have a positive debit or credit with at most two decimal places, not both';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) as x(account_id uuid, debit numeric, credit numeric)
    left join public.business_chart_of_accounts a on a.id = x.account_id and a.business_id = p_business
    where a.id is null or not a.is_active
  ) then
    raise exception 'Opening balance contains an unavailable account';
  end if;
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_debits, v_credits
    from jsonb_to_recordset(p_lines) as x(account_id uuid, debit numeric, credit numeric);
  if v_debits <= 0 or v_debits <> v_credits then
    raise exception 'Opening balance debits and credits must balance and be greater than zero';
  end if;
  v_payload := jsonb_build_object('financial_year_id', p_financial_year, 'effective_date', p_effective_date, 'lines', p_lines);
  v_old := private.ledgerwise_idempotency_claim(p_business, 'save_opening_balance', p_key, v_payload);
  if v_old is not null then return v_old; end if;
  insert into public.business_opening_balances(business_id, financial_year_id, effective_date)
    values (p_business, p_financial_year, p_effective_date) returning id into v_batch;
  insert into public.business_opening_balance_lines(opening_balance_id, business_id, account_id, debit, credit)
    select v_batch, p_business, x.account_id, x.debit, x.credit
    from jsonb_to_recordset(p_lines) as x(account_id uuid, debit numeric, credit numeric);
  update public.business_opening_balances
    set status = 'posted', posted_at = now(), posted_by = auth.uid()
    where id = v_batch;
  perform private.ledgerwise_idempotency_complete(p_business, 'save_opening_balance', p_key, v_batch);
  return v_batch;
end
$function$;
