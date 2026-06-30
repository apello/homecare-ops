import { ORG_ROLES } from '@/types'
import { z } from 'zod'

const orgRoleEnum = z.enum(ORG_ROLES)

export const InviteUserSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: orgRoleEnum,
}).strict()

export const UpdateRoleSchema = z.object({
  organizationId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: orgRoleEnum,
}).strict()

export type InviteUserInput = z.infer<typeof InviteUserSchema>
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>