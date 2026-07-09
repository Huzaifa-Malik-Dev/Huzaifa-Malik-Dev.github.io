import { Stack, Title } from '@mantine/core';
import PermissionsPage from './PermissionsPage';

// Account creation/roles/documents live in HR (one source of truth for "who exists and what can
// they do"). Admin/Settings is just the RBAC control panel - keeping Users here too was a second,
// identical view of the same employee list with no distinct purpose.
export default function AdminPage() {
  return (
    <Stack>
      <Title order={3}>Admin / Settings</Title>
      <PermissionsPage />
    </Stack>
  );
}
