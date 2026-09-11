import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getPatientAction, listPatientAddressesAction } from '../../../actions'
import PatientAddressForm from '../../../_components/PatientAddressForm'

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

  const [patientResult, addressesResult] = await Promise.all([
    getPatientAction(orgId, resolvedParams.patientId),
    listPatientAddressesAction(orgId, resolvedParams.patientId),
  ])
  const patient = patientResult.success ? patientResult.data ?? null : null

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  const existingAddressTypes = (addressesResult.success ? addressesResult.data ?? [] : []).map(
    (address) => address.address_type,
  )

  return (
    <PatientAddressForm
      patient={patient}
      orgId={orgId}
      existingAddressTypes={existingAddressTypes}
    />
  )
}
