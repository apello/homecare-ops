import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getPatientAction } from '../../actions'

interface ContactPageProps {
  params: Promise<{
    patientId: string
  }>
}

export default async function ContactPage({ params }: ContactPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'patients.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const patientResult = await getPatientAction(membership.organization_id, resolvedParams.patientId)
  const patient = patientResult.success ? patientResult.data ?? null : null

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  return (
    <Typography sx={{ p: 3 }}>Emergency contact management isnt available yet. Check back soon</Typography>
  )
}
