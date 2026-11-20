-- Additive Ledgerwise setup for financial years and GST registrations.
-- Run only after reviewing 00_foundation_preflight.sql.
-- This script does not alter or delete existing transaction data.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.ledgerwise_user_can_access_business(
  p_business_id uuid,
  p_allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when (select auth.uid()) is null then false
    else exists (
      select 1
      from public.business_members as bm
      where bm.business_id = p_business_id
        and bm.user_id = (select auth.uid())
        and (p_allowed_roles is null or bm.role = any (p_allowed_roles))
    )
  end;
$function$;

revoke all on function private.ledgerwise_user_can_access_business(uuid, text[])
  from public, anon, authenticated;
grant execute on function private.ledgerwise_user_can_access_business(uuid, text[])
  to authenticated;

create or replace function private.ledgerwise_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.ledgerwise_touch_updated_at() from public, anon;
grant execute on function private.ledgerwise_touch_updated_at() to authenticated;

create table if not exists public.business_financial_years (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_financial_years_dates_check check (end_date >= start_date),
  constraint business_financial_years_name_unique unique (business_id, name),
  constraint business_financial_years_start_unique unique (business_id, start_date)
);

create unique index if not exists business_financial_years_one_current_per_business
  on public.business_financial_years (business_id)
  where is_current;

create index if not exists business_financial_years_business_dates_idx
  on public.business_financial_years (business_id, start_date desc);

create table if not exists public.business_gst_registrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  gstin text not null,
  state_code text not null,
  registration_type text not null default 'regular'
    check (registration_type in (
      'regular', 'composition', 'casual', 'sez_unit', 'sez_developer',
      'isd', 'tds_deductor', 'tcs_collector', 'non_resident'
    )),
  legal_name text,
  trade_name text,
  address text,
  effective_from date,
  effective_to date,
  return_frequency text not null default 'monthly'
    check (return_frequency in ('monthly', 'quarterly')),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_gst_registrations_gstin_format_check
    check (gstin = upper(gstin) and gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  constraint business_gst_registrations_state_code_check check (state_code ~ '^[0-9]{2}$'),
  constraint business_gst_registrations_state_matches_gstin_check
    check (state_code = substring(gstin from 1 for 2)),
  constraint business_gst_registrations_dates_check
    check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint business_gst_registrations_business_gstin_unique unique (business_id, gstin)
);

create unique index if not exists business_gst_registrations_one_primary_per_business
  on public.business_gst_registrations (business_id)
  where is_primary;

create index if not exists business_gst_registrations_business_active_idx
  on public.business_gst_registrations (business_id, is_active, state_code);

-- Backfill one current financial year per existing business using April–March.
-- Existing years and businesses that already have a current year are untouched.
with india_today as (
  select (now() at time zone 'Asia/Kolkata')::date as local_date
), bounds as (
  select case when extract(month from local_date) < 4
    then make_date(extract(year from local_date)::integer - 1, 4, 1)
    else make_date(extract(year from local_date)::integer, 4, 1)
  end as fy_start
  from india_today
), year_values as (
  select fy_start, (fy_start + interval '1 year' - interval '1 day')::date as fy_end
  from bounds
)
insert into public.business_financial_years (
  business_id, name, start_date, end_date, is_current, created_by
)
select b.id,
       to_char(y.fy_start, 'YYYY') || '-' || to_char(y.fy_end, 'YY'),
       y.fy_start, y.fy_end, true, b.owner_user_id
from public.businesses as b
cross join year_values as y
where not exists (
  select 1 from public.business_financial_years as fy
  where fy.business_id = b.id and fy.is_current
)
on conflict (business_id, start_date) do nothing;

-- Copy only valid existing GSTIN values. Invalid values are left for review.
insert into public.business_gst_registrations (
  business_id, gstin, state_code, registration_type, legal_name, address,
  is_primary, created_by
)
select b.id,
       upper(btrim(b.gstin)),
       coalesce(nullif(btrim(b.state_code), ''), substring(upper(btrim(b.gstin)) from 1 for 2)),
       'regular', b.name, b.address, true, b.owner_user_id
from public.businesses as b
where nullif(btrim(b.gstin), '') is not null
  and upper(btrim(b.gstin)) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  and coalesce(nullif(btrim(b.state_code), ''), substring(upper(btrim(b.gstin)) from 1 for 2)) ~ '^[0-9]{2}$'
  and not exists (
    select 1 from public.business_gst_registrations as r
    where r.business_id = b.id and r.is_primary
  )
on conflict (business_id, gstin) do nothing;

alter table public.business_financial_years enable row level security;
alter table public.business_gst_registrations enable row level security;

revoke all on table public.business_financial_years from anon, authenticated;
revoke all on table public.business_gst_registrations from anon, authenticated;
grant select, insert, update on table public.business_financial_years to authenticated;
grant select, insert, update on table public.business_gst_registrations to authenticated;

drop policy if exists business_financial_years_select on public.business_financial_years;
create policy business_financial_years_select
  on public.business_financial_years for select to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, null));

drop policy if exists business_financial_years_insert on public.business_financial_years;
create policy business_financial_years_insert
  on public.business_financial_years for insert to authenticated
  with check (private.ledgerwise_user_can_access_business(business_id, array['owner', 'admin', 'accountant']::text[]));

drop policy if exists business_financial_years_update on public.business_financial_years;
create policy business_financial_years_update
  on public.business_financial_years for update to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner', 'admin', 'accountant']::text[]))
  with check (private.ledgerwise_user_can_access_business(business_id, array['owner', 'admin', 'accountant']::text[]));

drop policy if exists business_gst_registrations_select on public.business_gst_registrations;
create policy business_gst_registrations_select
  on public.business_gst_registrations for select to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, null));

drop policy if exists business_gst_registrations_insert on public.business_gst_registrations;
create policy business_gst_registrations_insert
  on public.business_gst_registrations for insert to authenticated
  with check (private.ledgerwise_user_can_access_business(business_id, array['owner', 'admin', 'accountant']::text[]));

drop policy if exists business_gst_registrations_update on public.business_gst_registrations;
create policy business_gst_registrations_update
  on public.business_gst_registrations for update to authenticated
  using (private.ledgerwise_user_can_access_business(business_id, array['owner', 'admin', 'accountant']::text[]))
  with check (private.ledgerwise_user_can_access_business(business_id, array['owner', 'admin', 'accountant']::text[]));

drop trigger if exists ledgerwise_financial_years_updated_at on public.business_financial_years;
create trigger ledgerwise_financial_years_updated_at
  before update on public.business_financial_years
  for each row execute function private.ledgerwise_touch_updated_at();

drop trigger if exists ledgerwise_gst_registrations_updated_at on public.business_gst_registrations;
create trigger ledgerwise_gst_registrations_updated_at
  before update on public.business_gst_registrations
  for each row execute function private.ledgerwise_touch_updated_at();

commit;
