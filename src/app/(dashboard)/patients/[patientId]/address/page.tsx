import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getPatient, listPatientAddresses } from '@/lib/services/patients.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import PatientAddressList from '../../_components/PatientAddressList'

interface AddressListPageProps {
  params: Promise<{
    patientId: string
  }>
}

export default async function AddressListPage({ params }: AddressListPageProps) {
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

  return (
    <PatientAddressList
      patient={patient}
      orgId={orgId}
      addresses={addresses}
    />
  )
}
