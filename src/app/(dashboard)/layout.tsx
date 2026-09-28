import DashboardFrame from './DashboardFrame';
import SessionWatcher from '@/components/SessionWatcher';
import { getActiveMembership } from '@/lib/auth/server';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const membership = await getActiveMembership();

  return (
    <>
      <SessionWatcher />
      <DashboardFrame roles={membership?.roles ?? []}>{children}</DashboardFrame>
    </>
  );
}