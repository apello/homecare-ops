import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getPatient, listPatientRequirements } from '@/lib/services/patients.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import RequirementList from '../../_components/RequirementList'

interface RequirementListPageProps {
  params: Promise<{
    patientId: string
  }>
}

export default async function RequirementListPage({ params }: RequirementListPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'patients.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const [patient, requirements] = await Promise.all([
    getPatient(orgId, resolvedParams.patientId),
    listPatientRequirements(orgId, resolvedParams.patientId),
  ])

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  return (
    <RequirementList
      patient={patient}
      orgId={orgId}
      requirements={requirements}
    />
  )
}
