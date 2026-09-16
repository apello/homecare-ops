import { z } from 'zod'
import type { PatientRequirement } from '@/types'

const patientStatusEnum = z.enum(['Intake', 'Active', 'Suspended', 'Discharged', 'Archived'] as const)
const patientRequirementTypeEnum = z.enum(['Language', 'Gender Preference', 'Lifting'] as const)
const matchingEffectEnum = z.enum(['Required', 'Preferred', 'Review Required', 'Exclude'] as const)
const visibilityLevelEnum = z.enum(['Operational', 'Clinical', 'Restricted'] as const)
const addressTypeEnum = z.enum(['Service', 'Mailing', 'Other'] as const)
// TODO: Find out whether there is an official list of contact types needed
const contactTypeEnum = z.enum([
  'Emergency',
  'Primary',
  'Secondary',
  'Guardian',
  'Power of Attorney',
  'Other',
] as const)
const contactRelationshipEnum = z.enum([
  'Spouse',
  'Partner',
  'Parent',
  'Child',
  'Sibling',
  'Grandparent',
  'Grandchild',
  'Other Relative',
  'Friend',
  'Neighbor',
  'Legal Guardian',
  'Case Manager',
  'Other',
] as const)

export const CONTACT_TYPES = contactTypeEnum.options
export const CONTACT_RELATIONSHIPS = contactRelationshipEnum.options
export const PATIENT_REQUIREMENT_TYPES = patientRequirementTypeEnum.options
export const COMMON_LANGUAGES = [
  'English',
  'Spanish',
  'Arabic',
  'French',
  'Mandarin Chinese',
  'Cantonese',
  'Vietnamese',
  'Korean',
  'Tagalog',
  'Haitian Creole',
  'Russian',
  'Portuguese',
  'Other',
] as const
export const PATIENT_LIFTING_THRESHOLDS = [150, 200, 250] as const

export const MAX_PATIENT_ADDRESSES = addressTypeEnum.options.length
export const MAX_PATIENT_CONTACTS = 5

const uuidShape = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid UUID',
)

const dateShape = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

// ─── Address ──────────────────────────────────────────────────────────────────

export const PatientAddressSchema = z.object({
  address_type: addressTypeEnum,
  address_line_1: z.string().min(1, 'Address line 1 is required'),
  address_line_2: z.string().nullable().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zip_code: z.string().min(5, 'ZIP code is required'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  location_hash: z.string().nullable().optional(),
  geocoding_provider: z.string().nullable().optional(),
  geocoded_at: z.string().nullable().optional(),
}).strict()

// ─── Create Patient ───────────────────────────────────────────────────────────

export const CreatePatientSchema = z.object({
  organizationId: uuidShape,
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  middle_name: z.string().nullable().optional(),
  date_of_birth: dateShape,
  patient_external_id: z.string().nullable().optional(),
  status: patientStatusEnum.optional(),
  address: PatientAddressSchema.optional(),
}).strict()

export type CreatePatientInput = z.infer<typeof CreatePatientSchema>

// ─── Update Patient ───────────────────────────────────────────────────────────

export const UpdatePatientSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  middle_name: z.string().nullable().optional(),
  date_of_birth: dateShape,
  patient_external_id: z.string().nullable().optional(),
  status: patientStatusEnum.optional(),
}).strict().refine(
  (obj) => Object.keys(obj).length > 2, // At least organizationId, patientId, and one other field
  'At least one field must be updated',
).refine(
  (obj) => obj.status !== 'Archived',
  'Use the archive action to archive a patient',
)

export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>

// ─── Patient Requirement ──────────────────────────────────────────────────────

export const PatientRequirementSchema = z
  .object({
    organizationId: uuidShape,
    patientId: uuidShape,
    requirement_type: patientRequirementTypeEnum,
    requirement_code: z.string().min(1, 'Requirement code is required'),
    matching_effect: matchingEffectEnum,
    required_skill_code: z.string().nullable().optional(),
    restricted_note_id: uuidShape.nullable().optional(),
    visibility_level: visibilityLevelEnum,
    effective_start_date: dateShape.optional(),
    effective_end_date: dateShape.nullable().optional(),
    structured_value: z.object({}).passthrough().optional(),
  })
  .strict()

export type PatientRequirementInput = z.infer<typeof PatientRequirementSchema>

export function getPatientRequirementDisplayValue(
  requirement: Pick<PatientRequirement, 'requirement_type' | 'structured_value'>,
): string {
  const structuredValue = requirement.structured_value
  if (!structuredValue) return 'Details not available'

  if (requirement.requirement_type === 'Language' && typeof structuredValue.language === 'string') {
    return structuredValue.language
  }
  if (
    requirement.requirement_type === 'Gender Preference'
    && typeof structuredValue.gender_preference === 'string'
  ) {
    return structuredValue.gender_preference
  }
  if (
    requirement.requirement_type === 'Lifting'
    && typeof structuredValue.minimum_patient_lifting_lbs === 'number'
  ) {
    return `Lift a patient weighing at least ${structuredValue.minimum_patient_lifting_lbs} lb`
  }

  return 'Details not available'
}

export const DeactivatePatientRequirementSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  requirementId: uuidShape,
}).strict()

export type DeactivatePatientRequirementInput = z.infer<typeof DeactivatePatientRequirementSchema>

// ─── Patient List Response ────────────────────────────────────────────────────

export const PatientListResponseSchema = z.object({
  id: uuidShape,
  organization_id: uuidShape,
  first_name: z.string(),
  last_name: z.string(),
  middle_name: z.string().nullable(),
  patient_external_id: z.string().nullable(),
  status: patientStatusEnum,
  created_at: z.string(),
  created_by_user_id: uuidShape,
  updated_at: z.string().nullable(),
  updated_by_user_id: uuidShape.nullable(),
}).strict()

export type PatientListResponse = z.infer<typeof PatientListResponseSchema>

// ─── Archive Patient ──────────────────────────────────────────────────────────

export const ArchivePatientSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
}).strict()

export type ArchivePatientInput = z.infer<typeof ArchivePatientSchema>

// ─── Upsert Address ───────────────────────────────────────────────────────────

export const UpsertPatientAddressSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  address_type: addressTypeEnum,
  address_line_1: z.string().min(1, 'Address line 1 is required'),
  address_line_2: z.string().nullable().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zip_code: z.string().min(5, 'ZIP code is required'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  location_hash: z.string().nullable().optional(),
  geocoding_provider: z.string().nullable().optional(),
  geocoded_at: z.string().nullable().optional(),
}).strict()

export type UpsertPatientAddressInput = z.infer<typeof UpsertPatientAddressSchema>

// ─── Deactivate Address ───────────────────────────────────────────────────────

export const DeactivatePatientAddressSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  addressId: uuidShape,
}).strict()

export type DeactivatePatientAddressInput = z.infer<typeof DeactivatePatientAddressSchema>

// ─── Patient Contact ──────────────────────────────────────────────────────────

export const UpsertPatientContactSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  contactId: uuidShape.optional(),
  contact_type: contactTypeEnum,
  contact_name: z.string().min(1, 'Contact name is required'),
  relationship: contactRelationshipEnum.nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email address').nullable().optional(),
  authorized_contact: z.boolean().optional(),
}).strict()

export type UpsertPatientContactInput = z.infer<typeof UpsertPatientContactSchema>

export const DeactivatePatientContactSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  contactId: uuidShape,
}).strict()

export type DeactivatePatientContactInput = z.infer<typeof DeactivatePatientContactSchema>
