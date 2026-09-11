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
import InfoIcon from '@mui/icons-material/Info'
import Tooltip from '@mui/material/Tooltip'
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
import { MATCHING_EFFECT_HELP, VISIBILITY_LEVEL_HELP } from '@/types'
import type { MatchingEffect, Patient, PatientRequirement, VisibilityLevel } from '@/types'
import { deactivatePatientRequirementAction } from '../actions'

function HeaderWithHelp({ label, help }: { label: string; help: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <span>{label}</span>
      <Tooltip title={help}>
        <InfoIcon fontSize="inherit" color="action" sx={{ display: 'block' }} />
      </Tooltip>
    </Stack>
  )
}

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
      field: 'requirement_code',
      headerName: 'Code',
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'matching_effect',
      headerName: 'Matching Effect',
      flex: 1,
      minWidth: 150,
      renderHeader: () => (
        <HeaderWithHelp
          label="Matching Effect"
          help="UNCONFIRMED — confirm with the operations team. Required excludes caregivers who do not meet it; Preferred raises matching score without excluding; Review Required requires scheduler review; Exclude removes caregivers who meet it."
        />
      ),
      renderCell: (params) => (
        <Tooltip
          title={`UNCONFIRMED — confirm with the operations team. ${
            MATCHING_EFFECT_HELP[params.value as MatchingEffect] ?? ''
          }`}
        >
          <span>{params.value as string}</span>
        </Tooltip>
      ),
    },
    {
      field: 'visibility_level',
      headerName: 'Visibility',
      flex: 1,
      minWidth: 140,
      renderHeader: () => (
        <HeaderWithHelp
          label="Visibility"
          help="Controls who can read this requirement: Operational rows need patients.read_basic; Clinical and Restricted rows need patients.read_clinical."
        />
      ),
      renderCell: (params) => (
        <Tooltip title={VISIBILITY_LEVEL_HELP[params.value as VisibilityLevel] ?? ''}>
          <span>{params.value as string}</span>
        </Tooltip>
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
        `Remove the ${requirement.requirement_type} requirement (${requirement.requirement_code})?`,
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
