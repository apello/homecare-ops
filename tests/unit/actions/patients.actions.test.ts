import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/server', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/permissions', () => ({ requirePermission: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/services/patients.service', () => ({
  listPatients: vi.fn(),
  getPatient: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  archivePatient: vi.fn(),
  listPatientAddresses: vi.fn(),
  upsertPatientAddress: vi.fn(),
  deactivatePatientAddress: vi.fn(),
  listPatientRequirements: vi.fn(),
  upsertPatientRequirement: vi.fn(),
  deactivatePatientRequirement: vi.fn(),
  listPatientContacts: vi.fn(),
  upsertPatientContact: vi.fn(),
  deactivatePatientContact: vi.fn(),
}))

import { revalidatePath } from 'next/cache'
import {
  archivePatientAction,
  createPatientAction,
  deactivatePatientAddressAction,
  deactivatePatientContactAction,
  deactivatePatientRequirementAction,
  getPatientAction,
  listPatientAddressesAction,
  listPatientContactsAction,
  listPatientRequirementsAction,
  listPatientsAction,
  updatePatientAction,
  upsertPatientAddressAction,
  upsertPatientContactAction,
  upsertPatientRequirementAction,
} from '@/app/(dashboard)/patients/actions'
import { requireAuth } from '@/lib/auth/server'
import { requirePermission } from '@/lib/permissions'
import * as service from '@/lib/services/patients.service'
import type { ActionResponse } from '@/types'

const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>
const mockRequirePermission = requirePermission as ReturnType<typeof vi.fn>
const mockRevalidatePath = revalidatePath as ReturnType<typeof vi.fn>

const mockListPatients = service.listPatients as ReturnType<typeof vi.fn>
const mockGetPatient = service.getPatient as ReturnType<typeof vi.fn>
const mockCreatePatient = service.createPatient as ReturnType<typeof vi.fn>
const mockUpdatePatient = service.updatePatient as ReturnType<typeof vi.fn>
const mockArchivePatient = service.archivePatient as ReturnType<typeof vi.fn>
const mockListAddresses = service.listPatientAddresses as ReturnType<typeof vi.fn>
const mockUpsertAddress = service.upsertPatientAddress as ReturnType<typeof vi.fn>
const mockDeactivateAddress = service.deactivatePatientAddress as ReturnType<typeof vi.fn>
const mockListRequirements = service.listPatientRequirements as ReturnType<typeof vi.fn>
const mockUpsertRequirement = service.upsertPatientRequirement as ReturnType<typeof vi.fn>
const mockDeactivateRequirement = service.deactivatePatientRequirement as ReturnType<typeof vi.fn>
const mockListContacts = service.listPatientContacts as ReturnType<typeof vi.fn>
const mockUpsertContact = service.upsertPatientContact as ReturnType<typeof vi.fn>
const mockDeactivateContact = service.deactivatePatientContact as ReturnType<typeof vi.fn>

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const PATIENT_ID = '00000000-0000-0000-0000-000000000002'
const CHILD_ID = '00000000-0000-0000-0000-000000000003'
const USER_ID = '00000000-0000-0000-0000-000000000004'

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ id: USER_ID })
  mockRequirePermission.mockResolvedValue(undefined)
})

const readCases: Array<{
  name: string
  run: () => Promise<ActionResponse<unknown>>
  serviceMock: ReturnType<typeof vi.fn>
}> = [
  {
    name: 'listPatientsAction',
    run: () => listPatientsAction(ORG_ID, { status: 'Active' }),
    serviceMock: mockListPatients,
  },
  {
    name: 'getPatientAction',
    run: () => getPatientAction(ORG_ID, PATIENT_ID),
    serviceMock: mockGetPatient,
  },
  {
    name: 'listPatientAddressesAction',
    run: () => listPatientAddressesAction(ORG_ID, PATIENT_ID),
    serviceMock: mockListAddresses,
  },
  {
    name: 'listPatientRequirementsAction',
    run: () => listPatientRequirementsAction(ORG_ID, PATIENT_ID, 'Clinical'),
    serviceMock: mockListRequirements,
  },
  {
    name: 'listPatientContactsAction',
    run: () => listPatientContactsAction(ORG_ID, PATIENT_ID),
    serviceMock: mockListContacts,
  },
]

describe.each(readCases)('$name', ({ run, serviceMock }) => {
  it('returns data after auth and read permission checks', async () => {
    const rows = [{ id: CHILD_ID }]
    serviceMock.mockResolvedValue(rows)

    await expect(run()).resolves.toEqual({ success: true, data: rows })
    expect(mockRequireAuth).toHaveBeenCalledOnce()
    expect(mockRequirePermission).toHaveBeenCalledWith(ORG_ID, 'patients.read_basic')
    expect(serviceMock).toHaveBeenCalledOnce()
  })

  it('returns an authorization error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    await expect(run()).resolves.toEqual({ success: false, error: 'Not authorized.' })
    expect(serviceMock).not.toHaveBeenCalled()
  })

  it('returns an authorization error when forbidden', async () => {
    mockRequirePermission.mockRejectedValue(new Error('Forbidden'))
    await expect(run()).resolves.toEqual({ success: false, error: 'Not authorized.' })
    expect(serviceMock).not.toHaveBeenCalled()
  })

  it('returns a failure when the service throws', async () => {
    serviceMock.mockRejectedValue(new Error('service failed'))
    await expect(run()).resolves.toEqual({ success: false, error: 'Not authorized.' })
  })
})

type MutationCase = {
  name: string
  run: (input: unknown) => Promise<ActionResponse<unknown>>
  valid: Record<string, unknown>
  required: string[]
  serviceMock: ReturnType<typeof vi.fn>
  expectedArgs: unknown[]
  revalidatePath: string
}

const createInput = {
  organizationId: ORG_ID,
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
}

const updateInput = {
  organizationId: ORG_ID,
  patientId: PATIENT_ID,
  first_name: 'Updated',
  date_of_birth: '1990-01-15',
}

const addressInput = {
  organizationId: ORG_ID,
  patientId: PATIENT_ID,
  address_type: 'Service',
  address_line_1: '100 Test Way',
  city: 'Testville',
  state: 'PA',
  zip_code: '19000',
}

const requirementInput = {
  organizationId: ORG_ID,
  patientId: PATIENT_ID,
  requirement_type: 'Skill',
  requirement_code: 'TEMP-SKILL',
  matching_effect: 'Required',
  visibility_level: 'Operational',
  effective_start_date: '2026-01-01',
}

const contactInput = {
  organizationId: ORG_ID,
  patientId: PATIENT_ID,
  contact_type: 'Emergency',
  contact_name: 'Test Contact',
  relationship: 'Friend',
  email: 'contact@example.test',
}

const mutationCases: MutationCase[] = [
  {
    name: 'createPatientAction',
    run: createPatientAction,
    valid: createInput,
    required: ['organizationId', 'first_name', 'last_name', 'date_of_birth'],
    serviceMock: mockCreatePatient,
    expectedArgs: [
      ORG_ID,
      USER_ID,
      {
        first_name: 'Test',
        last_name: 'Patient',
        middle_name: undefined,
        date_of_birth: '1990-01-15',
        patient_external_id: undefined,
        status: undefined,
        address: createInput.address,
      },
    ],
    revalidatePath: '/patients',
  },
  {
    name: 'updatePatientAction',
    run: updatePatientAction,
    valid: updateInput,
    required: ['organizationId', 'patientId', 'date_of_birth'],
    serviceMock: mockUpdatePatient,
    expectedArgs: [
      ORG_ID,
      PATIENT_ID,
      USER_ID,
      {
        first_name: 'Updated',
        last_name: undefined,
        middle_name: undefined,
        date_of_birth: '1990-01-15',
        patient_external_id: undefined,
        status: undefined,
      },
    ],
    revalidatePath: `/patients/${PATIENT_ID}`,
  },
  {
    name: 'archivePatientAction',
    run: archivePatientAction,
    valid: { organizationId: ORG_ID, patientId: PATIENT_ID },
    required: ['organizationId', 'patientId'],
    serviceMock: mockArchivePatient,
    expectedArgs: [ORG_ID, PATIENT_ID, USER_ID],
    revalidatePath: '/patients',
  },
  {
    name: 'upsertPatientAddressAction',
    run: upsertPatientAddressAction,
    valid: addressInput,
    required: ['organizationId', 'patientId', 'address_type', 'address_line_1', 'city', 'state', 'zip_code'],
    serviceMock: mockUpsertAddress,
    expectedArgs: [
      ORG_ID,
      PATIENT_ID,
      'Service',
      {
        address_type: 'Service',
        address_line_1: '100 Test Way',
        address_line_2: undefined,
        city: 'Testville',
        state: 'PA',
        zip_code: '19000',
        latitude: undefined,
        longitude: undefined,
        location_hash: undefined,
        geocoding_provider: undefined,
        geocoded_at: undefined,
      },
    ],
    revalidatePath: `/patients/${PATIENT_ID}`,
  },
  {
    name: 'deactivatePatientAddressAction',
    run: deactivatePatientAddressAction,
    valid: { organizationId: ORG_ID, patientId: PATIENT_ID, addressId: CHILD_ID },
    required: ['organizationId', 'patientId', 'addressId'],
    serviceMock: mockDeactivateAddress,
    expectedArgs: [ORG_ID, PATIENT_ID, CHILD_ID],
    revalidatePath: `/patients/${PATIENT_ID}`,
  },
  {
    name: 'upsertPatientRequirementAction',
    run: upsertPatientRequirementAction,
    valid: requirementInput,
    required: [
      'organizationId',
      'patientId',
      'requirement_type',
      'requirement_code',
      'matching_effect',
      'visibility_level',
      'effective_start_date',
    ],
    serviceMock: mockUpsertRequirement,
    expectedArgs: [
      ORG_ID,
      PATIENT_ID,
      USER_ID,
      {
        requirement_type: 'Skill',
        requirement_code: 'TEMP-SKILL',
        matching_effect: 'Required',
        required_skill_code: undefined,
        structured_value: undefined,
        restricted_note_id: undefined,
        visibility_level: 'Operational',
        effective_start_date: '2026-01-01',
        effective_end_date: undefined,
      },
    ],
    revalidatePath: `/patients/${PATIENT_ID}`,
  },
  {
    name: 'deactivatePatientRequirementAction',
    run: deactivatePatientRequirementAction,
    valid: { organizationId: ORG_ID, patientId: PATIENT_ID, requirementId: CHILD_ID },
    required: ['organizationId', 'patientId', 'requirementId'],
    serviceMock: mockDeactivateRequirement,
    expectedArgs: [ORG_ID, PATIENT_ID, CHILD_ID],
    revalidatePath: `/patients/${PATIENT_ID}`,
  },
  {
    name: 'upsertPatientContactAction',
    run: upsertPatientContactAction,
    valid: contactInput,
    required: ['organizationId', 'patientId', 'contact_type', 'contact_name'],
    serviceMock: mockUpsertContact,
    expectedArgs: [
      ORG_ID,
      PATIENT_ID,
      undefined,
      {
        contact_type: 'Emergency',
        contact_name: 'Test Contact',
        relationship: 'Friend',
        phone: undefined,
        email: 'contact@example.test',
        authorized_contact: undefined,
      },
    ],
    revalidatePath: `/patients/${PATIENT_ID}`,
  },
  {
    name: 'deactivatePatientContactAction',
    run: deactivatePatientContactAction,
    valid: { organizationId: ORG_ID, patientId: PATIENT_ID, contactId: CHILD_ID },
    required: ['organizationId', 'patientId', 'contactId'],
    serviceMock: mockDeactivateContact,
    expectedArgs: [ORG_ID, PATIENT_ID, CHILD_ID],
    revalidatePath: `/patients/${PATIENT_ID}`,
  },
]

describe.each(mutationCases)('$name', ({
  run,
  valid,
  required,
  serviceMock,
  expectedArgs,
  revalidatePath: expectedPath,
}) => {
  it('checks manage permission, delegates validated data, and revalidates', async () => {
    const row = { id: CHILD_ID }
    serviceMock.mockResolvedValue(row)

    const result = await run(valid)
    expect(result.success).toBe(true)
    expect(mockRequirePermission).toHaveBeenCalledWith(ORG_ID, 'patients.manage')
    expect(serviceMock).toHaveBeenCalledWith(...expectedArgs)
    expect(mockRevalidatePath).toHaveBeenCalledWith(expectedPath)
  })

  it.each(required)('returns fieldErrors when required field %s is missing', async (field) => {
    const result = await run({ ...valid, [field]: undefined })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.[field]).toBeDefined()
    expect(serviceMock).not.toHaveBeenCalled()
  })

  it('rejects unknown fields in strict mode', async () => {
    const result = await run({ ...valid, extra: true })
    expect(result.success).toBe(false)
    expect(serviceMock).not.toHaveBeenCalled()
  })

  it('returns an error when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    const result = await run(valid)
    expect(result).toEqual({ success: false, error: 'Unauthenticated' })
    expect(serviceMock).not.toHaveBeenCalled()
  })

  it('returns an error when forbidden', async () => {
    mockRequirePermission.mockRejectedValue(new Error('Forbidden'))
    const result = await run(valid)
    expect(result).toEqual({ success: false, error: 'Forbidden' })
    expect(serviceMock).not.toHaveBeenCalled()
  })

  it('returns the service error and does not revalidate', async () => {
    serviceMock.mockRejectedValue(new Error('service failed'))
    const result = await run(valid)
    expect(result).toEqual({ success: false, error: 'service failed' })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
