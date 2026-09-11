import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getPatientAction, listPatientContactsAction } from '../../../../actions'
import ContactForm from '../../../../_components/ContactForm'

interface ContactEditPageProps {
  params: Promise<{
    patientId: string
    contactId: string
  }>
}

export default async function ContactEditPage({ params }: ContactEditPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'patients.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const orgId = membership.organization_id

  const [patientResult, contactsResult] = await Promise.all([
    getPatientAction(orgId, resolvedParams.patientId),
    listPatientContactsAction(orgId, resolvedParams.patientId),
  ])

  const patient = patientResult.success ? patientResult.data ?? null : null

  if (!patient) {
    return <Typography sx={{ p: 3 }}>Patient not found.</Typography>
  }

  const contact = (contactsResult.success ? contactsResult.data ?? [] : []).find(
    (item) => item.id === resolvedParams.contactId,
  )

  if (!contact) {
    return <Typography sx={{ p: 3 }}>Contact not found.</Typography>
  }

  return <ContactForm patient={patient} orgId={orgId} contact={contact} />
}
