'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/server'
import { requirePermission } from '@/lib/permissions'
import { InviteUserSchema, SetRolesSchema } from '@/lib/schemas/users.schema'
import * as usersService from '@/lib/services/users.service'
import type { ActionResponse, OrgRole, OrgMemberWithProfile, PendingInvite } from '@/types'

export async function getMemberAction(orgId: string, membershipId: string): Promise<ActionResponse<OrgMemberWithProfile | null>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'users.manage')
    const data = await usersService.getMember(orgId, membershipId)
    return { success: true, data }
  } catch (err) {
    console.error('[getMemberAction] failed:', { orgId, membershipId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

export async function listMembersAction(orgId: string): Promise<ActionResponse<OrgMemberWithProfile[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'users.manage')
    const data = await usersService.listOrgMembers(orgId)
    return { success: true, data }
  } catch (err) {
    console.error('[listMembersAction] failed:', { orgId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

export async function inviteMemberAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = InviteUserSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[inviteMemberAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'users.manage')
    await usersService.inviteUser(parsed.data.organizationId, parsed.data.email, parsed.data.roles)
    revalidatePath('/settings/users')
    return { success: true }
  } catch (err) {
    console.error('[inviteMemberAction] failed:', { error: err })
    const message = err instanceof Error ? err.message : undefined
    return { success: false, error: message ?? 'Unable to complete this action.' }
  }
}

export async function setRolesAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = SetRolesSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[setRolesAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'users.manage')
    await usersService.setMemberRoles(parsed.data.organizationId, parsed.data.membershipId, parsed.data.roles)
    revalidatePath('/settings/users')
    return { success: true }
  } catch (err) {
    console.error('[setRolesAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function suspendMemberAction(input: { organizationId: string; membershipId: string }): Promise<ActionResponse> {
  try {
    await requireAuth()
    await requirePermission(input.organizationId, 'users.manage')
    await usersService.suspendMember(input.organizationId, input.membershipId)
    return { success: true }
  } catch (err) {
    console.error('[suspendMemberAction] failed:', { input, error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function unsuspendMemberAction(input: { organizationId: string; membershipId: string }): Promise<ActionResponse> {
  try {
    await requireAuth()
    await requirePermission(input.organizationId, 'users.manage')
    await usersService.unsuspendMember(input.organizationId, input.membershipId)
    return { success: true }
  } catch (err) {
    console.error('[unsuspendMemberAction] failed:', { input, error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function revokeMemberAction(input: { organizationId: string; membershipId: string }): Promise<ActionResponse> {
  try {
    await requireAuth()
    await requirePermission(input.organizationId, 'users.manage')
    await usersService.revokeMember(input.organizationId, input.membershipId)
    return { success: true }
  } catch (err) {
    console.error('[revokeMemberAction] failed:', { input, error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function listPendingInvitesAction(orgId: string): Promise<ActionResponse<PendingInvite[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'users.manage')
    const data = await usersService.listPendingInvites(orgId)
    return { success: true, data }
  } catch (err) {
    console.error('[listPendingInvitesAction] failed:', { orgId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

export async function deleteInviteAction(input: { organizationId: string; userId: string }): Promise<ActionResponse> {
  try {
    await requireAuth()
    await requirePermission(input.organizationId, 'users.manage')
    await usersService.deleteInvite(input.organizationId, input.userId)
    revalidatePath('/settings/users/invite')
    return { success: true }
  } catch (err) {
    console.error('[deleteInviteAction] failed:', { input, error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function resendInviteAction(input: { organizationId: string; userId: string; email: string; roles: OrgRole[] }): Promise<ActionResponse> {
  try {
    await requireAuth()
    await requirePermission(input.organizationId, 'users.manage')
    await usersService.resendInvite(input.organizationId, input.userId, input.email, input.roles)
    revalidatePath('/settings/users/invite')
    return { success: true }
  } catch (err) {
    console.error('[resendInviteAction] failed:', { input, error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}
