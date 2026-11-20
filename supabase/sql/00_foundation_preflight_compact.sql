-- Read-only foundation preflight that returns one result set with one row per section.
-- Run this in the Supabase SQL Editor and export/copy the result grid as JSON if needed.

with wanted(table_name) as (
  values
    ('businesses'), ('business_members'), ('parties'), ('products'),
    ('invoice_counters'), ('invoices'), ('invoice_lines'), ('payments'),
    ('inventory_movements'), ('purchases'), ('purchase_lines'), ('expenses')
),
table_security as (
  select c.relname as table_name,
         c.relrowsecurity as rls_enabled,
         c.relforcerowsecurity as rls_forced,
         coalesce(s.n_live_tup, 0) as estimated_rows
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join wanted w on w.table_name = c.relname
  left join pg_stat_user_tables s on s.relid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'
),
policies as (
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public' and tablename in (select table_name from wanted)
),
constraints as (
  select t.relname as table_name,
         con.conname as constraint_name,
         con.contype as constraint_type,
         pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class t on t.oid = con.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname in (select table_name from wanted)
),
indexes as (
  select tablename, indexname, indexdef
  from pg_indexes
  where schemaname = 'public' and tablename in (select table_name from wanted)
),
app_functions as (
  select p.oid::regprocedure::text as function_signature,
         p.prosecdef as security_definer,
         p.proconfig as function_settings,
         pg_get_functiondef(p.oid) as function_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'create_business', 'create_sales_invoice', 'create_purchase', 'adjust_inventory',
      'record_payment', 'record_purchase_payment'
    )
),
consistency as (
  select jsonb_build_object(
    'payments_with_zero_or_two_targets',
      (select count(*) from public.payments p
       where (p.invoice_id is null) = (p.purchase_id is null)),
    'payments_crossing_invoice_business',
      (select count(*) from public.payments p
       join public.invoices i on i.id = p.invoice_id
       where p.business_id <> i.business_id),
    'payments_crossing_purchase_business',
      (select count(*) from public.payments p
       join public.purchases pu on pu.id = p.purchase_id
       where p.business_id <> pu.business_id),
    'invoices_crossing_party_business',
      (select count(*) from public.invoices i
       join public.parties pa on pa.id = i.party_id
       where i.business_id <> pa.business_id),
    'purchases_crossing_party_business',
      (select count(*) from public.purchases pu
       join public.parties pa on pa.id = pu.party_id
       where pu.business_id <> pa.business_id),
    'invoice_lines_crossing_product_business',
      (select count(*) from public.invoice_lines il
       join public.invoices i on i.id = il.invoice_id
       join public.products pr on pr.id = il.product_id
       where i.business_id <> pr.business_id),
    'purchase_lines_crossing_product_business',
      (select count(*) from public.purchase_lines pl
       join public.purchases pu on pu.id = pl.purchase_id
       join public.products pr on pr.id = pl.product_id
       where pu.business_id <> pr.business_id),
    'duplicate_invoice_number_groups',
      (select count(*) from (
         select business_id, invoice_number from public.invoices
         group by business_id, invoice_number having count(*) > 1
       ) d),
    'duplicate_purchase_bill_number_groups',
      (select count(*) from (
         select business_id, bill_number from public.purchases
         group by business_id, bill_number having count(*) > 1
       ) d)
  ) as details
),
member_roles as (
  select role, count(*) as member_count
  from public.business_members
  group by role
),
gst_summary as (
  select jsonb_build_object(
    'businesses_with_gstin', count(*) filter (where nullif(btrim(gstin), '') is not null),
    'gstin_values_needing_review', count(*) filter (
      where nullif(btrim(gstin), '') is not null
        and upper(btrim(gstin)) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
    ),
    'gst_state_values_needing_review', count(*) filter (
      where nullif(btrim(gstin), '') is not null
        and coalesce(nullif(btrim(state_code), ''), substring(upper(btrim(gstin)) from 1 for 2)) !~ '^[0-9]{2}$'
    )
  ) as details
  from public.businesses
)
select 'table_security' as section,
       coalesce((select jsonb_agg(to_jsonb(x) order by x.table_name) from table_security x), '[]'::jsonb) as details
union all
select 'rls_policies',
       coalesce((select jsonb_agg(to_jsonb(x) order by x.tablename, x.policyname) from policies x), '[]'::jsonb)
union all
select 'constraints',
       coalesce((select jsonb_agg(to_jsonb(x) order by x.table_name, x.constraint_name) from constraints x), '[]'::jsonb)
union all
select 'indexes',
       coalesce((select jsonb_agg(to_jsonb(x) order by x.tablename, x.indexname) from indexes x), '[]'::jsonb)
union all
select 'application_rpc_definitions',
       coalesce((select jsonb_agg(to_jsonb(x) order by x.function_signature) from app_functions x), '[]'::jsonb)
union all
select 'data_consistency_counts', (select details from consistency)
union all
select 'membership_roles',
       coalesce((select jsonb_agg(to_jsonb(x) order by x.role) from member_roles x), '[]'::jsonb)
union all
select 'gst_profile_format_counts', (select details from gst_summary)
order by section;
