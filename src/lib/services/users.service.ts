import { createClient } from '@/lib/db/client'
import { createAdminClient } from '@/lib/db/admin'
import { getSession } from '@/lib/auth/server'
import type { OrgRole, OrganizationMembership, UserProfile } from '@/types'

export type OrgMemberWithProfile = OrganizationMembership & {
  profile: Pick<UserProfile, 'id' | 'first_name' | 'last_name' | 'access_status'> | null
}

type MembershipAccessCheck = Pick<
  OrganizationMembership,
  'id' | 'organization_id' | 'user_id' | 'status'
>

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
  const { error } = await supabase
    .from('organization_memberships')
    .update({ role })
    .eq('id', membershipId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
}

export async function suspendMember(orgId: string, membershipId: string): Promise<void> {
  const user = await getSession()
  const supabase = await createClient()

  if (!user?.id) {
    throw new Error('Not authenticated')
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id, user_id, status')
    .eq('id', membershipId)
    .eq('organization_id', orgId)
    .single<MembershipAccessCheck>()

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  if (membership.user_id === user.id) {
    throw new Error('You cannot suspend your own account.')
  }

  if (membership.status !== 'Active') {
    throw new Error('Only active members can be suspended.')
  }

  const { error } = await supabase
    .from('organization_memberships')
    .update({
      status: 'Suspended',
      disabled_at: new Date().toISOString(),
      disabled_by_user_id: user.id,
    })
    .eq('id', membershipId)
    .eq('organization_id', orgId)
    .eq('status', 'Active')
    .neq('user_id', user.id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function unsuspendMember(orgId: string, membershipId: string): Promise<void> {
  const supabase = await createClient()

  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id, user_id, status')
    .eq('id', membershipId)
    .eq('organization_id', orgId)
    .single<MembershipAccessCheck>()

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  if (membership.status !== 'Suspended') {
    throw new Error('Only suspended members can be unsuspended.')
  }

  const { error } = await supabase
    .from('organization_memberships')
    .update({
      status: 'Active',
      disabled_at: null,
      disabled_by_user_id: null,
    })
    .eq('id', membershipId)
    .eq('organization_id', orgId)
    .eq('status', 'Suspended')

  if (error) {
    throw new Error(error.message)
  }
}

export async function revokeMember(orgId: string, membershipId: string): Promise<void> {
  const user = await getSession()
  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_memberships')
    .update({
      status: 'Revoked',
      disabled_at: new Date().toISOString(),
      disabled_by_user_id: user?.id ?? null,
    })
    .eq('id', membershipId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
}
