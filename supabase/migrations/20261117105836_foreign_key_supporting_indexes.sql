-- Cover the foreign keys flagged by Supabase's performance advisor.
-- These indexes support referential checks and deletion/update lookups.

create index if not exists audit_events_actor_user_id_idx
  on public.audit_events (actor_user_id);

create index if not exists business_financial_years_created_by_idx
  on public.business_financial_years (created_by);

create index if not exists business_gst_registrations_created_by_idx
  on public.business_gst_registrations (created_by);

create index if not exists payments_party_business_idx
  on public.payments (party_id, business_id);
