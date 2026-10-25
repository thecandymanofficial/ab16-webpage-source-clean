import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Badge, EmptyState, LoadingRows } from '@/components/admin/ui';

interface InventoryRow {
  id: string;
  size: string;
  color: string;
  stock: number;
  sku: string | null;
  printful_sync_variant_id: number | null;
  products: { name: string; slug: string } | null;
}

export function AdminInventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from('product_variants')
      .select('id, size, color, stock, sku, printful_sync_variant_id, products(name, slug)')
      .order('stock', { ascending: true });
    setRows((data ?? []) as InventoryRow[]);
    setLoading(false);
  };

  const updateStock = async (id: string, stock: number) => {
    await supabase.from('product_variants').update({ stock }).eq('id', id);
    setRows(rows.map((r) => r.id === id ? { ...r, stock } : r));
  };

  const unmappedCount = rows.filter((r) => r.printful_sync_variant_id === null).length;
  const lowStockCount = rows.filter((r) => r.stock < 5).length;

  if (loading) return <div className="space-y-2"><LoadingRows count={4} height="h-12" /></div>;

  return (
    <div>
      <PageHeader title="Inventory" subtitle={`${rows.length} variants`} />

      {/* Alert badges */}
      <div className="flex flex-wrap gap-3 mb-4">
        {unmappedCount > 0 && (
          <a href="/admin/printful" className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 hover:bg-amber-100 transition-colors">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {unmappedCount} variant{unmappedCount !== 1 ? 's' : ''} missing Printful mapping
          </a>
        )}
        {lowStockCount > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {lowStockCount} low stock item{lowStockCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Package} title="No inventory" desc="Product variants will appear here once products are created." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Variant</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">SKU</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Stock</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Printful ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-jet">{r.products?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.color} · {r.size}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{r.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      value={r.stock}
                      onChange={(e) => updateStock(r.id, parseInt(e.target.value || '0'))}
                      className={`w-20 text-center border px-2 py-1 rounded transition-colors ${r.stock < 5 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.printful_sync_variant_id ? (
                      <span className="font-mono text-xs text-slate-600">{r.printful_sync_variant_id}</span>
                    ) : (
                      <Badge tone="warning">Missing</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
