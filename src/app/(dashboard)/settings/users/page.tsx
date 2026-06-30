import { redirect } from 'next/navigation';
import { requireAuth, getActiveMembership } from '@/lib/auth/server';
import { hasPermission } from '@/lib/permissions';
import { listOrgMembers } from '@/lib/services/users.service';
import UnauthorizedMessage from '@/components/UnauthorizedMessage';
import UserList from './_components/UserList';

export default async function UsersPage() {
  const user = await requireAuth();
  const membership = await getActiveMembership();
  if (!membership) redirect('/login');

  const allowed = await hasPermission(membership.organization_id, 'users.manage');
  if (!allowed) {
    return <UnauthorizedMessage />;
  }

  const initialMembers = await listOrgMembers(membership.organization_id);
  return (
    <UserList
      orgId={membership.organization_id}
      currentUserId={user.id}
      initialMembers={initialMembers}
    />
  );
}