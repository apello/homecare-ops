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
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Caregiver } from '@/types'
import { upsertServiceEligibilityAction } from '../actions'

interface EligibilityFormValues {
  organization_service_id: string
  supervision_required: string
}

const EMPTY_VALUES: EligibilityFormValues = {
  organization_service_id: '',
  supervision_required: 'No',
}

export interface EligibilityFormProps {
  caregiver: Caregiver
  orgId: string
}

export default function EligibilityForm({ caregiver, orgId }: EligibilityFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()

  const [values, setValues] = React.useState<EligibilityFormValues>(EMPTY_VALUES)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const hasChanges = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(EMPTY_VALUES),
    [values],
  )

  const handleChange = React.useCallback((field: keyof EligibilityFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors({})
  }, [])

  const handleReset = React.useCallback(() => {
    setValues(EMPTY_VALUES)
    setErrors({})
  }, [])

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}/eligibility`)
  }, [router, caregiver.id])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!values.organization_service_id.trim()) {
        setErrors({ organization_service_id: 'Organization service ID is required.' })
        return
      }

      setIsSubmitting(true)

      try {
        const result = await upsertServiceEligibilityAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          organization_service_id: values.organization_service_id.trim(),
          supervision_required: values.supervision_required === 'Yes',
        })

        if (!result.success) {
          if (result.fieldErrors) {
            setErrors(
              Object.fromEntries(
                Object.entries(result.fieldErrors).map(([key, messages]) => [key, messages[0]]),
              ),
            )
          }
          notifications.show(result.error ?? 'Failed to save service eligibility.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show('Service eligibility added.', { severity: 'success', autoHideDuration: 3000 })
        router.push(`/caregivers/${caregiver.id}/eligibility`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, orgId, caregiver.id, notifications, router],
  )

  return (
    <PageContainer
      title="Add Service Eligibility"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` },
        { title: 'Service Eligibility', path: `/caregivers/${caregiver.id}/eligibility` },
        { title: 'Add Service' },
      ]}
    >
      {/* TODO(phase-6/authorizations): replace with a Select of organization services
          once listOrgServicesAction exists. */}
      <Typography component="p" variant="body2" color="text.secondary" sx={{ mt: -1, mb: 4 }}>
        Enter the organization service ID to approve for this caregiver. Adding a service that is already
        approved replaces the existing approval.
      </Typography>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}
      >
        <TextField
          label="Organization Service ID"
          value={values.organization_service_id}
          onChange={(e) => handleChange('organization_service_id', e.target.value)}
          error={!!errors.organization_service_id}
          helperText={errors.organization_service_id}
          required
          fullWidth
          disabled={isSubmitting}
        />

        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="supervision-label">Supervision Required</InputLabel>
          <Select
            labelId="supervision-label"
            label="Supervision Required"
            value={values.supervision_required}
            onChange={(e) => handleChange('supervision_required', e.target.value)}
          >
            <MenuItem value="No">No</MenuItem>
            <MenuItem value="Yes">Yes</MenuItem>
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
              {isSubmitting ? 'Saving...' : 'Save Service'}
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
