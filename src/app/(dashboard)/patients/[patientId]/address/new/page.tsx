import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getPatientAction } from '../../../actions'
import AddressForm from '../../../_components/AddressForm'

interface AddressNewPageProps {
  params: Promise<{
    patientId: string
  }>
}

export default async function AddressNewPage({ params }: AddressNewPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'patients.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const patientResult = await getPatientAction(orgId, resolvedParams.patientId)
  const patient = patientResult.success ? patientResult.data ?? null : null

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  return <AddressForm patient={patient} orgId={orgId} />
}
