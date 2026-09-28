'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
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
import useServerPagination from '@/components/shared/useServerPagination'
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination'
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
  const [isArchiving, setIsArchiving] = React.useState(false)

  const {
    rows: patients,
    rowCount,
    paginationModel,
    isLoading: isFetching,
    error,
    onPaginationModelChange,
    reload,
  } = useServerPagination<PatientListItem, Record<string, never>>({
    initialPage,
    initialPaginationModel,
    initialFilters: {},
    errorMessage: 'Failed to load patients.',
    fetchPage: (model) =>
      listPatientsAction(orgId, {
        page: model.page,
        pageSize: model.pageSize,
      }),
  })

  const isLoading = isFetching || isArchiving

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) reload()
  }, [isLoading, reload])

  const handleCreateClick = () => router.push('/patients/create')
  const handleApprovePatientsClick = () => router.push('/patients/approve')

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

      setIsArchiving(true)

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

        reload()
      } finally {
        setIsArchiving(false)
      }
    },
    [dialogs, notifications, orgId, reload],
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
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        {title: 'Patients' },
      ]}
      actions={
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'flex-start',
            width: { xs: '100%', md: 'auto' },
          }}
        >
          <Tooltip title="Reload data" placement="right" enterDelay={1000}>
            <span>
              <Button
                variant="outlined"
                aria-label="Reload"
                startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                onClick={handleRefresh}
                disabled={isLoading}
                sx={{
                  minWidth: { md: 40 },
                  width: { xs: '100%', md: 'auto' },
                  '& .MuiButton-startIcon': { mr: { md: 0 } },
                }}
              >
                <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
                  Reload
                </Box>
              </Button>
            </span>
          </Tooltip>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ alignItems: { xs: 'stretch', md: 'center' }, width: { xs: '100%', md: 'auto' } }}
          >
            <Badge
              color="success"
              overlap="rectangular"
              variant="dot"
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              sx={{
                display: { xs: 'block', md: 'inline-flex' },
                width: { xs: '100%', md: 'auto' },
                '& .MuiBadge-badge': {
                  border: 2,
                  borderColor: 'background.paper',
                  borderStyle: 'solid',
                  borderRadius: '50%',
                  height: 14,
                  minWidth: 14,
                },
              }}
            >
              <Button
                variant="outlined"
                onClick={handleApprovePatientsClick}
                sx={{ backgroundColor: 'background.paper', whiteSpace: 'nowrap', width: { xs: '100%', md: 'auto' } }}
              >
                Approve patients
              </Button>
            </Badge>
            <Button
              variant="contained"
              onClick={handleCreateClick}
              startIcon={<AddIcon />}
              sx={{ whiteSpace: 'nowrap', width: { xs: '100%', md: 'auto' } }}
            >
              Create patient
            </Button>
          </Stack>
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
            onPaginationModelChange={onPaginationModelChange}
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
