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
import { getPatientRequirementDisplayValue } from '@/lib/schemas/patients.schema'
import type { Patient, PatientRequirement } from '@/types'
import { deactivatePatientRequirementAction } from '../actions'

function requirementColumns(
  onRequirementEdit: (requirement: PatientRequirement) => void,
  onRequirementDelete: (requirement: PatientRequirement) => void,
  isDeleting: boolean,
): GridColDef<PatientRequirement>[] {
  return [
    {
      field: 'requirement_type',
      headerName: 'Type',
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'details',
      headerName: 'Preference / Need',
      flex: 2,
      minWidth: 220,
      valueGetter: (_value, row) => getPatientRequirementDisplayValue(row),
    },
    {
      field: 'effective_start_date',
      headerName: 'Start Date',
      type: 'date',
      flex: 1,
      minWidth: 120,
      valueGetter: (value) => value ? new Date(`${value}T00:00:00`) : null,
    },
    {
      field: 'effective_end_date',
      headerName: 'End Date',
      type: 'date',
      flex: 1,
      minWidth: 120,
      valueGetter: (value) => value ? new Date(`${value}T00:00:00`) : null,
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
          onClick={() => onRequirementEdit(row)}
          disabled={isDeleting}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => onRequirementDelete(row)}
          disabled={isDeleting}
        />,
      ],
    },
  ]
}

export interface RequirementListProps {
  patient: Patient
  orgId: string
  requirements: PatientRequirement[]
}

export default function RequirementList({ patient, orgId, requirements: initialRequirements }: RequirementListProps) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')

  const [requirements, setRequirements] = React.useState<PatientRequirement[]>(initialRequirements)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleBackClick = React.useCallback(() => {
    router.push(`/patients/${patient.id}`)
  }, [router, patient.id])

  const handleAdd = React.useCallback(() => {
    router.push(`/patients/${patient.id}/requirement/new`)
  }, [router, patient.id])

  const handleEdit = React.useCallback(
    (requirement: PatientRequirement) => {
      router.push(`/patients/${patient.id}/requirement/${requirement.id}/edit`)
    },
    [router, patient.id],
  )

  const handleDelete = React.useCallback(
    async (requirement: PatientRequirement) => {
      const confirmed = await dialogs.confirm(
        `Remove the ${requirement.requirement_type.toLowerCase()} preference "${getPatientRequirementDisplayValue(requirement)}"?`,
        { title: 'Remove requirement?', severity: 'warning', okText: 'Remove' },
      )
      if (!confirmed) return

      setIsDeleting(true)
      try {
        const result = await deactivatePatientRequirementAction({
          organizationId: orgId,
          patientId: patient.id,
          requirementId: requirement.id,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to remove requirement.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show('Requirement removed.', { severity: 'success', autoHideDuration: 3000 })
        setRequirements((prev) => prev.filter((item) => item.id !== requirement.id))
        router.refresh()
      } finally {
        setIsDeleting(false)
      }
    },
    [dialogs, notifications, orgId, patient.id, router],
  )

  const columns = React.useMemo(
    () => requirementColumns(handleEdit, handleDelete, isDeleting),
    [handleEdit, handleDelete, isDeleting],
  )

  return (
    <PageContainer
      title="Requirements"
      breadcrumbs={[
        { title: 'Patients', path: '/patients' },
        { title: fullName || 'Patient', path: `/patients/${patient.id}` },
        { title: 'Requirements' },
      ]}
      actions={
        <Button variant="contained" onClick={handleAdd} startIcon={<AddIcon />}>
          Add requirement
        </Button>
      }
    >
      <Stack spacing={2} sx={{ width: '100%', mt: 1 }}>
        <Box sx={{ width: '100%', height: 320 }}>
          <DataGrid
            rows={requirements}
            getRowId={(row) => row.id}
            columns={columns}
            disableRowSelectionOnClick
            hideFooter
            slots={{
              noRowsOverlay: () => (
                <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No requirements added yet.
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
        <Box>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackClick}>
            Back
          </Button>
        </Box>
      </Stack>
    </PageContainer>
  )
}
