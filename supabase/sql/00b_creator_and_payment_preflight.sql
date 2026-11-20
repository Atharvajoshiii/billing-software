-- Read-only follow-up for the business-creation helper and payment-party integrity.
-- Run this before the additive setup scripts; it returns four rows in one result set.

with creator as (
  select p.oid::regprocedure::text as signature,
         p.prosecdef as security_definer,
         p.proconfig as function_settings,
         pg_get_userbyid(p.proowner) as function_owner,
         p.proacl as function_acl,
         pg_get_functiondef(p.oid) as function_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'create_business_impl'
),
creator_acl as (
  select c.signature,
         case when a.grantee = 0 then 'PUBLIC' else grantee_role.rolname end as grantee,
         a.privilege_type,
         a.is_grantable
  from creator c
  join pg_proc p on p.oid::regprocedure::text = c.signature
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  left join pg_roles grantee_role on grantee_role.oid = a.grantee
),
public_rpc_acl as (
  select p.oid::regprocedure::text as signature,
         p.prosecdef as security_definer,
         case when a.grantee = 0 then 'PUBLIC' else grantee_role.rolname end as grantee,
         a.privilege_type,
         a.is_grantable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  left join pg_roles grantee_role on grantee_role.oid = a.grantee
  where n.nspname = 'public'
    and p.proname in (
      'create_business', 'create_sales_invoice', 'create_purchase', 'adjust_inventory',
      'record_payment', 'record_purchase_payment'
    )
),
payment_checks as (
  select jsonb_build_object(
    'payments_with_zero_or_two_document_targets',
      (select count(*) from public.payments p
       where (p.invoice_id is null) = (p.purchase_id is null)),
    'payments_whose_party_is_in_another_business',
      (select count(*) from public.payments p
       join public.parties pa on pa.id = p.party_id
       where p.business_id <> pa.business_id),
    'payment_party_composite_fk_exists',
      exists (
        select 1 from pg_constraint con
        join pg_class t on t.oid = con.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public' and t.relname = 'payments'
          and con.conname = 'payments_party_business_fk' and con.contype = 'f'
      ),
    'payment_target_check_definition',
      (select pg_get_constraintdef(con.oid)
       from pg_constraint con
       join pg_class t on t.oid = con.conrelid
       join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'public' and t.relname = 'payments'
         and con.conname = 'payments_one_document_check')
  ) as details
)
select 'private_business_creator' as section,
       coalesce((select jsonb_agg(to_jsonb(x)) from creator x), '[]'::jsonb) as details
union all
select 'private_business_creator_acl',
       coalesce((select jsonb_agg(to_jsonb(x) order by x.grantee, x.privilege_type) from creator_acl x), '[]'::jsonb)
union all
select 'public_rpc_execute_acl',
       coalesce((select jsonb_agg(to_jsonb(x) order by x.signature, x.grantee) from public_rpc_acl x), '[]'::jsonb)
union all
select 'payment_integrity', (select details from payment_checks)
order by section;
