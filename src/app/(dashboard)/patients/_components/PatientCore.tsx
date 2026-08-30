'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import Divider from '@mui/material/Divider'
import Card from '@mui/material/Card'
import Tooltip from '@mui/material/Tooltip'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Patient, PatientAddress, PatientRequirement } from '@/types'

interface InfoSectionProps {
  title: string
  onEditClick: () => void
  children: React.ReactNode
  buttonText?: string
  tooltipText?: string
}

function InfoSection({ title, onEditClick, children, buttonText = 'Edit', tooltipText }: InfoSectionProps) {
  const isEdit = buttonText === 'Edit'
  const button = (
    <Button
      size="small"
      variant="outlined"
      sx={{
        borderColor: 'divider',
        '&:hover': {
          borderColor: 'divider',
        },
      }}
      startIcon={isEdit ? <EditIcon /> : <AutorenewIcon />}
      onClick={onEditClick}
    >
      {buttonText}
    </Button>
  )

  return (
    <Card sx={{ p: 0, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          bgcolor: 'action.hover'
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {tooltipText ? (
          <Tooltip title={tooltipText}>
            <span>{button}</span>
          </Tooltip>
        ) : (
          button
        )}
      </Stack>
      <Divider />
      <Box sx={{ p: 2 }}>
        {children}
      </Box>
    </Card>
  )
}

export interface PatientCoreProps {
  patient: Patient
  orgId: string
  addresses: PatientAddress[]
  requirements: PatientRequirement[]
}

export default function PatientCore({ patient, addresses, requirements }: PatientCoreProps) {
  const router = useRouter()
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')

  const handleBackClick = React.useCallback(() => {
    router.push('/patients')
  }, [router])

  const goTo = React.useCallback(
    (path: string) => () => {
      router.push(`/patients/${patient.id}/${path}`)
    },
    [router, patient.id],
  )

  return (
    <PageContainer
      title={fullName || 'Patient'}
      breadcrumbs={[
        { title: 'Patients', path: '/patients' },
        { title: fullName || 'Patient' },
      ]}
    >
      <Stack spacing={2} sx={{ width: '100%', mt: 1 }}>
        <InfoSection
          title="Caregiver Assignment"
          onEditClick={goTo('matching')}
          buttonText="Match Patient"
          tooltipText="Match Patient will generate a list of recommended caregivers for this patient"
        >
          <Typography variant="body2" color="text.secondary">
            No caregiver for this patient
          </Typography>
        </InfoSection>

        <InfoSection title="Patient Information" onEditClick={goTo('edit')}>
          <Typography variant="body2">Name: {fullName || '—'}</Typography>
          <Typography variant="body2">Date of Birth: {patient.date_of_birth ?? '—'}</Typography>
          <Typography variant="body2">
            Status: {patient.status} 
          </Typography>
          {patient.patient_external_id ? (
            <Typography variant="body2">External ID: {patient.patient_external_id}</Typography>
          ) : null}
        </InfoSection>

        <InfoSection title="Addresses" onEditClick={goTo('address')}>
          {addresses.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No addresses added yet.
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {addresses.map((address) => {
                const parts = [address.address_line_1]
                if (address.address_line_2) parts.push(address.address_line_2)
                if (address.city) parts.push(address.city)
                if (address.state) parts.push(address.state)
                if (address.zip_code) parts.push(address.zip_code)
                return (
                  <Typography variant="body2" key={address.id}>
                    {address.address_type}: {parts.join(', ')}
                  </Typography>
                )
              })}
            </Stack>
          )}
        </InfoSection>

        <InfoSection title="Emergency Contact" onEditClick={goTo('contact')}>
          <Typography variant="body2" color="text.secondary">
            No contact information on file.
          </Typography>
        </InfoSection>

        <InfoSection title="Patient Authorization" onEditClick={goTo('authorization')}>
          <Typography variant="body2" color="text.secondary">
            No authorization information on file.
          </Typography>
        </InfoSection>

        <InfoSection title="Requirements" onEditClick={goTo('requirement')}>
          {requirements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No requirements added yet.
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {requirements.map((requirement) => (
                <Typography variant="body2" key={requirement.id}>
                  {requirement.requirement_type}: {requirement.requirement_code} ({requirement.matching_effect})
                </Typography>
              ))}
            </Stack>
          )}
        </InfoSection>

        <Box>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackClick}>
            Back
          </Button>
        </Box>
      </Stack>
    </PageContainer>
  )
}
