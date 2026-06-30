// src/app/(dashboard)/layout.tsx
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardLayout from '@/components/templates/crud-dashboard/components/DashboardLayout';
import NotificationsProvider from '@/components/templates/crud-dashboard/hooks/useNotifications/NotificationsProvider';
import DialogsProvider from '@/components/templates/crud-dashboard/hooks/useDialogs/DialogsProvider';
import type { NavigationItem } from '@/components/templates/crud-dashboard/navigation';

const navigation: NavigationItem[] = [
  { kind: 'header', title: 'Navigation' },
  { kind: 'page', id: 'link', title: 'Home', icon: <HomeIcon />, href: '/dashboard' },
  { kind: 'header', title: 'Settings' },
  { kind: 'page', id: 'user-settings', title: 'Users', icon: <PersonIcon />, href: '/settings/users' },
  { kind: 'page', id: 'logout', title: 'Logout', icon: <LogoutIcon />, href: '/logout' },
  // append new entities here: { kind: 'page', id: 'patients', title: 'Patients', href: '/patients' }, etc.
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider>
      <DialogsProvider>
        <DashboardLayout navigation={navigation}>
          {children}
        </DashboardLayout>
      </DialogsProvider>
    </NotificationsProvider>
  );
}