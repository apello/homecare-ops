import { z } from 'zod'

const patientStatusEnum = z.enum(['Intake', 'Active', 'Suspended', 'Discharged', 'Archived'] as const)
const requirementTypeEnum = z.enum([
  'Skill',
  'Language',
  'Gender Preference',
  'Travel',
  'Pets',
  'Smoking',
  'Lifting',
  'Schedule',
  'Other',
] as const)
const matchingEffectEnum = z.enum(['Required', 'Preferred', 'Review Required', 'Exclude'] as const)
const visibilityLevelEnum = z.enum(['Operational', 'Clinical', 'Restricted'] as const)
const addressTypeEnum = z.enum(['Service', 'Mailing', 'Other'] as const)

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
  date_of_birth: dateShape.nullable().optional(),
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
  date_of_birth: dateShape.nullable().optional(),
  patient_external_id: z.string().nullable().optional(),
  status: patientStatusEnum.optional(),
}).strict().refine(
  (obj) => Object.keys(obj).length > 2, // At least organizationId, patientId, and one other field
  'At least one field must be updated',
)

export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>

// ─── Patient Requirement ──────────────────────────────────────────────────────

export const PatientRequirementSchema = z
  .object({
    organizationId: uuidShape,
    patientId: uuidShape,
    requirement_type: requirementTypeEnum,
    requirement_code: z.string().min(1, 'Requirement code is required'),
    matching_effect: matchingEffectEnum,
    required_skill_code: z.string().nullable().optional(),
    restricted_note_id: uuidShape.nullable().optional(),
    visibility_level: visibilityLevelEnum,
    effective_start_date: dateShape,
    effective_end_date: dateShape.nullable().optional(),
    structured_value: z.object({}).passthrough().optional(),
  })
  .strict()

export type PatientRequirementInput = z.infer<typeof PatientRequirementSchema>

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
