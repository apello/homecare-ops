import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/db/client'
import {
  archivePatient,
  createPatient,
  deactivatePatientAddress,
  deactivatePatientContact,
  deactivatePatientRequirement,
  getPatient,
  getPatientAddress,
  getPatientContact,
  getPatientRequirement,
  listPatientAddresses,
  listPatientContacts,
  listPatientRequirements,
  listPatients,
  updatePatient,
  upsertPatientAddress,
  upsertPatientContact,
  upsertPatientRequirement,
} from '@/lib/services/patients.service'

const mockClient = createClient as ReturnType<typeof vi.fn>

function makeSupabase(overrides: Record<string, unknown> = {}) {
  const base = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn(),
    range: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    rpc: vi.fn(),
    count: null as number | null,
    error: null as { message: string } | null,
    ...overrides,
  }
  mockClient.mockResolvedValue(base)
  return base
}

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const PATIENT_ID = '00000000-0000-0000-0000-000000000002'
const CHILD_ID = '00000000-0000-0000-0000-000000000003'
const USER_ID = '00000000-0000-0000-0000-000000000004'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listPatients', () => {
  it('filters by organization and excludes archived patients by default', async () => {
    const rows = [{ id: PATIENT_ID }]
    const supabase = makeSupabase()
    supabase.order.mockReturnValue(supabase)
    supabase.range.mockResolvedValue({ data: rows, error: null, count: 1 })

    await expect(listPatients(ORG_ID)).resolves.toEqual({ rows, rowCount: 1 })
    expect(supabase.from).toHaveBeenCalledWith('patients')
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.is).toHaveBeenCalledWith('archived_at', null)
    expect(supabase.range).toHaveBeenCalledWith(0, 9)
  })

  it('applies status and pagination filters and includes archived rows only for Archived', async () => {
    const supabase = makeSupabase()
    supabase.order.mockReturnValue(supabase)
    supabase.range.mockResolvedValue({ data: [], error: null, count: 0 })

    await listPatients(ORG_ID, { status: 'Archived', page: 2, pageSize: 25 })
    expect(supabase.eq).toHaveBeenCalledWith('status', 'Archived')
    expect(supabase.is).not.toHaveBeenCalled()
    expect(supabase.range).toHaveBeenCalledWith(50, 74)
  })

  it('returns an empty page on read error', async () => {
    const supabase = makeSupabase()
    supabase.order.mockReturnValue(supabase)
    supabase.range.mockResolvedValue({ data: null, error: { message: 'read failed' }, count: null })

    await expect(listPatients(ORG_ID)).resolves.toEqual({ rows: [], rowCount: 0 })
  })
})

describe('getPatient', () => {
  it('filters by patient and organization', async () => {
    const row = { id: PATIENT_ID }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: row, error: null })

    await expect(getPatient(ORG_ID, PATIENT_ID)).resolves.toEqual(row)
    expect(supabase.from).toHaveBeenCalledWith('patients')
    expect(supabase.select).toHaveBeenCalledWith(expect.stringContaining('created_by:user_profiles'))
    expect(supabase.eq).toHaveBeenCalledWith('id', PATIENT_ID)
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
  })

  it('returns null on read error', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await expect(getPatient(ORG_ID, PATIENT_ID)).resolves.toBeNull()
  })
})

describe('createPatient', () => {
  it('calls the transactional RPC with the unchanged date and optional address', async () => {
    const row = { id: PATIENT_ID }
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: row, error: null })

    await expect(createPatient(ORG_ID, USER_ID, {
      first_name: 'Test',
      last_name: 'Patient',
      date_of_birth: '1990-01-15',
      address: {
        address_type: 'Service',
        address_line_1: '100 Test Way',
        city: 'Testville',
        state: 'PA',
        zip_code: '19000',
      },
    })).resolves.toEqual(row)

    expect(supabase.rpc).toHaveBeenCalledWith('create_patient_with_address', expect.objectContaining({
      target_org_id: ORG_ID,
      date_of_birth: '1990-01-15',
      status: 'Intake',
      address_line_1: '100 Test Way',
    }))
  })

  it('passes null address fields when no initial address is created', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: { id: PATIENT_ID }, error: null })

    await createPatient(ORG_ID, USER_ID, {
      first_name: 'Test',
      last_name: 'Patient',
      date_of_birth: '1990-01-15',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('create_patient_with_address', expect.objectContaining({
      address_line_1: null,
      city: null,
      state: null,
      zip_code: null,
    }))
  })

  it('throws the RPC error', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'create failed' } })

    await expect(createPatient(ORG_ID, USER_ID, {
      first_name: 'Test',
      last_name: 'Patient',
      date_of_birth: '1990-01-15',
    })).rejects.toThrow('create failed')
  })
})

describe('updatePatient and archivePatient', () => {
  it('updates only the selected patient in the organization', async () => {
    const row = { id: PATIENT_ID, first_name: 'Updated' }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: row, error: null })

    await expect(updatePatient(ORG_ID, PATIENT_ID, USER_ID, {
      first_name: 'Updated',
      date_of_birth: '1990-01-15',
    })).resolves.toEqual(row)

    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({
      first_name: 'Updated',
      date_of_birth: '1990-01-15',
      updated_by_user_id: USER_ID,
    }))
    expect(supabase.eq).toHaveBeenCalledWith('id', PATIENT_ID)
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
  })

  it('throws an update error', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { message: 'update failed' } })

    await expect(updatePatient(ORG_ID, PATIENT_ID, USER_ID, {
      date_of_birth: '1990-01-15',
    })).rejects.toThrow('update failed')
  })

  it('soft-archives one selected patient', async () => {
    const supabase = makeSupabase()

    await expect(archivePatient(ORG_ID, PATIENT_ID, USER_ID)).resolves.toBeUndefined()
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'Archived',
      archived_at: expect.any(String),
      updated_by_user_id: USER_ID,
    }))
    expect(supabase.eq).toHaveBeenCalledWith('id', PATIENT_ID)
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
  })

  it('throws an archive error', async () => {
    const supabase = makeSupabase({ error: { message: 'archive failed' } })
    await expect(archivePatient(ORG_ID, PATIENT_ID, USER_ID)).rejects.toThrow('archive failed')
    expect(supabase.from).toHaveBeenCalledWith('patients')
  })
})

describe('patient addresses', () => {
  it('lists only active addresses for the patient and organization', async () => {
    const rows = [{ id: CHILD_ID }]
    const supabase = makeSupabase()
    supabase.order.mockResolvedValue({ data: rows, error: null })

    await expect(listPatientAddresses(ORG_ID, PATIENT_ID)).resolves.toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('patient_addresses')
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID)
    expect(supabase.eq).toHaveBeenCalledWith('active', true)
  })

  it('returns an empty array on address read error', async () => {
    const supabase = makeSupabase()
    supabase.order.mockResolvedValue({ data: null, error: { message: 'read failed' } })
    await expect(listPatientAddresses(ORG_ID, PATIENT_ID)).resolves.toEqual([])
  })

  it('limits address previews to the requested sentinel size', async () => {
    const rows = [{ id: CHILD_ID }]
    const supabase = makeSupabase()
    supabase.order.mockReturnValue(supabase)
    supabase.limit.mockResolvedValue({ data: rows, error: null })

    await expect(listPatientAddresses(ORG_ID, PATIENT_ID, 4)).resolves.toEqual(rows)
    expect(supabase.limit).toHaveBeenCalledWith(4)
  })

  it('gets one active address by org, patient, and address id', async () => {
    const row = { id: CHILD_ID }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: row, error: null })

    await expect(getPatientAddress(ORG_ID, PATIENT_ID, CHILD_ID)).resolves.toEqual(row)
    expect(supabase.eq).toHaveBeenCalledWith('id', CHILD_ID)
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID)
    expect(supabase.eq).toHaveBeenCalledWith('active', true)
  })

  it('returns null when one address cannot be loaded', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    await expect(getPatientAddress(ORG_ID, PATIENT_ID, CHILD_ID)).resolves.toBeNull()
  })

  it.each(['Service', 'Mailing', 'Other'] as const)(
    'keeps at most one active %s address by deactivating that type before one insert',
    async (addressType) => {
      const row = { id: CHILD_ID, address_type: addressType }
      const supabase = makeSupabase()
      supabase.single.mockResolvedValue({ data: row, error: null })

      await expect(upsertPatientAddress(ORG_ID, PATIENT_ID, addressType, {
        address_type: addressType,
        address_line_1: '100 Test Way',
        city: 'Testville',
        state: 'PA',
        zip_code: '19000',
      })).resolves.toEqual(row)

      expect(supabase.update).toHaveBeenCalledTimes(1)
      expect(supabase.update).toHaveBeenCalledWith({ active: false })
      expect(supabase.eq).toHaveBeenCalledWith('address_type', addressType)
      expect(supabase.insert).toHaveBeenCalledTimes(1)
      expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        organization_id: ORG_ID,
        patient_id: PATIENT_ID,
        address_type: addressType,
        active: true,
      }))
    },
  )

  it('does not create an address when replacement deactivation fails', async () => {
    const supabase = makeSupabase({ error: { message: 'deactivate failed' } })

    await expect(upsertPatientAddress(ORG_ID, PATIENT_ID, 'Service', {
      address_type: 'Service',
      address_line_1: '100 Test Way',
      city: 'Testville',
      state: 'PA',
      zip_code: '19000',
    })).rejects.toThrow('deactivate failed')
    expect(supabase.insert).not.toHaveBeenCalled()
  })

  it('throws an address insert error', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { message: 'insert failed' } })

    await expect(upsertPatientAddress(ORG_ID, PATIENT_ID, 'Service', {
      address_type: 'Service',
      address_line_1: '100 Test Way',
      city: 'Testville',
      state: 'PA',
      zip_code: '19000',
    })).rejects.toThrow('insert failed')
  })

  it('soft-deletes exactly one selected address', async () => {
    const supabase = makeSupabase()

    await expect(deactivatePatientAddress(ORG_ID, PATIENT_ID, CHILD_ID)).resolves.toBeUndefined()
    expect(supabase.update).toHaveBeenCalledWith({
      active: false,
      archived_at: expect.any(String),
    })
    expect(supabase.eq).toHaveBeenCalledWith('id', CHILD_ID)
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID)
  })

  it('throws an address delete error', async () => {
    makeSupabase({ error: { message: 'delete failed' } })
    await expect(deactivatePatientAddress(ORG_ID, PATIENT_ID, CHILD_ID)).rejects.toThrow('delete failed')
  })
})

describe('patient requirements', () => {
  const input = {
    requirement_type: 'Language' as const,
    requirement_code: 'LANGUAGE:Spanish',
    matching_effect: 'Preferred' as const,
    structured_value: { language: 'Spanish' },
    visibility_level: 'Operational' as const,
  }

  it('lists all active requirements with organization and patient filters', async () => {
    const rows = [{ id: CHILD_ID }]
    const supabase = makeSupabase()
    supabase.order.mockResolvedValue({ data: rows, error: null })

    await expect(listPatientRequirements(ORG_ID, PATIENT_ID)).resolves.toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('patient_requirements')
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID)
    expect(supabase.eq).toHaveBeenCalledWith('active', true)
  })

  it('returns an empty array on requirement read error', async () => {
    const supabase = makeSupabase()
    supabase.order.mockResolvedValue({ data: null, error: { message: 'read failed' } })
    await expect(listPatientRequirements(ORG_ID, PATIENT_ID)).resolves.toEqual([])
  })

  it('limits requirement previews before returning rows', async () => {
    const rows = [{ id: CHILD_ID }]
    const supabase = makeSupabase()
    supabase.order.mockReturnValue(supabase)
    supabase.limit.mockResolvedValue({ data: rows, error: null })

    await expect(listPatientRequirements(ORG_ID, PATIENT_ID, undefined, 4)).resolves.toEqual(rows)
    expect(supabase.limit).toHaveBeenCalledWith(4)
  })

  it('gets one active requirement instead of loading the full table', async () => {
    const row = { id: CHILD_ID }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: row, error: null })

    await expect(getPatientRequirement(ORG_ID, PATIENT_ID, CHILD_ID)).resolves.toEqual(row)
    expect(supabase.eq).toHaveBeenCalledWith('id', CHILD_ID)
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID)
    expect(supabase.eq).toHaveBeenCalledWith('active', true)
  })

  it('returns null when one requirement cannot be loaded', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    await expect(getPatientRequirement(ORG_ID, PATIENT_ID, CHILD_ID)).resolves.toBeNull()
  })

  it('uses the visibility RPC when a visibility ceiling is supplied', async () => {
    const rows = [{ id: CHILD_ID }]
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: rows, error: null })

    await expect(listPatientRequirements(ORG_ID, PATIENT_ID, 'Clinical')).resolves.toEqual(rows)
    expect(supabase.rpc).toHaveBeenCalledWith('list_patient_requirements_by_visibility', {
      target_org_id: ORG_ID,
      target_patient_id: PATIENT_ID,
      target_visibility: 'Clinical',
    })
  })

  it('returns an empty array on visibility RPC error', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'read failed' } })
    await expect(listPatientRequirements(ORG_ID, PATIENT_ID, 'Restricted')).resolves.toEqual([])
  })

  it('delegates each requirement create/update to the type-and-code upsert RPC without a count cap', async () => {
    const row = { id: CHILD_ID }
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: row, error: null })

    await expect(upsertPatientRequirement(ORG_ID, PATIENT_ID, USER_ID, input)).resolves.toEqual(row)
    expect(supabase.rpc).toHaveBeenCalledWith('upsert_patient_requirement', {
      target_org_id: ORG_ID,
      target_patient_id: PATIENT_ID,
      req_type: 'Language',
      req_code: 'LANGUAGE:Spanish',
      matching_effect: 'Preferred',
      required_skill_code: null,
      structured_value: { language: 'Spanish' },
      restricted_note_id: null,
      visibility_level: 'Operational',
      effective_end_date: null,
    })
    expect(supabase.select).not.toHaveBeenCalled()
  })

  it('throws a requirement upsert error', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'upsert failed' } })
    await expect(upsertPatientRequirement(ORG_ID, PATIENT_ID, USER_ID, input)).rejects.toThrow('upsert failed')
  })

  it('soft-deletes exactly one selected requirement', async () => {
    const supabase = makeSupabase()

    await expect(deactivatePatientRequirement(ORG_ID, PATIENT_ID, CHILD_ID)).resolves.toBeUndefined()
    expect(supabase.update).toHaveBeenCalledWith({ active: false })
    expect(supabase.eq).toHaveBeenCalledWith('id', CHILD_ID)
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID)
  })

  it('throws a requirement delete error', async () => {
    makeSupabase({ error: { message: 'delete failed' } })
    await expect(deactivatePatientRequirement(ORG_ID, PATIENT_ID, CHILD_ID)).rejects.toThrow('delete failed')
  })
})

describe('patient contacts', () => {
  const input = {
    contact_type: 'Emergency',
    contact_name: 'Test Contact',
    relationship: 'Friend',
    email: 'contact@example.test',
  }

  it('lists only active contacts for the patient and organization', async () => {
    const rows = [{ id: CHILD_ID }]
    const supabase = makeSupabase()
    supabase.order.mockResolvedValue({ data: rows, error: null })

    await expect(listPatientContacts(ORG_ID, PATIENT_ID)).resolves.toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('patient_contacts')
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID)
    expect(supabase.eq).toHaveBeenCalledWith('active', true)
  })

  it('returns an empty array on contact read error', async () => {
    const supabase = makeSupabase()
    supabase.order.mockResolvedValue({ data: null, error: { message: 'read failed' } })
    await expect(listPatientContacts(ORG_ID, PATIENT_ID)).resolves.toEqual([])
  })

  it('limits contact previews to three rows plus a view-more sentinel', async () => {
    const rows = [{ id: CHILD_ID }]
    const supabase = makeSupabase()
    supabase.order.mockReturnValue(supabase)
    supabase.limit.mockResolvedValue({ data: rows, error: null })

    await expect(listPatientContacts(ORG_ID, PATIENT_ID, 4)).resolves.toEqual(rows)
    expect(supabase.limit).toHaveBeenCalledWith(4)
  })

  it('gets one active contact instead of loading the full table', async () => {
    const row = { id: CHILD_ID }
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: row, error: null })

    await expect(getPatientContact(ORG_ID, PATIENT_ID, CHILD_ID)).resolves.toEqual(row)
    expect(supabase.eq).toHaveBeenCalledWith('id', CHILD_ID)
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID)
    expect(supabase.eq).toHaveBeenCalledWith('active', true)
  })

  it('returns null when one contact cannot be loaded', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    await expect(getPatientContact(ORG_ID, PATIENT_ID, CHILD_ID)).resolves.toBeNull()
  })

  it('creates a fifth active contact when four exist', async () => {
    const row = { id: CHILD_ID }
    const supabase = makeSupabase({ count: 4 })
    supabase.single.mockResolvedValue({ data: row, error: null })

    await expect(upsertPatientContact(ORG_ID, PATIENT_ID, undefined, input)).resolves.toEqual(row)
    expect(supabase.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(supabase.eq).toHaveBeenCalledWith('active', true)
    expect(supabase.insert).toHaveBeenCalledTimes(1)
  })

  it('rejects a sixth active contact and does not insert it', async () => {
    const supabase = makeSupabase({ count: 5 })

    await expect(upsertPatientContact(ORG_ID, PATIENT_ID, undefined, input))
      .rejects.toThrow('A patient can have at most 5 contacts.')
    expect(supabase.insert).not.toHaveBeenCalled()
  })

  it('throws when the active contact count fails', async () => {
    const supabase = makeSupabase({ error: { message: 'count failed' } })
    await expect(upsertPatientContact(ORG_ID, PATIENT_ID, undefined, input)).rejects.toThrow('count failed')
    expect(supabase.insert).not.toHaveBeenCalled()
  })

  it('updates an existing contact without applying the create limit', async () => {
    const row = { id: CHILD_ID }
    const supabase = makeSupabase({ count: 5 })
    supabase.single.mockResolvedValue({ data: row, error: null })

    await expect(upsertPatientContact(ORG_ID, PATIENT_ID, CHILD_ID, input)).resolves.toEqual(row)
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({
      contact_name: 'Test Contact',
    }))
    expect(supabase.eq).toHaveBeenCalledWith('id', CHILD_ID)
    expect(supabase.insert).not.toHaveBeenCalled()
  })

  it('throws contact update and insert errors', async () => {
    const updateClient = makeSupabase()
    updateClient.single.mockResolvedValue({ data: null, error: { message: 'update failed' } })
    await expect(upsertPatientContact(ORG_ID, PATIENT_ID, CHILD_ID, input)).rejects.toThrow('update failed')

    const insertClient = makeSupabase({ count: 0 })
    insertClient.single.mockResolvedValue({ data: null, error: { message: 'insert failed' } })
    await expect(upsertPatientContact(ORG_ID, PATIENT_ID, undefined, input)).rejects.toThrow('insert failed')
  })

  it('soft-deletes one contact so it no longer counts toward the active maximum', async () => {
    const supabase = makeSupabase()

    await expect(deactivatePatientContact(ORG_ID, PATIENT_ID, CHILD_ID)).resolves.toBeUndefined()
    expect(supabase.update).toHaveBeenCalledWith({
      active: false,
      archived_at: expect.any(String),
    })
    expect(supabase.eq).toHaveBeenCalledWith('id', CHILD_ID)
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('patient_id', PATIENT_ID)
  })

  it('throws a contact delete error', async () => {
    makeSupabase({ error: { message: 'delete failed' } })
    await expect(deactivatePatientContact(ORG_ID, PATIENT_ID, CHILD_ID)).rejects.toThrow('delete failed')
  })
})
