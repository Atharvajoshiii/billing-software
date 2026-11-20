-- Read-only, compact diagnostics before tightening existing roles and payments.
-- Export the result as CSV and share it before running a mutating migration.

with target_counts as (
  select
    (select count(*) from public.payments p
     where (p.invoice_id is null) = (p.purchase_id is null)) as invalid_document_target_count,
    (select count(*) from public.payments p
     join public.parties pa on pa.id = p.party_id
     where p.business_id <> pa.business_id) as cross_business_party_count
), payment_constraint as (
  select pg_get_constraintdef(c.oid) as definition
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname = 'payments'
    and c.conname = 'payments_one_document_check'
), creator as (
  select p.oid, p.oid::regprocedure::text as signature,
         p.prosecdef, p.proconfig, pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'create_business_impl'
), rpcs as (
  select p.oid, p.oid::regprocedure::text as signature,
         p.prosecdef, p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname = 'private' and p.proname = 'create_business_impl')
     or (n.nspname = 'public' and p.proname in (
       'create_business', 'create_sales_invoice', 'create_purchase',
       'adjust_inventory', 'record_payment', 'record_purchase_payment'
     ))
), rpc_grants as (
  select r.signature, r.prosecdef, r.proconfig,
         case when a.grantee = 0 then 'PUBLIC' else roles.rolname end as grantee,
         a.privilege_type, a.is_grantable
  from rpcs r
  join pg_proc p on p.oid = r.oid
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  left join pg_roles roles on roles.oid = a.grantee
)
select 'payment_counts'::text as section,
       'payments'::text as object_name,
       'invalid_targets; cross_business_party_links'::text as property,
       format('%s; %s', invalid_document_target_count, cross_business_party_count) as value
from target_counts
union all
select 'payment_constraint', 'payments', 'one_document_check', coalesce(definition, 'MISSING')
from (select true) seed
left join payment_constraint on true
union all
select 'payment_party_fk', 'payments', 'composite_business_party_fk',
       case when exists (
         select 1 from pg_constraint c
         join pg_class t on t.oid = c.conrelid
         join pg_namespace n on n.oid = t.relnamespace
         where n.nspname = 'public' and t.relname = 'payments'
           and c.conname = 'payments_party_business_fk' and c.contype = 'f'
       ) then 'present' else 'missing' end
union all
select 'business_creator', signature, 'security_and_definition',
       format('security_definer=%s; settings=%s; definition=%s', prosecdef, coalesce(proconfig::text, '[]'), definition)
from creator
union all
select 'rpc_grant', signature,
       format('execute_grantee=%s; grantable=%s', grantee, is_grantable),
       format('security_definer=%s; settings=%s; privilege=%s', prosecdef, coalesce(proconfig::text, '[]'), privilege_type)
from rpc_grants
where privilege_type = 'EXECUTE'
order by section, object_name, property;
