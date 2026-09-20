import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getCaregiver, listCompensationRates } from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import CompensationList from '../../_components/CompensationList'

interface CompensationListPageProps {
  params: Promise<{
    caregiverId: string
  }>
}

export default async function CompensationListPage({ params }: CompensationListPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const orgId = membership.organization_id
  const [canManage, canReadCompensation] = await Promise.all([
    hasPermission(orgId, 'caregivers.manage'),
    hasPermission(orgId, 'caregivers.read_compensation'),
  ])

  if (!canManage || !canReadCompensation) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params

  const [caregiver, rates] = await Promise.all([
    getCaregiver(orgId, resolvedParams.caregiverId),
    listCompensationRates(orgId, resolvedParams.caregiverId),
  ])

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  return <CompensationList caregiver={caregiver} orgId={orgId} rates={rates} />
}
