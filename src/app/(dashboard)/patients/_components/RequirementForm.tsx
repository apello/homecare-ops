'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import InfoIcon from '@mui/icons-material/Info'
import { useRouter } from 'next/navigation'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import {
  MATCHING_EFFECT_HELP,
  TEMPORARY_REQUIREMENT_CODES,
  VISIBILITY_LEVEL_HELP,
} from '@/types'
import type { MatchingEffect, Patient, PatientRequirement, RequirementType, VisibilityLevel } from '@/types'
import { upsertPatientRequirementAction } from '../actions'

function FieldLabel({ text, help }: { text: string; help: string }) {
  return (
    <Stack component="span" direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <span>{text}</span>
      <Tooltip title={help}>
        <InfoIcon fontSize="inherit" color="action" sx={{ display: 'block' }} />
      </Tooltip>
    </Stack>
  )
}

const REQUIREMENT_TYPES: RequirementType[] = [
  'Skill',
  'Language',
  'Gender Preference',
  'Travel',
  'Pets',
  'Smoking',
  'Lifting',
  'Schedule',
  'Other',
]
const MATCHING_EFFECTS: MatchingEffect[] = ['Required', 'Preferred', 'Review Required', 'Exclude']
const VISIBILITY_LEVELS: VisibilityLevel[] = ['Operational', 'Clinical', 'Restricted']
const MATCHING_EFFECT_CONFIRMATION =
  'UNCONFIRMED — confirm with the operations team. Required excludes caregivers who do not meet it; Preferred raises matching score without excluding; Review Required requires scheduler review; Exclude removes caregivers who meet it.'

interface RequirementFormValues {
  requirement_type: RequirementType
  requirement_code: string
  matching_effect: MatchingEffect
  required_skill_code: string
  visibility_level: VisibilityLevel
  effective_start_date: string
  effective_end_date: string
}

export interface RequirementFormProps {
  patient: Patient
  orgId: string
  requirement?: PatientRequirement
}

export default function RequirementForm({ patient, orgId, requirement }: RequirementFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const isEditing = !!requirement
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')

  const [values, setValues] = React.useState<RequirementFormValues>({
    requirement_type: requirement?.requirement_type ?? 'Skill',
    requirement_code: requirement?.requirement_code ?? '',
    matching_effect: requirement?.matching_effect ?? 'Required',
    required_skill_code: requirement?.required_skill_code ?? '',
    visibility_level: requirement?.visibility_level ?? 'Operational',
    effective_start_date: requirement?.effective_start_date ?? '',
    effective_end_date: requirement?.effective_end_date ?? '',
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const requirementCodeIsTemporary = TEMPORARY_REQUIREMENT_CODES.some(
    (option) => option.value === values.requirement_code,
  )
  const skillCodeIsTemporary = TEMPORARY_REQUIREMENT_CODES.some(
    (option) => option.value === values.required_skill_code,
  )

  const handleBackClick = React.useCallback(() => {
    router.push(`/patients/${patient.id}`)
  }, [router, patient.id])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!values.requirement_code.trim()) {
        setErrors({ requirement_code: 'Requirement code is required.' })
        return
      }
      if (!values.effective_start_date.trim()) {
        setErrors({ effective_start_date: 'Effective start date is required.' })
        return
      }

      setIsSubmitting(true)

      try {
        const result = await upsertPatientRequirementAction({
          organizationId: orgId,
          patientId: patient.id,
          requirement_type: values.requirement_type,
          requirement_code: values.requirement_code,
          matching_effect: values.matching_effect,
          required_skill_code: values.required_skill_code || undefined,
          visibility_level: values.visibility_level,
          effective_start_date: values.effective_start_date,
          effective_end_date: values.effective_end_date || undefined,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to save requirement.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show(isEditing ? 'Requirement updated successfully.' : 'Requirement added successfully.', {
          severity: 'success',
          autoHideDuration: 3000,
        })

        router.push(`/patients/${patient.id}`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, orgId, patient.id, isEditing, notifications, router],
  )

  return (
    <PageContainer
      title={isEditing ? 'Edit Requirement' : 'Add Requirement'}
      breadcrumbs={[
        { title: 'Patients', path: '/patients' },
        { title: fullName || 'Patient', path: `/patients/${patient.id}` },
        { title: isEditing ? 'Edit Requirement' : 'Add Requirement' },
      ]}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', mt: 1 }}
      >
        <Alert severity="warning">
          TODO: Requirement and skill codes are temporary placeholders. Confirm and replace them with the team-approved
          values before enabling matching.
        </Alert>

        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="requirement-type-label">Requirement Type</InputLabel>
          <Select
            labelId="requirement-type-label"
            label="Requirement Type"
            value={values.requirement_type}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, requirement_type: e.target.value as RequirementType }))
            }
          >
            {REQUIREMENT_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth required disabled={isSubmitting} error={!!errors.requirement_code}>
          <InputLabel id="requirement-code-label">Requirement Code</InputLabel>
          <Select
            labelId="requirement-code-label"
            label="Requirement Code"
            value={values.requirement_code}
            onChange={(e) => {
              setValues((prev) => ({ ...prev, requirement_code: e.target.value }))
              setErrors({})
            }}
          >
            {values.requirement_code && !requirementCodeIsTemporary ? (
              <MenuItem value={values.requirement_code}>{values.requirement_code} (existing value)</MenuItem>
            ) : null}
            {TEMPORARY_REQUIREMENT_CODES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{errors.requirement_code}</FormHelperText>
        </FormControl>

        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="matching-effect-label">
            <FieldLabel text="Matching Effect" help={MATCHING_EFFECT_CONFIRMATION} />
          </InputLabel>
          <Select
            labelId="matching-effect-label"
            label="Matching Effect"
            value={values.matching_effect}
            onChange={(e) => setValues((prev) => ({ ...prev, matching_effect: e.target.value as MatchingEffect }))}
          >
            {MATCHING_EFFECTS.map((effect) => (
              <MenuItem key={effect} value={effect}>
                <Tooltip title={`UNCONFIRMED — confirm with the operations team. ${MATCHING_EFFECT_HELP[effect]}`}>
                  <span>{effect}</span>
                </Tooltip>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="required-skill-code-label">Required Skill Code</InputLabel>
          <Select
            labelId="required-skill-code-label"
            label="Required Skill Code"
            value={values.required_skill_code}
            onChange={(e) => setValues((prev) => ({ ...prev, required_skill_code: e.target.value }))}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {values.required_skill_code && !skillCodeIsTemporary ? (
              <MenuItem value={values.required_skill_code}>{values.required_skill_code} (existing value)</MenuItem>
            ) : null}
            {TEMPORARY_REQUIREMENT_CODES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="visibility-level-label">
            <FieldLabel
              text="Visibility Level"
              help="Controls who can read this requirement: Operational rows need patients.read_basic; Clinical and Restricted rows need patients.read_clinical."
            />
          </InputLabel>
          <Select
            labelId="visibility-level-label"
            label="Visibility Level"
            value={values.visibility_level}
            onChange={(e) => setValues((prev) => ({ ...prev, visibility_level: e.target.value as VisibilityLevel }))}
          >
            {VISIBILITY_LEVELS.map((level) => (
              <MenuItem key={level} value={level}>
                <Tooltip title={VISIBILITY_LEVEL_HELP[level]} placement="right">
                  <span>{level}</span>
                </Tooltip>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Effective Start Date"
          type="date"
          value={values.effective_start_date}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, effective_start_date: e.target.value }))
            setErrors({})
          }}
          error={!!errors.effective_start_date}
          helperText={errors.effective_start_date}
          required
          fullWidth
          disabled={isSubmitting}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <TextField
          label="Effective End Date"
          type="date"
          value={values.effective_end_date}
          onChange={(e) => setValues((prev) => ({ ...prev, effective_end_date: e.target.value }))}
          fullWidth
          disabled={isSubmitting}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackClick} disabled={isSubmitting}>
            Back
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Requirement'}
          </Button>
        </Stack>
      </Box>
    </PageContainer>
  )
}
