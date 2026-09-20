'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/server'
import { requirePermission } from '@/lib/permissions'
import {
  ArchiveCaregiverSchema,
  CreateCaregiverSchema,
  DeactivateAvailabilitySchema,
  DeactivateServiceEligibilitySchema,
  DeactivateSkillSchema,
  RevokeCredentialSchema,
  SetCompensationRateSchema,
  UpdateCaregiverSchema,
  UpsertAvailabilitySchema,
  UpsertCredentialSchema,
  UpsertServiceEligibilitySchema,
  UpsertSkillSchema,
  VerifyCredentialSchema,
} from '@/lib/schemas/caregivers.schema'
import type { CaregiverStatusFilter } from '@/lib/schemas/caregivers.schema'
import * as caregiversService from '@/lib/services/caregivers.service'
import type {
  ActionResponse,
  Caregiver,
  CaregiverAvailability,
  CaregiverClassification,
  CaregiverCompensationRate,
  CaregiverCredential,
  CaregiverEmploymentStatus,
  CaregiverListPage,
  CaregiverServiceEligibility,
  CaregiverServiceEligibilityWithService,
  CaregiverSkill,
} from '@/types'

// ─── List Caregivers ──────────────────────────────────────────────────────────

export async function listCaregiversAction(
  orgId: string,
  filters?: {
    classification?: CaregiverClassification
    employment_status?: CaregiverEmploymentStatus
    status?: CaregiverStatusFilter
    page?: number
    pageSize?: number
  },
): Promise<ActionResponse<CaregiverListPage>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'caregivers.manage')
    const data = await caregiversService.listCaregivers(orgId, filters)
    return { success: true, data }
  } catch (err) {
    console.error('[listCaregiversAction] failed:', { orgId, filters, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Get Caregiver ────────────────────────────────────────────────────────────

export async function getCaregiverAction(
  orgId: string,
  caregiverId: string,
): Promise<ActionResponse<Caregiver | null>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'caregivers.manage')
    const data = await caregiversService.getCaregiver(orgId, caregiverId)
    return { success: true, data }
  } catch (err) {
    console.error('[getCaregiverAction] failed:', { orgId, caregiverId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Create Caregiver ─────────────────────────────────────────────────────────

export async function createCaregiverAction(input: unknown): Promise<ActionResponse<Caregiver>> {
  try {
    const user = await requireAuth()
    const parsed = CreateCaregiverSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[createCaregiverAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    const data = await caregiversService.createCaregiver(parsed.data.organizationId, user.id, {
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      classification: parsed.data.classification,
      email: parsed.data.email,
      phone: parsed.data.phone,
      employee_external_id: parsed.data.employee_external_id,
      max_hours_per_week: parsed.data.max_hours_per_week,
      service_area_zip: parsed.data.service_area_zip,
      travel_radius_miles: parsed.data.travel_radius_miles,
    })
    revalidatePath('/caregivers')
    return { success: true, data }
  } catch (err) {
    console.error('[createCaregiverAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── Update Caregiver ─────────────────────────────────────────────────────────

export async function updateCaregiverAction(input: unknown): Promise<ActionResponse<Caregiver>> {
  try {
    const user = await requireAuth()
    const parsed = UpdateCaregiverSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[updateCaregiverAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    const data = await caregiversService.updateCaregiver(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      user.id,
      {
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        classification: parsed.data.classification,
        email: parsed.data.email,
        phone: parsed.data.phone,
        employee_external_id: parsed.data.employee_external_id,
        max_hours_per_week: parsed.data.max_hours_per_week,
        service_area_zip: parsed.data.service_area_zip,
        travel_radius_miles: parsed.data.travel_radius_miles,
        employment_status: parsed.data.employment_status,
        matching_status: parsed.data.matching_status,
      },
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[updateCaregiverAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── Archive Caregiver ────────────────────────────────────────────────────────

export async function archiveCaregiverAction(input: unknown): Promise<ActionResponse> {
  try {
    const user = await requireAuth()
    const parsed = ArchiveCaregiverSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[archiveCaregiverAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    await caregiversService.archiveCaregiver(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      user.id,
    )
    revalidatePath('/caregivers')
    return { success: true }
  } catch (err) {
    console.error('[archiveCaregiverAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── Credentials ──────────────────────────────────────────────────────────────

export async function listCredentialsAction(
  orgId: string,
  caregiverId: string,
  limit?: number,
): Promise<ActionResponse<CaregiverCredential[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'caregivers.manage')
    const data = await caregiversService.listCredentials(orgId, caregiverId, limit)
    return { success: true, data }
  } catch (err) {
    console.error('[listCredentialsAction] failed:', { orgId, caregiverId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

export async function getCredentialAction(
  orgId: string,
  caregiverId: string,
  credentialId: string,
): Promise<ActionResponse<CaregiverCredential | null>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'caregivers.manage')
    const data = await caregiversService.getCredential(orgId, caregiverId, credentialId)
    return { success: true, data }
  } catch (err) {
    console.error('[getCredentialAction] failed:', { orgId, caregiverId, credentialId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

export async function upsertCredentialAction(input: unknown): Promise<ActionResponse<CaregiverCredential>> {
  try {
    await requireAuth()
    const parsed = UpsertCredentialSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[upsertCredentialAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    const data = await caregiversService.upsertCredential(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      parsed.data.credentialId,
      {
        credential_type: parsed.data.credential_type,
        credential_name: parsed.data.credential_name,
        credential_number: parsed.data.credential_number,
        issued_date: parsed.data.issued_date,
        expiration_date: parsed.data.expiration_date,
        status: parsed.data.status,
      },
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[upsertCredentialAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function verifyCredentialAction(input: unknown): Promise<ActionResponse<CaregiverCredential>> {
  try {
    const user = await requireAuth()
    const parsed = VerifyCredentialSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[verifyCredentialAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    const data = await caregiversService.verifyCredential(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      parsed.data.credentialId,
      user.id,
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[verifyCredentialAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function revokeCredentialAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = RevokeCredentialSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[revokeCredentialAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    await caregiversService.revokeCredential(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      parsed.data.credentialId,
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true }
  } catch (err) {
    console.error('[revokeCredentialAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export async function listSkillsAction(
  orgId: string,
  caregiverId: string,
  limit?: number,
): Promise<ActionResponse<CaregiverSkill[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'caregivers.manage')
    const data = await caregiversService.listSkills(orgId, caregiverId, limit)
    return { success: true, data }
  } catch (err) {
    console.error('[listSkillsAction] failed:', { orgId, caregiverId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

export async function getSkillAction(
  orgId: string,
  caregiverId: string,
  skillId: string,
): Promise<ActionResponse<CaregiverSkill | null>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'caregivers.manage')
    const data = await caregiversService.getSkill(orgId, caregiverId, skillId)
    return { success: true, data }
  } catch (err) {
    console.error('[getSkillAction] failed:', { orgId, caregiverId, skillId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

export async function upsertSkillAction(input: unknown): Promise<ActionResponse<CaregiverSkill>> {
  try {
    await requireAuth()
    const parsed = UpsertSkillSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[upsertSkillAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    const data = await caregiversService.upsertSkill(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      parsed.data.skillId,
      {
        skill_code: parsed.data.skill_code,
        skill_name: parsed.data.skill_name,
        verified_at: parsed.data.verified_at,
        expires_at: parsed.data.expires_at,
      },
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[upsertSkillAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function deactivateSkillAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = DeactivateSkillSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[deactivateSkillAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    await caregiversService.deactivateSkill(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      parsed.data.skillId,
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true }
  } catch (err) {
    console.error('[deactivateSkillAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── Service eligibility ──────────────────────────────────────────────────────

export async function listServiceEligibilityAction(
  orgId: string,
  caregiverId: string,
  limit?: number,
): Promise<ActionResponse<CaregiverServiceEligibilityWithService[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'caregivers.manage')
    const data = await caregiversService.listServiceEligibility(orgId, caregiverId, limit)
    return { success: true, data }
  } catch (err) {
    console.error('[listServiceEligibilityAction] failed:', { orgId, caregiverId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

export async function upsertServiceEligibilityAction(
  input: unknown,
): Promise<ActionResponse<CaregiverServiceEligibility>> {
  try {
    const user = await requireAuth()
    const parsed = UpsertServiceEligibilitySchema.safeParse(input)
    if (!parsed.success) {
      console.error('[upsertServiceEligibilityAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    const data = await caregiversService.upsertServiceEligibility(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      user.id,
      {
        organization_service_id: parsed.data.organization_service_id,
        supervision_required: parsed.data.supervision_required,
      },
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[upsertServiceEligibilityAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function deactivateServiceEligibilityAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = DeactivateServiceEligibilitySchema.safeParse(input)
    if (!parsed.success) {
      console.error('[deactivateServiceEligibilityAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    await caregiversService.deactivateServiceEligibility(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      parsed.data.eligibilityId,
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true }
  } catch (err) {
    console.error('[deactivateServiceEligibilityAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── Availability ─────────────────────────────────────────────────────────────

export async function listAvailabilityAction(
  orgId: string,
  caregiverId: string,
  limit?: number,
): Promise<ActionResponse<CaregiverAvailability[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'caregivers.manage')
    const data = await caregiversService.listAvailability(orgId, caregiverId, limit)
    return { success: true, data }
  } catch (err) {
    console.error('[listAvailabilityAction] failed:', { orgId, caregiverId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

export async function upsertAvailabilityAction(input: unknown): Promise<ActionResponse<CaregiverAvailability>> {
  try {
    await requireAuth()
    const parsed = UpsertAvailabilitySchema.safeParse(input)
    if (!parsed.success) {
      console.error('[upsertAvailabilityAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    const data = await caregiversService.upsertAvailability(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      {
        day_of_week: parsed.data.day_of_week,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        availability_status: parsed.data.availability_status,
        effective_start_date: parsed.data.effective_start_date,
        effective_end_date: parsed.data.effective_end_date,
      },
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[upsertAvailabilityAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

export async function deactivateAvailabilityAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = DeactivateAvailabilitySchema.safeParse(input)
    if (!parsed.success) {
      console.error('[deactivateAvailabilityAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    await caregiversService.deactivateAvailability(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      parsed.data.availabilityId,
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true }
  } catch (err) {
    console.error('[deactivateAvailabilityAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}


// ─── Compensation (requires caregivers.read_compensation as well) ─────────────

export async function listCompensationRatesAction(
  orgId: string,
  caregiverId: string,
  limit?: number,
): Promise<ActionResponse<CaregiverCompensationRate[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'caregivers.manage')
    await requirePermission(orgId, 'caregivers.read_compensation')
    const data = await caregiversService.listCompensationRates(orgId, caregiverId, limit)
    return { success: true, data }
  } catch (err) {
    console.error('[listCompensationRatesAction] failed:', { orgId, caregiverId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

export async function setCompensationRateAction(
  input: unknown,
): Promise<ActionResponse<CaregiverCompensationRate>> {
  try {
    const user = await requireAuth()
    const parsed = SetCompensationRateSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[setCompensationRateAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    await requirePermission(parsed.data.organizationId, 'caregivers.read_compensation')
    const data = await caregiversService.setCompensationRate(
      parsed.data.organizationId,
      parsed.data.caregiverId,
      user.id,
      {
        pay_rate: parsed.data.pay_rate,
        rate_unit: parsed.data.rate_unit,
        effective_start_date: parsed.data.effective_start_date,
        organization_service_id: parsed.data.organization_service_id,
      },
    )
    revalidatePath(`/caregivers/${parsed.data.caregiverId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[setCompensationRateAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}
