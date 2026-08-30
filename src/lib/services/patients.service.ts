import { createClient } from '@/lib/db/client'
import type {
  Patient,
  PatientAddress,
  PatientRequirement,
  VisibilityLevel,
} from '@/types'

type PatientWithDates = Patient

type PatientAddressInput = {
  address_type: 'Service' | 'Mailing' | 'Other'
  address_line_1: string
  address_line_2?: string | null
  city: string
  state: string
  zip_code: string
  latitude?: number | null
  longitude?: number | null
  location_hash?: string | null
  geocoding_provider?: string | null
  geocoded_at?: string | null
}

type PatientRequirementInput = {
  requirement_type: string
  requirement_code: string
  matching_effect: 'Required' | 'Preferred' | 'Review Required' | 'Exclude'
  required_skill_code?: string | null
  structured_value?: Record<string, unknown> | null
  restricted_note_id?: string | null
  visibility_level: VisibilityLevel
  effective_start_date: string
  effective_end_date?: string | null
}

export async function listPatients(
  orgId: string,
  filters?: { status?: string },
): Promise<PatientWithDates[]> {
  const supabase = await createClient()

  let query = supabase
    .from('patients')
    .select(`
      *,
      created_by:user_profiles!patients_created_by_user_id_fkey(
        id,
        first_name,
        last_name
      )
    `)
    .eq('organization_id', orgId)

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('[listPatients] query failed:', { orgId, filters, error })
    return []
  }

  return (data ?? []) as PatientWithDates[]
}

export async function getPatient(orgId: string, patientId: string): Promise<PatientWithDates | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .eq('organization_id', orgId)
    .single()

  if (error) {
    console.error('[getPatient] lookup failed:', { orgId, patientId, error })
    return null
  }

  return data as PatientWithDates
}

export async function createPatient(
  orgId: string,
  userId: string,
  data: {
    first_name: string
    last_name: string
    middle_name?: string | null
    date_of_birth?: string | null
    patient_external_id?: string | null
    status?: string
    address?: PatientAddressInput
  },
): Promise<PatientWithDates> {
  const supabase = await createClient()

  // Use RPC function for transactional create with optional address
  const result = await supabase.rpc('create_patient_with_address', {
    target_org_id: orgId,
    first_name: data.first_name,
    last_name: data.last_name,
    middle_name: data.middle_name ?? null,
    date_of_birth: data.date_of_birth ? new Date(data.date_of_birth).toISOString().split('T')[0] : null,
    patient_external_id: data.patient_external_id ?? null,
    status: data.status ?? 'Intake',
    address_line_1: data.address?.address_line_1 ?? null,
    address_line_2: data.address?.address_line_2 ?? null,
    city: data.address?.city ?? null,
    state: data.address?.state ?? null,
    zip_code: data.address?.zip_code ?? null,
    latitude: data.address?.latitude ?? null,
    longitude: data.address?.longitude ?? null,
  } as never)

  const { data: patientData, error: patientError } = result

  if (patientError) {
    console.error('[createPatient] RPC failed:', { orgId, userId, error: patientError })
    throw new Error(patientError.message)
  }

  return (patientData as unknown) as PatientWithDates
}

export async function updatePatient(
  orgId: string,
  patientId: string,
  userId: string,
  data: {
    first_name?: string
    last_name?: string
    middle_name?: string | null
    date_of_birth?: string | null
    patient_external_id?: string | null
    status?: string
  },
): Promise<PatientWithDates> {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {
    updated_by_user_id: userId,
    updated_at: new Date().toISOString(),
  }

  if (data.first_name !== undefined) updateData.first_name = data.first_name
  if (data.last_name !== undefined) updateData.last_name = data.last_name
  if (data.middle_name !== undefined) updateData.middle_name = data.middle_name
  if (data.date_of_birth !== undefined) updateData.date_of_birth = data.date_of_birth
  if (data.patient_external_id !== undefined) updateData.patient_external_id = data.patient_external_id
  if (data.status !== undefined) updateData.status = data.status

  const { data: patientData, error } = await supabase
    .from('patients')
    .update(updateData as never)
    .eq('id', patientId)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) {
    console.error('[updatePatient] update failed:', { orgId, patientId, error })
    throw new Error(error.message)
  }

  return patientData as PatientWithDates
}

export async function archivePatient(
  orgId: string,
  patientId: string,
  userId: string,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('patients')
    .update({
      status: 'Archived',
      archived_at: new Date().toISOString(),
      updated_by_user_id: userId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', patientId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('[archivePatient] update failed:', { orgId, patientId, error })
    throw new Error(error.message)
  }
}

export async function listPatientAddresses(
  orgId: string,
  patientId: string,
): Promise<PatientAddress[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patient_addresses')
    .select('*')
    .eq('organization_id', orgId)
    .eq('patient_id', patientId)
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[listPatientAddresses] query failed:', { orgId, patientId, error })
    return []
  }

  return (data ?? []) as PatientAddress[]
}

export async function upsertPatientAddress(
  orgId: string,
  patientId: string,
  addressType: 'Service' | 'Mailing' | 'Other',
  data: PatientAddressInput,
): Promise<PatientAddress> {
  const supabase = await createClient()

  // First, deactivate existing address of this type
  await supabase
    .from('patient_addresses')
    .update({ active: false } as never)
    .eq('organization_id', orgId)
    .eq('patient_id', patientId)
    .eq('address_type', addressType)
    .eq('active', true)

  // Then insert new address
  const { data: addressData, error } = await supabase
    .from('patient_addresses')
    .insert({
      organization_id: orgId,
      patient_id: patientId,
      address_type: data.address_type,
      address_line_1: data.address_line_1,
      address_line_2: data.address_line_2 ?? null,
      city: data.city,
      state: data.state,
      zip_code: data.zip_code,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      location_hash: data.location_hash ?? null,
      geocoding_provider: data.geocoding_provider ?? null,
      geocoded_at: data.geocoded_at ?? null,
      active: true,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('[upsertPatientAddress] insert failed:', { orgId, patientId, error })
    throw new Error(error.message)
  }

  return addressData as PatientAddress
}

export async function listPatientRequirements(
  orgId: string,
  patientId: string,
  visibilityLevel?: VisibilityLevel,
): Promise<PatientRequirement[]> {
  const supabase = await createClient()

  if (visibilityLevel) {
    // Use RPC for visibility-filtered query
    const result = await supabase.rpc('list_patient_requirements_by_visibility', {
      target_org_id: orgId,
      target_patient_id: patientId,
      target_visibility: visibilityLevel,
    } as never)

    const { data, error } = result

    if (error) {
      console.error('[listPatientRequirements] RPC failed:', { orgId, patientId, visibilityLevel, error })
      return []
    }

    return ((data ?? []) as unknown) as PatientRequirement[]
  }

  // For no visibility filter, return all active requirements
  const { data, error } = await supabase
    .from('patient_requirements')
    .select('*')
    .eq('organization_id', orgId)
    .eq('patient_id', patientId)
    .eq('active', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[listPatientRequirements] query failed:', { orgId, patientId, error })
    return []
  }

  return (data ?? []) as PatientRequirement[]
}

export async function upsertPatientRequirement(
  orgId: string,
  patientId: string,
  userId: string,
  data: PatientRequirementInput,
): Promise<PatientRequirement> {
  const supabase = await createClient()

  // Use RPC function for transactional upsert
  const result = await supabase.rpc('upsert_patient_requirement', {
    target_org_id: orgId,
    target_patient_id: patientId,
    req_type: data.requirement_type,
    req_code: data.requirement_code,
    matching_effect: data.matching_effect,
    required_skill_code: data.required_skill_code ?? null,
    structured_value: data.structured_value ?? null,
    restricted_note_id: data.restricted_note_id ?? null,
    visibility_level: data.visibility_level,
    effective_start_date: data.effective_start_date,
    effective_end_date: data.effective_end_date ?? null,
  } as never)

  const { data: resultData, error } = result

  if (error) {
    console.error('[upsertPatientRequirement] RPC failed:', { orgId, patientId, error })
    throw new Error(error.message)
  }

  return (resultData as unknown) as PatientRequirement
}

export async function deactivatePatientRequirement(
  orgId: string,
  patientId: string,
  requirementId: string,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('patient_requirements')
    .update({ active: false } as never)
    .eq('id', requirementId)
    .eq('organization_id', orgId)
    .eq('patient_id', patientId)

  if (error) {
    console.error('[deactivatePatientRequirement] update failed:', { orgId, patientId, requirementId, error })
    throw new Error(error.message)
  }
}
