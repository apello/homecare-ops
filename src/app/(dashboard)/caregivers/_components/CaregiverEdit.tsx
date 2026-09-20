'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useRouter } from 'next/navigation'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Caregiver } from '@/types'
import { updateCaregiverAction } from '../actions'
import CaregiverForm, { type CaregiverFormState, type CaregiverFormValues } from './CaregiverForm'

interface CaregiverEditFormProps {
  caregiver: Caregiver
  orgId: string
}

function CaregiverEditForm({ caregiver, orgId }: CaregiverEditFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const initialValues = React.useMemo<CaregiverFormValues>(
    () => ({
      first_name: caregiver.first_name,
      last_name: caregiver.last_name,
      classification: caregiver.classification,
      email: caregiver.email ?? '',
      phone: caregiver.phone ?? '',
      employee_external_id: caregiver.employee_external_id ?? '',
      max_hours_per_week: caregiver.max_hours_per_week === null ? '' : String(caregiver.max_hours_per_week),
      service_area_zip: caregiver.service_area_zip ?? '',
      travel_radius_miles: caregiver.travel_radius_miles === null ? '' : String(caregiver.travel_radius_miles),
      employment_status: caregiver.employment_status,
      matching_status: caregiver.matching_status,
    }),
    [caregiver],
  )

  const [formState, setFormState] = React.useState<CaregiverFormState>({
    values: initialValues,
    errors: {},
  })

  const hasChanges = React.useMemo(
    () => JSON.stringify(formState.values) !== JSON.stringify(initialValues),
    [formState.values, initialValues],
  )

  const handleFieldChange = React.useCallback((field: keyof CaregiverFormValues, value: string) => {
    setFormState((prev) => ({ ...prev, values: { ...prev.values, [field]: value }, errors: {} }))
  }, [])

  const handleReset = React.useCallback(() => {
    setFormState({ values: initialValues, errors: {} })
  }, [initialValues])

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}`)
  }, [router, caregiver.id])

  const handleSubmit = React.useCallback(
    async (values: CaregiverFormValues) => {
      if (!values.first_name.trim()) {
        setFormState((prev) => ({ ...prev, errors: { first_name: 'First name is required.' } }))
        return
      }

      if (!values.last_name.trim()) {
        setFormState((prev) => ({ ...prev, errors: { last_name: 'Last name is required.' } }))
        return
      }

      setIsSubmitting(true)

      try {
        const result = await updateCaregiverAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          first_name: values.first_name,
          last_name: values.last_name,
          classification: values.classification,
          email: values.email.trim() ? values.email.trim() : null,
          phone: values.phone.trim() ? values.phone.trim() : null,
          employee_external_id: values.employee_external_id.trim()
            ? values.employee_external_id.trim()
            : null,
          max_hours_per_week: values.max_hours_per_week.trim() ? Number(values.max_hours_per_week) : null,
          service_area_zip: values.service_area_zip.trim() ? values.service_area_zip.trim() : null,
          travel_radius_miles: values.travel_radius_miles.trim() ? Number(values.travel_radius_miles) : null,
          employment_status: values.employment_status,
          matching_status: values.matching_status,
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
          notifications.show(result.error ?? 'Failed to update caregiver.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show('Caregiver updated successfully.', {
          severity: 'success',
          autoHideDuration: 3000,
        })

        router.push(`/caregivers/${caregiver.id}`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [orgId, caregiver.id, notifications, router],
  )

  return (
    <CaregiverForm
      formState={formState}
      hasChanges={hasChanges}
      onFieldChange={handleFieldChange}
      onSubmit={handleSubmit}
      onReset={handleReset}
      onBackClick={handleBackClick}
      isSubmitting={isSubmitting}
      showStatusFields
    />
  )
}

export interface CaregiverEditProps {
  caregiver: Caregiver | null
  orgId: string
}

export default function CaregiverEdit({ caregiver, orgId }: CaregiverEditProps) {
  const fullName = caregiver ? `${caregiver.first_name} ${caregiver.last_name}`.trim() : undefined

  return (
    <PageContainer
      title="Edit Caregiver Information"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        ...(caregiver ? [{ title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` }] : []),
        { title: 'Edit Information' },
      ]}
    >
      <Box sx={{ display: 'flex', width: '100%', flex: 1 }}>
        {!caregiver ? (
          <Typography>Caregiver not found.</Typography>
        ) : (
          <CaregiverEditForm caregiver={caregiver} orgId={orgId} />
        )}
      </Box>
    </PageContainer>
  )
}
