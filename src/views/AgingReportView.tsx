import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type Customer } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Clock, Search, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

type AgingBucket = {
  customer: Customer;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
  invoices: { invoice_number: string; total: number; date: string; days: number; remaining: number }[];
};

export default function AgingReportView({ branchId }: { branchId: string }) {
  const [buckets, setBuckets] = useState<AgingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .gt('balance', 0)
      .order('name');

    if (!customers || customers.length === 0) {
      setBuckets([]);
      setLoading(false);
      return;
    }

    const customerIds = customers.map((c) => c.id);
    const { data: creditSales } = await supabase
      .from('sales')
      .select('*')
      .eq('branch_id', branchId)
      .eq('sale_type', 'credito')
      .eq('payment_method', 'Pendiente')
      .in('customer_id', customerIds)
      .order('created_at');

    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .in('customer_id', customerIds);

    const now = new Date();
    const result: AgingBucket[] = [];

    for (const customer of customers as Customer[]) {
      const custSales = (creditSales ?? []).filter((s) => s.customer_id === customer.id);
      const custPayments = (payments ?? []).filter((p) => p.customer_id === customer.id);

      const paymentsBySale = new Map<string, number>();
      custPayments.forEach((p: any) => {
        if (p.sale_id) {
          paymentsBySale.set(p.sale_id, (paymentsBySale.get(p.sale_id) ?? 0) + (p.amount ?? 0));
        }
      });

      let current = 0, days30 = 0, days60 = 0, days90 = 0, over90 = 0;
      const invoices: AgingBucket['invoices'] = [];

      for (const sale of custSales) {
        const paid = paymentsBySale.get(sale.id) ?? 0;
        const remaining = sale.total - paid;
        if (remaining <= 0) continue;

        const saleDate = new Date(sale.created_at);
        const diffDays = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) current += remaining;
        else if (diffDays <= 60) days30 += remaining;
        else if (diffDays <= 90) days60 += remaining;
        else if (diffDays <= 120) days90 += remaining;
        else over90 += remaining;

        invoices.push({
          invoice_number: sale.invoice_number ?? '—',
          total: sale.total,
          date: new Date(sale.created_at).toLocaleDateString(),
          days: diffDays,
          remaining,
        });
      }

      const total = current + days30 + days60 + days90 + over90;
      if (total > 0) {
        result.push({ customer, current, days30, days60, days90, over90, total, invoices });
      }
    }

    result.sort((a, b) => b.total - a.total);
    setBuckets(result);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buckets;
    return buckets.filter((b) => b.customer.name.toLowerCase().includes(q));
  }, [buckets, search]);

  const totals = useMemo(() => {
    return buckets.reduce(
      (acc, b) => ({
        current: acc.current + b.current,
        days30: acc.days30 + b.days30,
        days60: acc.days60 + b.days60,
        days90: acc.days90 + b.days90,
        over90: acc.over90 + b.over90,
        total: acc.total + b.total,
      }),
      { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 }
    );
  }, [buckets]);

  function exportToExcel() {
    const rows = buckets.map((b) => ({
      Cliente: b.customer.name,
      'Corriente (0-30)': b.current,
      '31-60 dias': b.days30,
      '61-90 dias': b.days60,
      '91-120 dias': b.days90,
      'Mas de 120': b.over90,
      Total: b.total,
    }));
    rows.push({
      Cliente: 'TOTAL',
      'Corriente (0-30)': totals.current,
      '31-60 dias': totals.days30,
      '61-90 dias': totals.days60,
      '91-120 dias': totals.days90,
      'Mas de 120': totals.over90,
      Total: totals.total,
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Antiguedad');
    XLSX.writeFile(wb, `antiguedad_cuentas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Antiguedad de Cuentas</h2>
            <p className="text-sm text-slate-500">{buckets.length} clientes con saldo pendiente</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-48 rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <BucketCard label="Corriente (0-30)" amount={totals.current} color="green" />
        <BucketCard label="31-60 dias" amount={totals.days30} color="amber" />
        <BucketCard label="61-90 dias" amount={totals.days60} color="orange" />
        <BucketCard label="91-120 dias" amount={totals.days90} color="red" />
        <BucketCard label="Mas de 120" amount={totals.over90} color="darkred" />
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 text-left font-semibold">Cliente</th>
              <th className="px-3 py-3 text-right font-semibold">Corriente</th>
              <th className="px-3 py-3 text-right font-semibold">31-60</th>
              <th className="px-3 py-3 text-right font-semibold">61-90</th>
              <th className="px-3 py-3 text-right font-semibold">91-120</th>
              <th className="px-3 py-3 text-right font-semibold">+120</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No hay cuentas pendientes
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr key={b.customer.id} className="border-b border-slate-100 hover:bg-blue-50/30">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{b.customer.name}</p>
                    <p className="text-xs text-slate-400">{b.invoices.length} facturas pendientes</p>
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-700">
                    {b.current > 0 ? formatCurrency(b.current) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={b.days30 > 0 ? 'font-medium text-amber-600' : 'text-slate-400'}>
                      {b.days30 > 0 ? formatCurrency(b.days30) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={b.days60 > 0 ? 'font-medium text-orange-600' : 'text-slate-400'}>
                      {b.days60 > 0 ? formatCurrency(b.days60) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={b.days90 > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}>
                      {b.days90 > 0 ? formatCurrency(b.days90) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={b.over90 > 0 ? 'font-bold text-red-700' : 'text-slate-400'}>
                      {b.over90 > 0 ? formatCurrency(b.over90) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                    {formatCurrency(b.total)}
                  </td>
                </tr>
              ))
            )}
            {filtered.length > 0 && (
              <tr className="bg-slate-50 font-bold">
                <td className="px-4 py-3 text-slate-700">TOTAL</td>
                <td className="px-3 py-3 text-right text-slate-700">{formatCurrency(totals.current)}</td>
                <td className="px-3 py-3 text-right text-amber-600">{formatCurrency(totals.days30)}</td>
                <td className="px-3 py-3 text-right text-orange-600">{formatCurrency(totals.days60)}</td>
                <td className="px-3 py-3 text-right text-red-600">{formatCurrency(totals.days90)}</td>
                <td className="px-3 py-3 text-right text-red-700">{formatCurrency(totals.over90)}</td>
                <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(totals.total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BucketCard({ label, amount, color }: { label: string; amount: number; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'border-green-200 bg-green-50',
    amber: 'border-amber-200 bg-amber-50',
    orange: 'border-orange-200 bg-orange-50',
    red: 'border-red-200 bg-red-50',
    darkred: 'border-red-300 bg-red-100',
  };
  const textClasses: Record<string, string> = {
    green: 'text-green-700',
    amber: 'text-amber-700',
    orange: 'text-orange-700',
    red: 'text-red-700',
    darkred: 'text-red-800',
  };
  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <p className="text-[10px] font-medium text-slate-500 uppercase">{label}</p>
      <p className={`mt-1 text-sm font-bold ${textClasses[color]}`}>{formatCurrency(amount)}</p>
    </div>
  );
}
