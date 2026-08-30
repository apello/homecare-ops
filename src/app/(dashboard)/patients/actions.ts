'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/server'
import { requirePermission } from '@/lib/permissions'
import {
  CreatePatientSchema,
  UpdatePatientSchema,
  PatientRequirementSchema,
  ArchivePatientSchema,
  UpsertPatientAddressSchema,
} from '@/lib/schemas/patients.schema'
import * as patientsService from '@/lib/services/patients.service'
import type {
  ActionResponse,
  Patient,
  PatientRequirement,
  PatientAddress,
} from '@/types'

// ─── List Patients ────────────────────────────────────────────────────────────

export async function listPatientsAction(
  orgId: string,
  filters?: { status?: string },
): Promise<ActionResponse<Patient[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'patients.read_basic')
    const data = await patientsService.listPatients(orgId, filters)
    return { success: true, data }
  } catch (err) {
    console.error('[listPatientsAction] failed:', { orgId, filters, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Get Patient ──────────────────────────────────────────────────────────────

export async function getPatientAction(
  orgId: string,
  patientId: string,
): Promise<ActionResponse<Patient | null>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'patients.read_basic')
    const data = await patientsService.getPatient(orgId, patientId)
    return { success: true, data }
  } catch (err) {
    console.error('[getPatientAction] failed:', { orgId, patientId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Create Patient ───────────────────────────────────────────────────────────

export async function createPatientAction(input: unknown): Promise<ActionResponse<Patient>> {
  try {
    await requireAuth()
    const parsed = CreatePatientSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[createPatientAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    const data = await patientsService.createPatient(
      parsed.data.organizationId,
      parsed.data.organizationId, // userId - would come from session in real app
      {
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        middle_name: parsed.data.middle_name,
        date_of_birth: parsed.data.date_of_birth,
        patient_external_id: parsed.data.patient_external_id,
        status: parsed.data.status,
        address: parsed.data.address,
      },
    )
    revalidatePath('/patients')
    return { success: true, data }
  } catch (err) {
    console.error('[createPatientAction] failed:', { error: err })
    const message = err instanceof Error ? err.message : undefined
    return { success: false, error: message ?? 'Unable to complete this action.' }
  }
}

// ─── Update Patient ───────────────────────────────────────────────────────────

export async function updatePatientAction(input: unknown): Promise<ActionResponse<Patient>> {
  try {
    await requireAuth()
    const parsed = UpdatePatientSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[updatePatientAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    const data = await patientsService.updatePatient(
      parsed.data.organizationId,
      parsed.data.patientId,
      parsed.data.organizationId, // userId
      {
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        middle_name: parsed.data.middle_name,
        date_of_birth: parsed.data.date_of_birth,
        patient_external_id: parsed.data.patient_external_id,
        status: parsed.data.status,
      },
    )
    revalidatePath(`/patients/${parsed.data.patientId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[updatePatientAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── Archive Patient ──────────────────────────────────────────────────────────

export async function archivePatientAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = ArchivePatientSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[archivePatientAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    await patientsService.archivePatient(
      parsed.data.organizationId,
      parsed.data.patientId,
      parsed.data.organizationId, // userId
    )
    revalidatePath('/patients')
    return { success: true }
  } catch (err) {
    console.error('[archivePatientAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── List Patient Addresses ───────────────────────────────────────────────────

export async function listPatientAddressesAction(
  orgId: string,
  patientId: string,
): Promise<ActionResponse<PatientAddress[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'patients.read_basic')
    const data = await patientsService.listPatientAddresses(orgId, patientId)
    return { success: true, data }
  } catch (err) {
    console.error('[listPatientAddressesAction] failed:', { orgId, patientId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Upsert Patient Address ───────────────────────────────────────────────────

export async function upsertPatientAddressAction(input: unknown): Promise<ActionResponse<PatientAddress>> {
  try {
    await requireAuth()
    const parsed = UpsertPatientAddressSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[upsertPatientAddressAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    const data = await patientsService.upsertPatientAddress(
      parsed.data.organizationId,
      parsed.data.patientId,
      parsed.data.address_type,
      {
        address_type: parsed.data.address_type,
        address_line_1: parsed.data.address_line_1,
        address_line_2: parsed.data.address_line_2,
        city: parsed.data.city,
        state: parsed.data.state,
        zip_code: parsed.data.zip_code,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        location_hash: parsed.data.location_hash,
        geocoding_provider: parsed.data.geocoding_provider,
        geocoded_at: parsed.data.geocoded_at,
      },
    )
    revalidatePath(`/patients/${parsed.data.patientId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[upsertPatientAddressAction] failed:', { error: err })
    const message = err instanceof Error ? err.message : undefined
    return { success: false, error: message ?? 'Unable to complete this action.' }
  }
}

// ─── List Patient Requirements ────────────────────────────────────────────────

export async function listPatientRequirementsAction(
  orgId: string,
  patientId: string,
  visibilityLevel?: 'Operational' | 'Clinical' | 'Restricted',
): Promise<ActionResponse<PatientRequirement[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'patients.read_basic')
    const data = await patientsService.listPatientRequirements(orgId, patientId, visibilityLevel)
    return { success: true, data }
  } catch (err) {
    console.error('[listPatientRequirementsAction] failed:', { orgId, patientId, visibilityLevel, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Upsert Patient Requirement ───────────────────────────────────────────────

export async function upsertPatientRequirementAction(input: unknown): Promise<ActionResponse<PatientRequirement>> {
  try {
    await requireAuth()
    const parsed = PatientRequirementSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[upsertPatientRequirementAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    const data = await patientsService.upsertPatientRequirement(
      parsed.data.organizationId,
      parsed.data.patientId,
      parsed.data.organizationId, // userId
      {
        requirement_type: parsed.data.requirement_type,
        requirement_code: parsed.data.requirement_code,
        matching_effect: parsed.data.matching_effect,
        required_skill_code: parsed.data.required_skill_code,
        structured_value: parsed.data.structured_value,
        restricted_note_id: parsed.data.restricted_note_id,
        visibility_level: parsed.data.visibility_level,
        effective_start_date: parsed.data.effective_start_date,
        effective_end_date: parsed.data.effective_end_date,
      },
    )
    revalidatePath(`/patients/${parsed.data.patientId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[upsertPatientRequirementAction] failed:', { error: err })
    const message = err instanceof Error ? err.message : undefined
    return { success: false, error: message ?? 'Unable to complete this action.' }
  }
}

// ─── Deactivate Patient Requirement ────────────────────────────────────────────

export async function deactivatePatientRequirementAction(input: {
  organizationId: string
  patientId: string
  requirementId: string
}): Promise<ActionResponse> {
  try {
    await requireAuth()
    await requirePermission(input.organizationId, 'patients.manage')
    await patientsService.deactivatePatientRequirement(
      input.organizationId,
      input.patientId,
      input.requirementId,
    )
    revalidatePath(`/patients/${input.patientId}`)
    return { success: true }
  } catch (err) {
    console.error('[deactivatePatientRequirementAction] failed:', { input, error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}
