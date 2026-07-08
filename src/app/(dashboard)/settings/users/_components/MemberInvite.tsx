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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/navigation';
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications';
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer';
import { ORG_ROLES, type OrgRole, type PendingInvite } from '@/types';
import { inviteMemberAction, listPendingInvitesAction } from '../actions';
import InviteList from './InviteList';

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  'Agency Administrator':
    'Manages agency users, roles, patient records, authorizations, organization services, approved service rates, and financial overrides. May view caregiver pay rates and payer reimbursement rates. Cannot access another agency.',
  'Scheduler':
    'Creates shifts, runs matching, reviews operational eligibility and rate compatibility, records call-offs, manages replacement outreach, and confirms standard assignments. Cannot manage users or approve financial or clinical overrides.',
  'Clinical Manager':
    'Reviews clinical requirements, restrictions, caregiver credentials, skills, and cases requiring clinical approval. Does not receive compensation access unless separately granted.',
  'HR Coordinator':
    'Creates and maintains caregiver employment records, credentials, background-check status, availability, service eligibility, and caregiver compensation rates. Receives only the patient information necessary for workforce eligibility tasks.',
  'Compliance Administrator':
    'Reviews audit events, disclosures, exports, overrides, call-offs, uncovered shifts, quality events, corrective actions, and privacy requests. Primarily read-only for operational records. Not for MVP, but for future use with privacy management in mind.',
};

interface FormState {
  email: string;
  roles: OrgRole[];
  errors: { email?: string; roles?: string };
}

export interface MemberInviteProps {
  orgId: string;
  initialInvites: PendingInvite[];
}

export default function MemberInvite({ orgId, initialInvites }: MemberInviteProps) {
  const router = useRouter();
  const notifications = useNotifications();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [invites, setInvites] = React.useState<PendingInvite[]>(initialInvites);

  const [formState, setFormState] = React.useState<FormState>({
    email: '',
    roles: [],
    errors: {},
  });

  const handleEmailChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, email: e.target.value, errors: { ...prev.errors, email: undefined } }));
  }, []);

  const handleRolesChange = React.useCallback((event: SelectChangeEvent<OrgRole[]>) => {
    const value = event.target.value;
    const roles = typeof value === 'string' ? [value as OrgRole] : (value as OrgRole[]);
    setFormState((prev) => ({ ...prev, roles, errors: { ...prev.errors, roles: undefined } }));
  }, []);

  const handleReset = React.useCallback(() => {
    setFormState({ email: '', roles: [], errors: {} });
  }, []);

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);

      try {
        const result = await inviteMemberAction({
          organizationId: orgId,
          email: formState.email,
          roles: formState.roles,
        });

        if (!result.success) {
          if (result.fieldErrors) {
            setFormState((prev) => ({
              ...prev,
              errors: {
                email: result.fieldErrors?.email?.[0],
                roles: result.fieldErrors?.roles?.[0],
              },
            }));
            return;
          }
          notifications.show(result.error ?? 'Failed to send invitation.', {
            severity: 'error',
            autoHideDuration: 4000,
          });
          return;
        }

        notifications.show('Invitation sent.', { severity: 'success', autoHideDuration: 3000 });
        handleReset();
        // Refresh invite list
        const listResult = await listPendingInvitesAction(orgId);
        if (listResult.success) setInvites(listResult.data ?? []);
      } finally {
        setIsSubmitting(false);
      }
    },
    [orgId, formState.email, formState.roles, notifications, handleReset],
  );

  return (
    <PageContainer
      title="Invite User"
      breadcrumbs={[
        { title: 'Settings' },
        { title: 'Users', path: '/settings/users' },
        { title: 'Invite' },
      ]}
    >
      <Stack spacing={4} sx={{ width: '100%', flex: 1 }}>
        <Box
          component="form"
          onSubmit={handleSubmit}
          noValidate
          autoComplete="off"
          sx={{ width: '100%' }}
        >
        <Stack spacing={3}>
          <TextField
            label="Email address"
            type="email"
            value={formState.email}
            onChange={handleEmailChange}
            error={!!formState.errors.email}
            helperText={formState.errors.email}
            fullWidth
            required
          />

          <FormControl error={!!formState.errors.roles} fullWidth>
            <InputLabel id="invite-roles-label">Roles</InputLabel>
            <Select
              labelId="invite-roles-label"
              multiple
              value={formState.roles}
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

          <InviteList orgId={orgId} initialInvites={invites} key={invites.length} />

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
              <Button type="reset" variant="text" onClick={handleReset}>
                Reset
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="large"
                loading={isSubmitting}
                disabled={formState.roles.length === 0 || !formState.email}
              >
                Send invitation
              </Button>
            </Stack>
          </Stack>
        </Stack>
        </Box>
                    </Stack>
    </PageContainer>
  );
}
