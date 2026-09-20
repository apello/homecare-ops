import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import {
  getCaregiver,
  listAvailability,
  listCompensationRates,
  listCredentials,
  listServiceEligibility,
  listSkills,
} from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import CaregiverCore from '../_components/CaregiverCore'

interface CaregiverPageProps {
  params: Promise<{
    caregiverId: string
  }>
}

// Three displayed preview rows plus one sentinel row that only signals "View more".
const PREVIEW_FETCH_LIMIT = 4

export default async function CaregiverPage({ params }: CaregiverPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const orgId = membership.organization_id
  const allowed = await hasPermission(orgId, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const caregiver = await getCaregiver(orgId, resolvedParams.caregiverId)

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  const canReadCompensation = await hasPermission(orgId, 'caregivers.read_compensation')

  const credentialsPromise = listCredentials(orgId, caregiver.id, PREVIEW_FETCH_LIMIT)
  const skillsPromise = listSkills(orgId, caregiver.id, PREVIEW_FETCH_LIMIT)
  const eligibilityPromise = listServiceEligibility(orgId, caregiver.id, PREVIEW_FETCH_LIMIT)
  const availabilityPromise = listAvailability(orgId, caregiver.id, PREVIEW_FETCH_LIMIT)
  const compensationPromise = canReadCompensation
    ? listCompensationRates(orgId, caregiver.id, PREVIEW_FETCH_LIMIT)
    : null

  return (
    <CaregiverCore
      caregiver={caregiver}
      canReadCompensation={canReadCompensation}
      credentialsPromise={credentialsPromise}
      skillsPromise={skillsPromise}
      eligibilityPromise={eligibilityPromise}
      availabilityPromise={availabilityPromise}
      compensationPromise={compensationPromise}
    />
  )
}
