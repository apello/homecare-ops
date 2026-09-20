import { createClient } from '@/lib/db/client'
import { createAdminClient } from '@/lib/db/admin'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/lib/pagination'
import type {
  OrgMemberListPage,
  OrgMemberWithProfile,
  OrgRole,
  OrganizationMembership,
  PendingInvite,
} from '@/types'

type MembershipAccessCheck = Pick<
  OrganizationMembership,
  'id' | 'organization_id' | 'user_id' | 'status'
>

export async function getMember(orgId: string, membershipId: string): Promise<OrgMemberWithProfile | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_memberships')
    .select(`
      *,
      profile:user_profiles!organization_memberships_user_id_fkey(
        id,
        first_name,
        last_name,
        access_status
      )
    `)
    .eq('id', membershipId)
    .eq('organization_id', orgId)
    .single()

  if (error) {
    console.error('[getMember] lookup failed:', { orgId, membershipId, error })
    return null
  }
  return data as unknown as OrgMemberWithProfile
}

export async function listOrgMembers(
  orgId: string,
  filters?: { page?: number; pageSize?: number },
): Promise<OrgMemberListPage> {
  const supabase = await createClient()
  const requestedPage = filters?.page ?? 0
  const requestedPageSize = filters?.pageSize ?? DEFAULT_PAGE_SIZE
  const page = Number.isInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE
  const rangeStart = page * pageSize
  const rangeEnd = rangeStart + pageSize - 1

  // `!inner` + a filter on the embedded column excludes Pending users in the
  // database. This filter used to run in JS after the fetch, which cannot work
  // with server pagination: the exact count would include Pending rows and each
  // page would render fewer than pageSize of them. Both columns are NOT NULL
  // (memberships.user_id FKs user_profiles, profiles.access_status defaults
  // 'Pending'), so the inner join drops nothing the JS filter kept.
  const { data, error, count } = await supabase
    .from('organization_memberships')
    .select(`
      id,
      organization_id,
      user_id,
      roles,
      status,
      joined_at,
      profile:user_profiles!organization_memberships_user_id_fkey!inner(
        id,
        first_name,
        last_name,
        access_status
      )
    `, { count: 'exact' })
    .eq('organization_id', orgId)
    .neq('profile.access_status', 'Pending')
    .order('joined_at', { ascending: false })
    // Tiebreaker: joined_at is not unique, and without a stable secondary sort
    // rows can repeat or vanish across page boundaries.
    .order('id', { ascending: false })
    .range(rangeStart, rangeEnd)

  if (error) {
    console.error('[listOrgMembers] query failed:', { orgId, filters, error })
    return { rows: [], rowCount: 0 }
  }

  return {
    rows: (data ?? []) as unknown as OrgMemberListPage['rows'],
    rowCount: count ?? 0,
  }
}

export async function inviteUser(orgId: string, email: string, roles: OrgRole[]): Promise<void> {
  const admin = createAdminClient()

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { pending_org_id: orgId },
  })

  if (inviteError) {
    console.error('[inviteUser] auth invite failed:', { orgId, email, error: inviteError })
    throw new Error(inviteError.message)
  }

  const supabase = await createClient()
  const { error: inviteRecordError } = await supabase.rpc('create_org_invite', {
    target_org_id: orgId,
    target_user_id: inviteData.user.id,
    target_email: email,
    initial_roles: roles,
  })

  if (inviteRecordError) {
    console.error('[inviteUser] create_org_invite RPC failed:', { orgId, userId: inviteData.user.id, error: inviteRecordError })
    throw new Error(inviteRecordError.message)
  }
}

export async function listPendingInvites(orgId: string): Promise<PendingInvite[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('list_pending_org_invites', {
    target_org_id: orgId,
  })

  if (error) {
    console.error('[listPendingInvites] RPC failed:', { orgId, error })
    return []
  }

  return (data ?? []) as PendingInvite[]
}

export async function deleteInvite(orgId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  const { error: rpcError } = await supabase.rpc('delete_org_invite', {
    target_org_id: orgId,
    target_user_id: userId,
  })

  if (rpcError) {
    console.error('[deleteInvite] RPC failed:', { orgId, userId, error: rpcError })
    throw new Error(rpcError.message)
  }

  const admin = createAdminClient()
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)

  if (deleteError) {
    console.error('[deleteInvite] auth deleteUser failed:', { userId, error: deleteError })
    throw new Error(deleteError.message)
  }
}

export async function resendInvite(orgId: string, userId: string, email: string, roles: OrgRole[]): Promise<void> {
  await deleteInvite(orgId, userId)
  await inviteUser(orgId, email, roles)
}

async function resolveMembership(
  orgId: string,
  membershipId: string,
  caller: string,
): Promise<MembershipAccessCheck> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_memberships')
    .select('id, organization_id, user_id, status')
    .eq('id', membershipId)
    .eq('organization_id', orgId)
    .single<MembershipAccessCheck>()

  if (error) {
    console.error(`[${caller}] membership lookup failed:`, { orgId, membershipId, error })
    throw new Error(error.message)
  }

  return data
}

export async function setMemberRoles(orgId: string, membershipId: string, roles: OrgRole[]): Promise<void> {
  const supabase = await createClient()
  const membership = await resolveMembership(orgId, membershipId, 'setMemberRoles')

  const { error } = await supabase.rpc('set_org_member_roles', {
    target_org_id: orgId,
    target_user_id: membership.user_id,
    new_roles: roles,
  })

  if (error) {
    console.error('[setMemberRoles] RPC failed:', { orgId, membershipId, roles, error })
    throw new Error(error.message)
  }
}

export async function suspendMember(orgId: string, membershipId: string): Promise<void> {
  const supabase = await createClient()
  const membership = await resolveMembership(orgId, membershipId, 'suspendMember')

  const { error } = await supabase.rpc('suspend_org_member', {
    target_org_id: orgId,
    target_user_id: membership.user_id,
  })

  if (error) {
    console.error('[suspendMember] RPC failed:', { orgId, membershipId, error })
    throw new Error(error.message)
  }
}

export async function unsuspendMember(orgId: string, membershipId: string): Promise<void> {
  const supabase = await createClient()
  const membership = await resolveMembership(orgId, membershipId, 'unsuspendMember')

  const { error } = await supabase.rpc('unsuspend_org_member', {
    target_org_id: orgId,
    target_user_id: membership.user_id,
  })

  if (error) {
    console.error('[unsuspendMember] RPC failed:', { orgId, membershipId, error })
    throw new Error(error.message)
  }
}

export async function revokeMember(orgId: string, membershipId: string): Promise<void> {
  const supabase = await createClient()
  const membership = await resolveMembership(orgId, membershipId, 'revokeMember')

  const { error } = await supabase.rpc('revoke_org_member', {
    target_org_id: orgId,
    target_user_id: membership.user_id,
  })

  if (error) {
    console.error('[revokeMember] RPC failed:', { orgId, membershipId, error })
    throw new Error(error.message)
  }
}
