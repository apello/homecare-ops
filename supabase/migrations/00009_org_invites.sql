-- ============================================================
-- Migration: org_invites table + invite lifecycle RPCs
-- Purpose:
-- - Decouple invite tracking from organization_memberships so
--   membership can be created after the user completes accept-invite.
-- - Replace the org-membership-based pending-invite detection with
--   a dedicated table that tracks status explicitly.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Table
-- ------------------------------------------------------------

create table org_invites (
  id                 uuid        primary key default gen_random_uuid(),
  organization_id    uuid        not null references organizations(id) on delete restrict,
  invited_user_id    uuid        not null references auth.users(id) on delete cascade,
  email              text        not null,
  roles              text[]      not null,
  status             text        not null default 'Pending'
                                 check (status in ('Pending', 'Accepted', 'Cancelled')),
  invited_by_user_id uuid        not null references user_profiles(id),
  invited_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  expires_at         timestamptz,
  unique (organization_id, invited_user_id)
);

create index org_invites_org_status_idx on org_invites(organization_id, status);
create index org_invites_user_idx        on org_invites(invited_user_id);

alter table org_invites enable row level security;

create policy "org_invites: admin read"
  on org_invites for select to authenticated
  using (is_org_admin(organization_id));

-- All writes go through security definer RPCs below.


-- ------------------------------------------------------------
-- 2. create_org_invite
-- ------------------------------------------------------------
-- Called by org admins when sending an invite. Inserts into
-- org_invites after the auth user has been created by the
-- admin API.

create or replace function public.create_org_invite(
  target_org_id    uuid,
  target_user_id   uuid,
  target_email     text,
  initial_roles    text[],
  invite_expires_at timestamptz default null
)
returns public.org_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  valid_roles text[] := array[
    'Agency Administrator',
    'Scheduler',
    'Clinical Manager',
    'HR Coordinator',
    'Compliance Administrator'
  ];
  new_invite public.org_invites;
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

  insert into public.org_invites (
    organization_id,
    invited_user_id,
    email,
    roles,
    invited_by_user_id,
    expires_at
  )
  values (
    target_org_id,
    target_user_id,
    target_email,
    initial_roles,
    auth.uid(),
    invite_expires_at
  )
  returning * into new_invite;

  -- Stub profile so the membership FK is satisfied before the user accepts.
  insert into public.user_profiles (id, access_status)
  values (target_user_id, 'Pending')
  on conflict (id) do nothing;

  return new_invite;
end;
$$;

revoke all on function public.create_org_invite(uuid, uuid, text, text[], timestamptz) from public;
grant execute on function public.create_org_invite(uuid, uuid, text, text[], timestamptz) to authenticated;


-- ------------------------------------------------------------
-- 3. complete_org_invite
-- ------------------------------------------------------------
-- Called by the invited user after completing the accept-invite
-- page. Verifies the caller matches the invite, creates the org
-- membership, and marks the invite as Accepted.

create or replace function public.complete_org_invite(
  target_org_id uuid
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row   public.org_invites;
  new_membership public.organization_memberships;
  valid_roles  text[] := array[
    'Agency Administrator',
    'Scheduler',
    'Clinical Manager',
    'HR Coordinator',
    'Compliance Administrator'
  ];
begin
  select * into invite_row
  from public.org_invites
  where organization_id  = target_org_id
    and invited_user_id  = auth.uid()
    and status           = 'Pending';

  if not found then
    raise exception 'No pending invite found for this user in this organization';
  end if;

  if invite_row.expires_at is not null and invite_row.expires_at < now() then
    update public.org_invites
    set status = 'Cancelled'
    where id = invite_row.id;
    raise exception 'This invite has expired';
  end if;

  insert into public.organization_memberships (organization_id, user_id, roles, status)
  values (target_org_id, auth.uid(), invite_row.roles, 'Active')
  returning * into new_membership;

  update public.org_invites
  set status      = 'Accepted',
      accepted_at = now()
  where id = invite_row.id;

  return new_membership;
end;
$$;

revoke all on function public.complete_org_invite(uuid) from public;
grant execute on function public.complete_org_invite(uuid) to authenticated;


-- ------------------------------------------------------------
-- 4. list_pending_org_invites  (replaces previous version)
-- ------------------------------------------------------------
-- Now reads from org_invites instead of inferring pending state
-- from organization_memberships + auth.users.confirmed_at.

drop function if exists public.list_pending_org_invites(uuid);

create or replace function public.list_pending_org_invites(target_org_id uuid)
returns table (
  invite_id  uuid,
  user_id    uuid,
  email      text,
  roles      text[],
  invited_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id            as invite_id,
    i.invited_user_id as user_id,
    i.email,
    i.roles,
    i.invited_at,
    i.expires_at
  from public.org_invites i
  where i.organization_id = target_org_id
    and i.status          = 'Pending';
$$;

revoke all on function public.list_pending_org_invites(uuid) from public;
grant execute on function public.list_pending_org_invites(uuid) to authenticated;


-- ------------------------------------------------------------
-- 5. delete_org_invite  (replaces previous version)
-- ------------------------------------------------------------
-- Marks the invite as Cancelled. The caller (service layer) is
-- responsible for deleting the auth user via the admin API
-- afterwards; the on delete cascade on invited_user_id will
-- then remove this row automatically.

create or replace function public.delete_org_invite(
  target_org_id  uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_org_users(target_org_id) then
    raise exception 'Not authorized to manage users for this organization';
  end if;

  if not exists (
    select 1 from public.org_invites
    where organization_id = target_org_id
      and invited_user_id = target_user_id
      and status          = 'Pending'
  ) then
    raise exception 'No pending invite found for this user';
  end if;

  update public.org_invites
  set status = 'Cancelled'
  where organization_id = target_org_id
    and invited_user_id = target_user_id;
end;
$$;

revoke all on function public.delete_org_invite(uuid, uuid) from public;
grant execute on function public.delete_org_invite(uuid, uuid) to authenticated;
