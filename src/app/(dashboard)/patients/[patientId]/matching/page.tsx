import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getPatient } from '@/lib/services/patients.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'

interface MatchingPageProps {
  params: Promise<{
    patientId: string
  }>
}

export default async function MatchingPage({ params }: MatchingPageProps) {
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

  return (
    <Typography sx={{ p: 3 }}>Caregiver matching isn&apos;t available yet. Check back soon</Typography>
  )
}
