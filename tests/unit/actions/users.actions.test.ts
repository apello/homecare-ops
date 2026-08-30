import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/server',  () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/permissions',  () => ({ requirePermission: vi.fn() }))
vi.mock('next/cache',         () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/services/users.service', () => ({
  getMember: vi.fn(),
  listOrgMembers: vi.fn(),
  inviteUser: vi.fn(),
  listPendingInvites: vi.fn(),
  deleteInvite: vi.fn(),
  resendInvite: vi.fn(),
  setMemberRoles: vi.fn(),
  suspendMember:  vi.fn(),
  unsuspendMember: vi.fn(),
  revokeMember:   vi.fn(),
}))

import { requireAuth }       from '@/lib/auth/server'
import { requirePermission } from '@/lib/permissions'
import { revalidatePath }    from 'next/cache'
import * as usersService     from '@/lib/services/users.service'
import {
  getMemberAction,
  listMembersAction,
  inviteMemberAction,
  setRolesAction,
  suspendMemberAction,
  unsuspendMemberAction,
  revokeMemberAction,
  listPendingInvitesAction,
  deleteInviteAction,
  resendInviteAction,
} from '@/app/(dashboard)/settings/users/actions'

const mockRequireAuth       = requireAuth       as ReturnType<typeof vi.fn>
const mockRequirePermission = requirePermission as ReturnType<typeof vi.fn>
const mockRevalidatePath    = revalidatePath    as ReturnType<typeof vi.fn>
const mockGetMember         = usersService.getMember        as ReturnType<typeof vi.fn>
const mockListOrgMembers    = usersService.listOrgMembers  as ReturnType<typeof vi.fn>
const mockInviteUser        = usersService.inviteUser      as ReturnType<typeof vi.fn>
const mockListPendingInvites = usersService.listPendingInvites as ReturnType<typeof vi.fn>
const mockDeleteInvite      = usersService.deleteInvite    as ReturnType<typeof vi.fn>
const mockResendInvite      = usersService.resendInvite    as ReturnType<typeof vi.fn>
const mockSetMemberRoles    = usersService.setMemberRoles  as ReturnType<typeof vi.fn>
const mockSuspendMember     = usersService.suspendMember   as ReturnType<typeof vi.fn>
const mockUnsuspendMember   = usersService.unsuspendMember as ReturnType<typeof vi.fn>
const mockRevokeMember      = usersService.revokeMember    as ReturnType<typeof vi.fn>

const ORG_ID        = '00000000-0000-0000-0000-000000000001'
const MEMBERSHIP_ID = '00000000-0000-0000-0000-000000000002'
const USER_ID       = '00000000-0000-0000-0000-000000000003'

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue(undefined)
  mockRequirePermission.mockResolvedValue(undefined)
  mockRevalidatePath.mockResolvedValue(undefined)
})

// ─── listMembersAction ────────────────────────────────────────────────────────

describe('listMembersAction', () => {
  it('returns members on success', async () => {
    const rows = [{ id: MEMBERSHIP_ID }]
    mockListOrgMembers.mockResolvedValue(rows)
    const result = await listMembersAction(ORG_ID)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(rows)
  })

  it('returns error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await listMembersAction(ORG_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authorized.')
  })

  it('returns error when caller lacks permission', async () => {
    mockRequirePermission.mockRejectedValue(new Error('Forbidden'))
    const result = await listMembersAction(ORG_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authorized.')
  })
})

// ─── getMemberAction ──────────────────────────────────────────────────────────

describe('getMemberAction', () => {
  it('returns member on success', async () => {
    const member = { id: MEMBERSHIP_ID, user_id: USER_ID, organization_id: ORG_ID, status: 'Active' as const, roles: [], joined_at: '2024-01-01', disabled_at: null, disabled_by_user_id: null, last_access_review_at: null, profile: null }
    mockGetMember.mockResolvedValue(member)
    const result = await getMemberAction(ORG_ID, MEMBERSHIP_ID)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(member)
  })

  it('returns null when member not found', async () => {
    mockGetMember.mockResolvedValue(null)
    const result = await getMemberAction(ORG_ID, MEMBERSHIP_ID)
    expect(result.success).toBe(true)
    expect(result.data).toBeNull()
  })

  it('returns error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await getMemberAction(ORG_ID, MEMBERSHIP_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authorized.')
  })

  it('returns error when caller lacks permission', async () => {
    mockRequirePermission.mockRejectedValue(new Error('Forbidden'))
    const result = await getMemberAction(ORG_ID, MEMBERSHIP_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authorized.')
  })
})

// ─── inviteMemberAction — schema validation ────────────────────────────────────

describe('inviteMemberAction — schema validation', () => {
  it('returns fieldErrors when email is missing', async () => {
    const result = await inviteMemberAction({ organizationId: ORG_ID, roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.email).toBeDefined()
    expect(mockInviteUser).not.toHaveBeenCalled()
  })

  it('returns fieldErrors when email is invalid', async () => {
    const result = await inviteMemberAction({ organizationId: ORG_ID, email: 'not-an-email', roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.email).toBeDefined()
    expect(mockInviteUser).not.toHaveBeenCalled()
  })

  it('returns fieldErrors when roles array is empty', async () => {
    const result = await inviteMemberAction({ organizationId: ORG_ID, email: 'user@example.com', roles: [] })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.roles).toBeDefined()
    expect(mockInviteUser).not.toHaveBeenCalled()
  })

  it('returns fieldErrors when organizationId is not a valid UUID', async () => {
    const result = await inviteMemberAction({ organizationId: 'not-a-uuid', email: 'user@example.com', roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.organizationId).toBeDefined()
    expect(mockInviteUser).not.toHaveBeenCalled()
  })
})

// ─── inviteMemberAction — auth / permission ────────────────────────────────────

describe('inviteMemberAction — auth and permission', () => {
  it('returns error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await inviteMemberAction({ organizationId: ORG_ID, email: 'user@example.com', roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Unauthenticated')
    expect(mockInviteUser).not.toHaveBeenCalled()
  })

  it('returns error when caller lacks users.manage permission', async () => {
    mockRequirePermission.mockRejectedValue(new Error('Not authorized.'))
    const result = await inviteMemberAction({ organizationId: ORG_ID, email: 'user@example.com', roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authorized.')
    expect(mockInviteUser).not.toHaveBeenCalled()
  })
})

// ─── inviteMemberAction — success / service error ──────────────────────────────

describe('inviteMemberAction — service delegation', () => {
  it('calls inviteUser with validated data and returns success', async () => {
    mockInviteUser.mockResolvedValue(undefined)
    const result = await inviteMemberAction({ organizationId: ORG_ID, email: 'user@example.com', roles: ['Scheduler'] })
    expect(result.success).toBe(true)
    expect(mockInviteUser).toHaveBeenCalledWith(ORG_ID, 'user@example.com', ['Scheduler'])
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/users')
  })

  it('returns error when service throws', async () => {
    mockInviteUser.mockRejectedValue(new Error('RPC failed'))
    const result = await inviteMemberAction({ organizationId: ORG_ID, email: 'user@example.com', roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('RPC failed')
  })
})

// ─── setRolesAction — schema validation ───────────────────────────────────────

describe('setRolesAction — schema validation', () => {
  it('returns fieldErrors when roles array is empty', async () => {
    const result = await setRolesAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID, roles: [] })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.roles).toBeDefined()
    expect(mockSetMemberRoles).not.toHaveBeenCalled()
  })

  it('returns fieldErrors when roles contains an invalid value', async () => {
    const result = await setRolesAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID, roles: ['Ghost'] })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.roles).toBeDefined()
    expect(mockSetMemberRoles).not.toHaveBeenCalled()
  })

  it('returns fieldErrors when organizationId is not a valid UUID', async () => {
    const result = await setRolesAction({ organizationId: 'not-a-uuid', membershipId: MEMBERSHIP_ID, roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.organizationId).toBeDefined()
    expect(mockSetMemberRoles).not.toHaveBeenCalled()
  })

  it('returns fieldErrors when membershipId is not a valid UUID', async () => {
    const result = await setRolesAction({ organizationId: ORG_ID, membershipId: 'bad-id', roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.membershipId).toBeDefined()
    expect(mockSetMemberRoles).not.toHaveBeenCalled()
  })

  it('returns fieldErrors when roles is missing entirely', async () => {
    const result = await setRolesAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.roles).toBeDefined()
  })
})

// ─── setRolesAction — auth / permission ───────────────────────────────────────

describe('setRolesAction — auth and permission', () => {
  it('returns error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await setRolesAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID, roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Unauthenticated')
    expect(mockSetMemberRoles).not.toHaveBeenCalled()
  })

  it('returns error when caller lacks users.manage permission', async () => {
    mockRequirePermission.mockRejectedValue(new Error('Not authorized.'))
    const result = await setRolesAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID, roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authorized.')
    expect(mockSetMemberRoles).not.toHaveBeenCalled()
  })
})

// ─── setRolesAction — success / service error ─────────────────────────────────

describe('setRolesAction — service delegation', () => {
  it('calls setMemberRoles with validated data and returns success', async () => {
    mockSetMemberRoles.mockResolvedValue(undefined)
    const result = await setRolesAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID, roles: ['Scheduler', 'HR Coordinator'] })
    expect(result.success).toBe(true)
    expect(mockSetMemberRoles).toHaveBeenCalledWith(ORG_ID, MEMBERSHIP_ID, ['Scheduler', 'HR Coordinator'])
  })

  it('returns error when service throws', async () => {
    mockSetMemberRoles.mockRejectedValue(new Error('RPC failed'))
    const result = await setRolesAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID, roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('RPC failed')
  })
})

// ─── suspendMemberAction ──────────────────────────────────────────────────────

describe('suspendMemberAction', () => {
  it('calls suspendMember and returns success', async () => {
    mockSuspendMember.mockResolvedValue(undefined)
    const result = await suspendMemberAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID })
    expect(result.success).toBe(true)
    expect(mockSuspendMember).toHaveBeenCalledWith(ORG_ID, MEMBERSHIP_ID)
  })

  it('returns error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await suspendMemberAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID })
    expect(result.success).toBe(false)
    expect(mockSuspendMember).not.toHaveBeenCalled()
  })

  it('returns error when service throws', async () => {
    mockSuspendMember.mockRejectedValue(new Error('Active membership not found'))
    const result = await suspendMemberAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID })
    expect(result.success).toBe(false)
  })
})

// ─── unsuspendMemberAction ────────────────────────────────────────────────────

describe('unsuspendMemberAction', () => {
  it('calls unsuspendMember and returns success', async () => {
    mockUnsuspendMember.mockResolvedValue(undefined)
    const result = await unsuspendMemberAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID })
    expect(result.success).toBe(true)
    expect(mockUnsuspendMember).toHaveBeenCalledWith(ORG_ID, MEMBERSHIP_ID)
  })

  it('returns error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await unsuspendMemberAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID })
    expect(result.success).toBe(false)
    expect(mockUnsuspendMember).not.toHaveBeenCalled()
  })

  it('returns error when service throws', async () => {
    mockUnsuspendMember.mockRejectedValue(new Error('Suspended membership not found'))
    const result = await unsuspendMemberAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID })
    expect(result.success).toBe(false)
  })
})

// ─── revokeMemberAction ───────────────────────────────────────────────────────

describe('revokeMemberAction', () => {
  it('calls revokeMember and returns success', async () => {
    mockRevokeMember.mockResolvedValue(undefined)
    const result = await revokeMemberAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID })
    expect(result.success).toBe(true)
    expect(mockRevokeMember).toHaveBeenCalledWith(ORG_ID, MEMBERSHIP_ID)
  })

  it('returns error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await revokeMemberAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID })
    expect(result.success).toBe(false)
    expect(mockRevokeMember).not.toHaveBeenCalled()
  })

  it('returns error when service throws', async () => {
    mockRevokeMember.mockRejectedValue(new Error('Active or suspended membership not found'))
    const result = await revokeMemberAction({ organizationId: ORG_ID, membershipId: MEMBERSHIP_ID })
    expect(result.success).toBe(false)
  })
})

// ─── listPendingInvitesAction ─────────────────────────────────────────────────

describe('listPendingInvitesAction', () => {
  it('returns pending invites on success', async () => {
    const invites = [{ user_id: USER_ID, email: 'user@example.com' }]
    mockListPendingInvites.mockResolvedValue(invites)
    const result = await listPendingInvitesAction(ORG_ID)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(invites)
    expect(mockListPendingInvites).toHaveBeenCalledWith(ORG_ID)
  })

  it('returns error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await listPendingInvitesAction(ORG_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authorized.')
  })

  it('returns error when caller lacks permission', async () => {
    mockRequirePermission.mockRejectedValue(new Error('Forbidden'))
    const result = await listPendingInvitesAction(ORG_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authorized.')
  })
})

// ─── deleteInviteAction ───────────────────────────────────────────────────────

describe('deleteInviteAction', () => {
  it('calls deleteInvite and returns success', async () => {
    mockDeleteInvite.mockResolvedValue(undefined)
    const result = await deleteInviteAction({ organizationId: ORG_ID, userId: USER_ID })
    expect(result.success).toBe(true)
    expect(mockDeleteInvite).toHaveBeenCalledWith(ORG_ID, USER_ID)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/users/invite')
  })

  it('returns error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await deleteInviteAction({ organizationId: ORG_ID, userId: USER_ID })
    expect(result.success).toBe(false)
    expect(mockDeleteInvite).not.toHaveBeenCalled()
  })

  it('returns error when caller lacks permission', async () => {
    mockRequirePermission.mockRejectedValue(new Error('Not authorized.'))
    const result = await deleteInviteAction({ organizationId: ORG_ID, userId: USER_ID })
    expect(result.success).toBe(false)
    expect(mockDeleteInvite).not.toHaveBeenCalled()
  })

  it('returns error when service throws', async () => {
    mockDeleteInvite.mockRejectedValue(new Error('RPC failed'))
    const result = await deleteInviteAction({ organizationId: ORG_ID, userId: USER_ID })
    expect(result.success).toBe(false)
    expect(result.error).toBe('RPC failed')
  })
})

// ─── resendInviteAction ───────────────────────────────────────────────────────

describe('resendInviteAction', () => {
  it('calls resendInvite with all params and returns success', async () => {
    mockResendInvite.mockResolvedValue(undefined)
    const result = await resendInviteAction({ organizationId: ORG_ID, userId: USER_ID, email: 'user@example.com', roles: ['Scheduler'] })
    expect(result.success).toBe(true)
    expect(mockResendInvite).toHaveBeenCalledWith(ORG_ID, USER_ID, 'user@example.com', ['Scheduler'])
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/users/invite')
  })

  it('returns error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await resendInviteAction({ organizationId: ORG_ID, userId: USER_ID, email: 'user@example.com', roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(mockResendInvite).not.toHaveBeenCalled()
  })

  it('returns error when caller lacks permission', async () => {
    mockRequirePermission.mockRejectedValue(new Error('Not authorized.'))
    const result = await resendInviteAction({ organizationId: ORG_ID, userId: USER_ID, email: 'user@example.com', roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(mockResendInvite).not.toHaveBeenCalled()
  })

  it('returns error when service throws', async () => {
    mockResendInvite.mockRejectedValue(new Error('RPC failed'))
    const result = await resendInviteAction({ organizationId: ORG_ID, userId: USER_ID, email: 'user@example.com', roles: ['Scheduler'] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('RPC failed')
  })
})
