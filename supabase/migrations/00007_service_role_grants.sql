-- ============================================================
-- Migration: create_org_member, list_pending_org_invites,
--            delete_org_invite RPCs
-- Purpose:
-- - Move membership insert out of the app layer into a security
--   definer function (eliminates service_role table grants).
-- - Provide a read-only view of pending (unconfirmed) invites
--   by joining organization_memberships with auth.users.
-- - Provide a controlled delete for pending invites.
-- ============================================================


-- ------------------------------------------------------------
-- 1. create_org_member
-- ------------------------------------------------------------

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

  insert into public.organization_memberships (organization_id, user_id, roles, status)
  values (target_org_id, target_user_id, initial_roles, 'Active')
  returning * into new_membership;

  return new_membership;
end;
$$;

revoke all on function public.create_org_member(uuid, uuid, text[]) from public;
grant execute on function public.create_org_member(uuid, uuid, text[]) to authenticated;


-- ------------------------------------------------------------
-- 2. list_pending_org_invites
-- ------------------------------------------------------------
-- Returns memberships where the auth user has not yet confirmed
-- their account (invited but not accepted).

create or replace function public.list_pending_org_invites(target_org_id uuid)
returns table (
  membership_id uuid,
  user_id       uuid,
  email         text,
  roles         text[],
  invited_at    timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    m.id            as membership_id,
    m.user_id,
    u.email,
    m.roles,
    u.invited_at
  from public.organization_memberships m
  join auth.users u on u.id = m.user_id
  where m.organization_id = target_org_id
    and m.status           = 'Active'
    and u.confirmed_at     is null
    and u.invited_at       is not null;
$$;

revoke all on function public.list_pending_org_invites(uuid) from public;
grant execute on function public.list_pending_org_invites(uuid) to authenticated;


-- ------------------------------------------------------------
-- 3. delete_org_invite
-- ------------------------------------------------------------
-- Removes the membership row for a pending (unconfirmed) invite.
-- The caller is responsible for deleting the auth user via the
-- admin API after this succeeds.

create or replace function public.delete_org_invite(
  target_org_id  uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.can_manage_org_users(target_org_id) then
    raise exception 'Not authorized to manage users for this organization';
  end if;

  -- Verify the user is actually unconfirmed before deleting
  if not exists (
    select 1 from auth.users
    where id           = target_user_id
      and confirmed_at is null
      and invited_at   is not null
  ) then
    raise exception 'No pending invite found for this user';
  end if;

  delete from public.organization_memberships
  where organization_id = target_org_id
    and user_id         = target_user_id;
end;
$$;

revoke all on function public.delete_org_invite(uuid, uuid) from public;
grant execute on function public.delete_org_invite(uuid, uuid) to authenticated;

