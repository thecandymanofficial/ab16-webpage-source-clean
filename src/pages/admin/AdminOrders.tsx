import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/format';
import { PageHeader, SearchInput, FilterSelect, Badge, EmptyState, LoadingRows } from '@/components/admin/ui';

interface OrderRow {
  id: string;
  order_number: string;
  email: string;
  total: number;
  payment_status: string;
  fulfilment_status: string | null;
  created_at: string;
  printful_orders: { status: string } | null;
}

export function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [fulfilmentFilter, setFulfilmentFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, email, total, payment_status, fulfilment_status, created_at, printful_orders(status)')
        .order('created_at', { ascending: false });
      setOrders((data ?? []) as OrderRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = orders.filter((o) => {
    const matchesSearch = o.order_number?.toLowerCase().includes(search.toLowerCase()) || o.email?.toLowerCase().includes(search.toLowerCase());
    const matchesPayment = paymentFilter === 'all' || o.payment_status === paymentFilter;
    const matchesFulfilment = fulfilmentFilter === 'all' || o.fulfilment_status === fulfilmentFilter;
    return matchesSearch && matchesPayment && matchesFulfilment;
  });

  return (
    <div>
      <PageHeader title="Orders" subtitle={`${orders.length} total`} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by order number or email..." />
        <FilterSelect
          value={paymentFilter}
          onChange={setPaymentFilter}
          options={[
            { value: 'all', label: 'All Payments' },
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
            { value: 'refunded', label: 'Refunded' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
        <FilterSelect
          value={fulfilmentFilter}
          onChange={setFulfilmentFilter}
          options={[
            { value: 'all', label: 'All Fulfilment' },
            { value: 'unfulfilled', label: 'Unfulfilled' },
            { value: 'fulfilled', label: 'Fulfilled' },
            { value: 'shipped', label: 'Shipped' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </div>

      {loading ? (
        <LoadingRows count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders found" desc="Orders will appear here once customers complete checkout." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Order</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Total</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Payment</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Fulfilment</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Printful</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3"><Link to={`/admin/orders/${o.id}`} className="font-mono text-xs font-medium text-accent hover:underline">{o.order_number}</Link></td>
                  <td className="px-4 py-3 text-slate-600">{o.email}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPrice(o.total)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={o.payment_status === 'paid' ? 'success' : o.payment_status === 'failed' ? 'danger' : 'warning'}>{o.payment_status}</Badge></td>
                  <td className="px-4 py-3 text-center"><Badge tone={o.fulfilment_status === 'shipped' ? 'success' : o.fulfilment_status === 'cancelled' ? 'danger' : 'neutral'}>{o.fulfilment_status ?? '—'}</Badge></td>
                  <td className="px-4 py-3 text-center">{o.printful_orders ? <Badge tone={o.printful_orders.status === 'shipped' ? 'success' : o.printful_orders.status === 'failed' ? 'danger' : 'info'}>{o.printful_orders.status}</Badge> : <span className="text-slate-300 text-xs">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
