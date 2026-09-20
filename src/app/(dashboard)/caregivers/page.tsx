import { redirect } from 'next/navigation'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { parsePaginationSearchParams } from '@/lib/pagination'
import { listCaregivers } from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { CAREGIVER_CLASSIFICATIONS, type CaregiverClassification } from '@/types'
import { CAREGIVER_STATUS_FILTERS, type CaregiverStatusFilter } from '@/lib/schemas/caregivers.schema'
import CaregiverList from './_components/CaregiverList'

interface CaregiversPageProps {
  searchParams: Promise<{
    page?: string | string[]
    pageSize?: string | string[]
    classification?: string | string[]
    status?: string | string[]
  }>
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function CaregiversPage({ searchParams }: CaregiversPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedSearchParams = await searchParams
  const paginationModel = parsePaginationSearchParams(resolvedSearchParams)

  const requestedClassification = firstValue(resolvedSearchParams.classification)
  const requestedStatus = firstValue(resolvedSearchParams.status)

  const filters = {
    classification: CAREGIVER_CLASSIFICATIONS.some((option) => option === requestedClassification)
      ? (requestedClassification as CaregiverClassification)
      : undefined,
    status: CAREGIVER_STATUS_FILTERS.some((option) => option === requestedStatus)
      ? (requestedStatus as CaregiverStatusFilter)
      : undefined,
  }

  const initialPage = await listCaregivers(membership.organization_id, {
    ...filters,
    ...paginationModel,
  })

  return (
    <CaregiverList
      orgId={membership.organization_id}
      initialPage={initialPage}
      initialPaginationModel={paginationModel}
      initialFilters={filters}
    />
  )
}
