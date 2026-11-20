-- Read-only check that migrations 01 and 02 are present.
-- Run in Supabase SQL Editor after both migrations complete.

with expected_tables(table_name) as (
  values
    ('business_financial_years'),
    ('business_gst_registrations'),
    ('audit_events')
), table_state as (
  select e.table_name,
         c.oid is not null as exists,
         coalesce(c.relrowsecurity, false) as rls_enabled,
         coalesce(c.relforcerowsecurity, false) as rls_forced
  from expected_tables e
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class c on c.relnamespace = n.oid
    and c.relname = e.table_name and c.relkind = 'r'
), policy_state as (
  select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'business_financial_years', 'business_gst_registrations', 'audit_events'
    )
), trigger_state as (
  select event_object_table as table_name, trigger_name, action_timing, event_manipulation
  from information_schema.triggers
  where trigger_schema = 'public'
    and trigger_name like 'ledgerwise_audit_%'
), private_functions as (
  select p.proname as function_name,
         p.prosecdef as security_definer,
         p.proconfig as function_settings
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname in ('ledgerwise_user_can_access_business', 'ledgerwise_capture_audit_event')
)
select 'tables' as section,
       coalesce((select jsonb_agg(to_jsonb(x) order by x.table_name) from table_state x), '[]'::jsonb) as details
union all
select 'policies',
       coalesce((select jsonb_agg(to_jsonb(x) order by x.tablename, x.policyname) from policy_state x), '[]'::jsonb)
union all
select 'audit_triggers',
       coalesce((select jsonb_agg(to_jsonb(x) order by x.table_name, x.trigger_name, x.event_manipulation) from trigger_state x), '[]'::jsonb)
union all
select 'private_functions',
       coalesce((select jsonb_agg(to_jsonb(x) order by x.function_name) from private_functions x), '[]'::jsonb)
order by section;
