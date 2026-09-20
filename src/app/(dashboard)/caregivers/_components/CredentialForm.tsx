'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import { CAREGIVER_CREDENTIAL_STATUSES } from '@/lib/schemas/caregivers.schema'
import { CREDENTIAL_TYPES, type Caregiver, type CaregiverCredential } from '@/types'
import { upsertCredentialAction } from '../actions'

interface CredentialFormValues {
  credential_type: string
  credential_name: string
  credential_number: string
  issued_date: string
  expiration_date: string
  status: string
}

export interface CredentialFormProps {
  caregiver: Caregiver
  orgId: string
  credential?: CaregiverCredential
}

export default function CredentialForm({ caregiver, orgId, credential }: CredentialFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const isEditing = !!credential
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()

  const initialValues = React.useMemo<CredentialFormValues>(
    () => ({
      credential_type: credential?.credential_type ?? 'License',
      credential_name: credential?.credential_name ?? '',
      credential_number: credential?.encrypted_credential_number ?? '',
      issued_date: credential?.issued_date ?? '',
      expiration_date: credential?.expiration_date ?? '',
      status: credential?.status ?? 'Active',
    }),
    [credential],
  )

  const [values, setValues] = React.useState<CredentialFormValues>(initialValues)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const hasChanges = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [values, initialValues],
  )

  const handleChange = React.useCallback(
    <K extends keyof CredentialFormValues>(field: K, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }))
      setErrors({})
    },
    [],
  )

  const handleReset = React.useCallback(() => {
    setValues(initialValues)
    setErrors({})
  }, [initialValues])

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}/credential`)
  }, [router, caregiver.id])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!values.credential_name.trim()) {
        setErrors({ credential_name: 'Credential name is required.' })
        return
      }

      if (values.issued_date && values.expiration_date && values.expiration_date < values.issued_date) {
        setErrors({ expiration_date: 'Expiration date must be on or after the issued date.' })
        return
      }

      setIsSubmitting(true)

      try {
        const result = await upsertCredentialAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          credentialId: credential?.id,
          credential_type: values.credential_type,
          credential_name: values.credential_name,
          credential_number: values.credential_number.trim() ? values.credential_number.trim() : null,
          issued_date: values.issued_date ? values.issued_date : null,
          expiration_date: values.expiration_date ? values.expiration_date : null,
          status: values.status,
        })

        if (!result.success) {
          if (result.fieldErrors) {
            setErrors(
              Object.fromEntries(
                Object.entries(result.fieldErrors).map(([key, messages]) => [key, messages[0]]),
              ),
            )
          }
          notifications.show(result.error ?? 'Failed to save credential.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show(isEditing ? 'Credential updated.' : 'Credential added.', {
          severity: 'success',
          autoHideDuration: 3000,
        })

        router.push(`/caregivers/${caregiver.id}/credential`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, orgId, caregiver.id, credential?.id, isEditing, notifications, router],
  )

  return (
    <PageContainer
      title={isEditing ? 'Edit Credential' : 'Add Credential'}
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` },
        { title: 'Credentials', path: `/caregivers/${caregiver.id}/credential` },
        { title: isEditing ? 'Edit Credential' : 'Add Credential' },
      ]}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}
      >
        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="credential-type-label">Credential Type</InputLabel>
          <Select
            labelId="credential-type-label"
            label="Credential Type"
            value={values.credential_type}
            onChange={(e) => handleChange('credential_type', e.target.value)}
          >
            {CREDENTIAL_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Credential Name"
          value={values.credential_name}
          onChange={(e) => handleChange('credential_name', e.target.value)}
          error={!!errors.credential_name}
          helperText={errors.credential_name}
          required
          fullWidth
          disabled={isSubmitting}
        />

        <TextField
          label="Credential Number"
          value={values.credential_number}
          onChange={(e) => handleChange('credential_number', e.target.value)}
          error={!!errors.credential_number}
          helperText={errors.credential_number}
          fullWidth
          disabled={isSubmitting}
        />

        <Stack direction="row" spacing={2}>
          <TextField
            label="Issued Date"
            type="date"
            value={values.issued_date}
            onChange={(e) => handleChange('issued_date', e.target.value)}
            error={!!errors.issued_date}
            helperText={errors.issued_date}
            fullWidth
            disabled={isSubmitting}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Expiration Date"
            type="date"
            value={values.expiration_date}
            onChange={(e) => handleChange('expiration_date', e.target.value)}
            error={!!errors.expiration_date}
            helperText={errors.expiration_date}
            fullWidth
            disabled={isSubmitting}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>

        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="credential-status-label">Status</InputLabel>
          <Select
            labelId="credential-status-label"
            label="Status"
            value={values.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            {CAREGIVER_CREDENTIAL_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ width: '100%', mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip
            label={hasChanges ? 'Unsaved Changes' : 'No Changes'}
            color={hasChanges ? 'success' : 'default'}
            variant="outlined"
          />
          <Stack direction="row" spacing={1}>
            <Button type="reset" variant="text" onClick={handleReset} disabled={isSubmitting || !hasChanges}>
              Reset
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting || !hasChanges}>
              {isSubmitting ? 'Saving...' : 'Save Credential'}
            </Button>
          </Stack>
        </Box>

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackClick} disabled={isSubmitting}>
            Back
          </Button>
        </Stack>
      </Box>
    </PageContainer>
  )
}
