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
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Patient, PatientAddress } from '@/types'
import { deactivatePatientAddressAction } from '../actions'

function addressColumns(
  onAddressEdit: (address: PatientAddress) => void,
  onAddressDelete: (address: PatientAddress) => void,
  isDeleting: boolean,
): GridColDef<PatientAddress>[] {
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
          disabled={isDeleting}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => onAddressDelete(row)}
          disabled={isDeleting}
        />,
      ],
    },
  ]
}

export interface PatientAddressListProps {
  patient: Patient
  orgId: string
  addresses: PatientAddress[]
}

export default function PatientAddressList({ patient, orgId, addresses: initialAddresses }: PatientAddressListProps) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')
  const [addresses, setAddresses] = React.useState(initialAddresses)
  const [isDeleting, setIsDeleting] = React.useState(false)

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

  const handleDelete = React.useCallback(
    async (address: PatientAddress) => {
      const confirmed = await dialogs.confirm(
        `Remove the ${address.address_type.toLowerCase()} address at ${address.address_line_1}?`,
        { title: 'Remove address?', severity: 'warning', okText: 'Remove' },
      )
      if (!confirmed) return

      setIsDeleting(true)
      try {
        const result = await deactivatePatientAddressAction({
          organizationId: orgId,
          patientId: patient.id,
          addressId: address.id,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to remove address.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        setAddresses((prev) => prev.filter((item) => item.id !== address.id))
        notifications.show('Address removed.', { severity: 'success', autoHideDuration: 3000 })
        router.refresh()
      } finally {
        setIsDeleting(false)
      }
    },
    [dialogs, notifications, orgId, patient.id, router],
  )

  const columns = React.useMemo(
    () => addressColumns(handleEdit, handleDelete, isDeleting),
    [handleEdit, handleDelete, isDeleting],
  )

  return (
    <PageContainer
      title="Addresses"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Patients', path: '/patients' },
        { title: fullName || 'Patient', path: `/patients/${patient.id}` },
        { title: 'Addresses' },
      ]}
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Address
        </Button>
      }
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
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
