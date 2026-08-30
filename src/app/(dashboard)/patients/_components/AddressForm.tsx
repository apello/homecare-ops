'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
import type { AddressType, Patient, PatientAddress } from '@/types'
import { upsertPatientAddressAction } from '../actions'

const ADDRESS_TYPES: AddressType[] = ['Service', 'Mailing', 'Other']

interface AddressFormValues {
  address_type: AddressType
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  zip_code: string
}

export interface AddressFormProps {
  patient: Patient
  orgId: string
  address?: PatientAddress
}

export default function AddressForm({ patient, orgId, address }: AddressFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const isEditing = !!address
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')

  const [values, setValues] = React.useState<AddressFormValues>({
    address_type: address?.address_type ?? 'Service',
    address_line_1: address?.address_line_1 ?? '',
    address_line_2: address?.address_line_2 ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    zip_code: address?.zip_code ?? '',
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleBackClick = React.useCallback(() => {
    router.push(`/patients/${patient.id}`)
  }, [router, patient.id])

  const handleChange = React.useCallback(
    <K extends keyof AddressFormValues>(field: K) =>
      (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) => {
        setValues((prev) => ({ ...prev, [field]: e.target.value as AddressFormValues[K] }))
        setErrors({})
      },
    [],
  )

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!values.address_line_1.trim()) {
        setErrors({ address_line_1: 'Address line 1 is required.' })
        return
      }
      if (!values.city.trim()) {
        setErrors({ city: 'City is required.' })
        return
      }
      if (values.state.trim().length < 2) {
        setErrors({ state: 'State is required.' })
        return
      }
      if (values.zip_code.trim().length < 5) {
        setErrors({ zip_code: 'ZIP code is required.' })
        return
      }

      setIsSubmitting(true)

      try {
        const result = await upsertPatientAddressAction({
          organizationId: orgId,
          patientId: patient.id,
          address_type: values.address_type,
          address_line_1: values.address_line_1,
          address_line_2: values.address_line_2 || undefined,
          city: values.city,
          state: values.state,
          zip_code: values.zip_code,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to save address.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show(isEditing ? 'Address updated successfully.' : 'Address added successfully.', {
          severity: 'success',
          autoHideDuration: 3000,
        })

        router.push(`/patients/${patient.id}`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, orgId, patient.id, isEditing, notifications, router],
  )

  return (
    <PageContainer
      title={isEditing ? 'Edit Address' : 'Add Address'}
      breadcrumbs={[
        { title: 'Patients', path: '/patients' },
        { title: fullName || 'Patient', path: `/patients/${patient.id}` },
        { title: isEditing ? 'Edit Address' : 'Add Address' },
      ]}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', mt: 1 }}
      >
        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="address-type-label">Address Type</InputLabel>
          <Select
            labelId="address-type-label"
            label="Address Type"
            value={values.address_type}
            onChange={(e) => setValues((prev) => ({ ...prev, address_type: e.target.value as AddressType }))}
          >
            {ADDRESS_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Address Line 1"
          value={values.address_line_1}
          onChange={handleChange('address_line_1')}
          error={!!errors.address_line_1}
          helperText={errors.address_line_1}
          required
          fullWidth
          disabled={isSubmitting}
        />

        <TextField
          label="Address Line 2"
          value={values.address_line_2}
          onChange={handleChange('address_line_2')}
          fullWidth
          disabled={isSubmitting}
        />

        <TextField
          label="City"
          value={values.city}
          onChange={handleChange('city')}
          error={!!errors.city}
          helperText={errors.city}
          required
          fullWidth
          disabled={isSubmitting}
        />

        <TextField
          label="State"
          value={values.state}
          onChange={handleChange('state')}
          error={!!errors.state}
          helperText={errors.state}
          required
          fullWidth
          disabled={isSubmitting}
        />

        <TextField
          label="ZIP Code"
          value={values.zip_code}
          onChange={handleChange('zip_code')}
          error={!!errors.zip_code}
          helperText={errors.zip_code}
          required
          fullWidth
          disabled={isSubmitting}
        />

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackClick} disabled={isSubmitting}>
            Back
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Address'}
          </Button>
        </Stack>
      </Box>
    </PageContainer>
  )
}
