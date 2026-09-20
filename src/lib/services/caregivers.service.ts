import { createClient } from '@/lib/db/client'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/lib/pagination'
import { getCredentialHealth } from '@/lib/schemas/caregivers.schema'
import type { CaregiverStatusFilter } from '@/lib/schemas/caregivers.schema'
import type {
  AvailabilityStatus,
  Caregiver,
  CaregiverAvailability,
  CaregiverClassification,
  CaregiverCompensationRate,
  CaregiverCredential,
  CaregiverEmploymentStatus,
  CaregiverListItem,
  CaregiverListPage,
  CaregiverMatchingStatus,
  CaregiverServiceEligibility,
  CaregiverServiceEligibilityWithService,
  CaregiverSkill,
  CredentialStatus,
  CredentialType,
  RateUnit,
} from '@/types'

// List projections never include compensation, credential numbers, or notes.
const CAREGIVER_LIST_COLUMNS = `
  id,
  organization_id,
  first_name,
  last_name,
  classification,
  employment_status,
  matching_status,
  service_area_zip,
  created_at,
  archived_at,
  credentials:caregiver_credentials(
    id,
    credential_type,
    expiration_date,
    status
  )
`

const CREDENTIAL_LIST_COLUMNS = `
  id,
  organization_id,
  caregiver_id,
  credential_type,
  credential_name,
  issued_date,
  expiration_date,
  status,
  verified_by_user_id,
  verified_at,
  created_at,
  updated_at
`

const ELIGIBILITY_COLUMNS = `
  *,
  organization_service:organization_services(
    id,
    local_service_name,
    service_code_mapping:service_code_mappings(evv_service_name)
  )
`

type CaregiverInput = {
  first_name: string
  last_name: string
  classification: CaregiverClassification
  email?: string | null
  phone?: string | null
  employee_external_id?: string | null
  max_hours_per_week?: number | null
  service_area_zip?: string | null
  travel_radius_miles?: number | null
}

type CaregiverUpdateInput = Partial<CaregiverInput> & {
  employment_status?: CaregiverEmploymentStatus
  matching_status?: CaregiverMatchingStatus
}

type CredentialInput = {
  credential_type: CredentialType
  credential_name: string
  credential_number?: string | null
  issued_date?: string | null
  expiration_date?: string | null
  status: CredentialStatus
}

type SkillInput = {
  skill_code: string
  skill_name: string
  verified_at?: string | null
  expires_at?: string | null
}

type ServiceEligibilityInput = {
  organization_service_id: string
  supervision_required?: boolean
}

type AvailabilityInput = {
  day_of_week: number
  start_time: string
  end_time: string
  availability_status: AvailabilityStatus
  effective_start_date: string
  effective_end_date?: string | null
}


type CompensationRateInput = {
  pay_rate: number
  rate_unit: RateUnit
  effective_start_date: string
  organization_service_id?: string | null
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Caregivers ───────────────────────────────────────────────────────────────

export async function markExpiredCredentials(orgId: string): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('mark_expired_credentials', {
    target_org_id: orgId,
  })

  if (error) {
    console.error('[markExpiredCredentials] RPC failed:', { orgId, error })
    return 0
  }

  return (data as number | null) ?? 0
}

export async function listCaregivers(
  orgId: string,
  filters?: {
    classification?: CaregiverClassification
    employment_status?: CaregiverEmploymentStatus
    status?: CaregiverStatusFilter
    page?: number
    pageSize?: number
  },
): Promise<CaregiverListPage> {
  const supabase = await createClient()

  // Opportunistic and cheap: keeps the 'Expired' credential status from going stale.
  await markExpiredCredentials(orgId)

  const requestedPage = filters?.page ?? 0
  const requestedPageSize = filters?.pageSize ?? DEFAULT_PAGE_SIZE
  const page = Number.isInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE
  const rangeStart = page * pageSize
  const rangeEnd = rangeStart + pageSize - 1

  let query = supabase
    .from('caregivers')
    .select(CAREGIVER_LIST_COLUMNS, { count: 'exact' })
    .eq('organization_id', orgId)

  if (filters?.classification) query = query.eq('classification', filters.classification)
  if (filters?.employment_status) query = query.eq('employment_status', filters.employment_status)

  // 'Archived' is a list-filter status only — archived rows are excluded otherwise.
  if (filters?.status === 'Archived') {
    query = query.not('archived_at', 'is', null)
  } else {
    query = query.is('archived_at', null)
    if (filters?.status) query = query.eq('matching_status', filters.status)
  }

  const { data, error, count } = await query
    .order('last_name', { ascending: true })
    .range(rangeStart, rangeEnd)

  if (error) {
    console.error('[listCaregivers] query failed:', { orgId, filters, error })
    return { rows: [], rowCount: 0 }
  }

  return {
    rows: (data ?? []) as unknown as CaregiverListItem[],
    rowCount: count ?? 0,
  }
}

export async function listCaregiversWithCredentialIssues(
  orgId: string,
  limit = 25,
): Promise<CaregiverListItem[]> {
  const { rows } = await listCaregivers(orgId, { page: 0, pageSize: limit })
  return rows.filter((row) => getCredentialHealth(row.credentials) !== 'OK')
}

export async function getCaregiver(orgId: string, caregiverId: string): Promise<Caregiver | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('caregivers')
    .select('*')
    .eq('id', caregiverId)
    .eq('organization_id', orgId)
    .single()

  if (error) {
    console.error('[getCaregiver] lookup failed:', { orgId, caregiverId, error })
    return null
  }

  return data as Caregiver
}

export async function createCaregiver(
  orgId: string,
  userId: string,
  data: CaregiverInput,
): Promise<Caregiver> {
  const supabase = await createClient()

  const { data: row, error } = await supabase.rpc('create_caregiver', {
    target_org_id: orgId,
    first_name: data.first_name,
    last_name: data.last_name,
    classification: data.classification,
    email: data.email ?? null,
    phone: data.phone ?? null,
    employee_external_id: data.employee_external_id ?? null,
    max_hours_per_week: data.max_hours_per_week ?? null,
    service_area_zip: data.service_area_zip ?? null,
    travel_radius_miles: data.travel_radius_miles ?? null,
  })

  if (error) {
    console.error('[createCaregiver] RPC failed:', { orgId, userId, error })
    throw new Error(error.message)
  }

  return row as Caregiver
}

export async function updateCaregiver(
  orgId: string,
  caregiverId: string,
  userId: string,
  data: CaregiverUpdateInput,
): Promise<Caregiver> {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {
    updated_by_user_id: userId,
    updated_at: new Date().toISOString(),
  }

  if (data.first_name !== undefined) updateData.first_name = data.first_name
  if (data.last_name !== undefined) updateData.last_name = data.last_name
  if (data.classification !== undefined) updateData.classification = data.classification
  if (data.email !== undefined) updateData.email = data.email
  if (data.phone !== undefined) updateData.phone = data.phone
  if (data.employee_external_id !== undefined) updateData.employee_external_id = data.employee_external_id
  if (data.max_hours_per_week !== undefined) updateData.max_hours_per_week = data.max_hours_per_week
  if (data.service_area_zip !== undefined) updateData.service_area_zip = data.service_area_zip
  if (data.travel_radius_miles !== undefined) updateData.travel_radius_miles = data.travel_radius_miles
  if (data.employment_status !== undefined) updateData.employment_status = data.employment_status
  if (data.matching_status !== undefined) updateData.matching_status = data.matching_status

  const { data: row, error } = await supabase
    .from('caregivers')
    .update(updateData as never)
    .eq('id', caregiverId)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) {
    console.error('[updateCaregiver] update failed:', { orgId, caregiverId, error })
    throw new Error(error.message)
  }

  return row as Caregiver
}

export async function archiveCaregiver(
  orgId: string,
  caregiverId: string,
  userId: string,
): Promise<void> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('caregivers')
    .update({
      archived_at: now,
      employment_status: 'Inactive',
      matching_status: 'Inactive',
      updated_by_user_id: userId,
      updated_at: now,
    } as never)
    .eq('id', caregiverId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('[archiveCaregiver] update failed:', { orgId, caregiverId, error })
    throw new Error(error.message)
  }
}

// ─── Credentials ──────────────────────────────────────────────────────────────

export async function listCredentials(
  orgId: string,
  caregiverId: string,
  limit?: number,
): Promise<CaregiverCredential[]> {
  const supabase = await createClient()

  let query = supabase
    .from('caregiver_credentials')
    .select(CREDENTIAL_LIST_COLUMNS)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)
    .order('expiration_date', { ascending: true, nullsFirst: false })

  if (limit !== undefined) query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('[listCredentials] query failed:', { orgId, caregiverId, error })
    return []
  }

  return (data ?? []) as unknown as CaregiverCredential[]
}

export async function getCredential(
  orgId: string,
  caregiverId: string,
  credentialId: string,
): Promise<CaregiverCredential | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('caregiver_credentials')
    .select('*')
    .eq('id', credentialId)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)
    .single()

  if (error) {
    console.error('[getCredential] lookup failed:', { orgId, caregiverId, credentialId, error })
    return null
  }

  return data as CaregiverCredential
}

export async function upsertCredential(
  orgId: string,
  caregiverId: string,
  credentialId: string | undefined,
  data: CredentialInput,
): Promise<CaregiverCredential> {
  const supabase = await createClient()

  // TODO(encrypt-credential-number): stored verbatim for MVP.
  const payload = {
    credential_type: data.credential_type,
    credential_name: data.credential_name,
    encrypted_credential_number: data.credential_number ?? null,
    issued_date: data.issued_date ?? null,
    expiration_date: data.expiration_date ?? null,
    status: data.status,
  }

  if (credentialId) {
    const { data: updated, error } = await supabase
      .from('caregiver_credentials')
      .update({ ...payload, updated_at: new Date().toISOString() } as never)
      .eq('id', credentialId)
      .eq('organization_id', orgId)
      .eq('caregiver_id', caregiverId)
      .select()
      .single()

    if (error) {
      console.error('[upsertCredential] update failed:', { orgId, caregiverId, credentialId, error })
      throw new Error(error.message)
    }

    return updated as CaregiverCredential
  }

  const { data: inserted, error } = await supabase
    .from('caregiver_credentials')
    .insert({
      organization_id: orgId,
      caregiver_id: caregiverId,
      ...payload,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('[upsertCredential] insert failed:', { orgId, caregiverId, error })
    throw new Error(error.message)
  }

  return inserted as CaregiverCredential
}

export async function verifyCredential(
  orgId: string,
  caregiverId: string,
  credentialId: string,
  userId: string,
): Promise<CaregiverCredential> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('caregiver_credentials')
    .update({
      verified_by_user_id: userId,
      verified_at: now,
      updated_at: now,
    } as never)
    .eq('id', credentialId)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)
    .select()
    .single()

  if (error) {
    console.error('[verifyCredential] update failed:', { orgId, caregiverId, credentialId, error })
    throw new Error(error.message)
  }

  return data as CaregiverCredential
}

export async function revokeCredential(
  orgId: string,
  caregiverId: string,
  credentialId: string,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('caregiver_credentials')
    .update({ status: 'Revoked', updated_at: new Date().toISOString() } as never)
    .eq('id', credentialId)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)

  if (error) {
    console.error('[revokeCredential] update failed:', { orgId, caregiverId, credentialId, error })
    throw new Error(error.message)
  }
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export async function listSkills(
  orgId: string,
  caregiverId: string,
  limit?: number,
): Promise<CaregiverSkill[]> {
  const supabase = await createClient()

  let query = supabase
    .from('caregiver_skills')
    .select('*')
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)
    .eq('active', true)
    .order('skill_name', { ascending: true })

  if (limit !== undefined) query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('[listSkills] query failed:', { orgId, caregiverId, error })
    return []
  }

  return (data ?? []) as CaregiverSkill[]
}

export async function getSkill(
  orgId: string,
  caregiverId: string,
  skillId: string,
): Promise<CaregiverSkill | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('caregiver_skills')
    .select('*')
    .eq('id', skillId)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)
    .eq('active', true)
    .single()

  if (error) {
    console.error('[getSkill] lookup failed:', { orgId, caregiverId, skillId, error })
    return null
  }

  return data as CaregiverSkill
}

export async function upsertSkill(
  orgId: string,
  caregiverId: string,
  skillId: string | undefined,
  data: SkillInput,
): Promise<CaregiverSkill> {
  const supabase = await createClient()

  const payload = {
    skill_code: data.skill_code,
    skill_name: data.skill_name,
    verified_at: data.verified_at ?? null,
    expires_at: data.expires_at ?? null,
  }

  if (skillId) {
    const { data: updated, error } = await supabase
      .from('caregiver_skills')
      .update(payload as never)
      .eq('id', skillId)
      .eq('organization_id', orgId)
      .eq('caregiver_id', caregiverId)
      .select()
      .single()

    if (error) {
      console.error('[upsertSkill] update failed:', { orgId, caregiverId, skillId, error })
      throw new Error(error.message)
    }

    return updated as CaregiverSkill
  }

  // One active row per skill code — deactivate the prior row instead of duplicating it.
  const { error: deactivateError } = await supabase
    .from('caregiver_skills')
    .update({ active: false } as never)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)
    .eq('skill_code', data.skill_code)
    .eq('active', true)

  if (deactivateError) {
    console.error('[upsertSkill] deactivate failed:', { orgId, caregiverId, error: deactivateError })
    throw new Error(deactivateError.message)
  }

  const { data: inserted, error } = await supabase
    .from('caregiver_skills')
    .insert({
      organization_id: orgId,
      caregiver_id: caregiverId,
      ...payload,
      active: true,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('[upsertSkill] insert failed:', { orgId, caregiverId, error })
    throw new Error(error.message)
  }

  return inserted as CaregiverSkill
}

export async function deactivateSkill(
  orgId: string,
  caregiverId: string,
  skillId: string,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('caregiver_skills')
    .update({ active: false } as never)
    .eq('id', skillId)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)

  if (error) {
    console.error('[deactivateSkill] update failed:', { orgId, caregiverId, skillId, error })
    throw new Error(error.message)
  }
}

// ─── Service eligibility ──────────────────────────────────────────────────────

export async function listServiceEligibility(
  orgId: string,
  caregiverId: string,
  limit?: number,
): Promise<CaregiverServiceEligibilityWithService[]> {
  const supabase = await createClient()

  let query = supabase
    .from('caregiver_service_eligibility')
    .select(ELIGIBILITY_COLUMNS)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)
    .eq('active', true)
    .order('approved_at', { ascending: false })

  if (limit !== undefined) query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('[listServiceEligibility] query failed:', { orgId, caregiverId, error })
    return []
  }

  return (data ?? []) as unknown as CaregiverServiceEligibilityWithService[]
}

export async function upsertServiceEligibility(
  orgId: string,
  caregiverId: string,
  userId: string,
  data: ServiceEligibilityInput,
): Promise<CaregiverServiceEligibility> {
  const supabase = await createClient()

  const { error: deactivateError } = await supabase
    .from('caregiver_service_eligibility')
    .update({ active: false } as never)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)
    .eq('organization_service_id', data.organization_service_id)
    .eq('active', true)

  if (deactivateError) {
    console.error('[upsertServiceEligibility] deactivate failed:', { orgId, caregiverId, error: deactivateError })
    throw new Error(deactivateError.message)
  }

  const { data: inserted, error } = await supabase
    .from('caregiver_service_eligibility')
    .insert({
      organization_id: orgId,
      caregiver_id: caregiverId,
      organization_service_id: data.organization_service_id,
      supervision_required: data.supervision_required ?? false,
      approved_by_user_id: userId,
      approved_at: new Date().toISOString(),
      active: true,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('[upsertServiceEligibility] insert failed:', { orgId, caregiverId, error })
    throw new Error(error.message)
  }

  return inserted as CaregiverServiceEligibility
}

export async function deactivateServiceEligibility(
  orgId: string,
  caregiverId: string,
  eligibilityId: string,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('caregiver_service_eligibility')
    .update({ active: false } as never)
    .eq('id', eligibilityId)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)

  if (error) {
    console.error('[deactivateServiceEligibility] update failed:', { orgId, caregiverId, eligibilityId, error })
    throw new Error(error.message)
  }
}

// ─── Availability ─────────────────────────────────────────────────────────────

export async function listAvailability(
  orgId: string,
  caregiverId: string,
  limit?: number,
): Promise<CaregiverAvailability[]> {
  const supabase = await createClient()

  let query = supabase
    .from('caregiver_availability')
    .select('*')
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (limit !== undefined) query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('[listAvailability] query failed:', { orgId, caregiverId, error })
    return []
  }

  return (data ?? []) as CaregiverAvailability[]
}

export async function upsertAvailability(
  orgId: string,
  caregiverId: string,
  data: AvailabilityInput,
): Promise<CaregiverAvailability> {
  const supabase = await createClient()

  const { data: row, error } = await supabase.rpc('upsert_caregiver_availability', {
    target_org_id: orgId,
    target_caregiver_id: caregiverId,
    day_of_week: data.day_of_week,
    start_time: data.start_time,
    end_time: data.end_time,
    availability_status: data.availability_status,
    effective_start_date: data.effective_start_date,
    effective_end_date: data.effective_end_date ?? null,
  })

  if (error) {
    console.error('[upsertAvailability] RPC failed:', { orgId, caregiverId, error })
    throw new Error(error.message)
  }

  return row as CaregiverAvailability
}

export async function deactivateAvailability(
  orgId: string,
  caregiverId: string,
  availabilityId: string,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('caregiver_availability')
    .update({ effective_end_date: today(), updated_at: new Date().toISOString() } as never)
    .eq('id', availabilityId)
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)

  if (error) {
    console.error('[deactivateAvailability] update failed:', { orgId, caregiverId, availabilityId, error })
    throw new Error(error.message)
  }
}


// ─── Compensation (gated by caregivers.read_compensation in the actions) ──────

export async function listCompensationRates(
  orgId: string,
  caregiverId: string,
  limit?: number,
): Promise<CaregiverCompensationRate[]> {
  const supabase = await createClient()

  let query = supabase
    .from('caregiver_compensation_rates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('caregiver_id', caregiverId)
    .order('effective_start_date', { ascending: false })

  if (limit !== undefined) query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('[listCompensationRates] query failed:', { orgId, caregiverId, error })
    return []
  }

  return (data ?? []) as CaregiverCompensationRate[]
}

export async function setCompensationRate(
  orgId: string,
  caregiverId: string,
  userId: string,
  data: CompensationRateInput,
): Promise<CaregiverCompensationRate> {
  const supabase = await createClient()

  const { data: row, error } = await supabase.rpc('set_caregiver_compensation_rate', {
    target_org_id: orgId,
    target_caregiver_id: caregiverId,
    pay_rate: data.pay_rate,
    rate_unit: data.rate_unit,
    effective_start_date: data.effective_start_date,
    organization_service_id: data.organization_service_id ?? null,
  })

  if (error) {
    console.error('[setCompensationRate] RPC failed:', { orgId, caregiverId, userId, error })
    throw new Error(error.message)
  }

  return row as CaregiverCompensationRate
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

// Defined in the schema module so client components can import it without
// pulling the Supabase server client into the browser bundle.
export { getCredentialHealth } from '@/lib/schemas/caregivers.schema'
