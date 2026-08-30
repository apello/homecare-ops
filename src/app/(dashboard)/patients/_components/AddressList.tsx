'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  gridClasses,
} from '@mui/x-data-grid'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Patient, PatientAddress } from '@/types'

function addressColumns(onAddressEdit: (address: PatientAddress) => void): GridColDef<PatientAddress>[] {
  return [
    {
      field: 'address_type',
      headerName: 'Type',
      flex: 1,
      minWidth: 100,
    },
    {
      field: 'address',
      headerName: 'Address',
      flex: 2,
      minWidth: 200,
      valueGetter: (_value, row) => {
        const parts = [row.address_line_1]
        if (row.address_line_2) parts.push(row.address_line_2)
        if (row.city) parts.push(row.city)
        if (row.state) parts.push(row.state)
        if (row.zip_code) parts.push(row.zip_code)
        return parts.join(', ')
      },
    },
    {
      field: 'actions',
      type: 'actions',
      width: 100,
      getActions: ({ row }) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label="Edit"
          onClick={() => onAddressEdit(row)}
        />,
        // TODO: Addresses have no deactivate/delete backend support yet (unlike
        // patient requirements, which have deactivatePatientRequirementAction).
        // The patient_addresses table already has an `active` column, so a
        // deactivatePatientAddressAction mirroring the requirement one should
        // be added before enabling this action.
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete (not yet available)"
          disabled
        />,
      ],
    },
  ]
}

export interface AddressListProps {
  patient: Patient
  orgId: string
  addresses: PatientAddress[]
}

export default function AddressList({ patient, addresses }: AddressListProps) {
  const router = useRouter()
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')

  const handleBackClick = React.useCallback(() => {
    router.push(`/patients/${patient.id}`)
  }, [router, patient.id])

  const handleAdd = React.useCallback(() => {
    router.push(`/patients/${patient.id}/address/new`)
  }, [router, patient.id])

  const handleEdit = React.useCallback(
    (address: PatientAddress) => {
      router.push(`/patients/${patient.id}/address/${address.id}/edit`)
    },
    [router, patient.id],
  )

  const columns = React.useMemo(() => addressColumns(handleEdit), [handleEdit])

  return (
    <PageContainer
      title="Addresses"
      breadcrumbs={[
        { title: 'Patients', path: '/patients' },
        { title: fullName || 'Patient', path: `/patients/${patient.id}` },
        { title: 'Addresses' },
      ]}
    >
      <Stack spacing={2} sx={{ width: '100%', mt: 1 }}>
        <Box sx={{ minHeight: 100, width: '100%' }}>
          {addresses.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No addresses added yet.
            </Typography>
          ) : (
            <DataGrid
              rows={addresses}
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
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Address
          </Button>
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
