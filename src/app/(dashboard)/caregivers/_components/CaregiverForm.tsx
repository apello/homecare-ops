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
import { CAREGIVER_EMPLOYMENT_STATUSES, CAREGIVER_MATCHING_STATUSES } from '@/lib/schemas/caregivers.schema'
import { CAREGIVER_CLASSIFICATIONS } from '@/types'

export interface CaregiverFormValues {
  first_name: string
  last_name: string
  classification: string
  email: string
  phone: string
  employee_external_id: string
  max_hours_per_week: string
  service_area_zip: string
  travel_radius_miles: string
  employment_status: string
  matching_status: string
}

export interface CaregiverFormState {
  values: CaregiverFormValues
  errors: Record<string, string>
}

export const EMPTY_CAREGIVER_VALUES: CaregiverFormValues = {
  first_name: '',
  last_name: '',
  classification: 'HHA',
  email: '',
  phone: '',
  employee_external_id: '',
  max_hours_per_week: '',
  service_area_zip: '',
  travel_radius_miles: '',
  employment_status: 'Active',
  matching_status: 'Active',
}

interface CaregiverFormProps {
  formState: CaregiverFormState
  hasChanges?: boolean
  onFieldChange: (field: keyof CaregiverFormValues, value: string) => void
  onSubmit: (values: CaregiverFormValues) => void
  onReset: () => void
  onBackClick?: () => void
  isSubmitting?: boolean
  showStatusFields?: boolean
  submitLabel?: string
}

export default function CaregiverForm({
  formState,
  hasChanges = false,
  onFieldChange,
  onSubmit,
  onReset,
  onBackClick,
  isSubmitting = false,
  showStatusFields = false,
  submitLabel = 'Save Changes',
}: CaregiverFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formState.values)
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', mt: 2 }}
    >
      <TextField
        label="First Name"
        value={formState.values.first_name}
        onChange={(e) => onFieldChange('first_name', e.target.value)}
        error={!!formState.errors.first_name}
        helperText={formState.errors.first_name}
        required
        fullWidth
        disabled={isSubmitting}
      />

      <TextField
        label="Last Name"
        value={formState.values.last_name}
        onChange={(e) => onFieldChange('last_name', e.target.value)}
        error={!!formState.errors.last_name}
        helperText={formState.errors.last_name}
        required
        fullWidth
        disabled={isSubmitting}
      />

      <FormControl fullWidth disabled={isSubmitting}>
        <InputLabel id="classification-label">Classification</InputLabel>
        <Select
          labelId="classification-label"
          label="Classification"
          value={formState.values.classification}
          onChange={(e) => onFieldChange('classification', e.target.value)}
        >
          {CAREGIVER_CLASSIFICATIONS.map((classification) => (
            <MenuItem key={classification} value={classification}>
              {classification}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Email"
        type="email"
        value={formState.values.email}
        onChange={(e) => onFieldChange('email', e.target.value)}
        error={!!formState.errors.email}
        helperText={formState.errors.email}
        fullWidth
        disabled={isSubmitting}
      />

      <TextField
        label="Phone"
        value={formState.values.phone}
        onChange={(e) => onFieldChange('phone', e.target.value)}
        error={!!formState.errors.phone}
        helperText={formState.errors.phone}
        fullWidth
        disabled={isSubmitting}
      />

      <TextField
        label="Employee ID"
        value={formState.values.employee_external_id}
        onChange={(e) => onFieldChange('employee_external_id', e.target.value)}
        error={!!formState.errors.employee_external_id}
        helperText={formState.errors.employee_external_id}
        fullWidth
        disabled={isSubmitting}
      />

      <Stack direction="row" spacing={2}>
        <TextField
          label="Max Hours per Week"
          type="number"
          value={formState.values.max_hours_per_week}
          onChange={(e) => onFieldChange('max_hours_per_week', e.target.value)}
          error={!!formState.errors.max_hours_per_week}
          helperText={formState.errors.max_hours_per_week}
          fullWidth
          disabled={isSubmitting}
        />
        <TextField
          label="Service Area ZIP"
          value={formState.values.service_area_zip}
          onChange={(e) => onFieldChange('service_area_zip', e.target.value)}
          error={!!formState.errors.service_area_zip}
          helperText={formState.errors.service_area_zip}
          fullWidth
          disabled={isSubmitting}
        />
        <TextField
          label="Travel Radius (miles)"
          type="number"
          value={formState.values.travel_radius_miles}
          onChange={(e) => onFieldChange('travel_radius_miles', e.target.value)}
          error={!!formState.errors.travel_radius_miles}
          helperText={formState.errors.travel_radius_miles}
          fullWidth
          disabled={isSubmitting}
        />
      </Stack>

      {showStatusFields ? (
        <Stack direction="row" spacing={2}>
          <FormControl fullWidth disabled={isSubmitting}>
            <InputLabel id="employment-status-label">Employment Status</InputLabel>
            <Select
              labelId="employment-status-label"
              label="Employment Status"
              value={formState.values.employment_status}
              onChange={(e) => onFieldChange('employment_status', e.target.value)}
            >
              {CAREGIVER_EMPLOYMENT_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth disabled={isSubmitting}>
            <InputLabel id="matching-status-label">Matching Status</InputLabel>
            <Select
              labelId="matching-status-label"
              label="Matching Status"
              value={formState.values.matching_status}
              onChange={(e) => onFieldChange('matching_status', e.target.value)}
            >
              {CAREGIVER_MATCHING_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      ) : null}

      <Box sx={{ width: '100%', mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip
          label={hasChanges ? 'Unsaved Changes' : 'No Changes'}
          color={hasChanges ? 'success' : 'default'}
          variant="outlined"
        />
        <Stack direction="row" spacing={1}>
          <Button type="reset" variant="text" onClick={onReset} disabled={isSubmitting || !hasChanges}>
            Reset
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || !hasChanges}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={onBackClick} disabled={isSubmitting}>
          Back
        </Button>
      </Stack>
    </Box>
  )
}
