import { Stack, Title, Tabs } from '@mantine/core';
import { useAuth } from '../../context/AuthContext';
import ProductsTab from './ProductsTab';
import SegmentsTab from './SegmentsTab';

export default function ProductsPage() {
  const { user } = useAuth();
  const canEdit = user.editModules?.includes('products');

  return (
    <Stack>
      <Title order={3}>Products & Segments</Title>

      <Tabs defaultValue="products">
        <Tabs.List>
          <Tabs.Tab value="products">Products</Tabs.Tab>
          <Tabs.Tab value="segments">Segments</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="products" pt="md">
          <ProductsTab canEdit={canEdit} />
        </Tabs.Panel>
        <Tabs.Panel value="segments" pt="md">
          <SegmentsTab canEdit={canEdit} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
