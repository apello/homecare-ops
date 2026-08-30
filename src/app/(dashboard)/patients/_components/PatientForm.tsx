'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import type { Patient } from '@/types'

export interface PatientFormState {
  values: {
    first_name: string
    last_name: string
    middle_name?: string
    date_of_birth?: string
  }
  errors: Record<string, string>
}

interface PatientFormProps {
  patient: Patient
  formState: PatientFormState
  hasChanges?: boolean
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onMiddleNameChange: (value: string) => void
  onDateOfBirthChange: (value: string) => void
  onSubmit: (values: PatientFormState['values']) => void
  onReset: () => void
  onBackClick?: () => void
  isSubmitting?: boolean
}

export default function PatientForm({
  formState,
  hasChanges = false,
  onFirstNameChange,
  onLastNameChange,
  onMiddleNameChange,
  onDateOfBirthChange,
  onSubmit,
  onReset,
  onBackClick,
  isSubmitting = false,
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
        label="Middle Name"
        value={formState.values.middle_name ?? ''}
        onChange={(e) => onMiddleNameChange(e.target.value)}
        error={!!formState.errors.middle_name}
        helperText={formState.errors.middle_name}
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

      <Box sx={{ width: '100%', mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip
          label={hasChanges ? 'Unsaved Changes' : 'No Changes'}
          color={hasChanges ? 'warning' : 'default'}
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
            {isSubmitting ? 'Saving...' : 'Save Changes'}
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
