import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getCaregiver, getSkill } from '@/lib/services/caregivers.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import SkillForm from '../../../../_components/SkillForm'

interface SkillEditPageProps {
  params: Promise<{
    caregiverId: string
    skillId: string
  }>
}

export default async function SkillEditPage({ params }: SkillEditPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const [caregiver, skill] = await Promise.all([
    getCaregiver(orgId, resolvedParams.caregiverId),
    getSkill(orgId, resolvedParams.caregiverId, resolvedParams.skillId),
  ])

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  if (!skill) {
    return <Typography sx={{ p: 3 }}>Skill not found.</Typography>
  }

  return <SkillForm caregiver={caregiver} orgId={orgId} skill={skill} />
}
