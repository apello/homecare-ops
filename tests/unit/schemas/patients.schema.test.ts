import { describe, expect, it } from 'vitest'

import {
  ArchivePatientSchema,
  COMMON_LANGUAGES,
  CreatePatientSchema,
  DeactivatePatientAddressSchema,
  DeactivatePatientContactSchema,
  DeactivatePatientRequirementSchema,
  getPatientRequirementDisplayValue,
  MAX_PATIENT_ADDRESSES,
  MAX_PATIENT_CONTACTS,
  PATIENT_LIFTING_THRESHOLDS,
  PATIENT_REQUIREMENT_TYPES,
  PatientAddressSchema,
  PatientListResponseSchema,
  PatientRequirementSchema,
  UpdatePatientSchema,
  UpsertPatientAddressSchema,
  UpsertPatientContactSchema,
} from '@/lib/schemas/patients.schema'

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const PATIENT_ID = '00000000-0000-0000-0000-000000000002'
const CHILD_ID = '00000000-0000-0000-0000-000000000003'
const USER_ID = '00000000-0000-0000-0000-000000000004'

const address = {
  address_type: 'Service' as const,
  address_line_1: '100 Test Way',
  city: 'Testville',
  state: 'PA',
  zip_code: '19000',
}

const requirement = {
  organizationId: ORG_ID,
  patientId: PATIENT_ID,
  requirement_type: 'Language' as const,
  requirement_code: 'LANGUAGE:Spanish',
  matching_effect: 'Preferred' as const,
  structured_value: { language: 'Spanish' },
  visibility_level: 'Operational' as const,
}

describe('PatientAddressSchema', () => {
  it('parses a valid address', () => {
    expect(PatientAddressSchema.parse(address)).toEqual(address)
  })

  it.each(['address_type', 'address_line_1', 'city', 'state', 'zip_code'] as const)(
    'rejects a missing %s',
    (field) => {
      const result = PatientAddressSchema.safeParse({ ...address, [field]: undefined })
      expect(result.success).toBe(false)
    },
  )

  it('rejects invalid address types and unknown fields', () => {
    expect(PatientAddressSchema.safeParse({ ...address, address_type: 'Temporary' }).success).toBe(false)
    expect(PatientAddressSchema.safeParse({ ...address, extra: true }).success).toBe(false)
  })

  it('allows exactly three address types', () => {
    const addressTypes = ['Service', 'Mailing', 'Other']

    expect(MAX_PATIENT_ADDRESSES).toBe(3)
    expect(addressTypes.every((address_type) => (
      PatientAddressSchema.safeParse({ ...address, address_type }).success
    ))).toBe(true)
    expect(PatientAddressSchema.safeParse({ ...address, address_type: 'Temporary' }).success).toBe(false)
  })
})

describe('CreatePatientSchema', () => {
  const valid = {
    organizationId: ORG_ID,
    first_name: 'Test',
    last_name: 'Patient',
    date_of_birth: '1990-01-15',
    address,
  }

  it('parses a valid patient with one optional service address', () => {
    expect(CreatePatientSchema.parse(valid)).toEqual(valid)
  })

  it.each(['organizationId', 'first_name', 'last_name', 'date_of_birth'] as const)(
    'rejects a missing %s',
    (field) => {
      expect(CreatePatientSchema.safeParse({ ...valid, [field]: undefined }).success).toBe(false)
    },
  )

  it('rejects invalid status, date format, and unknown fields', () => {
    expect(CreatePatientSchema.safeParse({ ...valid, status: 'Pending' }).success).toBe(false)
    expect(CreatePatientSchema.safeParse({ ...valid, date_of_birth: '01/15/1990' }).success).toBe(false)
    expect(CreatePatientSchema.safeParse({ ...valid, extra: true }).success).toBe(false)
  })
})

describe('UpdatePatientSchema', () => {
  const valid = {
    organizationId: ORG_ID,
    patientId: PATIENT_ID,
    first_name: 'Updated',
    date_of_birth: '1990-01-15',
  }

  it('parses a valid update', () => {
    expect(UpdatePatientSchema.parse(valid)).toEqual(valid)
  })

  it('requires date of birth', () => {
    expect(UpdatePatientSchema.safeParse({
      organizationId: ORG_ID,
      patientId: PATIENT_ID,
      first_name: 'Updated',
    }).success).toBe(false)
  })

  it('requires an update field beyond the identifiers', () => {
    expect(UpdatePatientSchema.safeParse({
      organizationId: ORG_ID,
      patientId: PATIENT_ID,
    }).success).toBe(false)
  })

  it('rejects Archived status and unknown fields', () => {
    expect(UpdatePatientSchema.safeParse({ ...valid, status: 'Archived' }).success).toBe(false)
    expect(UpdatePatientSchema.safeParse({ ...valid, extra: true }).success).toBe(false)
  })
})

describe('PatientRequirementSchema', () => {
  it('exposes only the supported patient-facing requirement choices', () => {
    expect(PATIENT_REQUIREMENT_TYPES).toEqual(['Language', 'Gender Preference', 'Lifting'])
    expect(COMMON_LANGUAGES).toContain('Other')
    expect(PATIENT_LIFTING_THRESHOLDS).toEqual([150, 200, 250])
  })

  it('parses a valid requirement', () => {
    expect(PatientRequirementSchema.parse(requirement)).toEqual(requirement)
  })

  it.each([
    ['requirement_type', 'Unsupported'],
    ['requirement_type', 'Skill'],
    ['matching_effect', 'Optional'],
    ['visibility_level', 'Public'],
  ])('rejects invalid %s values', (field, value) => {
    expect(PatientRequirementSchema.safeParse({ ...requirement, [field]: value }).success).toBe(false)
  })

  it.each([
    'organizationId',
    'patientId',
    'requirement_type',
    'requirement_code',
    'matching_effect',
    'visibility_level',
  ] as const)('rejects a missing %s', (field) => {
    expect(PatientRequirementSchema.safeParse({ ...requirement, [field]: undefined }).success).toBe(false)
  })

  it('rejects unknown fields', () => {
    expect(PatientRequirementSchema.safeParse({ ...requirement, extra: true }).success).toBe(false)
  })

  it('allows both effective dates to be omitted', () => {
    const parsed = PatientRequirementSchema.parse(requirement)
    expect(parsed.effective_start_date).toBeUndefined()
    expect(parsed.effective_end_date).toBeUndefined()
  })

  it.each([
    ['Language', { language: 'Spanish' }, 'Spanish'],
    ['Gender Preference', { gender_preference: 'Female' }, 'Female'],
    ['Lifting', { minimum_patient_lifting_lbs: 200 }, 'Lift a patient weighing at least 200 lb'],
  ] as const)('formats the %s value without exposing internal metadata', (requirementType, structuredValue, expected) => {
    expect(getPatientRequirementDisplayValue({
      requirement_type: requirementType,
      structured_value: structuredValue,
    })).toBe(expected)
  })
})

describe('PatientListResponseSchema', () => {
  const row = {
    id: PATIENT_ID,
    organization_id: ORG_ID,
    first_name: 'Test',
    last_name: 'Patient',
    middle_name: null,
    patient_external_id: null,
    status: 'Active' as const,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by_user_id: USER_ID,
    updated_at: null,
    updated_by_user_id: null,
  }

  it('parses basic list fields', () => {
    expect(PatientListResponseSchema.parse(row)).toEqual(row)
  })

  it('rejects clinical and unknown fields such as date of birth', () => {
    expect(PatientListResponseSchema.safeParse({ ...row, date_of_birth: '1990-01-15' }).success).toBe(false)
  })
})

describe('patient mutation identifier schemas', () => {
  it.each([
    [ArchivePatientSchema, { organizationId: ORG_ID, patientId: PATIENT_ID }],
    [DeactivatePatientAddressSchema, { organizationId: ORG_ID, patientId: PATIENT_ID, addressId: CHILD_ID }],
    [DeactivatePatientRequirementSchema, { organizationId: ORG_ID, patientId: PATIENT_ID, requirementId: CHILD_ID }],
    [DeactivatePatientContactSchema, { organizationId: ORG_ID, patientId: PATIENT_ID, contactId: CHILD_ID }],
  ])('parses identifiers and rejects unknown fields', (schema, valid) => {
    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse({ ...valid, extra: true }).success).toBe(false)
  })
})

describe('UpsertPatientAddressSchema', () => {
  const valid = { organizationId: ORG_ID, patientId: PATIENT_ID, ...address }

  it('parses a valid address and rejects unknown fields', () => {
    expect(UpsertPatientAddressSchema.parse(valid)).toEqual(valid)
    expect(UpsertPatientAddressSchema.safeParse({ ...valid, extra: true }).success).toBe(false)
  })
})

describe('UpsertPatientContactSchema', () => {
  const valid = {
    organizationId: ORG_ID,
    patientId: PATIENT_ID,
    contact_type: 'Emergency' as const,
    contact_name: 'Test Contact',
    relationship: 'Friend' as const,
    email: 'contact@example.test',
  }

  it('parses a valid contact', () => {
    expect(UpsertPatientContactSchema.parse(valid)).toEqual(valid)
  })

  it('rejects invalid contact types, relationships, emails, and unknown fields', () => {
    expect(UpsertPatientContactSchema.safeParse({ ...valid, contact_type: 'Unknown' }).success).toBe(false)
    expect(UpsertPatientContactSchema.safeParse({ ...valid, relationship: 'Unknown' }).success).toBe(false)
    expect(UpsertPatientContactSchema.safeParse({ ...valid, email: 'invalid' }).success).toBe(false)
    expect(UpsertPatientContactSchema.safeParse({ ...valid, extra: true }).success).toBe(false)
  })

  it('defines a maximum of five active contacts', () => {
    expect(MAX_PATIENT_CONTACTS).toBe(5)
  })
})
