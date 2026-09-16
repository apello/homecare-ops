import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import {
  getPatient,
  listPatientAddresses,
  listPatientContacts,
  listPatientRequirements,
} from '@/lib/services/patients.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import PatientCore from '../_components/PatientCore'

interface PatientPageProps {
  params: Promise<{
    patientId: string
  }>
}

export default async function PatientPage({ params }: PatientPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'patients.read_basic')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const patient = await getPatient(orgId, resolvedParams.patientId)

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  const addressesPromise = listPatientAddresses(orgId, patient.id, 4)
  const contactsPromise = listPatientContacts(orgId, patient.id, 4)
  const requirementsPromise = listPatientRequirements(orgId, patient.id, undefined, 4)

  return (
    <PatientCore
      patient={patient}
      addressesPromise={addressesPromise}
      contactsPromise={contactsPromise}
      requirementsPromise={requirementsPromise}
    />
  )
}
