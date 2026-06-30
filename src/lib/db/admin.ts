import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types'

// Service-role client — bypasses RLS, server-only, never expose to browser
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
