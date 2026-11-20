create or replace function private.ledgerwise_list_business_members(p_business_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.ledgerwise_user_can_access_business(p_business_id, null) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;

  return query
  select
    bm.user_id,
    u.email::text,
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Team member'
    )::text as display_name,
    bm.role,
    bm.created_at
  from public.business_members as bm
  join auth.users as u on u.id = bm.user_id
  where bm.business_id = p_business_id
  order by
    case bm.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    bm.created_at,
    bm.user_id;
end
$function$;

revoke all on function private.ledgerwise_list_business_members(uuid) from public, anon;
grant execute on function private.ledgerwise_list_business_members(uuid) to authenticated;

create or replace function public.get_business_members(p_business_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $function$
  select * from private.ledgerwise_list_business_members(p_business_id);
$function$;

revoke all on function public.get_business_members(uuid) from public, anon;
grant execute on function public.get_business_members(uuid) to authenticated;
