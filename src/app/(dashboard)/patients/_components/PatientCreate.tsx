'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import { useRouter } from 'next/navigation'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import { createPatientAction } from '../actions'
import PatientForm, { type PatientFormState } from './PatientForm'

const EMPTY_VALUES: PatientFormState['values'] = {
  first_name: '',
  last_name: '',
  middle_name: '',
  date_of_birth: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  zip_code: '',
}

export interface PatientCreateProps {
  orgId: string
}

export default function PatientCreate({ orgId }: PatientCreateProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formState, setFormState] = React.useState<PatientFormState>({
    values: EMPTY_VALUES,
    errors: {},
  })

  const hasChanges = React.useMemo(
    () => JSON.stringify(formState.values) !== JSON.stringify(EMPTY_VALUES),
    [formState.values],
  )

  const setValue = React.useCallback((field: keyof PatientFormState['values'], value: string) => {
    setFormState((prev) => ({ ...prev, values: { ...prev.values, [field]: value }, errors: {} }))
  }, [])

  const handleFirstNameChange = React.useCallback((value: string) => setValue('first_name', value), [setValue])
  const handleLastNameChange = React.useCallback((value: string) => setValue('last_name', value), [setValue])
  const handleMiddleNameChange = React.useCallback((value: string) => setValue('middle_name', value), [setValue])
  const handleDateOfBirthChange = React.useCallback((value: string) => setValue('date_of_birth', value), [setValue])
  const handleAddressFieldChange = React.useCallback(
    (field: 'address_line_1' | 'address_line_2' | 'city' | 'state' | 'zip_code', value: string) =>
      setValue(field, value),
    [setValue],
  )

  const handleReset = React.useCallback(() => {
    setFormState({ values: EMPTY_VALUES, errors: {} })
  }, [])

  const handleBackClick = React.useCallback(() => {
    router.push('/patients')
  }, [router])

  const handleSubmit = React.useCallback(
    async (values: PatientFormState['values']) => {
      if (!values.first_name?.trim()) {
        setFormState((prev) => ({ ...prev, errors: { first_name: 'First name is required.' } }))
        return
      }

      if (!values.last_name?.trim()) {
        setFormState((prev) => ({ ...prev, errors: { last_name: 'Last name is required.' } }))
        return
      }

      const hasAnyAddressField = Boolean(
        values.address_line_1?.trim() || values.city?.trim() || values.state?.trim() || values.zip_code?.trim(),
      )

      if (hasAnyAddressField) {
        const missing: Record<string, string> = {}
        if (!values.address_line_1?.trim()) missing.address_line_1 = 'Address line 1 is required.'
        if (!values.city?.trim()) missing.city = 'City is required.'
        if (!values.state?.trim()) missing.state = 'State is required.'
        if (!values.zip_code?.trim()) missing.zip_code = 'ZIP code is required.'
        if (Object.keys(missing).length > 0) {
          setFormState((prev) => ({ ...prev, errors: missing }))
          return
        }
      }

      setIsSubmitting(true)

      try {
        const result = await createPatientAction({
          organizationId: orgId,
          first_name: values.first_name,
          last_name: values.last_name,
          middle_name: values.middle_name?.trim() ? values.middle_name : undefined,
          date_of_birth: values.date_of_birth?.trim() ? values.date_of_birth : undefined,
          address: hasAnyAddressField
            ? {
                address_type: 'Service' as const,
                address_line_1: values.address_line_1 as string,
                address_line_2: values.address_line_2?.trim() ? values.address_line_2 : undefined,
                city: values.city as string,
                state: values.state as string,
                zip_code: values.zip_code as string,
              }
            : undefined,
        })

        if (!result.success) {
          if (result.fieldErrors) {
            setFormState((prev) => ({
              ...prev,
              errors: Object.fromEntries(
                Object.entries(result.fieldErrors ?? {}).map(([key, messages]) => [key, messages[0]]),
              ),
            }))
          }
          notifications.show(result.error ?? 'Failed to create patient.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show('Patient created successfully.', {
          severity: 'success',
          autoHideDuration: 3000,
        })

        router.push(result.data ? `/patients/${result.data.id}` : '/patients')
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [orgId, notifications, router],
  )

  return (
    <PageContainer
      title="Create Patient"
      breadcrumbs={[{ title: 'Patients', path: '/patients' }, { title: 'Create Patient' }]}
    >
      <Box sx={{ display: 'flex', width: '100%', flex: 1 }}>
        <PatientForm
          formState={formState}
          hasChanges={hasChanges}
          onFirstNameChange={handleFirstNameChange}
          onLastNameChange={handleLastNameChange}
          onMiddleNameChange={handleMiddleNameChange}
          onDateOfBirthChange={handleDateOfBirthChange}
          onAddressFieldChange={handleAddressFieldChange}
          onSubmit={handleSubmit}
          onReset={handleReset}
          onBackClick={handleBackClick}
          isSubmitting={isSubmitting}
          showAddress
          submitLabel="Create Patient"
        />
      </Box>
    </PageContainer>
  )
}
