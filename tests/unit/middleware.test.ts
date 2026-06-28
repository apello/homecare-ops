import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }))

import { createServerClient } from '@supabase/ssr'
import { middleware } from '../../middleware'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(path: string) {
  // TODO: update base URL to the real production domain before go-live
  return new NextRequest(`http://localhost${path}`)
}

function mockGetUser(user: object | null) {
  ;(createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  })
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
