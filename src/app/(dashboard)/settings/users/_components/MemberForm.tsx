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
import { ORG_ROLES, type OrgRole } from '@/types';

export interface MemberFormState {
  values: { roles: OrgRole[] };
  errors: { roles?: string };
}

export interface MemberFormProps {
  memberName: string;
  formState: MemberFormState;
  onRolesChange: (roles: OrgRole[]) => void;
  onSubmit: (values: MemberFormState['values']) => Promise<void>;
  onReset: () => void;
  submitButtonLabel?: string;
}

export default function MemberForm({
  memberName,
  formState,
  onRolesChange,
  onSubmit,
  onReset,
  submitButtonLabel = 'Save',
}: MemberFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
      sx={{ width: '100%', maxWidth: 480 }}
    >
      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Member
          </Typography>
          <Typography variant="body1" fontWeight={500}>
            {memberName}
          </Typography>
        </Box>

        <FormControl error={!!formState.errors.roles} fullWidth>
          <InputLabel id="member-roles-label">Roles</InputLabel>
          <Select
            labelId="member-roles-label"
            multiple
            value={formState.values.roles}
            onChange={handleRolesChange}
            input={<OutlinedInput label="Roles" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
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
          <FormHelperText>
            {formState.errors.roles ?? 'Multi-role assignment requires a future backend update.'}
          </FormHelperText>
        </FormControl>

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
            >
              {submitButtonLabel}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
