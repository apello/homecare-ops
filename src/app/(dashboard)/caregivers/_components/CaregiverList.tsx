'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridPaginationModel,
  gridClasses,
} from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import ArchiveIcon from '@mui/icons-material/Archive'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useRouter } from 'next/navigation'
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import useServerPagination from '@/components/shared/useServerPagination'
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination'
import {
  CAREGIVER_STATUS_FILTERS,
  getCredentialHealth,
  type CaregiverStatusFilter,
} from '@/lib/schemas/caregivers.schema'
import {
  CAREGIVER_CLASSIFICATIONS,
  type CaregiverClassification,
  type CaregiverListItem,
  type CaregiverListPage,
  type CredentialHealth,
} from '@/types'
import { archiveCaregiverAction, listCaregiversAction } from '../actions'

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default'> = {
  Active: 'success',
  Suspended: 'warning',
  Inactive: 'default',
  Archived: 'warning',
}

const CREDENTIAL_HEALTH_COLOR: Record<CredentialHealth, 'success' | 'warning' | 'error'> = {
  OK: 'success',
  'Expiring Soon': 'warning',
  Expired: 'error',
  Missing: 'error',
}

const CREDENTIAL_HEALTH_HELP: Record<CredentialHealth, string> = {
  OK: 'All credentials are current.',
  'Expiring Soon': 'At least one credential expires within 30 days.',
  Expired: 'At least one credential has expired.',
  Missing: 'No credentials are on file for this caregiver.',
}

// Sentinel for "no filter". A non-empty value keeps the MUI label shrunk so the
// Select shows "All" instead of an apparently empty field.
const ALL_OPTION = 'All'

export interface CaregiverListFilters {
  classification?: CaregiverClassification
  status?: CaregiverStatusFilter
}

export interface CaregiverListProps {
  orgId: string
  initialPage: CaregiverListPage
  initialPaginationModel: GridPaginationModel
  initialFilters: CaregiverListFilters
}

function syncFilterParams(params: URLSearchParams, filters: CaregiverListFilters) {
  if (filters.classification) {
    params.set('classification', filters.classification)
  } else {
    params.delete('classification')
  }

  if (filters.status) {
    params.set('status', filters.status)
  } else {
    params.delete('status')
  }
}

export default function CaregiverList({
  orgId,
  initialPage,
  initialPaginationModel,
  initialFilters,
}: CaregiverListProps) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()
  const [isArchiving, setIsArchiving] = React.useState(false)

  const {
    rows: caregivers,
    rowCount,
    paginationModel,
    filters,
    isLoading: isFetching,
    error,
    onPaginationModelChange,
    onFiltersChange,
    reload,
  } = useServerPagination<CaregiverListItem, CaregiverListFilters>({
    initialPage,
    initialPaginationModel,
    initialFilters,
    syncFilterParams,
    errorMessage: 'Failed to load caregivers.',
    fetchPage: (model, activeFilters) =>
      listCaregiversAction(orgId, {
        classification: activeFilters.classification,
        status: activeFilters.status,
        page: model.page,
        pageSize: model.pageSize,
      }),
  })

  const isLoading = isFetching || isArchiving

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) reload()
  }, [isLoading, reload])

  const handleCreateClick = () => router.push('/caregivers/create')

  const handleRowView = React.useCallback(
    (caregiver: CaregiverListItem) => () => {
      router.push(`/caregivers/${caregiver.id}`)
    },
    [router],
  )

  const handleRowArchive = React.useCallback(
    (caregiver: CaregiverListItem) => async () => {
      const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()

      const confirmed = await dialogs.confirm(`Archive ${fullName}?`, {
        title: 'Archive caregiver?',
        severity: 'warning',
        okText: 'Archive',
      })

      if (!confirmed) return

      setIsArchiving(true)

      try {
        const result = await archiveCaregiverAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
        })

        if (!result.success) {
          notifications.show(result.error, { severity: 'error', autoHideDuration: 4000 })
          return
        }

        notifications.show('Caregiver archived.', { severity: 'success', autoHideDuration: 3000 })

        reload()
      } finally {
        setIsArchiving(false)
      }
    },
    [dialogs, notifications, orgId, reload],
  )

  const columns = React.useMemo<GridColDef<CaregiverListItem>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 160,
        valueGetter: (_value, row) => `${row.first_name} ${row.last_name}`.trim() || '—',
      },
      {
        field: 'classification',
        headerName: 'Classification',
        width: 130,
      },
      {
        field: 'employment_status',
        headerName: 'Employment',
        width: 120,
      },
      {
        field: 'matching_status',
        headerName: 'Status',
        width: 120,
        renderCell: (params) => {
          const status = params.row.archived_at ? 'Archived' : (params.value as string)
          return (
            <Chip
              label={status}
              color={STATUS_COLOR[status] ?? 'default'}
              size="small"
              variant="outlined"
            />
          )
        },
      },
      {
        field: 'credentials',
        headerName: 'Credentials',
        width: 140,
        sortable: false,
        renderCell: (params) => {
          const health = getCredentialHealth(params.row.credentials ?? [])
          return (
            <Tooltip title={CREDENTIAL_HEALTH_HELP[health]}>
              <Chip label={health} color={CREDENTIAL_HEALTH_COLOR[health]} size="small" variant="outlined" />
            </Tooltip>
          )
        },
      },
      {
        field: 'service_area_zip',
        headerName: 'ZIP',
        width: 90,
        valueGetter: (_value, row) => row.service_area_zip ?? '—',
      },
      {
        field: 'actions',
        type: 'actions',
        width: 120,
        align: 'right',
        getActions: ({ row }) => [
          <GridActionsCellItem key="view" icon={<EditIcon />} label="View" onClick={handleRowView(row)} />,
          <GridActionsCellItem
            key="archive"
            icon={<ArchiveIcon />}
            label="Archive"
            onClick={handleRowArchive(row)}
            disabled={row.archived_at !== null}
          />,
        ],
      },
    ],
    [handleRowView, handleRowArchive],
  )

  return (
    <PageContainer
      title="Caregivers"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard' },
        { title: 'Caregivers' },
      ]}
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Tooltip title="Reload data" placement="right" enterDelay={1000}>
            <div>
              <IconButton size="small" aria-label="refresh" onClick={handleRefresh} disabled={isLoading}>
                {isLoading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              </IconButton>
            </div>
          </Tooltip>
          <FormControl size="small" sx={{ minWidth: 150 }} disabled={isLoading}>
            <InputLabel id="classification-filter-label">Classification</InputLabel>
            <Select
              labelId="classification-filter-label"
              label="Classification"
              value={filters.classification ?? ALL_OPTION}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  classification:
                    e.target.value === ALL_OPTION
                      ? undefined
                      : (e.target.value as CaregiverClassification),
                })
              }
            >
              <MenuItem value={ALL_OPTION}>{ALL_OPTION}</MenuItem>
              {CAREGIVER_CLASSIFICATIONS.map((classification) => (
                <MenuItem key={classification} value={classification}>
                  {classification}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }} disabled={isLoading}>
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              label="Status"
              value={filters.status ?? ALL_OPTION}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  status:
                    e.target.value === ALL_OPTION
                      ? undefined
                      : (e.target.value as CaregiverStatusFilter),
                })
              }
            >
              <MenuItem value={ALL_OPTION}>{ALL_OPTION}</MenuItem>
              {CAREGIVER_STATUS_FILTERS.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleCreateClick} startIcon={<AddIcon />}>
            Create caregiver
          </Button>
        </Stack>
      }
    >
      <Box sx={{ flex: 1, width: '100%' }}>
        {error ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <DataGrid
            rows={caregivers}
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
