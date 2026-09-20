import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getCaregiver, listSkills } from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import SkillList from '../../_components/SkillList'

interface SkillListPageProps {
  params: Promise<{
    caregiverId: string
  }>
}

export default async function SkillListPage({ params }: SkillListPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const [caregiver, skills] = await Promise.all([
    getCaregiver(orgId, resolvedParams.caregiverId),
    listSkills(orgId, resolvedParams.caregiverId),
  ])

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  return <SkillList caregiver={caregiver} orgId={orgId} skills={skills} />
}
