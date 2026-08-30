import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getPatientAction, listPatientAddressesAction } from '../../../../actions'
import PatientAddressForm from '../../../../_components/PatientAddressForm'

interface AddressEditPageProps {
  params: Promise<{
    patientId: string
    addressId: string
  }>
}

export default async function AddressEditPage({ params }: AddressEditPageProps) {
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

  const address = (addressesResult.success ? addressesResult.data ?? [] : []).find(
    (item) => item.id === resolvedParams.addressId,
  )

  if (!address) {
    return <Typography sx={{ p: 3 }}>Address not found.</Typography>
  }

  return <PatientAddressForm patient={patient} orgId={orgId} address={address} />
}
