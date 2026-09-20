'use client'

import * as React from 'react'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import {
  getCaregiverSkillDisplayValue,
  getCaregiverSkillType,
  getCredentialHealth,
} from '@/lib/schemas/caregivers.schema'
import type {
  Caregiver,
  CaregiverAvailability,
  CaregiverCompensationRate,
  CaregiverCredential,
  CaregiverServiceEligibilityWithService,
  CaregiverSkill,
  CredentialHealth,
} from '@/types'

const ACTION_BUTTON_SX = {
  borderColor: 'divider',
  '&:hover': {
    borderColor: 'divider',
  },
}

const PREVIEW_ROW_LIMIT = 3

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

const CREDENTIAL_HEALTH_COLOR: Record<CredentialHealth, 'success' | 'warning' | 'error'> = {
  OK: 'success',
  'Expiring Soon': 'warning',
  Expired: 'error',
  Missing: 'error',
}

interface InfoSectionProps {
  title: string
  onEditClick: () => void
  children: React.ReactNode
  buttonText?: string
  tooltipText?: string
  headerAdornment?: React.ReactNode
}

function InfoSection({
  title,
  onEditClick,
  children,
  buttonText = 'Edit',
  tooltipText,
  headerAdornment,
}: InfoSectionProps) {
  const button = (
    <Button
      size="small"
      variant="outlined"
      sx={ACTION_BUTTON_SX}
      startIcon={buttonText === 'Edit' ? <EditIcon /> : <AutorenewIcon />}
      onClick={onEditClick}
    >
      {buttonText}
    </Button>
  )

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        bgcolor: 'background.default',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        p: 0,
        gap: 0,
      }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'action.hover',
          px: 2,
          py: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {headerAdornment}
        </Stack>
        {tooltipText ? (
          <Tooltip title={tooltipText}>
            <span>{button}</span>
          </Tooltip>
        ) : (
          button
        )}
      </Stack>
      <Divider />
      <Box sx={{ px: 2, py: 1 }}>{children}</Box>
    </Card>
  )
}

function InfoRows({ children }: { children: React.ReactNode }) {
  return <Stack divider={<Divider flexItem />}>{children}</Stack>
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(100px, 0.45fr) minmax(0, 1fr)' },
        gap: { xs: 0.25, sm: 1.5 },
        py: 1.25,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  )
}

function ViewMore({ path }: { path: string }) {
  const router = useRouter()

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
      <Button size="small" variant="text" onClick={() => router.push(path)}>
        View more
      </Button>
    </Box>
  )
}

function PreviewFallback({ label }: { label: string }) {
  return (
    <InfoRow label={label}>
      <CircularProgress size={16} />
    </InfoRow>
  )
}

function CredentialPreview({
  caregiverId,
  credentialsPromise,
}: {
  caregiverId: string
  credentialsPromise: Promise<CaregiverCredential[]>
}) {
  const credentials = React.use(credentialsPromise)
  const previewRows = credentials.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <InfoRows>
      {previewRows.length === 0 ? (
        <InfoRow label="Credential">No credentials on file.</InfoRow>
      ) : (
        previewRows.map((credential) => (
          <InfoRow label={credential.credential_type} key={credential.id}>
            {credential.credential_name}
            {credential.expiration_date ? ` · expires ${credential.expiration_date}` : ''}
            {` · ${credential.status}`}
          </InfoRow>
        ))
      )}
      {credentials.length > PREVIEW_ROW_LIMIT ? (
        <ViewMore path={`/caregivers/${caregiverId}/credential`} />
      ) : null}
    </InfoRows>
  )
}

function CredentialHealthChip({
  credentialsPromise,
}: {
  credentialsPromise: Promise<CaregiverCredential[]>
}) {
  const credentials = React.use(credentialsPromise)
  const health = getCredentialHealth(credentials)

  return <Chip label={health} color={CREDENTIAL_HEALTH_COLOR[health]} size="small" variant="outlined" />
}

function SkillPreview({
  caregiverId,
  skillsPromise,
}: {
  caregiverId: string
  skillsPromise: Promise<CaregiverSkill[]>
}) {
  const skills = React.use(skillsPromise)
  const previewRows = skills.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <InfoRows>
      {previewRows.length === 0 ? (
        <InfoRow label="Skill">No skills recorded yet.</InfoRow>
      ) : (
        previewRows.map((skill) => (
          <InfoRow label={getCaregiverSkillType(skill.skill_code) ?? 'Skill'} key={skill.id}>
            {getCaregiverSkillDisplayValue(skill)}
          </InfoRow>
        ))
      )}
      {skills.length > PREVIEW_ROW_LIMIT ? <ViewMore path={`/caregivers/${caregiverId}/skill`} /> : null}
    </InfoRows>
  )
}

function EligibilityPreview({
  caregiverId,
  eligibilityPromise,
}: {
  caregiverId: string
  eligibilityPromise: Promise<CaregiverServiceEligibilityWithService[]>
}) {
  const eligibility = React.use(eligibilityPromise)
  const previewRows = eligibility.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <InfoRows>
      {previewRows.length === 0 ? (
        <InfoRow label="Service">No approved services yet.</InfoRow>
      ) : (
        previewRows.map((row) => (
          <InfoRow label="Service" key={row.id}>
            {row.organization_service?.local_service_name
              ?? row.organization_service?.service_code_mapping?.evv_service_name
              ?? row.organization_service_id}
            {row.supervision_required ? ' · supervision required' : ''}
          </InfoRow>
        ))
      )}
      {eligibility.length > PREVIEW_ROW_LIMIT ? (
        <ViewMore path={`/caregivers/${caregiverId}/eligibility`} />
      ) : null}
    </InfoRows>
  )
}

function AvailabilityPreview({
  caregiverId,
  availabilityPromise,
}: {
  caregiverId: string
  availabilityPromise: Promise<CaregiverAvailability[]>
}) {
  const availability = React.use(availabilityPromise)
  const previewRows = availability.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <InfoRows>
      {previewRows.length === 0 ? (
        <InfoRow label="Availability">No availability windows yet.</InfoRow>
      ) : (
        previewRows.map((window) => (
          <InfoRow label={DAY_NAMES[window.day_of_week] ?? 'Day'} key={window.id}>
            {`${window.start_time.slice(0, 5)}–${window.end_time.slice(0, 5)} · ${window.availability_status}`}
          </InfoRow>
        ))
      )}
      {availability.length > PREVIEW_ROW_LIMIT ? (
        <ViewMore path={`/caregivers/${caregiverId}/availability`} />
      ) : null}
    </InfoRows>
  )
}


function CompensationPreview({
  caregiverId,
  compensationPromise,
}: {
  caregiverId: string
  compensationPromise: Promise<CaregiverCompensationRate[]>
}) {
  const rates = React.use(compensationPromise)
  const previewRows = rates.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <InfoRows>
      {previewRows.length === 0 ? (
        <InfoRow label="Rate">No compensation rates recorded.</InfoRow>
      ) : (
        previewRows.map((rate) => (
          <InfoRow label={rate.active ? 'Current rate' : 'Previous rate'} key={rate.id}>
            {`$${Number(rate.pay_rate).toFixed(2)} per ${rate.rate_unit.toLowerCase()} · from ${rate.effective_start_date}`}
          </InfoRow>
        ))
      )}
      {rates.length > PREVIEW_ROW_LIMIT ? (
        <ViewMore path={`/caregivers/${caregiverId}/compensation`} />
      ) : null}
    </InfoRows>
  )
}

export interface CaregiverCoreProps {
  caregiver: Caregiver
  canReadCompensation: boolean
  credentialsPromise: Promise<CaregiverCredential[]>
  skillsPromise: Promise<CaregiverSkill[]>
  eligibilityPromise: Promise<CaregiverServiceEligibilityWithService[]>
  availabilityPromise: Promise<CaregiverAvailability[]>
  compensationPromise: Promise<CaregiverCompensationRate[]> | null
}

export default function CaregiverCore({
  caregiver,
  canReadCompensation,
  credentialsPromise,
  skillsPromise,
  eligibilityPromise,
  availabilityPromise,
  compensationPromise,
}: CaregiverCoreProps) {
  const router = useRouter()
  const [isRefreshing, startRefresh] = React.useTransition()
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()

  const goTo = React.useCallback(
    (path: string) => () => {
      router.push(`/caregivers/${caregiver.id}/${path}`)
    },
    [router, caregiver.id],
  )

  const handleRefresh = React.useCallback(() => {
    startRefresh(() => {
      router.refresh()
    })
  }, [router])

  return (
    <PageContainer
      title="Caregiver Information"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver' },
      ]}
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Tooltip title="Reload data" placement="right" enterDelay={1000}>
            <div>
              <IconButton size="small" aria-label="reload" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              </IconButton>
            </div>
          </Tooltip>
        </Stack>
      }
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Typography variant="body2" color="text.secondary">
          Review and manage the profile, credentials, skills, services, and availability for{' '}
          {fullName || 'this caregiver'}.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 2,
            alignItems: 'stretch',
          }}
        >
          <InfoSection title="Profile" onEditClick={goTo('edit')}>
            <InfoRows>
              <InfoRow label="Name">{fullName || '—'}</InfoRow>
              <InfoRow label="Classification">{caregiver.classification}</InfoRow>
              <InfoRow label="Employment">{caregiver.employment_status}</InfoRow>
              <InfoRow label="Matching">{caregiver.matching_status}</InfoRow>
              <InfoRow label="Email">{caregiver.email ?? '—'}</InfoRow>
              <InfoRow label="Phone">{caregiver.phone ?? '—'}</InfoRow>
              <InfoRow label="Employee ID">{caregiver.employee_external_id ?? '—'}</InfoRow>
              <InfoRow label="Max Hours/Week">{caregiver.max_hours_per_week ?? '—'}</InfoRow>
              <InfoRow label="Service Area ZIP">{caregiver.service_area_zip ?? '—'}</InfoRow>
              <InfoRow label="Travel Radius">
                {caregiver.travel_radius_miles === null ? '—' : `${caregiver.travel_radius_miles} miles`}
              </InfoRow>
            </InfoRows>
          </InfoSection>

          <InfoSection
            title="Credentials"
            onEditClick={goTo('credential')}
            buttonText="Manage"
            headerAdornment={
              <React.Suspense fallback={null}>
                <CredentialHealthChip credentialsPromise={credentialsPromise} />
              </React.Suspense>
            }
          >
            <React.Suspense fallback={<InfoRows><PreviewFallback label="Credential" /></InfoRows>}>
              <CredentialPreview caregiverId={caregiver.id} credentialsPromise={credentialsPromise} />
            </React.Suspense>
          </InfoSection>

          <InfoSection title="Skills" onEditClick={goTo('skill')} buttonText="Manage">
            <React.Suspense fallback={<InfoRows><PreviewFallback label="Skill" /></InfoRows>}>
              <SkillPreview caregiverId={caregiver.id} skillsPromise={skillsPromise} />
            </React.Suspense>
          </InfoSection>

          <InfoSection title="Service Eligibility" onEditClick={goTo('eligibility')} buttonText="Manage">
            <React.Suspense fallback={<InfoRows><PreviewFallback label="Service" /></InfoRows>}>
              <EligibilityPreview caregiverId={caregiver.id} eligibilityPromise={eligibilityPromise} />
            </React.Suspense>
          </InfoSection>

          <InfoSection title="Availability" onEditClick={goTo('availability')} buttonText="Manage">
            <React.Suspense fallback={<InfoRows><PreviewFallback label="Availability" /></InfoRows>}>
              <AvailabilityPreview caregiverId={caregiver.id} availabilityPromise={availabilityPromise} />
            </React.Suspense>
          </InfoSection>

          {canReadCompensation && compensationPromise ? (
            <InfoSection title="Compensation" onEditClick={goTo('compensation')} buttonText="Manage">
              <React.Suspense fallback={<InfoRows><PreviewFallback label="Rate" /></InfoRows>}>
                <CompensationPreview
                  caregiverId={caregiver.id}
                  compensationPromise={compensationPromise}
                />
              </React.Suspense>
            </InfoSection>
          ) : null}
        </Box>
      </Stack>
    </PageContainer>
  )
}
