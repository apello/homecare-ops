import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthError } from '@/lib/auth/server'

// ─── AuthError ────────────────────────────────────────────────────────────────

describe('AuthError', () => {
  it('defaults to "Not authorized." message', () => {
    const err = new AuthError()
    expect(err.message).toBe('Not authorized.')
    expect(err.name).toBe('AuthError')
  })

  it('accepts a custom message', () => {
    const err = new AuthError('Custom message')
    expect(err.message).toBe('Custom message')
  })

  it('is an instance of Error', () => {
    expect(new AuthError()).toBeInstanceOf(Error)
  })
})

// ─── requirePermission behaviour (unit — Supabase mocked) ────────────────────

vi.mock('@/lib/db/client', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/db/client'
import { hasPermission, requirePermission, isOrgAdmin } from '@/lib/permissions'

function mockRpc(returnValue: boolean) {
  const rpc = vi.fn().mockResolvedValue({ data: returnValue, error: null })
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc })
  return rpc
}

describe('hasPermission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when RPC returns true', async () => {
    mockRpc(true)
    expect(await hasPermission('org-1', 'shifts.manage')).toBe(true)
  })

  it('returns false when RPC returns false', async () => {
    mockRpc(false)
    expect(await hasPermission('org-1', 'shifts.manage')).toBe(false)
  })

  it('returns false when RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('db error') })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc })
    expect(await hasPermission('org-1', 'shifts.manage')).toBe(false)
  })
})

describe('requirePermission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves when permission is granted', async () => {
    mockRpc(true)
    await expect(requirePermission('org-1', 'shifts.manage')).resolves.toBeUndefined()
  })

  it('throws AuthError when permission is denied', async () => {
    mockRpc(false)
    await expect(requirePermission('org-1', 'shifts.manage')).rejects.toBeInstanceOf(AuthError)
  })
})

describe('isOrgAdmin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to has_org_permission with users.manage', async () => {
    const rpc = mockRpc(true)
    await isOrgAdmin('org-1')
    expect(rpc).toHaveBeenCalledWith('has_org_permission', {
      org_id: 'org-1',
      perm_code: 'users.manage',
    })
  })

  it('returns false when user is not admin', async () => {
    mockRpc(false)
    expect(await isOrgAdmin('org-1')).toBe(false)
  })
})
