import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  LAST_ACTIVITY_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_EXPIRED_REASON,
  SESSION_STARTED_COOKIE,
  evaluateSessionPolicy,
} from '@/lib/auth/session-policy'

// Routes that require a logged-in user
const PROTECTED_ROUTES = ['/dashboard', '/patients', '/caregivers', '/shifts', '/call-offs', '/settings']
// Routes only for unauthenticated users (except /logout)
const AUTH_ROUTES = ['/login', '/logout']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Capture this before getUser(), because the cookie handler below mutates
  // request.cookies when a session is refreshed or cleared.
  const hadSessionCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith('sb-') &&
        cookie.name.includes('auth-token') &&
        // PKCE leaves this behind mid-flow; it is not evidence of a real session.
        !cookie.name.includes('code-verifier'),
    )

  // Create a Supabase client that reads/writes auth cookies from the request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // Write updated cookies to both the request and response so the session stays in sync
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // A redirect creates a brand new response, so rotated/cleared auth cookies
  // written onto supabaseResponse must be copied across or they are lost. Losing
  // them makes the browser replay an already-rotated refresh token, which Auth
  // then rejects — logging the user out a few clicks into their next visit.
  const redirectTo = (url: URL) => {
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  // Refresh session — must not use getUser() from storage, always verify with server
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  const now = Date.now()
  // Link prefetches are issued by the router, not the person, so they must not
  // count as activity or an idle tab would keep itself alive.
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch'

  let sessionExpiredByPolicy = false

  if (user) {
    const expiry = evaluateSessionPolicy(
      {
        lastActivity: request.cookies.get(LAST_ACTIVITY_COOKIE)?.value,
        sessionStarted: request.cookies.get(SESSION_STARTED_COOKIE)?.value,
      },
      now,
    )

    if (expiry) {
      // Supabase-side inactivity/timebox limits are Pro-only, so enforce them here.
      await supabase.auth.signOut()
      sessionExpiredByPolicy = true
    } else if (!isPrefetch) {
      supabaseResponse.cookies.set(LAST_ACTIVITY_COOKIE, String(now), SESSION_COOKIE_OPTIONS)
      if (!request.cookies.get(SESSION_STARTED_COOKIE)) {
        supabaseResponse.cookies.set(SESSION_STARTED_COOKIE, String(now), SESSION_COOKIE_OPTIONS)
      }
    }
  }

  // Once there is no live session, these timestamps are stale and would otherwise
  // expire the *next* sign-in early.
  if (!user || sessionExpiredByPolicy) {
    supabaseResponse.cookies.delete(LAST_ACTIVITY_COOKIE)
    supabaseResponse.cookies.delete(SESSION_STARTED_COOKIE)
  }

  // Unauthenticated user trying to access a protected page → send to login
  if ((!user || sessionExpiredByPolicy) && isProtected) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname) // preserve intended destination
    // Auth cookies were sent but no user came back: the session expired or was
    // revoked, as opposed to never having been signed in at all.
    if (hadSessionCookie || sessionExpiredByPolicy) {
      loginUrl.searchParams.set('reason', SESSION_EXPIRED_REASON)
    }
    return redirectTo(loginUrl)
  }

  // Authenticated user trying to access login → send to dashboard
  if (user && !sessionExpiredByPolicy && isAuthRoute && pathname !== '/logout') {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return redirectTo(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
