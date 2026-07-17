import { Stack, Title, Tabs } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProductsTab from './ProductsTab';
import PricingTab from './PricingTab';

// Two tabs rather than one screen: managing the catalog (what exists) and managing default pricing
// (what each product costs per subscription type) are different jobs done at different times, and
// the pricing matrix needs the full width. Same Tabs + ?tab= URL persistence pattern as AdminPage.
//
// There's no Categories tab - categories are a fixed four-value set (CATEGORIES in
// server/utils/constants.js), picked from a dropdown when creating a product, not a CRUD list.
export default function ProductsPage() {
  const { user } = useAuth();
  const canEdit = user.editModules?.includes('products');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = ['catalog', 'pricing'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'catalog';

  return (
    <Stack>
      <Title order={1} size="h3">Products</Title>

      <Tabs value={activeTab} onChange={(v) => setSearchParams({ tab: v }, { replace: true })}>
        <Tabs.List>
          <Tabs.Tab value="catalog">Catalog</Tabs.Tab>
          <Tabs.Tab value="pricing">Pricing</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="catalog" pt="md">
          <ProductsTab canEdit={canEdit} />
        </Tabs.Panel>
        <Tabs.Panel value="pricing" pt="md">
          <PricingTab canEdit={canEdit} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
