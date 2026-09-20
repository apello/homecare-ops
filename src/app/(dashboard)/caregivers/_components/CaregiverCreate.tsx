'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import { useRouter } from 'next/navigation'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import { createCaregiverAction } from '../actions'
import CaregiverForm, {
  EMPTY_CAREGIVER_VALUES,
  type CaregiverFormState,
  type CaregiverFormValues,
} from './CaregiverForm'

export interface CaregiverCreateProps {
  orgId: string
}

export default function CaregiverCreate({ orgId }: CaregiverCreateProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formState, setFormState] = React.useState<CaregiverFormState>({
    values: EMPTY_CAREGIVER_VALUES,
    errors: {},
  })

  const hasChanges = React.useMemo(
    () => JSON.stringify(formState.values) !== JSON.stringify(EMPTY_CAREGIVER_VALUES),
    [formState.values],
  )

  const handleFieldChange = React.useCallback((field: keyof CaregiverFormValues, value: string) => {
    setFormState((prev) => ({ ...prev, values: { ...prev.values, [field]: value }, errors: {} }))
  }, [])

  const handleReset = React.useCallback(() => {
    setFormState({ values: EMPTY_CAREGIVER_VALUES, errors: {} })
  }, [])

  const handleBackClick = React.useCallback(() => {
    router.push('/caregivers')
  }, [router])

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
        const result = await createCaregiverAction({
          organizationId: orgId,
          first_name: values.first_name,
          last_name: values.last_name,
          classification: values.classification,
          email: values.email.trim() ? values.email.trim() : undefined,
          phone: values.phone.trim() ? values.phone.trim() : undefined,
          employee_external_id: values.employee_external_id.trim()
            ? values.employee_external_id.trim()
            : undefined,
          max_hours_per_week: values.max_hours_per_week.trim()
            ? Number(values.max_hours_per_week)
            : undefined,
          service_area_zip: values.service_area_zip.trim() ? values.service_area_zip.trim() : undefined,
          travel_radius_miles: values.travel_radius_miles.trim()
            ? Number(values.travel_radius_miles)
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
          notifications.show(result.error ?? 'Failed to create caregiver.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show('Caregiver created successfully.', {
          severity: 'success',
          autoHideDuration: 3000,
        })

        router.push(result.data ? `/caregivers/${result.data.id}` : '/caregivers')
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [orgId, notifications, router],
  )

  return (
    <PageContainer
      title="Create Caregiver"
         breadcrumbs={[
        { title: 'Home', path: '/dashboard'},{ title: 'Caregivers', path: '/caregivers' }, { title: 'Create Caregiver' }]}
    >
      <Box sx={{ display: 'flex', width: '100%', flex: 1 }}>
        <CaregiverForm
          formState={formState}
          hasChanges={hasChanges}
          onFieldChange={handleFieldChange}
          onSubmit={handleSubmit}
          onReset={handleReset}
          onBackClick={handleBackClick}
          isSubmitting={isSubmitting}
          submitLabel="Create Caregiver"
        />
      </Box>
    </PageContainer>
  )
}
