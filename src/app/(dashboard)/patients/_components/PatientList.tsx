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
  GridPaginationModel,
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
import { PAGE_SIZE_OPTIONS, replacePaginationSearchParams } from '@/lib/pagination'
import type { PatientListItem, PatientListPage } from '@/types'
import { listPatientsAction, archivePatientAction } from '../actions'

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default' | 'info'> = {
  Intake: 'info',
  Active: 'success',
  Suspended: 'warning',
  Discharged: 'default',
  Archived: 'warning',
}

// TODO(patient-statuses): Confirm these operational definitions with the team.
const STATUS_HELP: Record<string, string> = {
  Intake: 'UNCONFIRMED — confirm with the operations team. The patient is being onboarded and is not yet receiving active services.',
  Active: 'UNCONFIRMED — confirm with the operations team. The patient is currently receiving or ready to receive services.',
  Suspended: 'UNCONFIRMED — confirm with the operations team. The patient’s services are temporarily paused.',
  Discharged: 'UNCONFIRMED — confirm with the operations team. The patient’s services have ended, but the record remains available.',
  Archived: 'The patient record is archived and hidden from the default patient list.',
}

export interface PatientListProps {
  orgId: string
  initialPage: PatientListPage
  initialPaginationModel: GridPaginationModel
}

export default function PatientList({ orgId, initialPage, initialPaginationModel }: PatientListProps) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()

  const [patients, setPatients] = React.useState<PatientListItem[]>(initialPage.rows)
  const [rowCount, setRowCount] = React.useState(initialPage.rowCount)
  const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>(initialPaginationModel)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async (model: GridPaginationModel = paginationModel) => {
    setError(null)
    setIsLoading(true)

    try {
      const result = await listPatientsAction(orgId, {
        page: model.page,
        pageSize: model.pageSize,
      })

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to load patients.')
      }

      setPatients(result.data?.rows ?? [])
      setRowCount(result.data?.rowCount ?? 0)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [orgId, paginationModel])

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) loadData()
  }, [isLoading, loadData])

  const handleCreateClick = () => router.push('/patients/create')

  const handleRowView = React.useCallback(
    (patient: PatientListItem) => () => {
      router.push(`/patients/${patient.id}`)
    },
    [router],
  )

  const handleRowArchive = React.useCallback(
    (patient: PatientListItem) => async () => {
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

  const columns = React.useMemo<GridColDef<PatientListItem>[]>(
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
          <Tooltip title={STATUS_HELP[params.value as string] ?? ''}>
            <Chip
              label={params.value}
              color={STATUS_COLOR[params.value as string] ?? 'default'}
              size="small"
              variant="outlined"
            />
          </Tooltip>
        ),
      },
      {
        field: 'created_by',
        headerName: 'Added by',
        width: 130,
        valueGetter: (_value, row) => {
          const createdBy = row.created_by
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
            paginationMode="server"
            rowCount={rowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={(model) => {
              setPaginationModel(model)
              window.history.replaceState(
                window.history.state,
                '',
                replacePaginationSearchParams(window.location.href, model),
              )
              void loadData(model)
            }}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
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
