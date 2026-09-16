import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getPatient, listPatientAddresses } from '@/lib/services/patients.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
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

  const [patient, addresses] = await Promise.all([
    getPatient(orgId, resolvedParams.patientId),
    listPatientAddresses(orgId, resolvedParams.patientId),
  ])

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  const existingAddressTypes = addresses.map((address) => address.address_type)

  return (
    <PatientAddressForm
      patient={patient}
      orgId={orgId}
      existingAddressTypes={existingAddressTypes}
    />
  )
}
