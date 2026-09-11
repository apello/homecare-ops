'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import type { Patient } from '@/types'

export interface PatientFormState {
  values: {
    first_name: string
    last_name: string
    middle_name?: string
    date_of_birth?: string
    address_line_1?: string
    address_line_2?: string
    city?: string
    state?: string
    zip_code?: string
  }
  errors: Record<string, string>
}

interface PatientFormProps {
  patient?: Patient
  formState: PatientFormState
  hasChanges?: boolean
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onMiddleNameChange: (value: string) => void
  onDateOfBirthChange: (value: string) => void
  onAddressFieldChange?: (field: 'address_line_1' | 'address_line_2' | 'city' | 'state' | 'zip_code', value: string) => void
  onSubmit: (values: PatientFormState['values']) => void
  onReset: () => void
  onBackClick?: () => void
  isSubmitting?: boolean
  showAddress?: boolean
  submitLabel?: string
}

export default function PatientForm({
  formState,
  hasChanges = false,
  onFirstNameChange,
  onLastNameChange,
  onMiddleNameChange,
  onDateOfBirthChange,
  onAddressFieldChange,
  onSubmit,
  onReset,
  onBackClick,
  isSubmitting = false,
  showAddress = false,
  submitLabel = 'Save Changes',
}: PatientFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formState.values)
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        width: '100%',
        mt: 2
      }}
    >
      <TextField
        label="First Name"
        value={formState.values.first_name}
        onChange={(e) => onFirstNameChange(e.target.value)}
        error={!!formState.errors.first_name}
        helperText={formState.errors.first_name}
        required
        fullWidth
        disabled={isSubmitting}
      />

      <TextField
        label="Middle Name"
        value={formState.values.middle_name ?? ''}
        onChange={(e) => onMiddleNameChange(e.target.value)}
        error={!!formState.errors.middle_name}
        helperText={formState.errors.middle_name}
        fullWidth
        disabled={isSubmitting}
      />

      <TextField
        label="Last Name"
        value={formState.values.last_name}
        onChange={(e) => onLastNameChange(e.target.value)}
        error={!!formState.errors.last_name}
        helperText={formState.errors.last_name}
        required
        fullWidth
        disabled={isSubmitting}
      />

      <TextField
        label="Date of Birth"
        type="date"
        value={formState.values.date_of_birth ?? ''}
        onChange={(e) => onDateOfBirthChange(e.target.value)}
        error={!!formState.errors.date_of_birth}
        helperText={formState.errors.date_of_birth}
        fullWidth
        disabled={isSubmitting}
        InputLabelProps={{ shrink: true }}
      />

      {showAddress && onAddressFieldChange ? (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Service Address (optional)
          </Typography>

          <TextField
            label="Address Line 1"
            value={formState.values.address_line_1 ?? ''}
            onChange={(e) => onAddressFieldChange('address_line_1', e.target.value)}
            error={!!formState.errors.address_line_1}
            helperText={formState.errors.address_line_1}
            fullWidth
            disabled={isSubmitting}
          />

          <TextField
            label="Address Line 2"
            value={formState.values.address_line_2 ?? ''}
            onChange={(e) => onAddressFieldChange('address_line_2', e.target.value)}
            fullWidth
            disabled={isSubmitting}
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="City"
              value={formState.values.city ?? ''}
              onChange={(e) => onAddressFieldChange('city', e.target.value)}
              error={!!formState.errors.city}
              helperText={formState.errors.city}
              fullWidth
              disabled={isSubmitting}
            />
            <TextField
              label="State"
              value={formState.values.state ?? ''}
              onChange={(e) => onAddressFieldChange('state', e.target.value)}
              error={!!formState.errors.state}
              helperText={formState.errors.state}
              fullWidth
              disabled={isSubmitting}
            />
            <TextField
              label="ZIP Code"
              value={formState.values.zip_code ?? ''}
              onChange={(e) => onAddressFieldChange('zip_code', e.target.value)}
              error={!!formState.errors.zip_code}
              helperText={formState.errors.zip_code}
              fullWidth
              disabled={isSubmitting}
            />
          </Stack>
        </>
      ) : null}

      <Box sx={{ width: '100%', mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip
          label={hasChanges ? 'Unsaved Changes' : 'No Changes'}
          color={hasChanges ? 'success' : 'default'}
          variant="outlined"
        />
        <Stack direction="row" spacing={1}>
          <Button
            type="reset"
            variant="text"
            onClick={onReset}
            disabled={isSubmitting || !hasChanges}
          >
            Reset
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || !hasChanges}
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={onBackClick}
          disabled={isSubmitting}
        >
          Back
        </Button>
      </Stack>
    </Box>
  )
}
