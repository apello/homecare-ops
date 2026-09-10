-- ============================================================
-- Migration: Multi-role support for organization memberships
-- Purpose:
-- - Convert organization_memberships.role (text) to roles (text[])
-- - Update is_org_admin() and has_org_permission() to check against the array
-- - Replace update_org_member_role with set/add/remove role RPCs
-- ============================================================


-- ------------------------------------------------------------
-- 1. Alter organization_memberships: role → roles
-- ------------------------------------------------------------

alter table organization_memberships
  add column roles text[] not null default '{}';

update organization_memberships
  set roles = array[role];

alter table organization_memberships
  drop column role;

alter table organization_memberships
  add constraint membership_roles_valid check (
    roles <@ array[
      'Agency Administrator',
      'Scheduler',
      'Clinical Manager',
      'HR Coordinator',
      'Compliance Administrator'
    ]::text[]
  ),
  add constraint membership_roles_non_empty check (
    array_length(roles, 1) >= 1
  );


-- ------------------------------------------------------------
-- 2. Update is_org_admin() to use ANY(roles)
-- ------------------------------------------------------------

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships
    where organization_id = org_id
      and user_id          = auth.uid()
      and 'Agency Administrator' = any(roles)
      and status           = 'Active'
  );
$$;


-- ------------------------------------------------------------
-- 3. Update has_org_permission() to check all roles in the array
-- ------------------------------------------------------------

create or replace function public.has_org_permission(org_id uuid, perm_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships m
    where m.organization_id = org_id
      and m.user_id          = auth.uid()
      and m.status           = 'Active'
      and (
        exists (
          select 1
          from role_permission_defaults d
          where d.role          = any(m.roles)
            and d.permission_code = perm_code
            and d.enabled         = true
        )
        or
        exists (
          select 1
          from membership_permission_grants g
          where g.membership_id   = m.id
            and g.organization_id = org_id
            and g.permission_code = perm_code
            and g.revoked_at      is null
            and (g.expires_at is null or g.expires_at > now())
        )
      )
  );
$$;


-- ------------------------------------------------------------
-- 4. Replace update_org_member_role with set/add/remove RPCs
-- ------------------------------------------------------------

-- Drop the old single-role setter
drop function if exists public.update_org_member_role(uuid, uuid, text);

-- set_org_member_roles: replace all roles at once
create or replace function public.set_org_member_roles(
  target_org_id  uuid,
  target_user_id uuid,
  new_roles      text[]
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_membership public.organization_memberships;
  valid_roles        text[] := array[
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

  if target_user_id = auth.uid() then
    raise exception 'Users cannot change their own roles';
  end if;

  if array_length(new_roles, 1) is null or array_length(new_roles, 1) < 1 then
    raise exception 'At least one role is required';
  end if;

  if not (new_roles <@ valid_roles) then
    raise exception 'One or more invalid roles provided';
  end if;

  update public.organization_memberships
    set roles = new_roles
  where organization_id = target_org_id
    and user_id         = target_user_id
    and status          = 'Active'
  returning * into updated_membership;

  if updated_membership.id is null then
    raise exception 'Active membership not found';
  end if;

  return updated_membership;
end;
$$;

-- add_org_member_role: append a role (no-op if already present)
create or replace function public.add_org_member_role(
  target_org_id  uuid,
  target_user_id uuid,
  role_to_add    text
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_membership public.organization_memberships;
  valid_roles        text[] := array[
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

  if target_user_id = auth.uid() then
    raise exception 'Users cannot change their own roles';
  end if;

  if not (role_to_add = any(valid_roles)) then
    raise exception 'Invalid role: %', role_to_add;
  end if;

  update public.organization_memberships
    set roles = array_append(roles, role_to_add)
  where organization_id = target_org_id
    and user_id         = target_user_id
    and status          = 'Active'
    and not (role_to_add = any(roles))
  returning * into updated_membership;

  -- If no row was updated, either membership not found or role already present
  if updated_membership.id is null then
    select * into updated_membership
    from public.organization_memberships
    where organization_id = target_org_id
      and user_id         = target_user_id
      and status          = 'Active';

    if updated_membership.id is null then
      raise exception 'Active membership not found';
    end if;
    -- role already present — return as-is
  end if;

  return updated_membership;
end;
$$;

-- remove_org_member_role: drop a role; fails if it would leave the member with no roles
create or replace function public.remove_org_member_role(
  target_org_id  uuid,
  target_user_id uuid,
  role_to_remove text
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  current_membership public.organization_memberships;
  updated_membership public.organization_memberships;
begin
  if not public.can_manage_org_users(target_org_id) then
    raise exception 'Not authorized to manage users for this organization';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Users cannot change their own roles';
  end if;

  select * into current_membership
  from public.organization_memberships
  where organization_id = target_org_id
    and user_id         = target_user_id
    and status          = 'Active';

  if current_membership.id is null then
    raise exception 'Active membership not found';
  end if;

  if not (role_to_remove = any(current_membership.roles)) then
    raise exception 'Member does not have role: %', role_to_remove;
  end if;

  if array_length(current_membership.roles, 1) = 1 then
    raise exception 'Cannot remove the last role; revoke the membership instead';
  end if;

  update public.organization_memberships
    set roles = array_remove(roles, role_to_remove)
  where id = current_membership.id
  returning * into updated_membership;

  return updated_membership;
end;
$$;


-- ------------------------------------------------------------
-- 5. Grant / revoke execute on new RPCs
-- ------------------------------------------------------------

revoke all on function public.set_org_member_roles(uuid, uuid, text[]) from public;
revoke all on function public.add_org_member_role(uuid, uuid, text)    from public;
revoke all on function public.remove_org_member_role(uuid, uuid, text) from public;

grant execute on function public.set_org_member_roles(uuid, uuid, text[]) to authenticated;
grant execute on function public.add_org_member_role(uuid, uuid, text)    to authenticated;
grant execute on function public.remove_org_member_role(uuid, uuid, text) to authenticated;
