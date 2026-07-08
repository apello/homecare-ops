'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/navigation';
import { ORG_ROLES, type OrgRole, type OrgMemberWithProfile } from '@/types';

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  'Agency Administrator':
    'Manages agency users, roles, patient records, authorizations, organization services, approved service rates, and financial overrides. May view caregiver pay rates and payer reimbursement rates.',
  'Scheduler':
    'Creates shifts, runs matching, reviews operational eligibility and rate compatibility, records call-offs, manages replacement outreach, and confirms standard assignments. Cannot manage users or approve financial or clinical overrides.',
  'Clinical Manager':
    'Reviews clinical requirements, restrictions, caregiver credentials, skills, and cases requiring clinical approval. Does not receive compensation access unless separately granted.',
  'HR Coordinator':
    'Creates and maintains caregiver employment records, credentials, background-check status, availability, service eligibility, and caregiver compensation rates. Receives only the patient information necessary for workforce eligibility tasks.',
  'Compliance Administrator':
    'Reviews audit events, disclosures, exports, overrides, call-offs, uncovered shifts, quality events, corrective actions, and privacy requests. Primarily read-only for operational records. Not for MVP, but for future use with privacy management in mind.',
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export interface MemberFormState {
  values: { roles: OrgRole[] };
  errors: { roles?: string };
}

export interface MemberFormProps {
  member: OrgMemberWithProfile;
  formState: MemberFormState;
  onRolesChange: (roles: OrgRole[]) => void;
  onSubmit: (values: MemberFormState['values']) => Promise<void>;
  onReset: () => void;
  submitButtonLabel?: string;
}

export default function MemberForm({
  member,
  formState,
  onRolesChange,
  onSubmit,
  onReset,
  submitButtonLabel = 'Save',
}: MemberFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const memberName =
    `${member.profile?.first_name ?? ''} ${member.profile?.last_name ?? ''}`.trim();

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      try {
        await onSubmit(formState.values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formState.values, onSubmit],
  );

  const handleRolesChange = React.useCallback(
    (event: SelectChangeEvent<OrgRole[]>) => {
      const value = event.target.value;
      onRolesChange(typeof value === 'string' ? [value as OrgRole] : (value as OrgRole[]));
    },
    [onRolesChange],
  );

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      autoComplete="off"
      onReset={onReset}
      sx={{ width: '100%'}}
    >
      <Stack spacing={3}>
        <Typography variant="subtitle2" fontWeight={600} color="info.dark">
            Member Information
          </Typography>
        <Box
          sx={{
            p: 2,
            borderRadius: 1,
            bgcolor: 'info.lighter',
            border: '1px solid',
            borderColor: 'info.light',
          }}
        >
          
          <Stack spacing={1.5}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>
                  Member
                </Typography>
                <Typography variant="body2">{memberName}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>
                  Membership Status
                </Typography>
                <Typography variant="body2">{member.status}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>
                  Access Status
                </Typography>
                <Typography variant="body2">{member.profile?.access_status ?? '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>
                  Joined
                </Typography>
                <Typography variant="body2">{formatDate(member.joined_at)}</Typography>
              </Box>
              {member.last_access_review_at && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>
                    Last Access Review
                  </Typography>
                  <Typography variant="body2">{formatDate(member.last_access_review_at)}</Typography>
                </Box>
              )}
              {member.disabled_at && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" fontWeight={500}>
                    Disabled
                  </Typography>
                  <Typography variant="body2">{formatDate(member.disabled_at)}</Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </Box>

        <FormControl error={!!formState.errors.roles} fullWidth>
          <InputLabel id="member-roles-label">Roles</InputLabel>
          <Select
            labelId="member-roles-label"
            multiple
            value={formState.values.roles}
            onChange={handleRolesChange}
            input={<OutlinedInput label="Roles" />}
            sx={{ height: 'auto' }}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, py: 0.5 }}>
                {selected.map((role) => (
                  <Chip key={role} label={role} size="small" />
                ))}
              </Box>
            )}
          >
            {ORG_ROLES.map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{formState.errors.roles}</FormHelperText>
        </FormControl>

        <Box
          sx={{
            p: 2,
            borderRadius: 1,
            bgcolor: 'action.hover',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack spacing={1.5}>
            {ORG_ROLES.map((role) => (
              <Box key={role}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  {role}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {ROLE_DESCRIPTIONS[role]}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/settings/users')}
          >
            Back
          </Button>
          <Stack direction="row" spacing={1}>
            <Button type="reset" variant="text">
              Reset
            </Button>
            <Button
              type="submit"
              variant="contained"
              size="large"
              loading={isSubmitting}
              disabled={formState.values.roles.length === 0}
              sx={{
                '&.Mui-disabled': {
                  color: 'action.disabled',
                },
              }}
            >
              {submitButtonLabel}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
