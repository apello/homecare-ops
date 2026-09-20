import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getCaregiver, listCredentials } from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import CredentialList from '../../_components/CredentialList'

interface CredentialListPageProps {
  params: Promise<{
    caregiverId: string
  }>
}

export default async function CredentialListPage({ params }: CredentialListPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const [caregiver, credentials] = await Promise.all([
    getCaregiver(orgId, resolvedParams.caregiverId),
    listCredentials(orgId, resolvedParams.caregiverId),
  ])

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  return <CredentialList caregiver={caregiver} orgId={orgId} credentials={credentials} />
}
