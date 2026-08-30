import { redirect } from 'next/navigation'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { listPatients } from '@/lib/services/patients.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import PatientList from './_components/PatientList'

export default async function PatientsPage() {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'patients.read_basic')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const initialPatients = await listPatients(membership.organization_id)
  return (
    <PatientList
      orgId={membership.organization_id}
      initialPatients={initialPatients}
    />
  )
}
