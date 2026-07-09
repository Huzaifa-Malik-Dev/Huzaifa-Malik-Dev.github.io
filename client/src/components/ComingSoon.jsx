import { Center, Stack, Title, Text } from '@mantine/core';

export default function ComingSoon({ label }) {
  return (
    <Center h="60vh">
      <Stack align="center" gap={4}>
        <Title order={3}>{label}</Title>
        <Text c="dimmed">This module is built next.</Text>
      </Stack>
    </Center>
  );
}
