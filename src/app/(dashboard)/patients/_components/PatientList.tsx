'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  gridClasses,
} from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditIcon from '@mui/icons-material/Edit';
import ArchiveIcon from '@mui/icons-material/Archive';
import { useRouter } from 'next/navigation'
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Patient } from '@/types'
import { listPatientsAction, archivePatientAction } from '../actions'

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default' | 'info'> = {
  Intake: 'info',
  Active: 'success',
  Suspended: 'warning',
  Discharged: 'default',
  Archived: 'warning',
}

export interface PatientListProps {
  orgId: string
  initialPatients: Patient[]
}

export default function PatientList({ orgId, initialPatients }: PatientListProps) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()

  const [patients, setPatients] = React.useState<Patient[]>(initialPatients)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      const result = await listPatientsAction(orgId)

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to load patients.')
      }

      setPatients(result.data ?? [])
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [orgId])

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) loadData()
  }, [isLoading, loadData])

  const handleCreateClick = () => router.push('/patients/create')

  const handleRowView = React.useCallback(
    (patient: Patient) => () => {
      router.push(`/patients/${patient.id}`)
    },
    [router],
  )

  const handleRowArchive = React.useCallback(
    (patient: Patient) => async () => {
      const fullName = `${patient.first_name} ${patient.last_name}`.trim()

      const confirmed = await dialogs.confirm(`Archive ${fullName}?`, {
        title: 'Archive patient?',
        severity: 'warning',
        okText: 'Archive',
      })

      if (!confirmed) return

      setIsLoading(true)

      try {
        const result = await archivePatientAction({
          organizationId: orgId,
          patientId: patient.id,
        })

        if (!result.success) {
          notifications.show(result.error, {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show('Patient archived.', {
          severity: 'success',
          autoHideDuration: 3000,
        })

        await loadData()
      } finally {
        setIsLoading(false)
      }
    },
    [dialogs, notifications, orgId, loadData],
  )

  const columns = React.useMemo<GridColDef<Patient>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 160,
        valueGetter: (_value, row) => {
          const name = `${row.first_name} ${row.last_name}`.trim() || '—'
          return name
        },
      },
      {
        field: 'date_of_birth',
        headerName: 'Date of Birth',
        width: 110,
        type: 'date',
        valueGetter: (_value, row) => (row.date_of_birth ? new Date(row.date_of_birth) : null),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
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
        field: 'created_by',
        headerName: 'Added by',
        width: 130,
        valueGetter: (_value, row) => {
          const createdBy = (row as any).created_by
          if (!createdBy) return '—'
          const name = `${createdBy.first_name} ${createdBy.last_name}`.trim()
          return name || '—'
        },
      },
      {
        field: 'created_at',
        headerName: 'Created',
        width: 130,
        type: 'date',
        valueGetter: (_value, row) => (row.created_at ? new Date(row.created_at) : null),
      },
      {
        field: 'actions',
        type: 'actions',
        width: 120,
        align: 'right',
        getActions: ({ row }) => [
          <GridActionsCellItem
            key="view"
            icon={<EditIcon />}
            label="View"
            onClick={handleRowView(row)}
          />,
          <GridActionsCellItem
            key="archive"
            icon={<ArchiveIcon />}
            label="Archive"
            onClick={handleRowArchive(row)}
          />,
        ],
      },
    ],
    [handleRowView, handleRowArchive],
  )

  return (
    <PageContainer
      title="Patients"
      breadcrumbs={[{ title: 'Patients' }]}
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Tooltip title="Reload data" placement="right" enterDelay={1000}>
            <div>
              <IconButton size="small" aria-label="refresh" onClick={handleRefresh} disabled={isLoading}>
                {isLoading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              </IconButton>
            </div>
          </Tooltip>
          <Button variant="contained" onClick={handleCreateClick} startIcon={<AddIcon />}>
            Create patient
          </Button>
        </Stack>
      }
    >
      <Box sx={{ flex: 1, width: '100%' }}>
        {error ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <DataGrid
            rows={patients}
            getRowId={(row) => row.id}
            columns={columns}
            disableRowSelectionOnClick
            showToolbar
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[5, 10, 25]}
            sx={{
              opacity: isLoading ? 0.5 : 1,
              transition: 'opacity 0.2s',
              [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: { outline: 'transparent' },
              [`& .${gridClasses.columnHeader}:focus-within, & .${gridClasses.cell}:focus-within`]: {
                outline: 'none',
              },
            }}
          />
        )}
      </Box>
    </PageContainer>
  )
}
