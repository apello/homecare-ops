'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BlockIcon from '@mui/icons-material/Block'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EditIcon from '@mui/icons-material/Edit'
import { DataGrid, GridActionsCellItem, GridColDef, gridClasses } from '@mui/x-data-grid'
import { useRouter } from 'next/navigation'
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Caregiver, CaregiverCredential } from '@/types'
import { revokeCredentialAction, verifyCredentialAction } from '../actions'

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default' | 'error'> = {
  Active: 'success',
  Pending: 'warning',
  Expired: 'error',
  Revoked: 'default',
}

export interface CredentialListProps {
  caregiver: Caregiver
  orgId: string
  credentials: CaregiverCredential[]
}

export default function CredentialList({ caregiver, orgId, credentials: initialCredentials }: CredentialListProps) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()
  const [credentials, setCredentials] = React.useState(initialCredentials)
  const [isBusy, setIsBusy] = React.useState(false)

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}`)
  }, [router, caregiver.id])

  const handleAdd = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}/credential/new`)
  }, [router, caregiver.id])

  const handleEdit = React.useCallback(
    (credential: CaregiverCredential) => {
      router.push(`/caregivers/${caregiver.id}/credential/${credential.id}/edit`)
    },
    [router, caregiver.id],
  )

  const handleVerify = React.useCallback(
    async (credential: CaregiverCredential) => {
      setIsBusy(true)
      try {
        const result = await verifyCredentialAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          credentialId: credential.id,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to verify credential.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        setCredentials((prev) =>
          prev.map((item) => (item.id === credential.id ? { ...item, ...result.data } : item)),
        )
        notifications.show('Credential verified.', { severity: 'success', autoHideDuration: 3000 })
        router.refresh()
      } finally {
        setIsBusy(false)
      }
    },
    [notifications, orgId, caregiver.id, router],
  )

  const handleRevoke = React.useCallback(
    async (credential: CaregiverCredential) => {
      const confirmed = await dialogs.confirm(`Revoke ${credential.credential_name}?`, {
        title: 'Revoke credential?',
        severity: 'warning',
        okText: 'Revoke',
      })
      if (!confirmed) return

      setIsBusy(true)
      try {
        const result = await revokeCredentialAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          credentialId: credential.id,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to revoke credential.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        setCredentials((prev) =>
          prev.map((item) => (item.id === credential.id ? { ...item, status: 'Revoked' as const } : item)),
        )
        notifications.show('Credential revoked.', { severity: 'success', autoHideDuration: 3000 })
        router.refresh()
      } finally {
        setIsBusy(false)
      }
    },
    [dialogs, notifications, orgId, caregiver.id, router],
  )

  const columns = React.useMemo<GridColDef<CaregiverCredential>[]>(
    () => [
      { field: 'credential_type', headerName: 'Type', flex: 1, minWidth: 120 },
      { field: 'credential_name', headerName: 'Name', flex: 1, minWidth: 150 },
      {
        field: 'issued_date',
        headerName: 'Issued',
        width: 110,
        type: 'date',
        valueGetter: (_value, row) => (row.issued_date ? new Date(row.issued_date) : null),
      },
      {
        field: 'expiration_date',
        headerName: 'Expires',
        width: 110,
        type: 'date',
        valueGetter: (_value, row) => (row.expiration_date ? new Date(row.expiration_date) : null),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 110,
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
        field: 'verified_at',
        headerName: 'Verified',
        width: 110,
        type: 'date',
        valueGetter: (_value, row) => (row.verified_at ? new Date(row.verified_at) : null),
      },
      {
        field: 'actions',
        type: 'actions',
        width: 130,
        getActions: ({ row }) => [
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Edit"
            onClick={() => handleEdit(row)}
            disabled={isBusy}
          />,
          <GridActionsCellItem
            key="verify"
            icon={<CheckCircleIcon />}
            label="Verify"
            onClick={() => handleVerify(row)}
            disabled={isBusy}
          />,
          <GridActionsCellItem
            key="revoke"
            icon={<BlockIcon />}
            label="Revoke"
            onClick={() => handleRevoke(row)}
            disabled={isBusy || row.status === 'Revoked'}
          />,
        ],
      },
    ],
    [handleEdit, handleVerify, handleRevoke, isBusy],
  )

  return (
    <PageContainer
      title="Credentials"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` },
        { title: 'Credentials' },
      ]}
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Credential
        </Button>
      }
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Box sx={{ minHeight: 100, width: '100%' }}>
          {credentials.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No credentials on file.
            </Typography>
          ) : (
            <DataGrid
              rows={credentials}
              getRowId={(row) => row.id}
              columns={columns}
              disableRowSelectionOnClick
              hideFooter
              sx={{
                opacity: isBusy ? 0.6 : 1,
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
