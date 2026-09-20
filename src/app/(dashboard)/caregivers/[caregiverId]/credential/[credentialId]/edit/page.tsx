import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getCaregiver, getCredential } from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import CredentialForm from '../../../../_components/CredentialForm'

interface CredentialEditPageProps {
  params: Promise<{
    caregiverId: string
    credentialId: string
  }>
}

export default async function CredentialEditPage({ params }: CredentialEditPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const [caregiver, credential] = await Promise.all([
    getCaregiver(orgId, resolvedParams.caregiverId),
    getCredential(orgId, resolvedParams.caregiverId, resolvedParams.credentialId),
  ])

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  if (!credential) {
    return <Typography sx={{ p: 3 }}>Credential not found.</Typography>
  }

  return <CredentialForm caregiver={caregiver} orgId={orgId} credential={credential} />
}
