'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { Patient, PatientAddress, PatientRequirement } from '@/types'

interface InfoSectionProps {
  title: string
  onEditClick: () => void
  children: React.ReactNode
}

function InfoSection({ title, onEditClick, children }: InfoSectionProps) {
  return (
    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          sx={{
            borderColor: 'divider',
            '&:hover': {
              borderColor: 'divider',
            },
          }}
          startIcon={<EditIcon />}
          onClick={onEditClick}
        >
          Edit
        </Button>
      </Stack>
      {children}
    </Box>
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
        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Caregiver Assignment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No caregiver for this patient
          </Typography>
        </Box>

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
