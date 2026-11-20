-- Read-only inspection before adding Ledgerwise foundation tables.
-- Run this first in the Supabase SQL Editor. It does not change the database.

-- 1. RLS state and table size for the tables shown in the pasted schema.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       coalesce(s.n_live_tup, 0) as estimated_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'businesses', 'business_members', 'parties', 'products', 'invoice_counters',
    'invoices', 'invoice_lines', 'payments', 'inventory_movements', 'purchases',
    'purchase_lines', 'expenses'
  )
order by c.relname;

-- 2. Existing policies: review before changing tenant access rules.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'businesses', 'business_members', 'parties', 'products', 'invoice_counters',
    'invoices', 'invoice_lines', 'payments', 'inventory_movements', 'purchases',
    'purchase_lines', 'expenses'
  )
order by tablename, policyname;

-- 3. Constraints and indexes on the current business tables.
select t.relname as table_name,
       con.conname as constraint_name,
       con.contype as constraint_type,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class t on t.oid = con.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in (
    'businesses', 'business_members', 'parties', 'products', 'invoice_counters',
    'invoices', 'invoice_lines', 'payments', 'inventory_movements', 'purchases',
    'purchase_lines', 'expenses'
  )
order by t.relname, con.conname;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'businesses', 'business_members', 'parties', 'products', 'invoice_counters',
    'invoices', 'invoice_lines', 'payments', 'inventory_movements', 'purchases',
    'purchase_lines', 'expenses'
  )
order by tablename, indexname;

-- 4. Installed application RPCs and their security mode.
-- Function bodies are included to review transaction, authorization, and numbering logic.
select p.oid::regprocedure as function_signature,
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
order by p.proname, p.oid::regprocedure::text;

-- 5. Aggregate consistency checks. These return counts only, not customer data.
select
  (select count(*) from public.payments p
   where (p.invoice_id is null) = (p.purchase_id is null)) as payments_with_zero_or_two_targets,
  (select count(*) from public.payments p
   join public.invoices i on i.id = p.invoice_id
   where p.business_id <> i.business_id) as payments_crossing_invoice_business,
  (select count(*) from public.payments p
   join public.purchases pu on pu.id = p.purchase_id
   where p.business_id <> pu.business_id) as payments_crossing_purchase_business,
  (select count(*) from public.invoices i
   join public.parties pa on pa.id = i.party_id
   where i.business_id <> pa.business_id) as invoices_crossing_party_business,
  (select count(*) from public.purchases pu
   join public.parties pa on pa.id = pu.party_id
   where pu.business_id <> pa.business_id) as purchases_crossing_party_business,
  (select count(*) from public.invoice_lines il
   join public.invoices i on i.id = il.invoice_id
   join public.products pr on pr.id = il.product_id
   where i.business_id <> pr.business_id) as invoice_lines_crossing_product_business,
  (select count(*) from public.purchase_lines pl
   join public.purchases pu on pu.id = pl.purchase_id
   join public.products pr on pr.id = pl.product_id
   where pu.business_id <> pr.business_id) as purchase_lines_crossing_product_business;

-- 6. Role values and GSTIN format counts for existing business rows.
select role, count(*) as member_count
from public.business_members
group by role
order by role;

select
  count(*) filter (where nullif(btrim(gstin), '') is not null) as businesses_with_gstin,
  count(*) filter (
    where nullif(btrim(gstin), '') is not null
      and upper(btrim(gstin)) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  ) as gstin_values_needing_review,
  count(*) filter (
    where nullif(btrim(gstin), '') is not null
      and coalesce(nullif(btrim(state_code), ''), substring(upper(btrim(gstin)) from 1 for 2)) !~ '^[0-9]{2}$'
  ) as gst_state_values_needing_review
from public.businesses;
