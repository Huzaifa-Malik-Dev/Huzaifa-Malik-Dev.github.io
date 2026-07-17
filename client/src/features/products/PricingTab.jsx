import { useMemo, useState } from 'react';
import { Group, Stack, NumberInput, Text, ActionIcon, Tooltip, Alert } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '../../utils/toast';
import { Check, Info } from 'lucide-react';
import DataTable from '../../components/DataTable';
import Tag from '../../components/Tag';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchProducts, updateProduct } from '../../api/products';
import { SR_TYPES } from '../../constants/pipeline';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}

// The default Unit Price for each (Product x Subscription Type) combination - what a deal's Unit
// Price prefills to when that pair is picked in the line-item editor. Always still editable on the
// deal itself; this is a starting point, not a locked rate.
//
// Laid out as a flat grid (one row per product, one editable cell per subscription type) rather
// than a modal-per-product: updating one rate is the common case, and SR_TYPES is a small fixed
// set, so the whole matrix fits as columns. Edits are staged locally and saved per-row, so a typo
// mid-edit doesn't fire a request on every keystroke.
export default function PricingTab({ canEdit }) {
  const queryClient = useQueryClient();
  const list = usePagedList(['products'], fetchProducts);
  // Keyed `${productId}:${subscriptionType}` -> price. Only holds cells the user has actually
  // touched; everything else renders straight from the saved product.
  const [pending, setPending] = useState({});
  const [saving, setSaving] = useState(null);

  const priceOf = (row, sr) => {
    const key = `${row._id}:${sr}`;
    if (key in pending) return pending[key];
    return row.pricing?.find((p) => p.subscriptionType === sr)?.defaultPrice ?? '';
  };

  const isDirty = (row) => SR_TYPES.some((sr) => `${row._id}:${sr}` in pending);

  const handleSave = async (row) => {
    setSaving(row._id);
    try {
      // Merge the touched cells into the product's existing presets rather than replacing the
      // array wholesale - editing one subscription type must never clear the others.
      const pricing = SR_TYPES.map((sr) => ({ subscriptionType: sr, defaultPrice: Number(priceOf(row, sr)) || 0 })).filter(
        (p) => p.defaultPrice > 0
      );
      await updateProduct(row._id, { pricing });
      setPending((prev) => {
        const next = { ...prev };
        SR_TYPES.forEach((sr) => delete next[`${row._id}:${sr}`]);
        return next;
      });
      notifications.show({ color: 'green', message: `Pricing saved for "${row.title}"` });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      list.refetch();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save pricing', message: err.response?.data?.error || 'Something went wrong' });
    } finally {
      setSaving(null);
    }
  };

  const columns = useMemo(
    () => [
      { accessorKey: 'title', header: 'Product' },
      { accessorKey: 'cat', header: 'Category', cell: (info) => <Tag>{info.getValue()}</Tag> },
      ...SR_TYPES.map((sr) => ({
        id: `price-${sr}`,
        header: sr,
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (!canEdit) {
            const v = priceOf(row, sr);
            return v === '' ? <Text size="sm" c="dimmed">—</Text> : <Text size="sm">{AED(v)}</Text>;
          }
          return (
            <NumberInput
              size="xs"
              w={110}
              min={0}
              placeholder="—"
              value={priceOf(row, sr)}
              onChange={(v) => setPending((prev) => ({ ...prev, [`${row._id}:${sr}`]: v }))}
              aria-label={`${sr} price for ${row.title}`}
            />
          );
        },
      })),
      ...(canEdit
        ? [
            {
              id: 'action',
              header: '',
              cell: (info) => {
                const row = info.row.original;
                if (!isDirty(row)) return null;
                return (
                  <Tooltip label="Save pricing for this product">
                    <ActionIcon
                      variant="filled"
                      color="green"
                      size="lg"
                      radius="md"
                      loading={saving === row._id}
                      onClick={() => handleSave(row)}
                      aria-label={`Save pricing for ${row.title}`}
                    >
                      <Check size={18} />
                    </ActionIcon>
                  </Tooltip>
                );
              },
            },
          ]
        : []),
    ],
    // `pending`/`saving` drive what each cell renders, so the columns must rebuild when they change.
    [canEdit, pending, saving]
  );

  return (
    <Stack gap="md">
      <Alert color="blue" variant="light" icon={<Info size={16} />}>
        These are default prices — when someone picks this product and subscription type on a deal, the Unit Price
        starts here. They can always change it on the deal itself. Leave a cell blank for no default.
      </Alert>

      <DataTable
        columns={columns}
        data={list.data}
        totalRowCount={list.totalRowCount}
        page={list.page}
        limit={list.limit}
        onPageChange={list.onPageChange}
        search={list.search}
        onSearchChange={list.onSearchChange}
        sorting={list.sorting}
        onSortingChange={list.onSortingChange}
        isLoading={list.isLoading}
        emptyLabel="No products in the catalog yet — add one on the Products tab first"
      />
    </Stack>
  );
}
