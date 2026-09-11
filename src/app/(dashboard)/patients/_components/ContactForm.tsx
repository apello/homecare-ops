'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Patient, PatientContact } from '@/types'
import { CONTACT_RELATIONSHIPS, CONTACT_TYPES } from '@/lib/schemas/patients.schema'
import { upsertPatientContactAction } from '../actions'

interface ContactFormValues {
  contact_type: string
  contact_name: string
  relationship: string
  phone: string
  email: string
  authorized_contact: boolean
}

export interface ContactFormProps {
  patient: Patient
  orgId: string
  contact?: PatientContact
}

export default function ContactForm({ patient, orgId, contact }: ContactFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const isEditing = !!contact
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')

  const [values, setValues] = React.useState<ContactFormValues>({
    contact_type: contact?.contact_type ?? 'Emergency',
    contact_name: contact?.contact_name ?? '',
    relationship: contact?.relationship ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    authorized_contact: contact?.authorized_contact ?? false,
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleBackClick = React.useCallback(() => {
    router.push(`/patients/${patient.id}/contact`)
  }, [router, patient.id])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!values.contact_name.trim()) {
        setErrors({ contact_name: 'Contact name is required.' })
        return
      }

      setIsSubmitting(true)

      try {
        const result = await upsertPatientContactAction({
          organizationId: orgId,
          patientId: patient.id,
          contactId: contact?.id,
          contact_type: values.contact_type,
          contact_name: values.contact_name,
          relationship: values.relationship || undefined,
          phone: values.phone || undefined,
          email: values.email || undefined,
          authorized_contact: values.authorized_contact,
        })

        if (!result.success) {
          if (result.fieldErrors) {
            setErrors(
              Object.fromEntries(
                Object.entries(result.fieldErrors).map(([key, messages]) => [key, messages[0]]),
              ),
            )
          }
          notifications.show(result.error ?? 'Failed to save contact.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show(isEditing ? 'Contact updated successfully.' : 'Contact added successfully.', {
          severity: 'success',
          autoHideDuration: 3000,
        })

        router.push(`/patients/${patient.id}/contact`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, orgId, patient.id, contact?.id, isEditing, notifications, router],
  )

  return (
    <PageContainer
      title={isEditing ? 'Edit Contact' : 'Add Contact'}
      breadcrumbs={[
        { title: 'Patients', path: '/patients' },
        { title: fullName || 'Patient', path: `/patients/${patient.id}` },
        { title: 'Contacts', path: `/patients/${patient.id}/contact` },
        { title: isEditing ? 'Edit Contact' : 'Add Contact' },
      ]}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', mt: 1 }}
      >
        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="contact-type-label">Contact Type</InputLabel>
          <Select
            labelId="contact-type-label"
            label="Contact Type"
            value={values.contact_type}
            onChange={(e) => setValues((prev) => ({ ...prev, contact_type: e.target.value }))}
          >
            {CONTACT_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Contact Name"
          value={values.contact_name}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, contact_name: e.target.value }))
            setErrors({})
          }}
          error={!!errors.contact_name}
          helperText={errors.contact_name}
          required
          fullWidth
          disabled={isSubmitting}
        />

        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="contact-relationship-label">Relationship</InputLabel>
          <Select
            labelId="contact-relationship-label"
            label="Relationship"
            value={values.relationship}
            onChange={(e) => setValues((prev) => ({ ...prev, relationship: e.target.value }))}
          >
            <MenuItem value="">
              <em>Not specified</em>
            </MenuItem>
            {CONTACT_RELATIONSHIPS.map((relationship) => (
              <MenuItem key={relationship} value={relationship}>
                {relationship}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Phone"
          value={values.phone}
          onChange={(e) => setValues((prev) => ({ ...prev, phone: e.target.value }))}
          error={!!errors.phone}
          helperText={errors.phone}
          fullWidth
          disabled={isSubmitting}
        />

        <TextField
          label="Email"
          value={values.email}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, email: e.target.value }))
            setErrors({})
          }}
          error={!!errors.email}
          helperText={errors.email}
          fullWidth
          disabled={isSubmitting}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={values.authorized_contact}
              onChange={(e) => setValues((prev) => ({ ...prev, authorized_contact: e.target.checked }))}
              disabled={isSubmitting}
            />
          }
          label="Authorized to receive patient information"
        />

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackClick} disabled={isSubmitting}>
            Back
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Contact'}
          </Button>
        </Stack>
      </Box>
    </PageContainer>
  )
}
