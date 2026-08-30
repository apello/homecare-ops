import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getPatientAction, listPatientRequirementsAction } from '../../../../actions'
import RequirementForm from '../../../../_components/RequirementForm'

interface RequirementEditPageProps {
  params: Promise<{
    patientId: string
    requirementId: string
  }>
}

export default async function RequirementEditPage({ params }: RequirementEditPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'patients.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const [patientResult, requirementsResult] = await Promise.all([
    getPatientAction(orgId, resolvedParams.patientId),
    listPatientRequirementsAction(orgId, resolvedParams.patientId),
  ])

  const patient = patientResult.success ? patientResult.data ?? null : null

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  const requirement = (requirementsResult.success ? requirementsResult.data ?? [] : []).find(
    (item) => item.id === resolvedParams.requirementId,
  )

  if (!requirement) {
    return <Typography sx={{ p: 3 }}>Requirement not found.</Typography>
  }

  return <RequirementForm patient={patient} orgId={orgId} requirement={requirement} />
}
