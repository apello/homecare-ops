'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/server'
import { requirePermission } from '@/lib/permissions'
import { InviteUserSchema, SetRolesSchema } from '@/lib/schemas/users.schema'
import * as usersService from '@/lib/services/users.service'
import type { ActionResponse } from '@/types'
import type { OrgMemberWithProfile } from '@/lib/services/users.service'

export async function listMembersAction(orgId: string): Promise<ActionResponse<OrgMemberWithProfile[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'users.manage')
    const data = await usersService.listOrgMembers(orgId)
    return { success: true, data }
  } catch {
    return { success: false, error: 'Not authorized.' }
  }
}

// export async function inviteMemberAction(input: unknown): Promise<ActionResponse> {
//   try {
//     await requireAuth()
//     const parsed = InviteUserSchema.safeParse(input)
//     if (!parsed.success) {
//       return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
//     }
//     await requirePermission(parsed.data.organizationId, 'users.manage')
//     await usersService.inviteUser(parsed.data.organizationId, parsed.data.email, parsed.data.roles)
//     return { success: true }
//   } catch (err) {
//     const message = err instanceof Error ? err.message : undefined
//     return { success: false, error: message ?? 'Unable to complete this action.' }
//   }
// }

export async function setRolesAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = SetRolesSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'users.manage')
    await usersService.setMemberRoles(parsed.data.organizationId, parsed.data.membershipId, parsed.data.roles)
    revalidatePath('/settings/users')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function suspendMemberAction(input: { organizationId: string; membershipId: string }): Promise<ActionResponse> {
  try {
    await requireAuth()
    await requirePermission(input.organizationId, 'users.manage')
    await usersService.suspendMember(input.organizationId, input.membershipId)
    return { success: true }
  } catch {
    return { success: false, error: 'Unable to complete this action.' }
  }
}

export async function unsuspendMemberAction(input: { organizationId: string; membershipId: string }): Promise<ActionResponse> {
  try {
    await requireAuth()
    await requirePermission(input.organizationId, 'users.manage')
    await usersService.unsuspendMember(input.organizationId, input.membershipId)
    return { success: true }
  } catch {
    return { success: false, error: 'Unable to complete this action.' }
  }
}

export async function revokeMemberAction(input: { organizationId: string; membershipId: string }): Promise<ActionResponse> {
  try {
    await requireAuth()
    await requirePermission(input.organizationId, 'users.manage')
    await usersService.revokeMember(input.organizationId, input.membershipId)
    return { success: true }
  } catch {
    return { success: false, error: 'Unable to complete this action.' }
  }
}
