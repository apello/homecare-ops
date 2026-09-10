-- ============================================================
-- Migration: Update member role / revoke member RPCs
-- Purpose:
-- - Provide controlled RPCs for changing a member's role and revoking membership
-- - Authorization enforced via can_manage_org_users() (users.manage permission)
-- ============================================================


-- ------------------------------------------------------------
-- 1. Update the role of an organization member
-- ------------------------------------------------------------
-- Notes:
-- - Caller must hold users.manage permission for the org
-- - Only Active memberships can have their role changed
-- - Users cannot change their own role

create or replace function public.update_org_member_role(
  target_org_id  uuid,
  target_user_id uuid,
  new_role       text
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
    raise exception 'Users cannot change their own role';
  end if;

  if new_role not in (
    'Agency Administrator',
    'Scheduler',
    'Clinical Manager',
    'HR Coordinator',
    'Compliance Administrator'
  ) then
    raise exception 'Invalid role: %', new_role;
  end if;

  update public.organization_memberships
  set role = new_role
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
-- 2. Revoke an organization member
-- ------------------------------------------------------------
-- Notes:
-- - Caller must hold users.manage permission for the org
-- - Users cannot revoke their own membership
-- - Active and Suspended memberships may be revoked
-- - Already-revoked memberships are a no-op error
-- - Records who performed the action

create or replace function public.revoke_org_member(
  target_org_id  uuid,
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
    raise exception 'Users cannot revoke their own organization membership';
  end if;

  update public.organization_memberships
  set
    status              = 'Revoked',
    disabled_at         = now(),
    disabled_by_user_id = auth.uid()
  where organization_id = target_org_id
    and user_id = target_user_id
    and status in ('Active', 'Suspended')
  returning *
  into updated_membership;

  if updated_membership.id is null then
    raise exception 'Active or suspended membership not found';
  end if;

  return updated_membership;
end;
$$;


-- ------------------------------------------------------------
-- 3. Lock down RPC execution
-- ------------------------------------------------------------

revoke all on function public.update_org_member_role(uuid, uuid, text) from public;
revoke all on function public.revoke_org_member(uuid, uuid) from public;

grant execute on function public.update_org_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_org_member(uuid, uuid) to authenticated;
