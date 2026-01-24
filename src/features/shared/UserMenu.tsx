'use client';

import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Avatar,
  Typography,
  ListItemIcon,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import ManageAccountsSharpIcon from '@mui/icons-material/ManageAccountsSharp';
import LogoutIcon from '@mui/icons-material/Logout';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

const menu = [
  { name: 'common.settings', fallback: 'Settings', path: '/settings', icon: <ManageAccountsSharpIcon /> },
  { name: 'common.logout', fallback: 'Logout', action: 'logout', icon: <LogoutIcon /> },
];

export default function UserMenu() {
  const { t } = useI18n();
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const fallbackName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.username ||
    user?.emailAddresses[0]?.emailAddress ||
    t('common.user', 'Пользователь');
  const userEmail = user?.emailAddresses[0]?.emailAddress;

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleMenuClick = async (setting: (typeof menu)[0]) => {
    handleCloseUserMenu();
    if (setting.action === 'logout') {
      await signOut({ redirectUrl: withBasePath('/sign-in') });
    } else if (setting.path) {
      router.push(setting.path);
    }
  };

  return (
    <Box sx={{ flexGrow: 0 }}>
      <Tooltip title={t('menu.open', 'Open menu')}>
        <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
          <Avatar alt={fallbackName || t('common.user', 'User')} src={user?.imageUrl || ''} />
        </IconButton>
      </Tooltip>
      <Menu
        id='menu-appbar'
        anchorEl={anchorElUser}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
      >
        <Box sx={{ minWidth: 200, textAlign: 'center' }}>
          <Typography variant='button' margin='5px' fontWeight='bold'>
            {fallbackName}
          </Typography>
          <Typography fontSize='0.85rem' color='text.secondary'>
            {userEmail}
          </Typography>
          {menu.map((setting) => (
            <MenuItem
              key={setting.name}
              onClick={() => handleMenuClick(setting)}
            >
              <ListItemIcon>{setting.icon}</ListItemIcon>
              <Typography textAlign='center' fontSize='0.9rem'>
                {t(setting.name, setting.fallback)}
              </Typography>
            </MenuItem>
          ))}
        </Box>
      </Menu>
    </Box>
  );
}
