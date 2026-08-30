import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import {
  getPatientAction,
  listPatientAddressesAction,
  listPatientRequirementsAction,
} from '../actions'
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

  const [patientResult, addressesResult, requirementsResult] = await Promise.all([
    getPatientAction(orgId, resolvedParams.patientId),
    listPatientAddressesAction(orgId, resolvedParams.patientId),
    listPatientRequirementsAction(orgId, resolvedParams.patientId),
  ])

  const patient = patientResult.success ? patientResult.data ?? null : null

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  return (
    <PatientCore
      patient={patient}
      orgId={orgId}
      addresses={addressesResult.success ? addressesResult.data ?? [] : []}
      requirements={requirementsResult.success ? requirementsResult.data ?? [] : []}
    />
  )
}
