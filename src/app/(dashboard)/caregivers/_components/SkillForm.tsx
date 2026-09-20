'use client'

import * as React from 'react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import {
  CAREGIVER_LANGUAGES,
  CAREGIVER_LIFTING_CAPACITIES,
  CAREGIVER_SKILL_TYPES,
  buildCaregiverSkill,
  getCaregiverSkillType,
  getCaregiverSkillValue,
  type CaregiverSkillType,
} from '@/lib/schemas/caregivers.schema'
import type { Caregiver, CaregiverSkill } from '@/types'
import { upsertSkillAction } from '../actions'

interface SkillFormValues {
  skill_type: CaregiverSkillType | ''
  selection: string
  other_language: string
  other_weight: string
  verified_at: string
  expires_at: string
}

export interface SkillFormProps {
  caregiver: Caregiver
  orgId: string
  skill?: CaregiverSkill
}

function getInitialSelection(
  skill: CaregiverSkill | undefined,
  skillType: CaregiverSkillType | '',
): Pick<SkillFormValues, 'selection' | 'other_language' | 'other_weight'> {
  const empty = { selection: '', other_language: '', other_weight: '' }
  if (!skill || !skillType) return empty

  const value = getCaregiverSkillValue(skill.skill_code)

  if (skillType === 'Language') {
    const isCommonLanguage = CAREGIVER_LANGUAGES.some((option) => option !== 'Other' && option === value)
    return isCommonLanguage
      ? { ...empty, selection: value }
      : { ...empty, selection: 'Other', other_language: value }
  }

  if (skillType === 'Gender') {
    return { ...empty, selection: value ? value.charAt(0) + value.slice(1).toLowerCase() : '' }
  }

  const weight = Number(value)
  const isCommonWeight = CAREGIVER_LIFTING_CAPACITIES.some((option) => option === weight)
  return isCommonWeight
    ? { ...empty, selection: String(weight) }
    : { ...empty, selection: 'Other', other_weight: value }
}

export default function SkillForm({ caregiver, orgId, skill }: SkillFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const isEditing = !!skill
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()
  const initialSkillType = skill ? getCaregiverSkillType(skill.skill_code) ?? '' : ''

  const [values, setValues] = React.useState<SkillFormValues>({
    skill_type: initialSkillType,
    ...getInitialSelection(skill, initialSkillType),
    verified_at: skill?.verified_at?.slice(0, 10) ?? '',
    expires_at: skill?.expires_at?.slice(0, 10) ?? '',
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}/skill`)
  }, [router, caregiver.id])

  const handleTypeChange = React.useCallback((skillType: CaregiverSkillType) => {
    setValues((previous) => ({
      ...previous,
      skill_type: skillType,
      selection: '',
      other_language: '',
      other_weight: '',
    }))
    setErrors({})
  }, [])

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()

      if (!values.skill_type) {
        setErrors({ skill_type: 'Select a skill type.' })
        return
      }
      if (!values.selection) {
        setErrors({ selection: 'Select an option.' })
        return
      }
      if (values.skill_type === 'Language' && values.selection === 'Other' && !values.other_language.trim()) {
        setErrors({ other_language: 'Enter the language.' })
        return
      }
      if (
        values.skill_type === 'Lifting'
        && values.selection === 'Other'
        && (!values.other_weight.trim() || Number(values.other_weight) <= 0)
      ) {
        setErrors({ other_weight: 'Enter a valid patient weight in pounds.' })
        return
      }

      const skillData = buildCaregiverSkill(
        values.skill_type,
        values.selection,
        values.other_language,
        values.other_weight,
      )
      setIsSubmitting(true)

      try {
        const result = await upsertSkillAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          skillId: skill?.id,
          skill_code: skillData.skill_code,
          skill_name: skillData.skill_name,
          verified_at: values.verified_at || null,
          expires_at: values.expires_at || null,
        })

        if (!result.success) {
          notifications.show(result.error ?? 'Failed to save skill.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show(isEditing ? 'Skill updated successfully.' : 'Skill added successfully.', {
          severity: 'success',
          autoHideDuration: 3000,
        })

        router.push(`/caregivers/${caregiver.id}/skill`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, orgId, caregiver.id, skill?.id, isEditing, notifications, router],
  )

  return (
    <PageContainer
      title={isEditing ? 'Edit Skill' : 'Add Skill'}
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` },
        { title: 'Skills', path: `/caregivers/${caregiver.id}/skill` },
        { title: isEditing ? 'Edit Skill' : 'Add Skill' },
      ]}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', mt: 1 }}
      >
        <FormControl fullWidth disabled={isSubmitting} error={!!errors.skill_type}>
          <InputLabel id="skill-type-label">Skill Type</InputLabel>
          <Select
            labelId="skill-type-label"
            label="Skill Type"
            value={values.skill_type}
            onChange={(event) => handleTypeChange(event.target.value as CaregiverSkillType)}
          >
            <MenuItem value="" disabled>
              <em>Pick an option</em>
            </MenuItem>
            {CAREGIVER_SKILL_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{errors.skill_type}</FormHelperText>
        </FormControl>

        {values.skill_type === 'Language' ? (
          <>
            <FormControl fullWidth required disabled={isSubmitting} error={!!errors.selection}>
              <InputLabel id="skill-language-label">Language</InputLabel>
              <Select
                labelId="skill-language-label"
                label="Language"
                value={values.selection}
                onChange={(event) => {
                  setValues((previous) => ({ ...previous, selection: event.target.value }))
                  setErrors({})
                }}
              >
                {CAREGIVER_LANGUAGES.map((language) => (
                  <MenuItem key={language} value={language}>
                    {language}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{errors.selection}</FormHelperText>
            </FormControl>
            {values.selection === 'Other' ? (
              <TextField
                label="Other Language"
                value={values.other_language}
                onChange={(event) => {
                  setValues((previous) => ({ ...previous, other_language: event.target.value }))
                  setErrors({})
                }}
                error={!!errors.other_language}
                helperText={errors.other_language}
                required
                fullWidth
                disabled={isSubmitting}
              />
            ) : null}
          </>
        ) : null}

        {values.skill_type === 'Gender' ? (
          <FormControl fullWidth required disabled={isSubmitting} error={!!errors.selection}>
            <InputLabel id="skill-gender-label">Caregiver Gender</InputLabel>
            <Select
              labelId="skill-gender-label"
              label="Caregiver Gender"
              value={values.selection}
              onChange={(event) => {
                setValues((previous) => ({ ...previous, selection: event.target.value }))
                setErrors({})
              }}
            >
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
            </Select>
            <FormHelperText>{errors.selection}</FormHelperText>
          </FormControl>
        ) : null}

        {values.skill_type === 'Lifting' ? (
          <FormControl fullWidth required disabled={isSubmitting} error={!!errors.selection}>
            <InputLabel id="caregiver-lifting-label">Patient Lifting Capacity</InputLabel>
            <Select
              labelId="caregiver-lifting-label"
              label="Patient Lifting Capacity"
              value={values.selection}
              onChange={(event) => {
                setValues((previous) => ({ ...previous, selection: event.target.value }))
                setErrors({})
              }}
            >
              {CAREGIVER_LIFTING_CAPACITIES.map((weight) => (
                <MenuItem key={weight} value={String(weight)}>
                  Lift a patient weighing at least {weight} lb
                </MenuItem>
              ))}
              <MenuItem value="Other">Other weight</MenuItem>
            </Select>
            <FormHelperText>
              {errors.selection ?? 'Select the maximum patient weight this caregiver can lift safely.'}
            </FormHelperText>
          </FormControl>
        ) : null}

        {values.skill_type === 'Lifting' && values.selection === 'Other' ? (
          <TextField
            label="Other Patient Weight (lb)"
            type="number"
            value={values.other_weight}
            onChange={(event) => {
              setValues((previous) => ({ ...previous, other_weight: event.target.value }))
              setErrors({})
            }}
            error={!!errors.other_weight}
            helperText={errors.other_weight ?? 'Enter the patient weight this caregiver can lift safely.'}
            required
            fullWidth
            disabled={isSubmitting}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
        ) : null}

        <TextField
          label="Verified On (Optional)"
          type="date"
          value={values.verified_at}
          onChange={(event) => setValues((previous) => ({ ...previous, verified_at: event.target.value }))}
          fullWidth
          disabled={isSubmitting}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <TextField
          label="Expires On (Optional)"
          type="date"
          value={values.expires_at}
          onChange={(event) => setValues((previous) => ({ ...previous, expires_at: event.target.value }))}
          fullWidth
          disabled={isSubmitting}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackClick} disabled={isSubmitting}>
            Back
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Skill'}
          </Button>
        </Stack>
      </Box>
    </PageContainer>
  )
}
