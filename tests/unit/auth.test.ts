import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({ createClient: vi.fn() }))
vi.mock('next/navigation',  () => ({ redirect: vi.fn() }))

import { createClient } from '@/lib/db/client'
import { redirect }      from 'next/navigation'
import {
  getSession,
  requireAuth,
  getOrgMembership,
  getActiveMembership,
  getUserProfile,
} from '@/lib/auth/server'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_USER       = { id: 'user-1', email: 'test@example.com' }
const FAKE_MEMBERSHIP = { id: 'mem-1', organization_id: 'org-1', user_id: 'user-1', role: 'Scheduler', status: 'Active', joined_at: '2024-01-01' }
const FAKE_PROFILE    = { id: 'user-1', first_name: 'Test', last_name: 'User', access_status: 'Active' }

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Builds a Proxy that returns itself for every method call except:
 *   .single() → resolves with `result`
 *   .limit()  → returns { single } so .limit(1).single() works
 */
function makeQueryChain(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const chain: object = new Proxy({}, {
    get(_, prop: string) {
      if (prop === 'single') return single
      if (prop === 'limit')  return () => ({ single })
      return () => chain
    },
  })
  return chain
}

function mockSupabase({
  user        = null as object | null,
  authError   = null as Error | null,
  queryResult = { data: null, error: null } as { data: unknown; error: unknown },
} = {}) {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }) },
    from: vi.fn().mockReturnValue(makeQueryChain(queryResult)),
  }
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client)
  return client
}

// ─── getSession ───────────────────────────────────────────────────────────────

describe('getSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the user when auth succeeds', async () => {
    mockSupabase({ user: FAKE_USER })
    expect(await getSession()).toEqual(FAKE_USER)
  })

  it('returns null when auth.getUser errors', async () => {
    mockSupabase({ authError: new Error('network error') })
    expect(await getSession()).toBeNull()
  })

  it('returns null when user is null', async () => {
    mockSupabase({ user: null })
    expect(await getSession()).toBeNull()
  })
})

// ─── requireAuth ──────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the user when a session exists', async () => {
    mockSupabase({ user: FAKE_USER })
    expect(await requireAuth()).toEqual(FAKE_USER)
  })

  it('calls redirect("/login") when there is no session', async () => {
    mockSupabase({ user: null })
    await requireAuth()
    expect(redirect).toHaveBeenCalledWith('/login')
  })
})

// ─── getOrgMembership ─────────────────────────────────────────────────────────

describe('getOrgMembership', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the membership row when found', async () => {
    mockSupabase({ user: FAKE_USER, queryResult: { data: FAKE_MEMBERSHIP, error: null } })
    expect(await getOrgMembership('org-1')).toEqual(FAKE_MEMBERSHIP)
  })

  it('returns null when the DB errors', async () => {
    mockSupabase({ user: FAKE_USER, queryResult: { data: null, error: new Error('db error') } })
    expect(await getOrgMembership('org-1')).toBeNull()
  })

  it('returns null without querying DB when there is no session', async () => {
    const client = mockSupabase({ user: null })
    expect(await getOrgMembership('org-1')).toBeNull()
    expect(client.from).not.toHaveBeenCalled()
  })
})

// ─── getActiveMembership ──────────────────────────────────────────────────────

describe('getActiveMembership', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the first active membership', async () => {
    mockSupabase({ user: FAKE_USER, queryResult: { data: FAKE_MEMBERSHIP, error: null } })
    expect(await getActiveMembership()).toEqual(FAKE_MEMBERSHIP)
  })

  it('returns null when no active membership exists', async () => {
    mockSupabase({ user: FAKE_USER, queryResult: { data: null, error: new Error('no rows') } })
    expect(await getActiveMembership()).toBeNull()
  })

  it('returns null without querying DB when there is no session', async () => {
    const client = mockSupabase({ user: null })
    expect(await getActiveMembership()).toBeNull()
    expect(client.from).not.toHaveBeenCalled()
  })
})

// ─── getUserProfile ───────────────────────────────────────────────────────────

describe('getUserProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the profile row when found', async () => {
    mockSupabase({ user: FAKE_USER, queryResult: { data: FAKE_PROFILE, error: null } })
    expect(await getUserProfile()).toEqual(FAKE_PROFILE)
  })

  it('returns null when the DB errors', async () => {
    mockSupabase({ user: FAKE_USER, queryResult: { data: null, error: new Error('db error') } })
    expect(await getUserProfile()).toBeNull()
  })

  it('returns null without querying DB when there is no session', async () => {
    const client = mockSupabase({ user: null })
    expect(await getUserProfile()).toBeNull()
    expect(client.from).not.toHaveBeenCalled()
  })
})
