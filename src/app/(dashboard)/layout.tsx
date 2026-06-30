import DashboardFrame from './DashboardFrame';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardFrame>{children}</DashboardFrame>;
}