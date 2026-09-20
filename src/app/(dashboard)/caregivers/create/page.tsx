import { redirect } from 'next/navigation'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import CaregiverCreate from '../_components/CaregiverCreate'

export default async function CaregiverCreatePage() {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  return <CaregiverCreate orgId={membership.organization_id} />
}
