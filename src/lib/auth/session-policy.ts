/**
 * Session timeout policy, enforced by the app rather than by Supabase Auth.
 *
 * Supabase's own `inactivity_timeout` / `timebox` settings are Pro-plan only, so
 * on the current plan the Auth server keeps sessions alive indefinitely. These
 * values are enforced in two places instead:
 *
 *   - `middleware.ts` — authoritative. Checks timestamps on every matched request
 *     and signs the user out when either budget is blown.
 *   - `SessionWatcher` — covers the unattended screen, where no request is made
 *     and middleware therefore never runs.
 *
 * Timestamps live in plain (unsigned) cookies. They are `httpOnly` so page
 * scripts cannot touch them, but they are deliberately not tamper-proof: a user
 * with devtools can extend their own session. Only server-side enforcement by
 * Auth can prevent that.
 */

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
export const SESSION_TIMEBOX_MS = 8 * 60 * 60 * 1000 // 8 hours

export const LAST_ACTIVITY_COOKIE = 'ho-last-activity'
export const SESSION_STARTED_COOKIE = 'ho-session-started'

export const SESSION_EXPIRED_REASON = 'session_expired'

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const

/** Parses a cookie timestamp, treating malformed or future values as absent. */
export function parseTimestamp(value: string | undefined, now: number): number | null {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  // A timestamp in the future means a clock change or a hand-edited cookie;
  // ignore it so it cannot be used to hold a session open indefinitely.
  if (parsed > now) return null
  return parsed
}

/** Returns why the session should end, or null if it is still within policy. */
export function evaluateSessionPolicy(
  { lastActivity, sessionStarted }: { lastActivity: string | undefined; sessionStarted: string | undefined },
  now: number,
): 'idle' | 'timebox' | null {
  const last = parseTimestamp(lastActivity, now)
  if (last !== null && now - last > IDLE_TIMEOUT_MS) return 'idle'

  const started = parseTimestamp(sessionStarted, now)
  if (started !== null && now - started > SESSION_TIMEBOX_MS) return 'timebox'

  return null
}
