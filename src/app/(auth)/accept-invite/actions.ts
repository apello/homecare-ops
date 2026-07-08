import { createClient } from '@/lib/db/browser'

type Tokens = { access: string; refresh: string }

type SetupInput = {
  tokens: Tokens
  firstName: string
  lastName: string
  password: string
}

export async function completeInviteSetup({
  tokens,
  firstName,
  lastName,
  password,
}: SetupInput): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: tokens.access,
    refresh_token: tokens.refresh,
  })
  if (sessionError) return { error: sessionError.message }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) return { error: updateError.message }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unable to retrieve user after authentication.' }

  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ first_name: firstName, last_name: lastName, access_status: 'Active' })
    .eq('id', user.id)
  if (profileError) return { error: 'Account created but profile update failed: ' + profileError.message + '. Contact administrator to retry invitation.' }

  const orgId = user.user_metadata?.pending_org_id as string | undefined
  if (orgId) {
    const { error: memberError } = await supabase.rpc('complete_org_invite', {
      target_org_id: orgId,
    })
    if (memberError) return { error: 'Account created but membership setup failed: ' + memberError.message + '. Contact administrator to retry invitation.' }
  }

  return { error: null }
}
