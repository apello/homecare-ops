'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useRouter } from 'next/navigation'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Patient } from '@/types'
import { updatePatientAction } from '../actions'
import PatientForm, { type PatientFormState } from './PatientForm'

interface PatientEditFormProps {
  patient: Patient
  orgId: string
}

function PatientEditForm({ patient, orgId }: PatientEditFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const initialValues = React.useMemo(
    () => ({
      first_name: patient.first_name,
      last_name: patient.last_name,
      middle_name: patient.middle_name ?? undefined,
      date_of_birth: patient.date_of_birth ?? undefined,
    }),
    [patient],
  )

  const [formState, setFormState] = React.useState<PatientFormState>({
    values: initialValues,
    errors: {},
  })

  const hasChanges = React.useMemo(() => {
    return JSON.stringify(formState.values) !== JSON.stringify(initialValues)
  }, [formState.values, initialValues])

  const handleFirstNameChange = React.useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, values: { ...prev.values, first_name: value }, errors: {} }))
  }, [])

  const handleLastNameChange = React.useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, values: { ...prev.values, last_name: value }, errors: {} }))
  }, [])

  const handleMiddleNameChange = React.useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, values: { ...prev.values, middle_name: value }, errors: {} }))
  }, [])

  const handleDateOfBirthChange = React.useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, values: { ...prev.values, date_of_birth: value }, errors: {} }))
  }, [])

  const handleReset = React.useCallback(() => {
    setFormState({ values: initialValues, errors: {} })
  }, [initialValues])

  const handleBackClick = React.useCallback(() => {
    router.push(`/patients/${patient.id}`)
  }, [router, patient.id])

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

      setIsSubmitting(true)

      try {
        const result = await updatePatientAction({
          organizationId: orgId,
          patientId: patient.id,
          first_name: values.first_name,
          last_name: values.last_name,
          middle_name: values.middle_name,
          date_of_birth: values.date_of_birth,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to update patient.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show('Patient updated successfully.', {
          severity: 'success',
          autoHideDuration: 3000,
        })

        router.push(`/patients/${patient.id}`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [orgId, patient.id, notifications, router],
  )

  return (
    <PatientForm
      patient={patient}
      formState={formState}
      hasChanges={hasChanges}
      onFirstNameChange={handleFirstNameChange}
      onLastNameChange={handleLastNameChange}
      onMiddleNameChange={handleMiddleNameChange}
      onDateOfBirthChange={handleDateOfBirthChange}
      onSubmit={handleSubmit}
      onReset={handleReset}
      onBackClick={handleBackClick}
      isSubmitting={isSubmitting}
    />
  )
}

export interface PatientEditProps {
  patient: Patient | null
  orgId: string
}

export default function PatientEdit({ patient, orgId }: PatientEditProps) {
  const fullName = patient
    ? [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')
    : undefined

  return (
    <PageContainer
      title="Edit Patient Information"
      breadcrumbs={[
        { title: 'Patients', path: '/patients' },
        ...(patient ? [{ title: fullName || 'Patient', path: `/patients/${patient.id}` }] : []),
        { title: 'Edit Information' },
      ]}
    >
      <Box sx={{ display: 'flex', width: '100%', flex: 1 }}>
        {!patient ? (
          <Typography>Patient not found.</Typography>
        ) : (
          <PatientEditForm patient={patient} orgId={orgId} />
        )}
      </Box>
    </PageContainer>
  )
}
