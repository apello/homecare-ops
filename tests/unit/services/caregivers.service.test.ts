import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/db/client'
import {
  createCaregiver,
  listCaregivers,
  setCompensationRate,
  upsertAvailability,
} from '@/lib/services/caregivers.service'

const mockClient = createClient as ReturnType<typeof vi.fn>
const ORG_ID = 'org-uuid'
const CAREGIVER_ID = 'caregiver-uuid'
const USER_ID = 'user-uuid'

function makeSupabase() {
  const base = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn(),
    rpc: vi.fn(),
  }
  mockClient.mockResolvedValue(base)
  return base
}

describe('listCaregivers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses a safe list projection, scopes archived rows, and paginates', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: 0, error: null })
    supabase.range.mockResolvedValue({ data: [{ id: CAREGIVER_ID }], error: null, count: 1 })

    await expect(listCaregivers(ORG_ID, {
      classification: 'HHA',
      status: 'Active',
      page: 1,
      pageSize: 25,
    })).resolves.toEqual({ rows: [{ id: CAREGIVER_ID }], rowCount: 1 })

    expect(supabase.from).toHaveBeenCalledWith('caregivers')
    const projection = supabase.select.mock.calls[0]?.[0] as string
    expect(projection).not.toContain('credential_number')
    expect(projection).not.toContain('encrypted_credential_number')
    expect(projection).not.toContain('compensation')
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('classification', 'HHA')
    expect(supabase.eq).toHaveBeenCalledWith('matching_status', 'Active')
    expect(supabase.is).toHaveBeenCalledWith('archived_at', null)
    expect(supabase.range).toHaveBeenCalledWith(25, 49)
  })

  it('uses the archived filter instead of matching status and returns an empty page on error', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: 0, error: null })
    supabase.range.mockResolvedValue({ data: null, error: { message: 'db error' }, count: null })

    await expect(listCaregivers(ORG_ID, { status: 'Archived' })).resolves.toEqual({ rows: [], rowCount: 0 })

    expect(supabase.not).toHaveBeenCalledWith('archived_at', 'is', null)
    expect(supabase.eq).not.toHaveBeenCalledWith('matching_status', 'Archived')
  })
})

describe('caregiver RPCs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps create-caregiver input to its RPC contract', async () => {
    const supabase = makeSupabase()
    const row = { id: CAREGIVER_ID }
    supabase.rpc.mockResolvedValue({ data: row, error: null })

    await expect(createCaregiver(ORG_ID, USER_ID, {
      first_name: 'Ada',
      last_name: 'Caregiver',
      classification: 'HHA',
    })).resolves.toEqual(row)

    expect(supabase.rpc).toHaveBeenCalledWith('create_caregiver', {
      target_org_id: ORG_ID,
      first_name: 'Ada',
      last_name: 'Caregiver',
      classification: 'HHA',
      email: null,
      phone: null,
      employee_external_id: null,
      max_hours_per_week: null,
      service_area_zip: null,
      travel_radius_miles: null,
    })
  })

  it('maps availability and compensation input to their RPC contracts', async () => {
    const supabase = makeSupabase()
    supabase.rpc
      .mockResolvedValueOnce({ data: { id: 'availability' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'rate' }, error: null })

    await upsertAvailability(ORG_ID, CAREGIVER_ID, {
      day_of_week: 1,
      start_time: '08:00',
      end_time: '16:00',
      availability_status: 'Available',
      effective_start_date: '2026-01-01',
    })
    await setCompensationRate(ORG_ID, CAREGIVER_ID, USER_ID, {
      pay_rate: 24.5,
      rate_unit: 'Hour',
      effective_start_date: '2026-01-01',
    })

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'upsert_caregiver_availability', {
      target_org_id: ORG_ID,
      target_caregiver_id: CAREGIVER_ID,
      day_of_week: 1,
      start_time: '08:00',
      end_time: '16:00',
      availability_status: 'Available',
      effective_start_date: '2026-01-01',
      effective_end_date: null,
    })
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'set_caregiver_compensation_rate', {
      target_org_id: ORG_ID,
      target_caregiver_id: CAREGIVER_ID,
      pay_rate: 24.5,
      rate_unit: 'Hour',
      effective_start_date: '2026-01-01',
      organization_service_id: null,
    })
  })

  it('surfaces RPC failures to callers', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } })

    await expect(upsertAvailability(ORG_ID, CAREGIVER_ID, {
      day_of_week: 1,
      start_time: '08:00',
      end_time: '16:00',
      availability_status: 'Available',
      effective_start_date: '2026-01-01',
    })).rejects.toThrow('rpc failed')
  })
})
