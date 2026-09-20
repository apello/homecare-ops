import DashboardFrame from './DashboardFrame';
import SessionWatcher from '@/components/SessionWatcher';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionWatcher />
      <DashboardFrame>{children}</DashboardFrame>
    </>
  );
}