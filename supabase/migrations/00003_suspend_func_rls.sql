-- ============================================================
-- Migration: User suspension / unsuspension support
-- Purpose:
-- - Allow admins to view suspended member profile data
-- - Provide controlled RPCs for suspending and unsuspending org users
-- - Keep revoked users blocked from normal restoration
-- ============================================================


-- ------------------------------------------------------------
-- 1. Fix profile visibility for suspended org members
-- ------------------------------------------------------------
-- Existing policy requires both current user and target profile user
-- to have Active memberships. That hides the profile once the target
-- membership is Suspended.
--
-- New rule:
-- - Viewer must be an active org member
-- - Target profile must belong to the same org
-- - Target membership may be Active or Suspended
-- - Revoked users remain hidden from normal roster/profile reads

drop policy if exists "user_profiles: read co-member profiles"
on public.user_profiles;

create policy "user_profiles: read co-member profiles"
on public.user_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships viewer_membership
    join public.organization_memberships target_membership
      on target_membership.organization_id = viewer_membership.organization_id
    where viewer_membership.user_id = auth.uid()
      and viewer_membership.status = 'Active'
      and target_membership.user_id = user_profiles.id
      and target_membership.status in ('Active', 'Suspended')
  )
);


-- ------------------------------------------------------------
-- 2. Add helper permission for user management
-- ------------------------------------------------------------
-- Your role_permission_defaults already includes users.manage for
-- Agency Administrator. This helper keeps RPC logic readable.

create or replace function public.can_manage_org_users(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_permission(target_org_id, 'users.manage');
$$;


-- ------------------------------------------------------------
-- 3. Suspend an organization member
-- ------------------------------------------------------------
-- Notes:
-- - Does not allow users to suspend themselves
-- - Does not affect Revoked memberships
-- - Records who performed the action
-- - Updates only the selected org membership, not the global profile

create or replace function public.suspend_org_member(
  target_org_id uuid,
  target_user_id uuid
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_membership public.organization_memberships;
begin
  if not public.can_manage_org_users(target_org_id) then
    raise exception 'Not authorized to manage users for this organization';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Users cannot suspend their own organization membership';
  end if;

  update public.organization_memberships
  set
    status = 'Suspended',
    disabled_at = now(),
    disabled_by_user_id = auth.uid()
  where organization_id = target_org_id
    and user_id = target_user_id
    and status = 'Active'
  returning *
  into updated_membership;

  if updated_membership.id is null then
    raise exception 'Active membership not found';
  end if;

  return updated_membership;
end;
$$;


-- ------------------------------------------------------------
-- 4. Unsuspend an organization member
-- ------------------------------------------------------------
-- Notes:
-- - Only restores Suspended memberships
-- - Does not restore Revoked memberships
-- - Clears disabled metadata
-- - Does not globally reactivate a disabled user profile

create or replace function public.unsuspend_org_member(
  target_org_id uuid,
  target_user_id uuid
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_membership public.organization_memberships;
begin
  if not public.can_manage_org_users(target_org_id) then
    raise exception 'Not authorized to manage users for this organization';
  end if;

  update public.organization_memberships
  set
    status = 'Active',
    disabled_at = null,
    disabled_by_user_id = null
  where organization_id = target_org_id
    and user_id = target_user_id
    and status = 'Suspended'
  returning *
  into updated_membership;

  if updated_membership.id is null then
    raise exception 'Suspended membership not found';
  end if;

  return updated_membership;
end;
$$;


-- ------------------------------------------------------------
-- 5. Lock down RPC execution
-- ------------------------------------------------------------

revoke all on function public.suspend_org_member(uuid, uuid) from public;
revoke all on function public.unsuspend_org_member(uuid, uuid) from public;

grant execute on function public.suspend_org_member(uuid, uuid) to authenticated;
grant execute on function public.unsuspend_org_member(uuid, uuid) to authenticated;