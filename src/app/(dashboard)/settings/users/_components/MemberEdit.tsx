'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { useRouter } from 'next/navigation';
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications';
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer';
import type { OrgMemberWithProfile } from '@/lib/services/users.service';
import type { OrgRole } from '@/types';
import { setRolesAction } from '../actions';
import MemberForm, { type MemberFormState } from './MemberForm';

interface MemberEditFormProps {
  member: OrgMemberWithProfile;
  orgId: string;
}

function MemberEditForm({ member, orgId }: MemberEditFormProps) {
  const router = useRouter();
  const notifications = useNotifications();

  const initialRoles = React.useMemo<OrgRole[]>(
    () => member.roles ?? [],
    [member.roles],
  );

  const [formState, setFormState] = React.useState<MemberFormState>({
    values: { roles: initialRoles },
    errors: {},
  });

  const handleRolesChange = React.useCallback((roles: OrgRole[]) => {
    setFormState((prev) => ({ ...prev, values: { roles }, errors: {} }));
  }, []);

  const handleReset = React.useCallback(() => {
    setFormState({ values: { roles: initialRoles }, errors: {} });
  }, [initialRoles]);

  const handleSubmit = React.useCallback(
    async (values: MemberFormState['values']) => {
      if (values.roles.length === 0) {
        setFormState((prev) => ({ ...prev, errors: { roles: 'Select at least one role.' } }));
        return;
      }

      const result = await setRolesAction({
        organizationId: orgId,
        membershipId: member.id,
        roles: values.roles,
      });

      if (!result.success) {
        notifications.show(result.error ?? 'Failed to update role.', {
          severity: 'error',
          autoHideDuration: 4000,
        });
        return;
      }

      notifications.show('Role updated successfully.', {
        severity: 'success',
        autoHideDuration: 3000,
      });

      router.refresh();
    },
    [orgId, member.id, notifications, router],
  );

  const memberName =
    `${member.profile?.first_name ?? ''} ${member.profile?.last_name ?? ''}`.trim() || member.id;

  return (
    <MemberForm
      memberName={memberName}
      formState={formState}
      onRolesChange={handleRolesChange}
      onSubmit={handleSubmit}
      onReset={handleReset}
    />
  );
}

export interface MemberEditProps {
  member: OrgMemberWithProfile | null;
  orgId: string;
  membershipId: string;
}

export default function MemberEdit({ member, orgId, membershipId }: MemberEditProps) {
  return (
    <PageContainer
      title="Edit Member"
      breadcrumbs={[
        { title: 'Settings' },
        { title: 'Users', path: '/settings/users' },
        { title: 'Edit' },
      ]}
    >
      <Box sx={{ display: 'flex', flex: 1 }}>
        {!member ? (
          <Alert severity="error">Member not found.</Alert>
        ) : (
          <MemberEditForm member={member} orgId={orgId} />
        )}
      </Box>
    </PageContainer>
  );
}
