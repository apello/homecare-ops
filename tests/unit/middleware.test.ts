import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }))

import { createServerClient } from '@supabase/ssr'
import { middleware } from '../../middleware'
import {
  IDLE_TIMEOUT_MS,
  LAST_ACTIVITY_COOKIE,
  SESSION_STARTED_COOKIE,
  SESSION_TIMEBOX_MS,
} from '@/lib/auth/session-policy'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(path: string) {
  // TODO: update base URL to the real production domain before go-live
  return new NextRequest(`http://localhost${path}`)
}

function makeRequestWithCookies(
  path: string,
  cookies: Record<string, string>,
  headers?: Record<string, string>,
) {
  const request = new NextRequest(`http://localhost${path}`, { headers })
  Object.entries(cookies).forEach(([name, value]) => request.cookies.set(name, value))
  return request
}

function mockGetUser(user: object | null) {
  ;(createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  })
}

function mockAuthedClientWithSignOut() {
  const signOut = vi.fn().mockResolvedValue({ error: null })
  ;(createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: FAKE_USER } }), signOut },
  })
  return signOut
}

const FAKE_USER = { id: 'user-1', email: 'test@example.com' }

// ─── Unauthenticated ──────────────────────────────────────────────────────────

describe('middleware — unauthenticated user', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetUser(null) })

  it.each(['/dashboard', '/patients', '/caregivers', '/shifts', '/call-offs', '/settings'])(
    'redirects %s to /login',
    async (path) => {
      const res = await middleware(makeRequest(path))
      expect(res.headers.get('location')).toContain('/login')
    }
  )

  it('includes redirectTo param preserving the original path', async () => {
    const res = await middleware(makeRequest('/dashboard'))
    const location = decodeURIComponent(res.headers.get('location') ?? '')
    expect(location).toContain('redirectTo=/dashboard')
  })

  it('preserves nested paths in redirectTo', async () => {
    const res = await middleware(makeRequest('/patients/abc-123'))
    const location = decodeURIComponent(res.headers.get('location') ?? '')
    expect(location).toContain('redirectTo=/patients/abc-123')
  })

  it('passes through /login without redirecting', async () => {
    const res = await middleware(makeRequest('/login'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through unprotected routes', async () => {
    const res = await middleware(makeRequest('/'))
    expect(res.headers.get('location')).toBeNull()
  })
})

// ─── Authenticated ────────────────────────────────────────────────────────────

describe('middleware — authenticated user', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetUser(FAKE_USER) })

  it('redirects /login to /dashboard', async () => {
    const res = await middleware(makeRequest('/login'))
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('does NOT redirect /logout (allows sign-out to proceed)', async () => {
    const res = await middleware(makeRequest('/logout'))
    expect(res.headers.get('location')).toBeNull()
  })

  it.each(['/dashboard', '/patients', '/caregivers', '/shifts', '/call-offs', '/settings'])(
    'passes through %s without redirecting',
    async (path) => {
      const res = await middleware(makeRequest(path))
      expect(res.headers.get('location')).toBeNull()
    }
  )
})

// ─── Session expiry messaging ─────────────────────────────────────────────────

describe('middleware — expired vs never-signed-in', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetUser(null) })

  it('flags reason=session_expired when auth cookies were present but no user came back', async () => {
    const req = makeRequestWithCookies('/patients', { 'sb-abc-auth-token': 'stale' })
    const res = await middleware(req)
    const location = res.headers.get('location')!
    expect(location).toContain('reason=session_expired')
    expect(location).toContain('redirectTo=%2Fpatients')
  })

  it('does NOT flag an expiry for a user who was never signed in', async () => {
    const res = await middleware(makeRequest('/patients'))
    expect(res.headers.get('location')).not.toContain('reason=')
  })

  it('ignores a leftover PKCE code-verifier cookie as evidence of a session', async () => {
    const req = makeRequestWithCookies('/patients', { 'sb-abc-auth-token-code-verifier': 'x' })
    const res = await middleware(req)
    expect(res.headers.get('location')).not.toContain('reason=')
  })
})

// ─── App-level session policy ─────────────────────────────────────────────────

describe('middleware — idle timeout and timebox', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('signs out and redirects when idle longer than the timeout', async () => {
    const signOut = mockAuthedClientWithSignOut()
    const staleActivity = String(Date.now() - (IDLE_TIMEOUT_MS + 60_000))

    const req = makeRequestWithCookies('/patients', { [LAST_ACTIVITY_COOKIE]: staleActivity })
    const res = await middleware(req)

    expect(signOut).toHaveBeenCalledOnce()
    expect(res.headers.get('location')).toContain('reason=session_expired')
  })

  it('signs out when the session exceeds its maximum lifetime even while active', async () => {
    const signOut = mockAuthedClientWithSignOut()
    const now = Date.now()

    const req = makeRequestWithCookies('/patients', {
      [LAST_ACTIVITY_COOKIE]: String(now - 1000), // active seconds ago
      [SESSION_STARTED_COOKIE]: String(now - (SESSION_TIMEBOX_MS + 60_000)),
    })
    const res = await middleware(req)

    expect(signOut).toHaveBeenCalledOnce()
    expect(res.headers.get('location')).toContain('reason=session_expired')
  })

  it('allows an active session through and refreshes the activity stamp', async () => {
    const signOut = mockAuthedClientWithSignOut()
    const req = makeRequestWithCookies('/patients', {
      [LAST_ACTIVITY_COOKIE]: String(Date.now() - 60_000),
    })
    const res = await middleware(req)

    expect(signOut).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBeNull()
    expect(res.cookies.get(LAST_ACTIVITY_COOKIE)).toBeDefined()
  })

  it('seeds both timestamps on a first authenticated request', async () => {
    mockAuthedClientWithSignOut()
    const res = await middleware(makeRequest('/patients'))

    expect(res.cookies.get(LAST_ACTIVITY_COOKIE)).toBeDefined()
    expect(res.cookies.get(SESSION_STARTED_COOKIE)).toBeDefined()
  })

  it('does not count a router prefetch as user activity', async () => {
    mockAuthedClientWithSignOut()
    const req = makeRequestWithCookies(
      '/patients',
      { [LAST_ACTIVITY_COOKIE]: String(Date.now() - 60_000) },
      { 'next-router-prefetch': '1' },
    )
    const res = await middleware(req)

    expect(res.cookies.get(LAST_ACTIVITY_COOKIE)).toBeUndefined()
  })

  it('marks the activity cookie httpOnly so page scripts cannot extend a session', async () => {
    mockAuthedClientWithSignOut()
    const res = await middleware(makeRequest('/patients'))

    expect(res.cookies.get(LAST_ACTIVITY_COOKIE)?.httpOnly).toBe(true)
  })
})
