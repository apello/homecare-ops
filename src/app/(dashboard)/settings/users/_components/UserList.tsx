// src/app/(dashboard)/settings/users/_components/UserList.tsx
'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  gridClasses,
} from '@mui/x-data-grid';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs';
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications';
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer';
import type { OrgMemberWithProfile } from '@/lib/services/users.service'; // adjust if this lives elsewhere
import { listMembersAction, suspendMemberAction, unsuspendMemberAction, revokeMemberAction } from '../actions';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default'> = {
  Active: 'success',
  Suspended: 'warning',
  Revoked: 'default',
};

export interface UserListProps {
  orgId: string;
  currentUserId: string;
  initialMembers: OrgMemberWithProfile[];
}

export default function UserList({ orgId, currentUserId, initialMembers }: UserListProps) {
  const dialogs = useDialogs();
  const notifications = useNotifications();

  const [members, setMembers] = React.useState<OrgMemberWithProfile[]>(initialMembers);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const loadData = React.useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await listMembersAction(orgId);

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to load members.');
      }

      setMembers(result.data ?? []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) loadData();
  }, [isLoading, loadData]);

  // const handleCreateClick = React.useCallback(async () => {
  //   const created = await dialogs.open(InviteUserDialog, { orgId });
  //   if (created) loadData();
  // }, [dialogs, orgId, loadData]);

  // const handleRowEdit = React.useCallback(
  //   (member: OrgMemberWithProfile) => async () => {
  //     const updated = await dialogs.open(EditMemberDialog, { orgId, member });
  //     if (updated) loadData();
  //   },
  //   [dialogs, orgId, loadData],
  // );

  const handleCreateClick = () => alert("Not implemented yet");

  const handleRowEdit = () => alert("Not implemented yet");

  const handleRowSuspend = React.useCallback(
    (member: OrgMemberWithProfile) => async () => {
      const fullName =
        `${member.profile?.first_name ?? ''} ${member.profile?.last_name ?? ''}`.trim() || 'this user';

      const confirmed = await dialogs.confirm(`Suspend ${fullName}?`, {
        title: 'Suspend member?',
        severity: 'warning',
        okText: 'Suspend',
      });

      if (!confirmed) return;

      setIsLoading(true);

      try {
        const result = await suspendMemberAction({
          organizationId: orgId,
          membershipId: member.id,
        });

        if (!result.success) {
          notifications.show(result.error, {
            severity: 'error',
            autoHideDuration: 4000,
          });
          return;
        }

        notifications.show('Member suspended.', {
          severity: 'success',
          autoHideDuration: 3000,
        });

        await loadData();
      } finally {
        setIsLoading(false);
      }
    },
    [dialogs, notifications, orgId, loadData],
  );

  const handleRowUnsuspend = React.useCallback(
    (member: OrgMemberWithProfile) => async () => {
      const fullName =
        `${member.profile?.first_name ?? ''} ${member.profile?.last_name ?? ''}`.trim() || 'this user';

      const confirmed = await dialogs.confirm(`Unsuspend ${fullName}?`, {
        title: 'Unsuspend member?',
        severity: 'info',
        okText: 'Unsuspend',
      });

      if (!confirmed) return;

      setIsLoading(true);

      try {
        const result = await unsuspendMemberAction({
          organizationId: orgId,
          membershipId: member.id,
        });

        if (!result.success) {
          notifications.show(result.error, {
            severity: 'error',
            autoHideDuration: 4000,
          });
          return;
        }

        notifications.show('Member unsuspended.', {
          severity: 'success',
          autoHideDuration: 3000,
        });

        await loadData();
      } finally {
        setIsLoading(false);
      }
    },
    [dialogs, notifications, orgId, loadData],
  );

  const handleRowRevoke = React.useCallback(
    (member: OrgMemberWithProfile) => async () => {
      const fullName =
        `${member.profile?.first_name ?? ''} ${member.profile?.last_name ?? ''}`.trim() || 'this user';
      const confirmed = await dialogs.confirm(`Revoke access for ${fullName}? This cannot be undone.`, {
        title: 'Revoke access?',
        severity: 'error',
        okText: 'Revoke',
      });
      if (!confirmed) return;

      setIsLoading(true);
      const result = await revokeMemberAction({ organizationId: orgId, membershipId: member.id });
      setIsLoading(false);

      if (!result.success) {
        notifications.show(result.error, { severity: 'error', autoHideDuration: 4000 });
        return;
      }
      notifications.show('Access revoked.', { severity: 'success', autoHideDuration: 3000 });
      loadData();
    },
    [dialogs, notifications, orgId, loadData],
  );
  // TODO: Add a tool tip explaining actions or disabled icons
  const columns = React.useMemo<GridColDef<OrgMemberWithProfile>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 160,
        valueGetter: (_value, row) =>
          `${row.profile?.first_name ?? ''} ${row.profile?.last_name ?? ''}`.trim() || '—',
      },
      { field: 'role', headerName: 'Role', width: 200 },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        renderCell: (params) => (
          <Chip
            label={params.value}
            color={STATUS_COLOR[params.value as string] ?? 'default'}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'joined_at',
        headerName: 'Joined',
        width: 140,
        type: 'date',
        valueGetter: (_value, row) => (row.joined_at ? new Date(row.joined_at) : null),
      },
     {
        field: 'actions',
        type: 'actions',
        width: 150,
        align: 'right',
        getActions: ({ row }) => {
          const isCurrentUser = row.user_id === currentUserId;

          const actions = [
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label="Edit"
              onClick={handleRowEdit}
            />,
          ];

          if (row.status === 'Suspended') {
            actions.push(
              <GridActionsCellItem
                key="unsuspend"
                icon={<CheckCircleIcon />}
                label={isCurrentUser ? 'You cannot unsuspend yourself' : 'Unsuspend'}
                onClick={handleRowUnsuspend(row)}
                disabled={isCurrentUser}
              />,
            );
          } else if (row.status === 'Active') {
            actions.push(
              <GridActionsCellItem
                key="suspend"
                icon={<BlockIcon />}
                label={isCurrentUser ? 'You cannot suspend yourself' : 'Suspend'}
                onClick={handleRowSuspend(row)}
                disabled={isCurrentUser}
              />,
            );
          }

          actions.push(
            <GridActionsCellItem
              key="revoke"
              icon={<DeleteIcon />}
              label={isCurrentUser ? 'You cannot revoke yourself' : 'Revoke'}
              onClick={handleRowRevoke(row)}
              disabled={isCurrentUser}
            />,
          );

          return actions;
        },
      }
    ],
    [currentUserId, handleRowRevoke, handleRowUnsuspend, handleRowSuspend],
  );

  return (
    <PageContainer
      title="Users"
      breadcrumbs={[{ title: 'Settings' }, { title: 'Users' }]}
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Tooltip title="Reload data" placement="right" enterDelay={1000}>
            <div>
              <IconButton size="small" aria-label="refresh" onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </div>
          </Tooltip>
          <Button variant="contained" onClick={handleCreateClick} startIcon={<AddIcon />}>
            Invite user
          </Button>
        </Stack>
      }
    >
      <Box sx={{ flex: 1, width: '100%' }}>
        {error ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <DataGrid
            rows={members}
            getRowId={(row) => row.id}
            columns={columns}
            loading={isLoading}
            disableRowSelectionOnClick
            showToolbar
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[5, 10, 25]}
            sx={{
              [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: { outline: 'transparent' },
              [`& .${gridClasses.columnHeader}:focus-within, & .${gridClasses.cell}:focus-within`]: {
                outline: 'none',
              },
            }}
          />
        )}
      </Box>
    </PageContainer>
  );
}