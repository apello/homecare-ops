import { requireAuth, getActiveMembership, getUserProfile } from '@/lib/auth/server'
import { requirePermission } from '@/lib/permissions'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  await requirePermission(membership.organization_id, 'dashboard.read')

  const profile = await getUserProfile()

  return (
    <div>
      <div>
        <span>Dashboard — Phase 11</span>
        <form action="/logout">
          <button type="submit">Logout</button>
        </form>
      </div>

      <pre>{JSON.stringify({ user: { id: user.id, email: user.email }, profile, membership }, null, 2)}</pre>
    </div>
  )
}


