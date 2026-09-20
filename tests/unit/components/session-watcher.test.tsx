import { render, act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}))

vi.mock('@/lib/db/browser', () => ({ createClient: vi.fn() }))

import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/db/browser'
import SessionWatcher from '@/components/SessionWatcher'
import { IDLE_TIMEOUT_MS } from '@/lib/auth/session-policy'

const mockUseRouter = useRouter as ReturnType<typeof vi.fn>
const mockUsePathname = usePathname as ReturnType<typeof vi.fn>
const mockCreateClient = createClient as ReturnType<typeof vi.fn>

const replace = vi.fn()
const signOut = vi.fn()
const unsubscribe = vi.fn()

/** Captures the SIGNED_OUT handler so tests can fire auth events by hand. */
let emitAuthEvent: (event: string) => void

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()

  mockUseRouter.mockReturnValue({ replace })
  mockUsePathname.mockReturnValue('/patients')
  signOut.mockResolvedValue({ error: null })

  mockCreateClient.mockReturnValue({
    auth: {
      signOut,
      onAuthStateChange: (callback: (event: string) => void) => {
        emitAuthEvent = callback
        return { data: { subscription: { unsubscribe } } }
      },
    },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SessionWatcher — reacting to sign-out', () => {
  it('redirects to login with an expiry reason when the session ends', () => {
    render(<SessionWatcher />)

    act(() => emitAuthEvent('SIGNED_OUT'))

    expect(replace).toHaveBeenCalledWith(
      '/login?redirectTo=%2Fpatients&reason=session_expired',
    )
  })

  it('ignores auth events that are not a sign-out', () => {
    render(<SessionWatcher />)

    act(() => emitAuthEvent('TOKEN_REFRESHED'))
    act(() => emitAuthEvent('SIGNED_IN'))

    expect(replace).not.toHaveBeenCalled()
  })

  it('does not claim an expiry when the user signed out deliberately', () => {
    mockUsePathname.mockReturnValue('/logout')
    render(<SessionWatcher />)

    act(() => emitAuthEvent('SIGNED_OUT'))

    expect(replace).not.toHaveBeenCalled()
  })
})

describe('SessionWatcher — idle timeout', () => {
  it('signs out once the idle budget is exceeded', () => {
    render(<SessionWatcher />)

    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 60_000)
    })

    expect(signOut).toHaveBeenCalledOnce()
  })

  it('does not sign out while still within the idle budget', () => {
    render(<SessionWatcher />)

    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 60_000)
    })

    expect(signOut).not.toHaveBeenCalled()
  })

  it('resets the countdown when the user interacts', () => {
    render(<SessionWatcher />)

    // Idle almost to the limit, then act like a present user.
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 60_000)
      window.dispatchEvent(new Event('keydown'))
    })

    // Crossing the original deadline must no longer trigger a sign-out.
    act(() => {
      vi.advanceTimersByTime(120_000)
    })

    expect(signOut).not.toHaveBeenCalled()

    // A fresh full idle period still does.
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS)
    })

    expect(signOut).toHaveBeenCalledOnce()
  })

  it('signs out only once while idle, not on every poll', () => {
    render(<SessionWatcher />)

    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 10 * 60_000)
    })

    expect(signOut).toHaveBeenCalledOnce()
  })

  it('stops listening and polling after unmount', () => {
    const { unmount } = render(<SessionWatcher />)
    unmount()

    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2)
    })

    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(signOut).not.toHaveBeenCalled()
  })
})
