import { createClient } from '@/lib/db/client'
import { createAdminClient } from '@/lib/db/admin'
import type { OrgMemberWithProfile, OrgRole, OrganizationMembership, PendingInvite } from '@/types'

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
  return data as OrgMemberWithProfile
}

export async function listOrgMembers(orgId: string): Promise<OrgMemberWithProfile[]> {
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
    .eq('organization_id', orgId)
    .order('joined_at', { ascending: false })

  if (error) {
    console.error('[listOrgMembers] query failed:', { orgId, error })
    return []
  }

  return (data as OrgMemberWithProfile[]).filter(m => m.profile?.access_status !== 'Pending')
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
