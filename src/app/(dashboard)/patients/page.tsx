import { redirect } from 'next/navigation'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { parsePaginationSearchParams } from '@/lib/pagination'
import { listPatients } from '@/lib/services/patients.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import PatientList from './_components/PatientList'

interface PatientsPageProps {
  searchParams: Promise<{
    page?: string | string[]
    pageSize?: string | string[]
  }>
}

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'patients.read_basic')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const paginationModel = parsePaginationSearchParams(await searchParams)
  const initialPage = await listPatients(membership.organization_id, paginationModel)
  return (
    <PatientList
      orgId={membership.organization_id}
      initialPage={initialPage}
      initialPaginationModel={paginationModel}
    />
  )
}
