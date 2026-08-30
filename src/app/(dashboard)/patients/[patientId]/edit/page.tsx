import { redirect } from 'next/navigation'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getPatientAction } from '../../actions'
import PatientEdit from '../../_components/PatientEdit'

interface PatientEditPageProps {
  params: Promise<{
    patientId: string
  }>
}

export default async function PatientEditPage({ params }: PatientEditPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'patients.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const result = await getPatientAction(membership.organization_id, resolvedParams.patientId)
  const patient = result.success ? result.data ?? null : null

  return (
    <PatientEdit
      patient={patient}
      orgId={membership.organization_id}
    />
  )
}
