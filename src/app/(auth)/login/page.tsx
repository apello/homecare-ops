'use client'

import { useActionState, useEffect, useState } from 'react'
import { signIn, type LoginState } from './actions'

const initialState: LoginState = { error: null }

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initialState)
  const [hashError, setHashError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    if (params.get('type') === 'invite') {
      window.location.replace('/accept-invite' + window.location.hash)
      return
    }
    if (params.get('error') === 'access_denied') {
      setHashError('This invitation link has expired or is no longer valid. Please contact your administrator to request a new invitation.')
    }
  }, [])

  return (
    <form action={action}>
      {(state.error || hashError) && <p role="alert">{hashError ?? state.error}</p>}

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
