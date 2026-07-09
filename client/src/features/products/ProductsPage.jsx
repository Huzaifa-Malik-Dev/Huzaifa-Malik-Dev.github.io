import { Stack, Title, Tabs, Text } from '@mantine/core';
import { useAuth } from '../../context/AuthContext';
import ProductsTab from './ProductsTab';
import SegmentsTab from './SegmentsTab';

export default function ProductsPage() {
  const { user } = useAuth();
  const canEdit = user.editModules?.includes('products');

  const tabs = [
    { value: 'products', label: 'Products', permKey: 'products.products' },
    { value: 'segments', label: 'Segments', permKey: 'products.segments' },
  ].filter((t) => user.modules?.includes(t.permKey));

  return (
    <Stack>
      <Title order={3}>Products & Segments</Title>

      {tabs.length === 0 ? (
        <Text c="dimmed" size="sm">You don't have access to any Products sections.</Text>
      ) : (
        <Tabs defaultValue={tabs[0].value}>
          <Tabs.List>
            {tabs.map((t) => <Tabs.Tab key={t.value} value={t.value}>{t.label}</Tabs.Tab>)}
          </Tabs.List>

          {tabs.some((t) => t.value === 'products') && (
            <Tabs.Panel value="products" pt="md">
              <ProductsTab canEdit={canEdit} />
            </Tabs.Panel>
          )}
          {tabs.some((t) => t.value === 'segments') && (
            <Tabs.Panel value="segments" pt="md">
              <SegmentsTab canEdit={canEdit} />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </Stack>
  );
}
