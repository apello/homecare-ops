import { createClient } from '@/lib/db/client'
import { createAdminClient } from '@/lib/db/admin'
import type { OrgRole, OrganizationMembership, UserProfile } from '@/types'

export type OrgMemberWithProfile = OrganizationMembership & {
  profile: Pick<UserProfile, 'id' | 'first_name' | 'last_name' | 'access_status'> | null
}

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

  if (error) return null
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
    console.error('listOrgMembers error:', error)
    return []
  }

  return data as OrgMemberWithProfile[]
}

export async function inviteUser(orgId: string, email: string, role: OrgRole): Promise<void> {
  const admin = createAdminClient()

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email)
  if (inviteError) throw new Error(inviteError.message)

  const { error: memberError } = await admin
    .from('organization_memberships')
    .insert({
      organization_id: orgId,
      user_id: inviteData.user.id,
      role,
      status: 'Active',
    })

  if (memberError) throw new Error(memberError.message)
}

export async function updateMemberRole(orgId: string, membershipId: string, role: OrgRole): Promise<void> {
  const supabase = await createClient()

  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id, user_id, status')
    .eq('id', membershipId)
    .eq('organization_id', orgId)
    .single<MembershipAccessCheck>()

  if (membershipError) {
    console.error('[updateMemberRole] membership lookup failed:', membershipError)
    throw new Error(membershipError.message)
  }

  const { error } = await supabase.rpc('update_org_member_role', {
    target_org_id: orgId,
    target_user_id: membership.user_id,
    new_role: role,
  })

  if (error) {
    console.error('[updateMemberRole] RPC error:', error)
    throw new Error(error.message)
  }
}

export async function suspendMember(orgId: string, membershipId: string): Promise<void> {
  const supabase = await createClient()

  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id, user_id, status')
    .eq('id', membershipId)
    .eq('organization_id', orgId)
    .single<MembershipAccessCheck>()

  if (membershipError) throw new Error(membershipError.message)

  const { error } = await supabase.rpc('suspend_org_member', {
    target_org_id: orgId,
    target_user_id: membership.user_id,
  })

  if (error) throw new Error(error.message)
}

export async function unsuspendMember(orgId: string, membershipId: string): Promise<void> {
  const supabase = await createClient()

  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id, user_id, status')
    .eq('id', membershipId)
    .eq('organization_id', orgId)
    .single<MembershipAccessCheck>()

  if (membershipError) throw new Error(membershipError.message)

  const { error } = await supabase.rpc('unsuspend_org_member', {
    target_org_id: orgId,
    target_user_id: membership.user_id,
  })

  if (error) throw new Error(error.message)
}

export async function revokeMember(orgId: string, membershipId: string): Promise<void> {
  const supabase = await createClient()

  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id, user_id, status')
    .eq('id', membershipId)
    .eq('organization_id', orgId)
    .single<MembershipAccessCheck>()

  if (membershipError) throw new Error(membershipError.message)

  const { error } = await supabase.rpc('revoke_org_member', {
    target_org_id: orgId,
    target_user_id: membership.user_id,
  })

  if (error) throw new Error(error.message)
}
