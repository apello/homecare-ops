import { redirect } from 'next/navigation';
import { requireAuth, getActiveMembership } from '@/lib/auth/server';
import { hasPermission } from '@/lib/permissions';
import { parsePaginationSearchParams } from '@/lib/pagination';
import { listOrgMembers } from '@/lib/services/users.service';
import UnauthorizedMessage from '@/components/UnauthorizedMessage';
import UserList from './_components/UserList';

interface UsersPageProps {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const user = await requireAuth();
  const membership = await getActiveMembership();
  if (!membership) redirect('/login');

  const allowed = await hasPermission(membership.organization_id, 'users.manage');
  if (!allowed) {
    return <UnauthorizedMessage />;
  }

  const paginationModel = parsePaginationSearchParams(await searchParams);
  const initialPage = await listOrgMembers(membership.organization_id, paginationModel);
  return (
    <UserList
      orgId={membership.organization_id}
      currentUserId={user.id}
      initialPage={initialPage}
      initialPaginationModel={paginationModel}
    />
  );
}