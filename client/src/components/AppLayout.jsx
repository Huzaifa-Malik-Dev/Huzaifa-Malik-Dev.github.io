import { AppShell, Group, Text, NavLink, Avatar, Menu, UnstyledButton, Badge, Box, ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ChevronDown, Menu as MenuIcon, Sun, Moon, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAV_ITEMS, ROLE_LABELS } from '../constants/nav';
import NotificationBell from './NotificationBell';
import ProfileModal from './ProfileModal';
import { useNotificationToasts } from '../hooks/useNotificationToasts';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [profileOpened, { open: openProfile, close: closeProfile }] = useDisclosure(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');
  useNotificationToasts();

  const visibleNav = NAV_ITEMS.filter((item) => user.modules.includes(item.key));

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 244, breakpoint: 'sm', collapsed: { mobile: !mobileOpened, desktop: !desktopOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <UnstyledButton onClick={() => { toggleMobile(); toggleDesktop(); }} aria-label="Toggle navigation menu">
              <MenuIcon size={20} />
            </UnstyledButton>
            <Group gap={8} wrap="nowrap">
              <img src="/logo-mark.png" alt="" width={28} height={28} style={{ display: 'block', objectFit: 'contain' }} />
              <Text fw={700} size="lg" visibleFrom="xs">Digitalcoo CRM</Text>
            </Group>
          </Group>
          <Group gap="md">
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle color scheme"
            >
              {computedColorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </ActionIcon>
            <NotificationBell />
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="xs">
                    <Avatar radius="xl" size={32} color="blue">{user.name[0]}</Avatar>
                    <Box visibleFrom="xs">
                      <Text size="sm" fw={600}>{user.name}</Text>
                      <Badge size="xs" variant="light">{ROLE_LABELS[user.role]}</Badge>
                    </Box>
                    <ChevronDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<UserCog size={14} />} onClick={openProfile}>
                  My Profile
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<LogOut size={14} />} onClick={() => { logout(); navigate('/login'); }}>
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <ProfileModal opened={profileOpened} onClose={closeProfile} />

      <AppShell.Navbar p="sm">
        {visibleNav.map((item) => (
          <NavLink
            key={item.key}
            label={item.label}
            leftSection={<item.icon size={18} />}
            active={location.pathname === item.path || location.pathname.startsWith(item.path + '/')}
            onClick={() => navigate(item.path)}
            variant="filled"
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
