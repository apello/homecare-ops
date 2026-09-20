import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getCaregiver, listAvailability } from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import AvailabilityList from '../../_components/AvailabilityList'

interface AvailabilityListPageProps {
  params: Promise<{
    caregiverId: string
  }>
}

export default async function AvailabilityListPage({ params }: AvailabilityListPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const [caregiver, availability] = await Promise.all([
    getCaregiver(orgId, resolvedParams.caregiverId),
    listAvailability(orgId, resolvedParams.caregiverId),
  ])

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  return <AvailabilityList caregiver={caregiver} orgId={orgId} availability={availability} />
}
