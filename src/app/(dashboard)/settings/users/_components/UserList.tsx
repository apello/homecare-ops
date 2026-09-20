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
import CircularProgress from '@mui/material/CircularProgress';
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridPaginationModel,
  gridClasses,
} from '@mui/x-data-grid';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRouter } from 'next/navigation';
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs';
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications';
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer';
import useServerPagination from '@/components/shared/useServerPagination';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import type { OrgMemberListItem, OrgMemberListPage } from '@/types';
import { listMembersAction, suspendMemberAction, unsuspendMemberAction, revokeMemberAction } from '../actions';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default'> = {
  Active: 'success',
  Suspended: 'warning',
  Revoked: 'default',
};

export interface UserListProps {
  orgId: string;
  currentUserId: string;
  initialPage: OrgMemberListPage;
  initialPaginationModel: GridPaginationModel;
}

export default function UserList({
  orgId,
  currentUserId,
  initialPage,
  initialPaginationModel,
}: UserListProps) {
  const router = useRouter();
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const [isMutating, setIsMutating] = React.useState(false);

  const {
    rows: members,
    rowCount,
    paginationModel,
    isLoading: isFetching,
    error,
    onPaginationModelChange,
    reload,
  } = useServerPagination<OrgMemberListItem, Record<string, never>>({
    initialPage,
    initialPaginationModel,
    initialFilters: {},
    errorMessage: 'Failed to load members.',
    fetchPage: (model) =>
      listMembersAction(orgId, {
        page: model.page,
        pageSize: model.pageSize,
      }),
  });

  const isLoading = isFetching || isMutating;

  const handleRefresh = React.useCallback(() => {
    if (!isLoading) reload();
  }, [isLoading, reload]);

  const handleCreateClick = () => router.push('/settings/users/invite');

  const handleRowEdit = React.useCallback(
    (member: OrgMemberListItem) => () => {
      router.push(`/settings/users/${member.id}/edit`);
    },
    [router],
  );

  const handleRowSuspend = React.useCallback(
    (member: OrgMemberListItem) => async () => {
      const fullName =
        `${member.profile?.first_name ?? ''} ${member.profile?.last_name ?? ''}`.trim() || 'this user';

      const confirmed = await dialogs.confirm(`Suspend ${fullName}?`, {
        title: 'Suspend member?',
        severity: 'warning',
        okText: 'Suspend',
      });

      if (!confirmed) return;

      setIsMutating(true);

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

        reload();
      } finally {
        setIsMutating(false);
      }
    },
    [dialogs, notifications, orgId, reload],
  );

  const handleRowUnsuspend = React.useCallback(
    (member: OrgMemberListItem) => async () => {
      const fullName =
        `${member.profile?.first_name ?? ''} ${member.profile?.last_name ?? ''}`.trim() || 'this user';

      const confirmed = await dialogs.confirm(`Unsuspend ${fullName}?`, {
        title: 'Unsuspend member?',
        severity: 'info',
        okText: 'Unsuspend',
      });

      if (!confirmed) return;

      setIsMutating(true);

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

        reload();
      } finally {
        setIsMutating(false);
      }
    },
    [dialogs, notifications, orgId, reload],
  );

  const handleRowRevoke = React.useCallback(
    (member: OrgMemberListItem) => async () => {
      const fullName =
        `${member.profile?.first_name ?? ''} ${member.profile?.last_name ?? ''}`.trim() || 'this user';
      const confirmed = await dialogs.confirm(`Revoke access for ${fullName}? This cannot be undone.`, {
        title: 'Revoke access?',
        severity: 'error',
        okText: 'Revoke',
      });
      if (!confirmed) return;

      setIsMutating(true);
      const result = await revokeMemberAction({ organizationId: orgId, membershipId: member.id });
      setIsMutating(false);

      if (!result.success) {
        notifications.show(result.error, { severity: 'error', autoHideDuration: 4000 });
        return;
      }
      notifications.show('Access revoked.', { severity: 'success', autoHideDuration: 3000 });
      reload();
    },
    [dialogs, notifications, orgId, reload],
  );

  const columns = React.useMemo<GridColDef<OrgMemberListItem>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 160,
        valueGetter: (_value, row) => {
          const name = `${row.profile?.first_name ?? ''} ${row.profile?.last_name ?? ''}`.trim() || '—';
          return row.user_id === currentUserId ? `${name} (You)` : name;
        },
      },
      {
        field: 'roles',
        headerName: 'Roles',
        flex: 1,
        minWidth: 200,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, padding: 0.5, alignItems: 'center', height: '100%', overflowY: 'auto' }}>
            {(params.value as string[])?.map((role: string) => (
              <Chip key={role} label={role} size="small" />
            ))}
          </Box>
        ),
      },
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
              label={isCurrentUser ? 'You cannot edit yourself' : 'Edit'}
              onClick={handleRowEdit(row)}
              disabled={isCurrentUser}

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
    [currentUserId, handleRowEdit, handleRowRevoke, handleRowUnsuspend, handleRowSuspend],
  );

  return (
    <PageContainer
      title="Users"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},{ title: 'Settings' }, { title: 'Users' }]}
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Tooltip title="Reload data" placement="right" enterDelay={1000}>
            <div>
              <IconButton size="small" aria-label="refresh" onClick={handleRefresh} disabled={isLoading}>
                {isLoading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
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
            disableRowSelectionOnClick
            showToolbar
            paginationMode="server"
            rowCount={rowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={onPaginationModelChange}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            sx={{
              opacity: isLoading ? 0.5 : 1,
              transition: 'opacity 0.2s',
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
