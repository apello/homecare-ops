import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getCaregiver } from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import EligibilityForm from '../../../_components/EligibilityForm'

interface EligibilityNewPageProps {
  params: Promise<{
    caregiverId: string
  }>
}

export default async function EligibilityNewPage({ params }: EligibilityNewPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id
  const caregiver = await getCaregiver(orgId, resolvedParams.caregiverId)

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  return <EligibilityForm caregiver={caregiver} orgId={orgId} />
}
