'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
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
import { MAX_PATIENT_CONTACTS } from '@/lib/schemas/patients.schema'
import { useRouter } from 'next/navigation'
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Patient, PatientContact } from '@/types'
import { deactivatePatientContactAction } from '../actions'

function contactColumns(
  onContactEdit: (contact: PatientContact) => void,
  onContactDelete: (contact: PatientContact) => void,
  isDeleting: boolean,
): GridColDef<PatientContact>[] {
  return [
    {
      field: 'contact_name',
      headerName: 'Name',
      flex: 1,
      minWidth: 140,
    },
    {
      field: 'contact_type',
      headerName: 'Type',
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'relationship',
      headerName: 'Relationship',
      flex: 1,
      minWidth: 120,
      valueGetter: (_value, row) => row.relationship ?? '—',
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 140,
      valueGetter: (_value, row) => row.phone ?? '—',
    },
    {
      field: 'authorized_contact',
      headerName: 'Patient Info',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Authorized' : 'Not authorized'}
          color={params.value ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
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
          onClick={() => onContactEdit(row)}
          disabled={isDeleting}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => onContactDelete(row)}
          disabled={isDeleting}
        />,
      ],
    },
  ]
}

export interface ContactListProps {
  patient: Patient
  orgId: string
  contacts: PatientContact[]
}

export default function ContactList({ patient, orgId, contacts: initialContacts }: ContactListProps) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')

  const [contacts, setContacts] = React.useState<PatientContact[]>(initialContacts)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleBackClick = React.useCallback(() => {
    router.push(`/patients/${patient.id}`)
  }, [router, patient.id])

  const handleAdd = React.useCallback(() => {
    router.push(`/patients/${patient.id}/contact/new`)
  }, [router, patient.id])

  const handleEdit = React.useCallback(
    (contact: PatientContact) => {
      router.push(`/patients/${patient.id}/contact/${contact.id}/edit`)
    },
    [router, patient.id],
  )

  const handleDelete = React.useCallback(
    async (contact: PatientContact) => {
      const confirmed = await dialogs.confirm(
        `Remove the ${contact.contact_type} contact (${contact.contact_name})?`,
        { title: 'Remove contact?', severity: 'warning', okText: 'Remove' },
      )
      if (!confirmed) return

      setIsDeleting(true)
      try {
        const result = await deactivatePatientContactAction({
          organizationId: orgId,
          patientId: patient.id,
          contactId: contact.id,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to remove contact.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show('Contact removed.', { severity: 'success', autoHideDuration: 3000 })
        setContacts((prev) => prev.filter((item) => item.id !== contact.id))
        router.refresh()
      } finally {
        setIsDeleting(false)
      }
    },
    [dialogs, notifications, orgId, patient.id, router],
  )

  const columns = React.useMemo(
    () => contactColumns(handleEdit, handleDelete, isDeleting),
    [handleEdit, handleDelete, isDeleting],
  )

  const atLimit = contacts.length >= MAX_PATIENT_CONTACTS

  return (
    <PageContainer
      title="Contacts"
      breadcrumbs={[
        { title: 'Patients', path: '/patients' },
        { title: fullName || 'Patient', path: `/patients/${patient.id}` },
        { title: 'Contacts' },
      ]}
      actions={
        <Tooltip
          title={atLimit ? `A patient can have at most ${MAX_PATIENT_CONTACTS} contacts.` : ''}
          placement="left"
        >
          <span>
            <Button variant="contained" onClick={handleAdd} startIcon={<AddIcon />} disabled={atLimit}>
              Add contact
            </Button>
          </span>
        </Tooltip>
      }
    >
      <Stack spacing={2} sx={{ width: '100%', mt: 1 }}>
        <Box sx={{ width: '100%', height: 320 }}>
          <DataGrid
            rows={contacts}
            getRowId={(row) => row.id}
            columns={columns}
            disableRowSelectionOnClick
            hideFooter
            slots={{
              noRowsOverlay: () => (
                <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No contacts added yet.
                  </Typography>
                </Stack>
              ),
            }}
            sx={{
              opacity: isDeleting ? 0.6 : 1,
              [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: { outline: 'transparent' },
              [`& .${gridClasses.columnHeader}:focus-within, & .${gridClasses.cell}:focus-within`]: {
                outline: 'none',
              },
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Up to {MAX_PATIENT_CONTACTS} contacts can be stored for a patient ({contacts.length} of{' '}
          {MAX_PATIENT_CONTACTS} used).
        </Typography>
        <Box>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackClick}>
            Back
          </Button>
        </Box>
        
      </Stack>
    </PageContainer>
  )
}
