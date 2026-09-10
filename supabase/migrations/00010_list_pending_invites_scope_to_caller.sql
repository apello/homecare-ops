-- ============================================================
-- Migration: list_pending_org_invites — scope to caller
-- Purpose:
-- Only return invites that the calling user sent, so admins
-- only manage their own outstanding invitations.
-- ============================================================

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
    i.id              as invite_id,
    i.invited_user_id as user_id,
    i.email,
    i.roles,
    i.invited_at,
    i.expires_at
  from public.org_invites i
  where i.organization_id    = target_org_id
    and i.status             = 'Pending'
    and i.invited_by_user_id = auth.uid();
$$;

revoke all on function public.list_pending_org_invites(uuid) from public;
grant execute on function public.list_pending_org_invites(uuid) to authenticated;
