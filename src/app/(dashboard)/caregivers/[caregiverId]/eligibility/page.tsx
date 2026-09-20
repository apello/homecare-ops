import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getCaregiver, listServiceEligibility } from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import EligibilityList from '../../_components/EligibilityList'

interface EligibilityListPageProps {
  params: Promise<{
    caregiverId: string
  }>
}

export default async function EligibilityListPage({ params }: EligibilityListPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const [caregiver, eligibility] = await Promise.all([
    getCaregiver(orgId, resolvedParams.caregiverId),
    listServiceEligibility(orgId, resolvedParams.caregiverId),
  ])

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  return <EligibilityList caregiver={caregiver} orgId={orgId} eligibility={eligibility} />
}
