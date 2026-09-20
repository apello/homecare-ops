'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { DataGrid, GridColDef, gridClasses } from '@mui/x-data-grid'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Caregiver, CaregiverCompensationRate } from '@/types'

export interface CompensationListProps {
  caregiver: Caregiver
  orgId: string
  rates: CaregiverCompensationRate[]
}

export default function CompensationList({ caregiver, rates }: CompensationListProps) {
  const router = useRouter()
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}`)
  }, [router, caregiver.id])

  const handleAdd = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}/compensation/new`)
  }, [router, caregiver.id])

  const columns = React.useMemo<GridColDef<CaregiverCompensationRate>[]>(
    () => [
      {
        field: 'pay_rate',
        headerName: 'Pay Rate',
        width: 120,
        valueGetter: (_value, row) => `$${Number(row.pay_rate).toFixed(2)}`,
      },
      { field: 'rate_unit', headerName: 'Unit', width: 100 },
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
        field: 'active',
        headerName: 'Status',
        width: 110,
        renderCell: (params) => (
          <Chip
            label={params.value ? 'Active' : 'Closed'}
            color={params.value ? 'success' : 'default'}
            size="small"
            variant="outlined"
          />
        ),
      },
    ],
    [],
  )

  return (
    <PageContainer
      title="Compensation"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` },
        { title: 'Compensation' },
      ]}
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Rate
        </Button>
      }
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Box sx={{ minHeight: 100, width: '100%' }}>
          {rates.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No compensation rates recorded.
            </Typography>
          ) : (
            <DataGrid
              rows={rates}
              getRowId={(row) => row.id}
              columns={columns}
              disableRowSelectionOnClick
              hideFooter
              sx={{
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
