import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/format';
import { PageHeader, SearchInput, Badge, EmptyState, LoadingRows } from '@/components/admin/ui';
import type { Product } from '@/types';

export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data, error } = await supabase.from('products').select('*, product_variants(*)').order('created_at', { ascending: false });
    if (error) {
      setDeleteError(`Failed to load products: ${error.message}`);
    } else {
      setProducts(data as Product[] ?? []);
    }
    setLoading(false);
  };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setDeleteError(`Failed to delete product: ${error.message}`);
    } else {
      load();
    }
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    const { error } = await supabase.from('products').update({ available_for_sale: !current }).eq('id', id);
    if (error) {
      setDeleteError(`Failed to update availability: ${error.message}`);
    } else {
      setProducts(products.map((p) => p.id === id ? { ...p, available_for_sale: !current } : p));
    }
  };

  return (
    <div>
      <PageHeader title="Products" subtitle={`${products.length} total`} action={<Link to="/admin/products/new" className="btn-primary"><Plus size={16} /> New Product</Link>} />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products..." />
      </div>

      {deleteError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {deleteError}
          <button onClick={() => setDeleteError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <LoadingRows count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No products found" action={<Link to="/admin/products/new" className="btn-primary">Create your first product</Link>} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Name</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Price</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Stock</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">For Sale</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stock = p.product_variants?.reduce((s, v) => s + v.stock, 0) ?? 0;
                return (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-jet">{p.name}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3 text-center">{stock}</td>
                    <td className="px-4 py-3 text-center"><Badge tone={p.status === 'published' ? 'success' : 'neutral'}>{p.status}</Badge></td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleAvailability(p.id, p.available_for_sale)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${p.available_for_sale ? 'bg-green-500' : 'bg-slate-300'}`}
                        title={p.available_for_sale ? 'Available — click to disable' : 'Unavailable — click to enable'}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${p.available_for_sale ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/products/${p.id}`} className="inline-flex p-1.5 hover:bg-slate-200 rounded" title="Edit"><Pencil size={14} /></Link>
                      <button onClick={() => deleteProduct(p.id)} className="inline-flex p-1.5 hover:bg-red-100 rounded text-red-500 ml-1" title="Delete"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
