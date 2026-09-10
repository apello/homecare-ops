-- ============================================================
-- Migration: allow stub user_profiles for invited users
--
-- Invited users have no name at invite time. Make first_name /
-- last_name nullable so create_org_member can insert a stub
-- profile that gets filled in after the user accepts.
-- ============================================================

alter table public.user_profiles
  alter column first_name drop not null,
  alter column last_name  drop not null;


-- Update create_org_member to also insert the stub profile.
-- ON CONFLICT DO NOTHING handles the case where the profile
-- already exists (e.g. user re-invited after partial setup).

create or replace function public.create_org_member(
  target_org_id uuid,
  target_user_id uuid,
  initial_roles  text[]
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  new_membership public.organization_memberships;
  valid_roles    text[] := array[
    'Agency Administrator',
    'Scheduler',
    'Clinical Manager',
    'HR Coordinator',
    'Compliance Administrator'
  ];
begin
  if not public.can_manage_org_users(target_org_id) then
    raise exception 'Not authorized to manage users for this organization';
  end if;

  if array_length(initial_roles, 1) is null or array_length(initial_roles, 1) < 1 then
    raise exception 'At least one role is required';
  end if;

  if not (initial_roles <@ valid_roles) then
    raise exception 'One or more invalid roles provided';
  end if;

  -- Stub profile so the FK is satisfied before the user accepts the invite.
  insert into public.user_profiles (id, access_status)
  values (target_user_id, 'Pending')
  on conflict (id) do nothing;

  insert into public.organization_memberships (organization_id, user_id, roles, status)
  values (target_org_id, target_user_id, initial_roles, 'Active')
  returning * into new_membership;

  return new_membership;
end;
$$;

revoke all on function public.create_org_member(uuid, uuid, text[]) from public;
grant execute on function public.create_org_member(uuid, uuid, text[]) to authenticated;
