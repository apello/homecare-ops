'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import { DataGrid, GridActionsCellItem, GridColDef, gridClasses } from '@mui/x-data-grid'
import { useRouter } from 'next/navigation'
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Caregiver, CaregiverServiceEligibilityWithService } from '@/types'
import { deactivateServiceEligibilityAction } from '../actions'

export interface EligibilityListProps {
  caregiver: Caregiver
  orgId: string
  eligibility: CaregiverServiceEligibilityWithService[]
}

export default function EligibilityList({
  caregiver,
  orgId,
  eligibility: initialEligibility,
}: EligibilityListProps) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()
  const [eligibility, setEligibility] = React.useState(initialEligibility)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}`)
  }, [router, caregiver.id])

  const handleAdd = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}/eligibility/new`)
  }, [router, caregiver.id])

  const handleDelete = React.useCallback(
    async (row: CaregiverServiceEligibilityWithService) => {
      const confirmed = await dialogs.confirm('Remove this service eligibility?', {
        title: 'Remove eligibility?',
        severity: 'warning',
        okText: 'Remove',
      })
      if (!confirmed) return

      setIsDeleting(true)
      try {
        const result = await deactivateServiceEligibilityAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          eligibilityId: row.id,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to remove eligibility.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        setEligibility((prev) => prev.filter((item) => item.id !== row.id))
        notifications.show('Service eligibility removed.', { severity: 'success', autoHideDuration: 3000 })
        router.refresh()
      } finally {
        setIsDeleting(false)
      }
    },
    [dialogs, notifications, orgId, caregiver.id, router],
  )

  const columns = React.useMemo<GridColDef<CaregiverServiceEligibilityWithService>[]>(
    () => [
      {
        field: 'service',
        headerName: 'Service',
        flex: 2,
        minWidth: 180,
        valueGetter: (_value, row) =>
          row.organization_service?.local_service_name
          ?? row.organization_service?.service_code_mapping?.evv_service_name
          ?? row.organization_service_id,
      },
      {
        field: 'supervision_required',
        headerName: 'Supervision',
        width: 130,
        valueGetter: (_value, row) => (row.supervision_required ? 'Required' : 'Not required'),
      },
      {
        field: 'approved_at',
        headerName: 'Approved',
        width: 130,
        type: 'date',
        valueGetter: (_value, row) => (row.approved_at ? new Date(row.approved_at) : null),
      },
      {
        field: 'actions',
        type: 'actions',
        width: 80,
        getActions: ({ row }) => [
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => handleDelete(row)}
            disabled={isDeleting}
          />,
        ],
      },
    ],
    [handleDelete, isDeleting],
  )

  return (
    <PageContainer
      title="Service Eligibility"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` },
        { title: 'Service Eligibility' },
      ]}
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Service
        </Button>
      }
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Box sx={{ minHeight: 100, width: '100%' }}>
          {eligibility.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No approved services yet.
            </Typography>
          ) : (
            <DataGrid
              rows={eligibility}
              getRowId={(row) => row.id}
              columns={columns}
              disableRowSelectionOnClick
              hideFooter
              sx={{
                opacity: isDeleting ? 0.6 : 1,
                [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: { outline: 'transparent' },
                [`& .${gridClasses.columnHeader}:focus-within, & .${gridClasses.cell}:focus-within`]: {
                  outline: 'none',
                },
              }}
            />
          )}
        </Box>
        <Box>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackClick}>
            Back
          </Button>
        </Box>
      </Stack>
    </PageContainer>
  )
}
