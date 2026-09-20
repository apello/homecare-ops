import { redirect } from 'next/navigation'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getCaregiver } from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import CaregiverEdit from '../../_components/CaregiverEdit'

interface CaregiverEditPageProps {
  params: Promise<{
    caregiverId: string
  }>
}

export default async function CaregiverEditPage({ params }: CaregiverEditPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const caregiver = await getCaregiver(membership.organization_id, resolvedParams.caregiverId)

  return <CaregiverEdit caregiver={caregiver} orgId={membership.organization_id} />
}
