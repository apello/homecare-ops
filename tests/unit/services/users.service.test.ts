import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/db/admin', () => ({ createAdminClient: vi.fn() }))

import { createClient } from '@/lib/db/client'
import { createAdminClient } from '@/lib/db/admin'
import {
  listOrgMembers,
  inviteUser,
  setMemberRoles,
  suspendMember,
  unsuspendMember,
  revokeMember,
} from '@/lib/services/users.service'

const mockClient = createClient as ReturnType<typeof vi.fn>
const mockAdmin = createAdminClient as ReturnType<typeof vi.fn>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSupabase(overrides: Record<string, unknown> = {}) {
  const base = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
    ...overrides,
  }
  mockClient.mockResolvedValue(base)
  return base
}

function makeAdminClient(overrides: Record<string, unknown> = {}) {
  const base = {
    auth: { admin: { inviteUserByEmail: vi.fn() } },
    from: vi.fn().mockReturnThis(),
    insert: vi.fn(),
    ...overrides,
  }
  mockAdmin.mockReturnValue(base)
  return base
}

const ORG_ID = 'org-uuid'
const MEMBERSHIP_ID = 'membership-uuid'
const USER_ID = 'user-uuid'
const OTHER_USER_ID = 'other-uuid'

// ─── listOrgMembers ───────────────────────────────────────────────────────────

describe('listOrgMembers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns members on success', async () => {
    const rows = [{ id: MEMBERSHIP_ID, profile: { id: USER_ID } }]
    const supabase = makeSupabase()
    supabase.order.mockResolvedValue({ data: rows, error: null })

    const result = await listOrgMembers(ORG_ID)
    expect(result).toEqual(rows)
  })

  it('returns empty array on error', async () => {
    const supabase = makeSupabase()
    supabase.order.mockResolvedValue({ data: null, error: { message: 'db error' } })

    const result = await listOrgMembers(ORG_ID)
    expect(result).toEqual([])
  })
})

// ─── inviteUser ───────────────────────────────────────────────────────────────

describe('inviteUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invites user and creates membership with roles array', async () => {
    const admin = makeAdminClient()
    admin.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: OTHER_USER_ID } },
      error: null,
    })
    admin.insert.mockResolvedValue({ error: null })

    await expect(inviteUser(ORG_ID, 'new@example.com', ['Scheduler'])).resolves.toBeUndefined()
    expect(admin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith('new@example.com')
  })

  it('inserts membership with provided roles', async () => {
    const admin = makeAdminClient()
    admin.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: OTHER_USER_ID } },
      error: null,
    })
    admin.insert.mockResolvedValue({ error: null })

    await inviteUser(ORG_ID, 'new@example.com', ['Scheduler', 'HR Coordinator'])

    expect(admin.from).toHaveBeenCalledWith('organization_memberships')
    expect(admin.insert).toHaveBeenCalledWith(expect.objectContaining({
      roles: ['Scheduler', 'HR Coordinator'],
      organization_id: ORG_ID,
      user_id: OTHER_USER_ID,
    }))
  })

  it('throws when auth invite fails', async () => {
    const admin = makeAdminClient()
    admin.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: 'invite failed' },
    })

    await expect(inviteUser(ORG_ID, 'new@example.com', ['Scheduler'])).rejects.toThrow('invite failed')
  })

  it('throws when membership insert fails', async () => {
    const admin = makeAdminClient()
    admin.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: OTHER_USER_ID } },
      error: null,
    })
    admin.insert.mockResolvedValue({ error: { message: 'insert failed' } })

    await expect(inviteUser(ORG_ID, 'new@example.com', ['Scheduler'])).rejects.toThrow('insert failed')
  })
})

// ─── setMemberRoles ───────────────────────────────────────────────────────────

describe('setMemberRoles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls set_org_member_roles RPC with resolved user_id and roles array', async () => {
    const membership = { id: MEMBERSHIP_ID, organization_id: ORG_ID, user_id: OTHER_USER_ID, status: 'Active' }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: membership, error: null })
    supabase.rpc.mockResolvedValue({ error: null })

    await setMemberRoles(ORG_ID, MEMBERSHIP_ID, ['Scheduler', 'HR Coordinator'])

    expect(supabase.rpc).toHaveBeenCalledWith('set_org_member_roles', {
      target_org_id: ORG_ID,
      target_user_id: OTHER_USER_ID,
      new_roles: ['Scheduler', 'HR Coordinator'],
    })
  })

  it('throws when membership lookup fails', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await expect(setMemberRoles(ORG_ID, MEMBERSHIP_ID, ['Scheduler'])).rejects.toThrow('not found')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('throws when RPC returns error', async () => {
    const membership = { id: MEMBERSHIP_ID, organization_id: ORG_ID, user_id: OTHER_USER_ID, status: 'Active' }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: membership, error: null })
    supabase.rpc.mockResolvedValue({ error: { message: 'Not authorized to manage users for this organization' } })

    await expect(setMemberRoles(ORG_ID, MEMBERSHIP_ID, ['Scheduler'])).rejects.toThrow('Not authorized')
  })
})

// ─── suspendMember ────────────────────────────────────────────────────────────

describe('suspendMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls suspend_org_member RPC with resolved user_id', async () => {
    const membership = { id: MEMBERSHIP_ID, organization_id: ORG_ID, user_id: OTHER_USER_ID, status: 'Active' }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: membership, error: null })
    supabase.rpc.mockResolvedValue({ error: null })

    await suspendMember(ORG_ID, MEMBERSHIP_ID)

    expect(supabase.rpc).toHaveBeenCalledWith('suspend_org_member', {
      target_org_id: ORG_ID,
      target_user_id: OTHER_USER_ID,
    })
  })

  it('throws when membership lookup fails', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await expect(suspendMember(ORG_ID, MEMBERSHIP_ID)).rejects.toThrow('not found')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('throws when RPC returns error', async () => {
    const membership = { id: MEMBERSHIP_ID, organization_id: ORG_ID, user_id: OTHER_USER_ID, status: 'Active' }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: membership, error: null })
    supabase.rpc.mockResolvedValue({ error: { message: 'Not authorized to manage users for this organization' } })

    await expect(suspendMember(ORG_ID, MEMBERSHIP_ID)).rejects.toThrow('Not authorized')
  })
})

// ─── unsuspendMember ──────────────────────────────────────────────────────────

describe('unsuspendMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls unsuspend_org_member RPC with resolved user_id', async () => {
    const membership = { id: MEMBERSHIP_ID, organization_id: ORG_ID, user_id: OTHER_USER_ID, status: 'Suspended' }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: membership, error: null })
    supabase.rpc.mockResolvedValue({ error: null })

    await unsuspendMember(ORG_ID, MEMBERSHIP_ID)

    expect(supabase.rpc).toHaveBeenCalledWith('unsuspend_org_member', {
      target_org_id: ORG_ID,
      target_user_id: OTHER_USER_ID,
    })
  })

  it('throws when membership lookup fails', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await expect(unsuspendMember(ORG_ID, MEMBERSHIP_ID)).rejects.toThrow('not found')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('throws when RPC returns error', async () => {
    const membership = { id: MEMBERSHIP_ID, organization_id: ORG_ID, user_id: OTHER_USER_ID, status: 'Suspended' }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: membership, error: null })
    supabase.rpc.mockResolvedValue({ error: { message: 'Suspended membership not found' } })

    await expect(unsuspendMember(ORG_ID, MEMBERSHIP_ID)).rejects.toThrow('Suspended membership not found')
  })
})

// ─── revokeMember ─────────────────────────────────────────────────────────────

describe('revokeMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls revoke_org_member RPC with resolved user_id', async () => {
    const membership = { id: MEMBERSHIP_ID, organization_id: ORG_ID, user_id: OTHER_USER_ID, status: 'Active' }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: membership, error: null })
    supabase.rpc.mockResolvedValue({ error: null })

    await revokeMember(ORG_ID, MEMBERSHIP_ID)

    expect(supabase.rpc).toHaveBeenCalledWith('revoke_org_member', {
      target_org_id: ORG_ID,
      target_user_id: OTHER_USER_ID,
    })
  })

  it('throws when membership lookup fails', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await expect(revokeMember(ORG_ID, MEMBERSHIP_ID)).rejects.toThrow('not found')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('throws when RPC returns error', async () => {
    const membership = { id: MEMBERSHIP_ID, organization_id: ORG_ID, user_id: OTHER_USER_ID, status: 'Active' }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: membership, error: null })
    supabase.rpc.mockResolvedValue({ error: { message: 'Active or suspended membership not found' } })

    await expect(revokeMember(ORG_ID, MEMBERSHIP_ID)).rejects.toThrow('Active or suspended membership not found')
  })
})
