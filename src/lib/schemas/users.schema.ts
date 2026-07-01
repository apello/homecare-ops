import { ORG_ROLES } from '@/types'
import { z } from 'zod'

const orgRoleEnum = z.enum(ORG_ROLES)

const uuidShape = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid UUID',
)

export const InviteUserSchema = z.object({
  organizationId: uuidShape,
  email: z.string().email(),
  roles: z.array(orgRoleEnum).min(1, 'At least one role is required'),
}).strict()

export const SetRolesSchema = z.object({
  organizationId: uuidShape,
  membershipId: uuidShape,
  roles: z.array(orgRoleEnum).min(1, 'At least one role is required'),
}).strict()

export type InviteUserInput = z.infer<typeof InviteUserSchema>
export type SetRolesInput = z.infer<typeof SetRolesSchema>
