import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/client', () => ({ createClient: vi.fn() }))
vi.mock('next/navigation',  () => ({ redirect: vi.fn() }))

import { createClient } from '@/lib/db/client'
import { redirect }      from 'next/navigation'
import { signIn }        from '@/app/(auth)/login/actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v))
  return fd
}

function mockSignInWithPassword(error: { message: string } | null) {
  const signInWithPassword = vi.fn().mockResolvedValue({ error })
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { signInWithPassword },
  })
  return signInWithPassword
}

const prev = { error: null }

// ─── Input validation ─────────────────────────────────────────────────────────

describe('signIn — input validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when email is empty', async () => {
    const result = await signIn(prev, makeFormData({ email: '', password: 'pass123' }))
    expect(result.error).toBe('Email and password are required.')
  })

  it('returns error when password is empty', async () => {
    const result = await signIn(prev, makeFormData({ email: 'a@b.com', password: '' }))
    expect(result.error).toBe('Email and password are required.')
  })

  it('does not call Supabase when inputs are missing', async () => {
    const spy = mockSignInWithPassword(null)
    await signIn(prev, makeFormData({ email: '', password: '' }))
    expect(spy).not.toHaveBeenCalled()
  })
})

// ─── GoTrue error handling ────────────────────────────────────────────────────

describe('signIn — GoTrue errors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a normalized message for invalid credentials', async () => {
    mockSignInWithPassword({ message: 'Invalid login credentials' })
    const result = await signIn(prev, makeFormData({ email: 'a@b.com', password: 'wrong' }))
    expect(result.error).toBe('Invalid email or password.')
  })

  it('returns the raw message for non-credential errors', async () => {
    mockSignInWithPassword({ message: 'Email not confirmed' })
    const result = await signIn(prev, makeFormData({ email: 'a@b.com', password: 'pass123' }))
    expect(result.error).toBe('Email not confirmed')
  })
})

// ─── Success ──────────────────────────────────────────────────────────────────

describe('signIn — success', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls redirect("/dashboard") on successful sign-in', async () => {
    mockSignInWithPassword(null)
    await signIn(prev, makeFormData({ email: 'a@b.com', password: 'pass123' }))
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('trims whitespace from the email before calling Supabase', async () => {
    const spy = mockSignInWithPassword(null)
    await signIn(prev, makeFormData({ email: '  a@b.com  ', password: 'pass123' }))
    expect(spy).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass123' })
  })
})
