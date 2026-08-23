import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import {
  TrendingUp,
  Package,
  DollarSign,
  ShoppingCart,
  Users,
  Calendar,
  BarChart3,
  Loader2,
} from 'lucide-react';

type SaleRow = {
  id: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  sale_type: string;
  created_at: string;
  customer_name: string | null;
};

type SaleItemRow = {
  part_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  sale_id: string;
};

type PeriodOption = '7d' | '30d' | '90d' | '365d';

export default function StatsView({ branchId }: { branchId: string }) {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodOption>('30d');

  const dateFrom = useMemo(() => {
    const d = new Date();
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00-05:00`;
  }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: salesData } = await supabase
      .from('sales')
      .select('id, total, subtotal, tax_amount, sale_type, created_at, customer_name')
      .eq('branch_id', branchId)
      .neq('sale_type', 'Cotizacion')
      .gte('created_at', dateFrom)
      .order('created_at', { ascending: false });

    const saleIds = (salesData ?? []).map((s) => s.id);

    let itemsData: SaleItemRow[] = [];
    if (saleIds.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < saleIds.length; i += batchSize) {
        const batch = saleIds.slice(i, i + batchSize);
        const { data } = await supabase
          .from('sale_items')
          .select('part_name, quantity, unit_price, subtotal, sale_id')
          .in('sale_id', batch);
        if (data) itemsData = itemsData.concat(data as SaleItemRow[]);
      }
    }

    setSales((salesData ?? []) as SaleRow[]);
    setSaleItems(itemsData);
    setLoading(false);
  }, [branchId, dateFrom]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((s, r) => s + r.total, 0);
    const totalTransactions = sales.length;
    const avgTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const creditSales = sales.filter((s) => s.sale_type === 'Credito');
    const cashSales = sales.filter((s) => s.sale_type === 'Contado');
    const creditTotal = creditSales.reduce((s, r) => s + r.total, 0);
    const cashTotal = cashSales.reduce((s, r) => s + r.total, 0);
    const totalItems = saleItems.reduce((s, i) => s + i.quantity, 0);

    const uniqueCustomers = new Set(
      sales.filter((s) => s.customer_name).map((s) => s.customer_name)
    ).size;

    return { totalRevenue, totalTransactions, avgTicket, creditTotal, cashTotal, totalItems, uniqueCustomers };
  }, [sales, saleItems]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    saleItems.forEach((item) => {
      const existing = map.get(item.part_name) ?? { qty: 0, revenue: 0 };
      existing.qty += item.quantity;
      existing.revenue += item.subtotal;
      map.set(item.part_name, existing);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [saleItems]);

  const topByRevenue = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    saleItems.forEach((item) => {
      const existing = map.get(item.part_name) ?? { qty: 0, revenue: 0 };
      existing.qty += item.quantity;
      existing.revenue += item.subtotal;
      map.set(item.part_name, existing);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [saleItems]);

  const dailySales = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    sales.forEach((s) => {
      const day = s.created_at.slice(0, 10);
      const existing = map.get(day) ?? { count: 0, total: 0 };
      existing.count++;
      existing.total += s.total;
      map.set(day, existing);
    });
    return Array.from(map.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => {
      const name = s.customer_name || 'Publico General';
      map.set(name, (map.get(name) ?? 0) + s.total);
    });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [sales]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const maxDaily = Math.max(...dailySales.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-800">Estadisticas</h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {([['7d', '7 dias'], ['30d', '30 dias'], ['90d', '90 dias'], ['365d', '1 ano']] as [PeriodOption, string][]).map(
            ([val, label]) => (
              <button
                key={val}
                onClick={() => setPeriod(val)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === val ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Ingresos" value={formatCurrency(stats.totalRevenue)} color="green" />
        <KpiCard icon={<ShoppingCart className="h-4 w-4" />} label="Transacciones" value={String(stats.totalTransactions)} color="blue" />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Ticket Promedio" value={formatCurrency(stats.avgTicket)} color="amber" />
        <KpiCard icon={<Users className="h-4 w-4" />} label="Clientes" value={String(stats.uniqueCustomers)} color="slate" />
      </div>

      {/* Revenue split */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Ventas Contado</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(stats.cashTotal)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{sales.filter(s => s.sale_type === 'contado').length} facturas</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Ventas Credito</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(stats.creditTotal)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{sales.filter(s => s.sale_type === 'credito').length} facturas</p>
        </div>
      </div>

      {/* Daily sales chart (bar chart with CSS) */}
      {dailySales.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-semibold text-slate-700">Ventas por Dia</p>
          </div>
          <div className="flex items-end gap-[2px] h-32 overflow-x-auto">
            {dailySales.slice(-60).map((d) => (
              <div key={d.date} className="flex flex-col items-center flex-1 min-w-[4px] group relative">
                <div
                  className="w-full min-w-[4px] rounded-t bg-blue-500 transition-colors hover:bg-blue-600"
                  style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: '2px' }}
                  title={`${d.date}: ${formatCurrency(d.total)} (${d.count} ventas)`}
                />
                <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white shadow">
                  {d.date}: {formatCurrency(d.total)}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-400">
            <span>{dailySales[Math.max(0, dailySales.length - 60)]?.date}</span>
            <span>{dailySales[dailySales.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Top products and customers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Top by quantity */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-blue-500" />
            <p className="text-sm font-semibold text-slate-700">Top Productos (Cantidad)</p>
          </div>
          <div className="space-y-2">
            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400">Sin datos</p>
            ) : (
              topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <p className="flex-1 truncate text-xs text-slate-700">{p.name}</p>
                  <span className="text-xs font-semibold text-slate-800">{p.qty}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top by revenue */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-green-500" />
            <p className="text-sm font-semibold text-slate-700">Top Productos (Ingresos)</p>
          </div>
          <div className="space-y-2">
            {topByRevenue.length === 0 ? (
              <p className="text-xs text-slate-400">Sin datos</p>
            ) : (
              topByRevenue.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <p className="flex-1 truncate text-xs text-slate-700">{p.name}</p>
                  <span className="text-xs font-semibold text-green-700">{formatCurrency(p.revenue)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top customers */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-slate-700">Top Clientes</p>
          </div>
          <div className="space-y-2">
            {topCustomers.length === 0 ? (
              <p className="text-xs text-slate-400">Sin datos</p>
            ) : (
              topCustomers.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <p className="flex-1 truncate text-xs text-slate-700">{c.name}</p>
                  <span className="text-xs font-semibold text-slate-800">{formatCurrency(c.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Items sold */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">Total de articulos vendidos en el periodo</p>
        <p className="text-2xl font-bold text-slate-800">{stats.totalItems.toLocaleString()}</p>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'green' | 'blue' | 'amber' | 'slate';
}) {
  const colors = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-800">{value}</p>
    </div>
  );
}
