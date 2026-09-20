'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/browser'
import { IDLE_TIMEOUT_MS, SESSION_EXPIRED_REASON } from '@/lib/auth/session-policy'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown'] as const
// How often to compare "now" against the last activity stamp. Polling on an
// interval is cheaper than clearing and re-arming a timeout on every event.
const IDLE_CHECK_INTERVAL_MS = 30 * 1000

/**
 * Two jobs:
 *
 *  1. Redirect to login the moment the session ends, instead of leaving a dead UI
 *     on screen until the next server navigation happens to run middleware.
 *  2. Enforce the idle timeout on an unattended screen. Middleware only runs when
 *     a request is made, so an abandoned tab is never noticed by the server until
 *     someone touches it again — which is precisely the case this guards against.
 *
 * Middleware remains authoritative; this is the belt to its braces.
 */
export default function SessionWatcher() {
  const router = useRouter()
  const pathname = usePathname()

  // Held in a ref so activity listeners never trigger a re-render. Seeded inside
  // the effect rather than here, because reading the clock during render is impure.
  const lastActivityRef = React.useRef(0)

  React.useEffect(() => {
    const supabase = createClient()
    lastActivityRef.current = Date.now()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return

      // /logout already routes to a clean login page; tagging it as an expiry
      // would wrongly tell a deliberate sign-out that their session timed out.
      if (pathname === '/logout') return

      const params = new URLSearchParams({
        redirectTo: pathname,
        reason: SESSION_EXPIRED_REASON,
      })
      router.replace(`/login?${params.toString()}`)
    })

    const markActive = () => {
      lastActivityRef.current = Date.now()
    }

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActive, { passive: true }),
    )

    let signingOut = false
    const interval = window.setInterval(() => {
      if (signingOut) return
      if (Date.now() - lastActivityRef.current <= IDLE_TIMEOUT_MS) return

      // signOut() emits SIGNED_OUT, which the listener above turns into the
      // redirect, so there is no need to navigate here as well.
      signingOut = true
      void supabase.auth.signOut()
    }, IDLE_CHECK_INTERVAL_MS)

    return () => {
      subscription.unsubscribe()
      window.clearInterval(interval)
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive))
    }
  }, [pathname, router])

  return null
}
