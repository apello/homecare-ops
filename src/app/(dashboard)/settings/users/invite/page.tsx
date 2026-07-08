import { redirect } from 'next/navigation';
import { requireAuth, getActiveMembership } from '@/lib/auth/server';
import { hasPermission } from '@/lib/permissions';
import { listPendingInvites } from '@/lib/services/users.service';
import UnauthorizedMessage from '@/components/UnauthorizedMessage';
import MemberInvite from '../_components/MemberInvite';

export default async function MemberInvitePage() {
  await requireAuth();
  const membership = await getActiveMembership();
  if (!membership) redirect('/login');

  const allowed = await hasPermission(membership.organization_id, 'users.manage');
  if (!allowed) return <UnauthorizedMessage />;

  const initialInvites = await listPendingInvites(membership.organization_id);
  return (
    <MemberInvite
      orgId={membership.organization_id}
      initialInvites={initialInvites}
    />
  );
}
