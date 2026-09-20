'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
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
import type { Caregiver, CaregiverAvailability } from '@/types'
import { deactivateAvailabilityAction } from '../actions'
import { DAY_NAMES } from './CaregiverCore'

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default'> = {
  Available: 'success',
  Preferred: 'success',
  Unavailable: 'default',
}

export interface AvailabilityListProps {
  caregiver: Caregiver
  orgId: string
  availability: CaregiverAvailability[]
}

export default function AvailabilityList({
  caregiver,
  orgId,
  availability: initialAvailability,
}: AvailabilityListProps) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()
  const [availability, setAvailability] = React.useState(initialAvailability)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}`)
  }, [router, caregiver.id])

  const handleAdd = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}/availability/new`)
  }, [router, caregiver.id])

  const handleDelete = React.useCallback(
    async (window: CaregiverAvailability) => {
      const confirmed = await dialogs.confirm(
        `End the ${DAY_NAMES[window.day_of_week] ?? ''} ${window.start_time.slice(0, 5)}–${window.end_time.slice(0, 5)} window today?`,
        { title: 'End availability window?', severity: 'warning', okText: 'End Window' },
      )
      if (!confirmed) return

      setIsDeleting(true)
      try {
        const result = await deactivateAvailabilityAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          availabilityId: window.id,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to end availability window.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        setAvailability((prev) => prev.filter((item) => item.id !== window.id))
        notifications.show('Availability window ended.', { severity: 'success', autoHideDuration: 3000 })
        router.refresh()
      } finally {
        setIsDeleting(false)
      }
    },
    [dialogs, notifications, orgId, caregiver.id, router],
  )

  const columns = React.useMemo<GridColDef<CaregiverAvailability>[]>(
    () => [
      {
        field: 'day_of_week',
        headerName: 'Day',
        width: 120,
        valueGetter: (_value, row) => DAY_NAMES[row.day_of_week] ?? row.day_of_week,
      },
      {
        field: 'start_time',
        headerName: 'Start',
        width: 90,
        valueGetter: (_value, row) => row.start_time.slice(0, 5),
      },
      {
        field: 'end_time',
        headerName: 'End',
        width: 90,
        valueGetter: (_value, row) => row.end_time.slice(0, 5),
      },
      {
        field: 'availability_status',
        headerName: 'Status',
        width: 130,
        renderCell: (params) => (
          <Chip
            label={params.value}
            color={STATUS_COLOR[params.value as string] ?? 'default'}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'effective_start_date',
        headerName: 'Effective From',
        width: 130,
        type: 'date',
        valueGetter: (_value, row) => (row.effective_start_date ? new Date(row.effective_start_date) : null),
      },
      {
        field: 'effective_end_date',
        headerName: 'Effective To',
        width: 130,
        type: 'date',
        valueGetter: (_value, row) => (row.effective_end_date ? new Date(row.effective_end_date) : null),
      },
      {
        field: 'actions',
        type: 'actions',
        width: 80,
        getActions: ({ row }) => [
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="End"
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
      title="Availability"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` },
        { title: 'Availability' },
      ]}
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Window
        </Button>
      }
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Box sx={{ minHeight: 100, width: '100%' }}>
          {availability.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No availability windows yet.
            </Typography>
          ) : (
            <DataGrid
              rows={availability}
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
