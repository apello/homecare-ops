import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/browser', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/db/browser'
import { completeInviteSetup } from '@/app/(auth)/accept-invite/actions'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSupabase(overrides: Record<string, unknown> = {}) {
  const base = {
    auth: {
      setSession: vi.fn(),
      updateUser: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn(),
    rpc: vi.fn(),
    ...overrides,
  }
  mockCreateClient.mockReturnValue(base)
  return base
}

const TOKENS = {
  access: 'access-token-123',
  refresh: 'refresh-token-456',
}

const USER_ID = '00000000-0000-0000-0000-000000000001'
const ORG_ID = '00000000-0000-0000-0000-000000000002'

// ─── completeInviteSetup ──────────────────────────────────────────────────────

describe('completeInviteSetup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('completes invite setup successfully without org', async () => {
    const supabase = makeSupabase()
    supabase.auth.setSession.mockResolvedValue({ error: null })
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, user_metadata: {} } },
      error: null,
    })
    supabase.eq.mockResolvedValue({ error: null })

    const result = await completeInviteSetup({
      tokens: TOKENS,
      firstName: 'John',
      lastName: 'Doe',
      password: 'SecurePassword123',
    })

    expect(result.error).toBeNull()
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: TOKENS.access,
      refresh_token: TOKENS.refresh,
    })
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'SecurePassword123' })
    expect(supabase.from).toHaveBeenCalledWith('user_profiles')
    expect(supabase.update).toHaveBeenCalledWith({
      first_name: 'John',
      last_name: 'Doe',
      access_status: 'Active',
    })
  })

  it('completes invite setup successfully with org', async () => {
    const supabase = makeSupabase()
    supabase.auth.setSession.mockResolvedValue({ error: null })
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, user_metadata: { pending_org_id: ORG_ID } } },
      error: null,
    })
    supabase.eq.mockResolvedValue({ error: null })
    supabase.rpc.mockResolvedValue({ error: null })

    const result = await completeInviteSetup({
      tokens: TOKENS,
      firstName: 'Jane',
      lastName: 'Smith',
      password: 'AnotherPassword456',
    })

    expect(result.error).toBeNull()
    expect(supabase.rpc).toHaveBeenCalledWith('complete_org_invite', {
      target_org_id: ORG_ID,
    })
  })

  it('returns error when setSession fails', async () => {
    const supabase = makeSupabase()
    supabase.auth.setSession.mockResolvedValue({ error: { message: 'Session failed' } })

    const result = await completeInviteSetup({
      tokens: TOKENS,
      firstName: 'John',
      lastName: 'Doe',
      password: 'Password123',
    })

    expect(result.error).toBe('Session failed')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('returns error when updateUser fails', async () => {
    const supabase = makeSupabase()
    supabase.auth.setSession.mockResolvedValue({ error: null })
    supabase.auth.updateUser.mockResolvedValue({ error: { message: 'Password update failed' } })

    const result = await completeInviteSetup({
      tokens: TOKENS,
      firstName: 'John',
      lastName: 'Doe',
      password: 'Password123',
    })

    expect(result.error).toBe('Password update failed')
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
  })

  it('returns error when user retrieval fails', async () => {
    const supabase = makeSupabase()
    supabase.auth.setSession.mockResolvedValue({ error: null })
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await completeInviteSetup({
      tokens: TOKENS,
      firstName: 'John',
      lastName: 'Doe',
      password: 'Password123',
    })

    expect(result.error).toBe('Unable to retrieve user after authentication.')
  })

  it('returns error with context when profile update fails', async () => {
    const supabase = makeSupabase()
    supabase.auth.setSession.mockResolvedValue({ error: null })
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, user_metadata: {} } },
      error: null,
    })
    supabase.eq.mockResolvedValue({ error: { message: 'Profile not found' } })

    const result = await completeInviteSetup({
      tokens: TOKENS,
      firstName: 'John',
      lastName: 'Doe',
      password: 'Password123',
    })

    expect(result.error).toContain('Account created but profile update failed')
    expect(result.error).toContain('Profile not found')
  })

  it('returns error with context when org invite completion fails', async () => {
    const supabase = makeSupabase()
    supabase.auth.setSession.mockResolvedValue({ error: null })
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, user_metadata: { pending_org_id: ORG_ID } } },
      error: null,
    })
    supabase.eq.mockResolvedValue({ error: null })
    supabase.rpc.mockResolvedValue({ error: { message: 'Org membership already exists' } })

    const result = await completeInviteSetup({
      tokens: TOKENS,
      firstName: 'John',
      lastName: 'Doe',
      password: 'Password123',
    })

    expect(result.error).toContain('Account created but membership setup failed')
    expect(result.error).toContain('Org membership already exists')
  })

  it('calls profile update with correct user id', async () => {
    const supabase = makeSupabase()
    supabase.auth.setSession.mockResolvedValue({ error: null })
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, user_metadata: {} } },
      error: null,
    })
    supabase.eq.mockResolvedValue({ error: null })

    await completeInviteSetup({
      tokens: TOKENS,
      firstName: 'John',
      lastName: 'Doe',
      password: 'Password123',
    })

    expect(supabase.eq).toHaveBeenCalledWith('id', USER_ID)
  })
})
