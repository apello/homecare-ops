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
  COMMON_LANGUAGES,
  PATIENT_LIFTING_THRESHOLDS,
  PATIENT_REQUIREMENT_TYPES,
} from '@/lib/schemas/patients.schema'
import type { Patient, PatientRequirement } from '@/types'
import { upsertPatientRequirementAction } from '../actions'

type SupportedRequirementType = (typeof PATIENT_REQUIREMENT_TYPES)[number]

interface RequirementFormValues {
  requirement_type: SupportedRequirementType | ''
  selection: string
  other_language: string
  other_weight: string
  effective_start_date: string
  effective_end_date: string
}

export interface RequirementFormProps {
  patient: Patient
  orgId: string
  requirement?: PatientRequirement
}

function isSupportedRequirementType(value: string | undefined): value is SupportedRequirementType {
  return PATIENT_REQUIREMENT_TYPES.some((type) => type === value)
}

function getInitialSelection(
  requirement: PatientRequirement | undefined,
  requirementType: SupportedRequirementType,
): Pick<RequirementFormValues, 'selection' | 'other_language'> {
  const structuredValue = requirement?.structured_value
  if (!structuredValue) return { selection: '', other_language: '' }

  if (requirementType === 'Language' && typeof structuredValue.language === 'string') {
    const language = structuredValue.language
    const isCommonLanguage = COMMON_LANGUAGES.some((option) => option !== 'Other' && option === language)
    return isCommonLanguage
      ? { selection: language, other_language: '' }
      : { selection: 'Other', other_language: language }
  }

  if (
    requirementType === 'Gender Preference'
    && typeof structuredValue.gender_preference === 'string'
  ) {
    return { selection: structuredValue.gender_preference, other_language: '' }
  }

  if (
    requirementType === 'Lifting'
    && typeof structuredValue.minimum_patient_lifting_lbs === 'number'
  ) {
    return {
      selection: String(structuredValue.minimum_patient_lifting_lbs),
      other_language: '',
    }
  }

  return { selection: '', other_language: '' }
}

function buildRequirementData(
  requirementType: SupportedRequirementType,
  selection: string,
  otherLanguage: string,
  otherWeight: string,
) {
  if (requirementType === 'Language') {
    const language = selection === 'Other' ? otherLanguage.trim() : selection
    return {
      requirement_code: `LANGUAGE:${language}`,
      structured_value: { language },
    }
  }

  if (requirementType === 'Gender Preference') {
    return {
      requirement_code: `GENDER_PREFERENCE:${selection.toUpperCase()}`,
      structured_value: { gender_preference: selection },
    }
  }

  const minimumPatientLiftingLbs = Number(selection === 'Other' ? otherWeight : selection)
  return {
    requirement_code: `PATIENT_LIFTING_MIN_LB:${minimumPatientLiftingLbs}`,
    structured_value: { minimum_patient_lifting_lbs: minimumPatientLiftingLbs },
  }
}

export default function RequirementForm({ patient, orgId, requirement }: RequirementFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const isEditing = !!requirement
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')
  const initialRequirementType = isSupportedRequirementType(requirement?.requirement_type)
    ? requirement.requirement_type
    : ''
  const initialSelection = initialRequirementType
    ? getInitialSelection(requirement, initialRequirementType)
    : { selection: '', other_language: '' }
  const initialLiftingWeight = requirement?.structured_value?.minimum_patient_lifting_lbs
  const usesOtherLiftingWeight = (
    initialRequirementType === 'Lifting'
    && typeof initialLiftingWeight === 'number'
    && !PATIENT_LIFTING_THRESHOLDS.some((weight) => weight === initialLiftingWeight)
  )

  const [values, setValues] = React.useState<RequirementFormValues>({
    requirement_type: initialRequirementType,
    ...initialSelection,
    selection: usesOtherLiftingWeight ? 'Other' : initialSelection.selection,
    other_weight: usesOtherLiftingWeight ? String(initialLiftingWeight) : '',
    effective_start_date: requirement?.effective_start_date ?? '',
    effective_end_date: requirement?.effective_end_date ?? '',
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleBackClick = React.useCallback(() => {
    router.push(`/patients/${patient.id}/requirement`)
  }, [router, patient.id])

  const handleTypeChange = React.useCallback((requirementType: SupportedRequirementType) => {
    setValues((previous) => ({
      ...previous,
      requirement_type: requirementType,
      selection: '',
      other_language: '',
      other_weight: '',
    }))
    setErrors({})
  }, [])

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()

      if (!values.requirement_type) {
        setErrors({ requirement_type: 'Select a requirement type.' })
        return
      }
      if (!values.selection) {
        setErrors({ selection: 'Select an option.' })
        return
      }
      if (values.requirement_type === 'Language' && values.selection === 'Other' && !values.other_language.trim()) {
        setErrors({ other_language: 'Enter the language.' })
        return
      }
      if (
        values.requirement_type === 'Lifting'
        && values.selection === 'Other'
        && (!values.other_weight.trim() || Number(values.other_weight) <= 0)
      ) {
        setErrors({ other_weight: 'Enter a valid patient weight in pounds.' })
        return
      }

      const requirementData = buildRequirementData(
        values.requirement_type,
        values.selection,
        values.other_language,
        values.other_weight,
      )
      setIsSubmitting(true)

      try {
        const result = await upsertPatientRequirementAction({
          organizationId: orgId,
          patientId: patient.id,
          requirement_type: values.requirement_type,
          requirement_code: requirementData.requirement_code,
          matching_effect: requirement?.matching_effect ?? 'Preferred',
          structured_value: requirementData.structured_value,
          visibility_level: requirement?.visibility_level ?? 'Operational',
          effective_start_date: values.effective_start_date || undefined,
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

        router.push(`/patients/${patient.id}/requirement`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, orgId, patient.id, requirement, isEditing, notifications, router],
  )

  return (
    <PageContainer
      title={isEditing ? 'Edit Requirement' : 'Add Requirement'}
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Patients', path: '/patients' },
        { title: fullName || 'Patient', path: `/patients/${patient.id}` },
        { title: 'Requirements', path: `/patients/${patient.id}/requirement` },
        { title: isEditing ? 'Edit Requirement' : 'Add Requirement' },
      ]}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', mt: 1 }}
      >
        <FormControl fullWidth disabled={isSubmitting} error={!!errors.requirement_type}>
          <InputLabel id="requirement-type-label">Requirement Type</InputLabel>
          <Select
            labelId="requirement-type-label"
            label="Requirement Type"
            value={values.requirement_type}
            onChange={(event) => handleTypeChange(event.target.value as SupportedRequirementType)}
          >
            <MenuItem value="" disabled>
              <em>Pick an option</em>
            </MenuItem>
            {PATIENT_REQUIREMENT_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{errors.requirement_type}</FormHelperText>
        </FormControl>

        {values.requirement_type === 'Language' ? (
          <>
            <FormControl fullWidth required disabled={isSubmitting} error={!!errors.selection}>
              <InputLabel id="language-label">Language</InputLabel>
              <Select
                labelId="language-label"
                label="Language"
                value={values.selection}
                onChange={(event) => {
                  setValues((previous) => ({ ...previous, selection: event.target.value }))
                  setErrors({})
                }}
              >
                {COMMON_LANGUAGES.map((language) => (
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

        {values.requirement_type === 'Gender Preference' ? (
          <FormControl fullWidth required disabled={isSubmitting} error={!!errors.selection}>
            <InputLabel id="gender-preference-label">Preferred Caregiver Gender</InputLabel>
            <Select
              labelId="gender-preference-label"
              label="Preferred Caregiver Gender"
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

        {values.requirement_type === 'Lifting' ? (
          <FormControl fullWidth required disabled={isSubmitting} error={!!errors.selection}>
            <InputLabel id="patient-lifting-label">Minimum Patient Lifting Capacity</InputLabel>
            <Select
              labelId="patient-lifting-label"
              label="Minimum Patient Lifting Capacity"
              value={values.selection}
              onChange={(event) => {
                setValues((previous) => ({ ...previous, selection: event.target.value }))
                setErrors({})
              }}
            >
              {PATIENT_LIFTING_THRESHOLDS.map((weight) => (
                <MenuItem key={weight} value={String(weight)}>
                  Lift a patient weighing at least {weight} lb
                </MenuItem>
              ))}
              <MenuItem value="Other">Other weight</MenuItem>
            </Select>
            <FormHelperText>
              {errors.selection ?? 'Select the minimum patient weight a caregiver must be able to lift safely.'}
            </FormHelperText>
          </FormControl>
        ) : null}

        {values.requirement_type === 'Lifting' && values.selection === 'Other' ? (
          <TextField
            label="Other Patient Weight (lb)"
            type="number"
            value={values.other_weight}
            onChange={(event) => {
              setValues((previous) => ({ ...previous, other_weight: event.target.value }))
              setErrors({})
            }}
            error={!!errors.other_weight}
            helperText={errors.other_weight ?? 'Enter the minimum patient weight the caregiver must be able to lift.'}
            required
            fullWidth
            disabled={isSubmitting}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
        ) : null}

        <TextField
          label="Effective Start Date (Optional)"
          type="date"
          value={values.effective_start_date}
          onChange={(event) => setValues((previous) => ({ ...previous, effective_start_date: event.target.value }))}
          fullWidth
          disabled={isSubmitting}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <TextField
          label="Effective End Date (Optional)"
          type="date"
          value={values.effective_end_date}
          onChange={(event) => setValues((previous) => ({ ...previous, effective_end_date: event.target.value }))}
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
