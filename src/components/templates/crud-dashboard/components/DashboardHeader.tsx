// src/components/templates/crud-dashboard/components/DashboardHeader.tsx
'use client';
import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import MuiAppBar from '@mui/material/AppBar';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import HelpIcon from '@mui/icons-material/Help';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type { OrgRole } from '@/types';
import ThemeSwitcher from './ThemeSwitcher';

const AppBar = styled(MuiAppBar)(({ theme }) => ({
  borderWidth: 0,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  borderColor: (theme.vars ?? theme).palette.divider,
  boxShadow: 'none',
  zIndex: theme.zIndex.drawer + 1,
}));

const LogoContainer = styled('div')({
  position: 'relative',
  height: 40,
  display: 'flex',
  alignItems: 'center',
  '& img': { maxHeight: 40 },
});

export interface DashboardHeaderProps {
  logo?: React.ReactNode;
  title?: string;
  roles: OrgRole[];
  menuOpen: boolean;
  onToggleMenu: (open: boolean) => void;
}

export default function DashboardHeader({
  logo,
  roles,
  menuOpen,
  onToggleMenu,
}: DashboardHeaderProps) {
  const handleMenuOpen = React.useCallback(
    () => onToggleMenu(!menuOpen),
    [menuOpen, onToggleMenu],
  );

  const getMenuIcon = React.useCallback(
    (isExpanded: boolean) => {
      const expandText = 'Expand';
      const collapseText = 'Collapse';
      return (
        <Tooltip title={`${isExpanded ? collapseText : expandText} menu`} enterDelay={1000}>
          <div>
            <IconButton
              size="small"
              aria-label={`${isExpanded ? collapseText : expandText} navigation menu`}
              onClick={handleMenuOpen}
            >
              {isExpanded ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </div>
        </Tooltip>
      );
    },
    [handleMenuOpen],
  );

  const modeLabel =
    roles.length === 0 ? 'No view assigned' : roles.length === 1 ? `${roles[0]} view` : 'Multi-role view';
  const modeDescription =
    roles.length === 0
      ? 'No organization view assigned'
      : roles.length === 1
        ? modeLabel
        : `Views: ${roles.join(', ')}`;

  return (
    <AppBar color="inherit" position="absolute" sx={{ displayPrint: 'none' }}>
      <Toolbar sx={{ backgroundColor: 'inherit', mx: { xs: -0.75, sm: -1 } }}>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}
        >
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Box sx={{ mr: 1 }}>{getMenuIcon(menuOpen)}</Box>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                {logo ? <LogoContainer>{logo}</LogoContainer> : null}
              </Stack>
            </Link>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', marginLeft: 'auto' }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
              <Tooltip title={modeDescription} enterDelay={1000}>
                <ButtonBase
                  aria-label={modeDescription}
                  sx={{
                    alignItems: 'center',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    display: 'flex',
                    minHeight: 35,
                    px: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    },
                    gap: .5
                  }}
                >
                  <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                    {modeLabel}
                  </Typography>
                  <HelpIcon sx={{ fontSize: 16, ml: 0.5 }} />
                </ButtonBase>
              </Tooltip>
              <Tooltip title="Notifications" enterDelay={1000}>
                <IconButton size="small" aria-label="Notifications">
                  <NotificationsNoneIcon />
                </IconButton>
              </Tooltip>
              <ThemeSwitcher />
            </Stack>
          </Stack>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}