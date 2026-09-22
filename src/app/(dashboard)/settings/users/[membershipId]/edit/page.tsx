import { redirect } from 'next/navigation';
import { requireAuth, getActiveMembership } from '@/lib/auth/server';
import { hasPermission } from '@/lib/permissions';
import { getMemberAction } from '../../actions';
import UnauthorizedMessage from '@/components/UnauthorizedMessage';
import MemberEdit from '../../_components/MemberEdit';

interface PageProps {
  params: Promise<{ membershipId: string }>;
}

export default async function MemberEditPage({ params }: PageProps) {
  const { membershipId } = await params;

  await requireAuth();
  const membership = await getActiveMembership();
  if (!membership) redirect('/login');

  const allowed = await hasPermission(membership.organization_id, 'users.manage');
  if (!allowed) return <UnauthorizedMessage />;

  const result = await getMemberAction(membership.organization_id, membershipId);

  return (
    <MemberEdit
      member={result.data ?? null}
      orgId={membership.organization_id}
    />
  );
}
