import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ShoppingBag, Music, Users, Mail, Tag, TrendingUp, AlertCircle, Truck, Activity, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/format';
import { StatCard, SectionCard, Badge, EmptyState, LoadingRows } from '@/components/admin/ui';
import { deriveMissingMappingAlerts, sortAlerts, type AlertItem } from '@/lib/adminAlerts';

interface OverviewOrder {
  id: string;
  order_number: string;
  total: number;
  payment_status: string;
  fulfilment_status: string;
  email: string;
  created_at: string;
}

interface OverviewVariant {
  id: string;
  product_name: string;
  printful_sync_variant_id: number | null;
  stock: number;
}

interface ActivityEntry {
  type: 'order' | 'enquiry' | 'release';
  label: string;
  detail: string;
  date: string;
  link: string;
}

interface PopularProduct {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

export function AdminOverview() {
  const [stats, setStats] = useState({
    orders: 0, revenue: 0, pendingOrders: 0, products: 0, lowStock: 0,
    customers: 0, subscribers: 0, releases: 0, upcomingReleases: 0, enquiries: 0, campaigns: 0,
    paidUnfulfilled: 0, shipped: 0, cancelled: 0,
  });
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [popular, setPopular] = useState<PopularProduct[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [orders, products, variants, subs, releases, enquiries, campaigns, orderItems, unmappedVariants] = await Promise.all([
        supabase.from('orders').select('id, order_number, total, payment_status, fulfilment_status, email, created_at').order('created_at', { ascending: false }),
        supabase.from('products').select('id, status'),
        supabase.from('product_variants').select('id, stock'),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact' }).is('unsubscribed_at', null),
        supabase.from('music_releases').select('id, status, release_date'),
        supabase.from('contact_enquiries').select('id', { count: 'exact' }).eq('handled', false),
        supabase.from('campaigns').select('id', { count: 'exact' }).in('status', ['live', 'scheduled']),
        supabase.from('order_items').select('product_name, quantity, price'),
        supabase.from('product_variants').select('id, product_name:products(name), printful_sync_variant_id, stock'),
      ]);

      const orderRows = (orders.data ?? []) as OverviewOrder[];
      const paidOrders = orderRows.filter((o) => o.payment_status === 'paid');
      const pending = orderRows.filter((o) => o.fulfilment_status === 'unfulfilled' && o.payment_status === 'paid');
      const uniqueEmails = new Set(orderRows.map((o) => o.email));
      const upcoming = (releases.data ?? []).filter((r: { status: string }) => r.status === 'upcoming' || r.status === 'scheduled');

      setStats({
        orders: orderRows.length,
        revenue: paidOrders.reduce((sum, o) => sum + o.total, 0),
        pendingOrders: pending.length,
        products: (products.data ?? []).filter((p: { status: string }) => p.status === 'published').length,
        lowStock: (variants.data ?? []).filter((v: { stock: number }) => v.stock < 5).length,
        customers: uniqueEmails.size,
        subscribers: subs.count ?? 0,
        releases: (releases.data ?? []).filter((r: { status: string }) => r.status === 'published').length,
        upcomingReleases: upcoming.length,
        enquiries: enquiries.count ?? 0,
        campaigns: campaigns.count ?? 0,
        paidUnfulfilled: orderRows.filter((o) => o.payment_status === 'paid' && o.fulfilment_status === 'unfulfilled').length,
        shipped: orderRows.filter((o) => o.fulfilment_status === 'shipped').length,
        cancelled: orderRows.filter((o) => o.fulfilment_status === 'cancelled').length,
      });

      // Recent activity feed
      const entries: ActivityEntry[] = orderRows.slice(0, 5).map((o) => ({
        type: 'order' as const,
        label: o.order_number,
        detail: `${formatPrice(o.total)} — ${o.payment_status}`,
        date: o.created_at,
        link: `/admin/orders/${o.id}`,
      }));
      setActivity(entries);

      // Popular products by quantity
      const itemRows = (orderItems.data ?? []) as { product_name: string; quantity: number; price: number }[];
      const productMap = new Map<string, { quantity: number; revenue: number }>();
      for (const item of itemRows) {
        const existing = productMap.get(item.product_name) ?? { quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue += item.price * item.quantity;
        productMap.set(item.product_name, existing);
      }
      setPopular(
        Array.from(productMap.entries())
          .map(([name, v]) => ({ product_name: name, total_quantity: v.quantity, total_revenue: v.revenue }))
          .sort((a, b) => b.total_quantity - a.total_quantity)
          .slice(0, 5),
      );

      // Alerts from missing Printful mappings
      const variantRows = (unmappedVariants.data ?? []) as unknown as OverviewVariant[];
      const mappingAlerts = deriveMissingMappingAlerts(
        variantRows.map((v) => ({
          id: v.id,
          product_name: (v as unknown as { product_name: { name: string } | string }).product_name as unknown as string,
          size: '',
          color: '',
          printful_sync_variant_id: v.printful_sync_variant_id,
          stock: v.stock,
        })),
      );
      setAlerts(sortAlerts(mappingAlerts.slice(0, 5)));

      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4"><LoadingRows count={3} height="h-24" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>

      {/* Key metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ShoppingBag} label="Total Orders" value={stats.orders.toString()} link="/admin/orders" />
        <StatCard icon={TrendingUp} label="Revenue (Paid)" value={formatPrice(stats.revenue)} link="/admin/analytics" />
        <StatCard icon={Package} label="Awaiting Fulfilment" value={stats.paidUnfulfilled.toString()} link="/admin/orders" alert={stats.paidUnfulfilled > 0} />
        <StatCard icon={AlertCircle} label="Low Stock Items" value={stats.lowStock.toString()} link="/admin/inventory" alert={stats.lowStock > 0} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Package} label="Published Products" value={stats.products.toString()} link="/admin/products" />
        <StatCard icon={Users} label="Unique Customers" value={stats.customers.toString()} />
        <StatCard icon={Mail} label="Subscribers" value={stats.subscribers.toString()} link="/admin/newsletter" />
        <StatCard icon={Tag} label="Active Campaigns" value={stats.campaigns.toString()} link="/admin/campaigns" />
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <SectionCard title="Active Alerts" action={<Link to="/admin/alerts" className="text-xs text-accent hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></Link>} className="mb-6 border-amber-200">
          <div className="space-y-2">
            {alerts.map((a) => (
              <Link key={a.id} to={a.link} className="flex items-start gap-3 p-3 rounded border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.severity === 'critical' ? 'bg-red-500' : a.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-jet">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{a.detail}</p>
                </div>
                <Badge tone={a.severity === 'critical' ? 'danger' : 'warning'}>{a.category}</Badge>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Recent activity */}
        <SectionCard title="Recent Activity" action={<Link to="/admin/orders" className="text-xs text-accent hover:underline">All orders</Link>}>
          {activity.length === 0 ? (
            <EmptyState icon={Activity} title="No recent activity" desc="Orders and enquiries will appear here." />
          ) : (
            <div className="space-y-3">
              {activity.map((a, i) => (
                <Link key={i} to={a.link} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    {a.type === 'order' && <ShoppingBag size={14} className="text-slate-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-jet truncate">{a.label}</p>
                    <p className="text-xs text-slate-500">{a.detail}</p>
                  </div>
                  <p className="text-xs text-slate-400 shrink-0">{formatDate(a.date)}</p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Popular products */}
        <SectionCard title="Popular Products" action={<Link to="/admin/analytics" className="text-xs text-accent hover:underline">Full analytics</Link>}>
          {popular.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No sales data yet" desc="Product performance will appear here once orders come in." />
          ) : (
            <div className="space-y-3">
              {popular.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <span className="w-6 h-6 rounded bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-jet truncate">{p.product_name}</p>
                    <p className="text-xs text-slate-500">{p.total_quantity} sold</p>
                  </div>
                  <p className="text-sm font-semibold text-jet shrink-0">{formatPrice(p.total_revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Fulfilment breakdown */}
      <SectionCard title="Fulfilment Status" className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <FulfilmentStat label="Awaiting Fulfilment" value={stats.paidUnfulfilled} tone="warning" icon={Package} />
          <FulfilmentStat label="Shipped" value={stats.shipped} tone="success" icon={Truck} />
          <FulfilmentStat label="Cancelled" value={stats.cancelled} tone="danger" icon={AlertCircle} />
          <FulfilmentStat label="Upcoming Releases" value={stats.upcomingReleases} tone="info" icon={Music} />
        </div>
      </SectionCard>

      {/* Getting started */}
      <SectionCard title="Getting Started">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <GettingStartedLink to="/admin/products/new" label="Add a product" desc="Create products with variants, images, and pricing" />
          <GettingStartedLink to="/admin/releases/new" label="Add a music release" desc="Upload artwork, tracklists, and streaming links" />
          <GettingStartedLink to="/admin/settings" label="Configure settings" desc="Set business name, contact email, social links" />
        </div>
      </SectionCard>
    </div>
  );
}

function FulfilmentStat({ label, value, tone, icon: Icon }: { label: string; value: number; tone: 'warning' | 'success' | 'danger' | 'info'; icon: typeof Package }) {
  const toneClasses: Record<string, string> = {
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <div className={`border rounded-lg p-4 ${toneClasses[tone]}`}>
      <Icon size={18} strokeWidth={1.5} className="mb-2" />
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

function GettingStartedLink({ to, label, desc }: { to: string; label: string; desc: string }) {
  return (
    <Link to={to} className="group border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
      <h3 className="text-sm font-semibold group-hover:text-accent">{label}</h3>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </Link>
  );
}
