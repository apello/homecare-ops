'use server'

import { createClient } from '@/lib/db/client'
import { redirect } from 'next/navigation'

export type LoginState = { error: string | null }

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email    = (formData.get('email')    as string)?.trim()
  const password = (formData.get('password') as string)

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Normalise GoTrue error messages — don't leak internal details
    const isCredentials = error.message.toLowerCase().includes('invalid')
    return { error: isCredentials ? 'Invalid email or password.' : error.message }
  }

  redirect('/dashboard')
}
