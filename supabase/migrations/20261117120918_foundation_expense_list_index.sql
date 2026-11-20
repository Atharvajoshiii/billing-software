-- Match the expense listing's tenant filter and descending date order.
create index if not exists expenses_business_date_id_idx
  on public.expenses (business_id, expense_date desc, id);
