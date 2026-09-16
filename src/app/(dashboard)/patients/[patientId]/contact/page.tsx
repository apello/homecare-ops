import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getPatient, listPatientContacts } from '@/lib/services/patients.service'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import ContactList from '../../_components/ContactList'

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
  const orgId = membership.organization_id

  const [patient, contacts] = await Promise.all([
    getPatient(orgId, resolvedParams.patientId),
    listPatientContacts(orgId, resolvedParams.patientId),
  ])

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  return (
    <ContactList
      patient={patient}
      orgId={orgId}
      contacts={contacts}
    />
  )
}
