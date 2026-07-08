'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  gridClasses,
} from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplayIcon from '@mui/icons-material/Replay';
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs';
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications';
import type { PendingInvite } from '@/types';
import { listPendingInvitesAction, deleteInviteAction, resendInviteAction } from '../actions';

export interface InviteListProps {
  orgId: string;
  initialInvites: PendingInvite[];
}

export default function InviteList({ orgId, initialInvites }: InviteListProps) {
  const dialogs = useDialogs();
  const notifications = useNotifications();

  const [invites, setInvites] = React.useState<PendingInvite[]>(initialInvites);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const loadData = React.useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await listPendingInvitesAction(orgId);
      if (!result.success) throw new Error(result.error ?? 'Failed to load pending invites.');
      setInvites(result.data ?? []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  const handleResend = React.useCallback(
    (invite: PendingInvite) => async () => {

      const confirmed = await dialogs.confirm(
      `Resending includes deleting current invitation for ${invite.email}? This cannot be undone.`,
      { title: 'Resend invitation?', severity: 'error', okText: 'Resend' },
    );
    if (!confirmed) return;

      setIsLoading(true);
      const result = await resendInviteAction({ organizationId: orgId, userId: invite.user_id, email: invite.email, roles: invite.roles });
      setIsLoading(false);

      if (!result.success) {
        notifications.show(result.error ?? 'Failed to resend invitation.', { severity: 'error', autoHideDuration: 4000 });
        return;
      }
      notifications.show('Invitation resent.', { severity: 'success', autoHideDuration: 3000 });
      await loadData();
    },
    [dialogs, orgId, notifications, loadData],
  );

  const handleDelete = React.useCallback(
    (invite: PendingInvite) => async () => {
      const confirmed = await dialogs.confirm(
        `Delete invitation for ${invite.email}? This cannot be undone.`,
        { title: 'Delete invitation?', severity: 'error', okText: 'Delete' },
      );
      if (!confirmed) return;

      setIsLoading(true);
      const result = await deleteInviteAction({ organizationId: orgId, userId: invite.user_id });
      setIsLoading(false);

      if (!result.success) {
        notifications.show(result.error ?? 'Failed to delete invitation.', { severity: 'error', autoHideDuration: 4000 });
        return;
      }
      notifications.show('Invitation deleted.', { severity: 'success', autoHideDuration: 3000 });
      await loadData();
    },
    [orgId, dialogs, notifications, loadData],
  );

  const columns = React.useMemo<GridColDef<PendingInvite>[]>(
    () => [
      {
        field: 'email',
        headerName: 'Email',
        flex: 1,
        minWidth: 300,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
            {params.value}
          </Box>
        ),
      },
      {
        field: 'roles',
        headerName: 'Roles',
        flex: 1,
        minWidth: 200,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', height: '100%', width: '100%' }}>
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
        renderCell: () => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
            <Chip label="Pending" color="warning" size="small" variant="outlined" />
          </Box>
        ),
      },
      {
        field: 'invited_at',
        headerName: 'Invited',
        width: 140,
        type: 'date',
        valueGetter: (_value, row) => (row.invited_at ? new Date(row.invited_at) : null),
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
            {params.value ? params.value.toLocaleDateString() : '—'}
          </Box>
        ),
      },
      {
        field: 'actions',
        type: 'actions',
        width: 100,
        align: 'right',
        cellClassName: 'actions-cell',
        getActions: ({ row }) => [
          <GridActionsCellItem
            key="resend"
            icon={<ReplayIcon />}
            label="Resend invitation"
            title="Resend invitation"
            onClick={handleResend(row)}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete invitation"
            title="Delete invitation"
            onClick={handleDelete(row)}
          />,
        ],
      },
    ],
    [handleResend, handleDelete],
  );

  if (invites.length === 0 && !error) return null;

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Pending invitations
      </Typography>
      {error ? (
        <Alert severity="error">{error.message}</Alert>
      ) : (
        <DataGrid
          rows={invites}
          getRowId={(row) => row.invite_id}
          columns={columns}
          getRowHeight={() => 'auto'}
          rowMinHeight={52}
          disableRowSelectionOnClick
          hideFooter={invites.length <= 10}
          sx={{
            opacity: isLoading ? 0.5 : 1,
            transition: 'opacity 0.2s',
            [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: { outline: 'transparent' },
            [`& .${gridClasses.columnHeader}:focus-within, & .${gridClasses.cell}:focus-within`]: {
              outline: 'none',
            },
            '& .actions-cell': { paddingY: .4 },
          }}
        />
      )}
    </Box>
  );
}
