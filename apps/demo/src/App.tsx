import { Stack, Text, Title } from "@mantine/core";

export function App() {
  return (
    <Stack p="xl" maw={600}>
      <Title order={1}>EVE Online Tools</Title>
      <Text>Demo showcase for Mantine component packages.</Text>
      <Text size="sm" c="dimmed">
        Workspace utils: coming soon
      </Text>
    </Stack>
  );
}
