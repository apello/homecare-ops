import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getPatient } from '@/lib/services/patients.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'

interface AuthorizationPageProps {
  params: Promise<{
    patientId: string
  }>
}

export default async function AuthorizationPage({ params }: AuthorizationPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'patients.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const patient = await getPatient(membership.organization_id, resolvedParams.patientId)

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  // TODO(phase-6/authorizations): placeholder only. Plan §4.7 / §6 — build the full
  // patient_authorizations + authorization_services slice (migration 00014 → types →
  // authorizations.schema.ts → authorizations.service.ts → actions → this page plus
  // /new and /[authorizationId]/edit → AuthorizationList / AuthorizationForm) and
  // replace this message. Also unblocks the empty section in PatientCore.
  return (
    <Typography sx={{ p: 3 }}>Authorization management isnt available yet. Check back soon.</Typography>
  )
}
