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
import { CAREGIVER_AVAILABILITY_STATUSES } from '@/lib/schemas/caregivers.schema'
import type { Caregiver } from '@/types'
import { upsertAvailabilityAction } from '../actions'
import { DAY_NAMES } from './CaregiverCore'

interface AvailabilityFormValues {
  day_of_week: string
  start_time: string
  end_time: string
  availability_status: string
  effective_start_date: string
  effective_end_date: string
}

const EMPTY_VALUES: AvailabilityFormValues = {
  day_of_week: '1',
  start_time: '09:00',
  end_time: '17:00',
  availability_status: 'Available',
  effective_start_date: '',
  effective_end_date: '',
}

export interface AvailabilityFormProps {
  caregiver: Caregiver
  orgId: string
}

export default function AvailabilityForm({ caregiver, orgId }: AvailabilityFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()

  const [values, setValues] = React.useState<AvailabilityFormValues>(EMPTY_VALUES)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const hasChanges = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(EMPTY_VALUES),
    [values],
  )

  const handleChange = React.useCallback((field: keyof AvailabilityFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors({})
  }, [])

  const handleReset = React.useCallback(() => {
    setValues(EMPTY_VALUES)
    setErrors({})
  }, [])

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}/availability`)
  }, [router, caregiver.id])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!values.effective_start_date) {
        setErrors({ effective_start_date: 'Effective start date is required.' })
        return
      }

      if (values.end_time <= values.start_time) {
        setErrors({ end_time: 'End time must be after start time.' })
        return
      }

      if (values.effective_end_date && values.effective_end_date < values.effective_start_date) {
        setErrors({ effective_end_date: 'Effective end date must be on or after the start date.' })
        return
      }

      setIsSubmitting(true)

      try {
        const result = await upsertAvailabilityAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          day_of_week: Number(values.day_of_week),
          start_time: values.start_time,
          end_time: values.end_time,
          availability_status: values.availability_status,
          effective_start_date: values.effective_start_date,
          effective_end_date: values.effective_end_date ? values.effective_end_date : null,
        })

        if (!result.success) {
          if (result.fieldErrors) {
            setErrors(
              Object.fromEntries(
                Object.entries(result.fieldErrors).map(([key, messages]) => [key, messages[0]]),
              ),
            )
          }
          notifications.show(result.error ?? 'Failed to save availability window.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show('Availability window saved.', { severity: 'success', autoHideDuration: 3000 })
        router.push(`/caregivers/${caregiver.id}/availability`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, orgId, caregiver.id, notifications, router],
  )

  return (
    <PageContainer
      title="Add Availability Window"
        breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` },
        { title: 'Availability', path: `/caregivers/${caregiver.id}/availability` },
        { title: 'Add Window' },
      ]}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}
      >
        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="day-label">Day of Week</InputLabel>
          <Select
            labelId="day-label"
            label="Day of Week"
            value={values.day_of_week}
            onChange={(e) => handleChange('day_of_week', e.target.value)}
          >
            {DAY_NAMES.map((day, index) => (
              <MenuItem key={day} value={String(index)}>
                {day}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={2}>
          <TextField
            label="Start Time"
            type="time"
            value={values.start_time}
            onChange={(e) => handleChange('start_time', e.target.value)}
            error={!!errors.start_time}
            helperText={errors.start_time}
            required
            fullWidth
            disabled={isSubmitting}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="End Time"
            type="time"
            value={values.end_time}
            onChange={(e) => handleChange('end_time', e.target.value)}
            error={!!errors.end_time}
            helperText={errors.end_time}
            required
            fullWidth
            disabled={isSubmitting}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>

        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="availability-status-label">Availability Status</InputLabel>
          <Select
            labelId="availability-status-label"
            label="Availability Status"
            value={values.availability_status}
            onChange={(e) => handleChange('availability_status', e.target.value)}
          >
            {CAREGIVER_AVAILABILITY_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={2}>
          <TextField
            label="Effective From"
            type="date"
            value={values.effective_start_date}
            onChange={(e) => handleChange('effective_start_date', e.target.value)}
            error={!!errors.effective_start_date}
            helperText={errors.effective_start_date}
            required
            fullWidth
            disabled={isSubmitting}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Effective To"
            type="date"
            value={values.effective_end_date}
            onChange={(e) => handleChange('effective_end_date', e.target.value)}
            error={!!errors.effective_end_date}
            helperText={errors.effective_end_date}
            fullWidth
            disabled={isSubmitting}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>

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
              {isSubmitting ? 'Saving...' : 'Save Window'}
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
