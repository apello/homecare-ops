import { requireAuth, getActiveMembership, getUserProfile } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'

export default async function DashboardPage() {
  const user = await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'dashboard.read');
  if (!allowed) {
    return <UnauthorizedMessage />;
  }

  const profile = await getUserProfile()
  return (
    <div>
      <div>
        <span>Dashboard — Phase 11</span>
      </div>
      <p>User information:</p>
      <pre>{JSON.stringify({ user: { id: user.id, email: user.email }, profile, membership }, null, 2)}</pre>
    </div>
  )
}


