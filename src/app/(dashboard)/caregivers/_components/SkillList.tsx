'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { DataGrid, GridActionsCellItem, GridColDef, gridClasses } from '@mui/x-data-grid'
import { useRouter } from 'next/navigation'
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import {
  getCaregiverSkillDisplayValue,
  getCaregiverSkillType,
} from '@/lib/schemas/caregivers.schema'
import type { Caregiver, CaregiverSkill } from '@/types'
import { deactivateSkillAction } from '../actions'

export interface SkillListProps {
  caregiver: Caregiver
  orgId: string
  skills: CaregiverSkill[]
}

export default function SkillList({ caregiver, orgId, skills: initialSkills }: SkillListProps) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()
  const [skills, setSkills] = React.useState(initialSkills)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}`)
  }, [router, caregiver.id])

  const handleAdd = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}/skill/new`)
  }, [router, caregiver.id])

  const handleEdit = React.useCallback(
    (skill: CaregiverSkill) => {
      router.push(`/caregivers/${caregiver.id}/skill/${skill.id}/edit`)
    },
    [router, caregiver.id],
  )

  const handleDelete = React.useCallback(
    async (skill: CaregiverSkill) => {
      const confirmed = await dialogs.confirm(
        `Remove the ${(getCaregiverSkillType(skill.skill_code) ?? 'skill').toLowerCase()} entry "${getCaregiverSkillDisplayValue(skill)}"?`,
        { title: 'Remove skill?', severity: 'warning', okText: 'Remove' },
      )
      if (!confirmed) return

      setIsDeleting(true)
      try {
        const result = await deactivateSkillAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          skillId: skill.id,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to remove skill.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        setSkills((prev) => prev.filter((item) => item.id !== skill.id))
        notifications.show('Skill removed.', { severity: 'success', autoHideDuration: 3000 })
        router.refresh()
      } finally {
        setIsDeleting(false)
      }
    },
    [dialogs, notifications, orgId, caregiver.id, router],
  )

  const columns = React.useMemo<GridColDef<CaregiverSkill>[]>(
    () => [
      {
        field: 'skill_type',
        headerName: 'Type',
        flex: 1,
        minWidth: 120,
        valueGetter: (_value, row) => getCaregiverSkillType(row.skill_code) ?? '—',
      },
      {
        field: 'details',
        headerName: 'Skill',
        flex: 2,
        minWidth: 220,
        valueGetter: (_value, row) => getCaregiverSkillDisplayValue(row),
      },
      {
        field: 'verified_at',
        headerName: 'Verified',
        width: 120,
        type: 'date',
        valueGetter: (_value, row) => (row.verified_at ? new Date(row.verified_at) : null),
      },
      {
        field: 'expires_at',
        headerName: 'Expires',
        width: 120,
        type: 'date',
        valueGetter: (_value, row) => (row.expires_at ? new Date(row.expires_at) : null),
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
            onClick={() => handleEdit(row)}
            disabled={isDeleting}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => handleDelete(row)}
            disabled={isDeleting}
          />,
        ],
      },
    ],
    [handleEdit, handleDelete, isDeleting],
  )

  return (
    <PageContainer
      title="Skills"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` },
        { title: 'Skills' },
      ]}
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Skill
        </Button>
      }
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Box sx={{ minHeight: 100, width: '100%' }}>
          {skills.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No skills recorded yet.
            </Typography>
          ) : (
            <DataGrid
              rows={skills}
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
