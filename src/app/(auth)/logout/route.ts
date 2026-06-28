import { createClient } from '@/lib/db/client'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
