import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type Sale, type Seller, type Payment } from '@/lib/supabase';
import { formatCurrency, formatDate, formatDateShort } from '@/lib/format';
import {
  BadgeDollarSign,
  TrendingUp,
  Percent,
  Wallet,
  Receipt,
  Printer,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type SaleWithSeller = Sale & {
  sellers: { name: string; seller_code: string; commission_rate: number } | null;
};

type SaleWithStatus = SaleWithSeller & {
  paidAmount: number;
  isFullyPaid: boolean;
  paidDate: string | null;
};

export default function CommissionsView({ branchId }: { branchId: string }) {
  const [sales, setSales] = useState<SaleWithSeller[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: sellerData, error: sellerErr } = await supabase
      .from('sellers')
      .select('*')
      .eq('branch_id', branchId)
      .order('name');
    if (sellerErr) {
      setError('Error al cargar vendedores: ' + sellerErr.message);
      setLoading(false);
      return;
    }
    if (sellerData) setSellers(sellerData as Seller[]);

    let query = supabase
      .from('sales')
      .select('*, sellers(name, seller_code, commission_rate)')
      .eq('branch_id', branchId)
      .neq('sale_type', 'Cotizacion')
      .order('created_at', { ascending: false });

    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);

    const { data, error: salesErr } = await query;
    if (salesErr) {
      setError('Error al cargar ventas: ' + salesErr.message);
      setLoading(false);
      return;
    }
    if (data) setSales(data as SaleWithSeller[]);

    // Load ALL payments (no date filter) so we correctly compute paid balance
    // for credit sales regardless of when the payment was recorded
    const { data: payData, error: payErr } = await supabase.from('payments').select('*').eq('branch_id', branchId);
    if (payErr) {
      setError('Error al cargar pagos: ' + payErr.message);
      setLoading(false);
      return;
    }
    if (payData) setPayments(payData as Payment[]);

    setLoading(false);
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  // Build sales with payment status
  // Payments in this system are linked to customer_id (not sale_id), so we
  // allocate total payments per customer across their credit sales (FIFO by date).
  const salesWithStatus = useMemo<SaleWithStatus[]>(() => {
    // Sum payments per customer (some payments might also have sale_id directly)
    const paymentsBySale = new Map<string, { total: number; lastDate: string }>();
    const paymentsByCustomer = new Map<string, { total: number; lastDate: string }>();

    for (const p of payments) {
      if (p.sale_id) {
        const existing = paymentsBySale.get(p.sale_id) ?? { total: 0, lastDate: '' };
        existing.total += Number(p.amount) || 0;
        if (p.created_at > existing.lastDate) existing.lastDate = p.created_at;
        paymentsBySale.set(p.sale_id, existing);
      }
      if (p.customer_id) {
        const existing = paymentsByCustomer.get(p.customer_id) ?? { total: 0, lastDate: '' };
        existing.total += Number(p.amount) || 0;
        if (p.created_at > existing.lastDate) existing.lastDate = p.created_at;
        paymentsByCustomer.set(p.customer_id, existing);
      }
    }

    // For credit sales, allocate customer-level payments in FIFO order
    // Group credit sales by customer, sort by date, then mark as paid in order
    const creditSalesByCustomer = new Map<string, SaleWithSeller[]>();
    for (const sale of sales) {
      if (sale.sale_type !== 'Credito' || !sale.customer_id) continue;
      const list = creditSalesByCustomer.get(sale.customer_id) ?? [];
      list.push(sale);
      creditSalesByCustomer.set(sale.customer_id, list);
    }

    // Sort each customer's credit sales by date (oldest first)
    for (const list of creditSalesByCustomer.values()) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }

    // Allocate payments per customer across their credit sales (FIFO)
    const saleFullyPaid = new Map<string, { paid: boolean; date: string | null }>();
    for (const [customerId, customerSales] of creditSalesByCustomer.entries()) {
      let remaining = paymentsByCustomer.get(customerId)?.total ?? 0;
      const lastPayDate = paymentsByCustomer.get(customerId)?.lastDate ?? null;

      for (const sale of customerSales) {
        const saleTotal = Number(sale.total) || 0;
        // Also add any direct sale_id payments
        const directPay = paymentsBySale.get(sale.id)?.total ?? 0;
        const needed = saleTotal - directPay;

        if (needed <= 0) {
          saleFullyPaid.set(sale.id, { paid: true, date: paymentsBySale.get(sale.id)?.lastDate ?? null });
        } else if (remaining >= needed) {
          remaining -= needed;
          saleFullyPaid.set(sale.id, { paid: true, date: lastPayDate });
        } else {
          saleFullyPaid.set(sale.id, { paid: false, date: null });
          remaining = 0;
        }
      }
    }

    return sales.map((sale) => {
      const totalNum = Number(sale.total) || 0;
      if (sale.sale_type === 'Contado') {
        return { ...sale, paidAmount: totalNum, isFullyPaid: true, paidDate: null, total: totalNum };
      }
      const status = saleFullyPaid.get(sale.id);
      const directPay = paymentsBySale.get(sale.id)?.total ?? 0;
      return {
        ...sale,
        paidAmount: status?.paid ? totalNum : directPay,
        isFullyPaid: status?.paid ?? false,
        paidDate: status?.date ?? null,
        total: totalNum,
      };
    });
  }, [sales, payments]);

  // Commission-eligible: contado sales + crédito sales fully paid in the period
  // Include sales without a seller so they appear in the report (commission = 0)
  const commissionableSales = useMemo(
    () => salesWithStatus.filter((s) => s.isFullyPaid),
    [salesWithStatus],
  );

  const filteredCommissionable = useMemo(() => {
    if (!selectedSellerId) return commissionableSales;
    return commissionableSales.filter((s) => s.seller_id === selectedSellerId);
  }, [commissionableSales, selectedSellerId]);

  // Separate by type for display


  // Crédito pendiente (not fully paid) — shown for reference, no commission
  const creditoPendiente = useMemo(() => {
    const pend = salesWithStatus.filter((s) => !s.isFullyPaid && s.sale_type === 'Credito');
    if (!selectedSellerId) return pend;
    return pend.filter((s) => s.seller_id === selectedSellerId);
  }, [salesWithStatus, selectedSellerId]);

  const sellerCommissions = useMemo(() => {
    const map = new Map<
      string,
      {
        seller: Seller;
        saleCount: number;
        totalAmount: number;
        commission: number;
      }
    >();

    for (const sale of commissionableSales) {
      if (!sale.seller_id || !sale.sellers) continue;
      const seller = sellers.find((s) => s.id === sale.seller_id);
      if (!seller) continue;

      const existing = map.get(seller.id) ?? {
        seller,
        saleCount: 0,
        totalAmount: 0,
        commission: 0,
      };
      existing.saleCount++;
      const baseAmount = Number(sale.subtotal) || 0;
      existing.totalAmount += baseAmount;
      existing.commission += baseAmount * (Number(seller.commission_rate) || 0) / 100;
      map.set(seller.id, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.commission - a.commission);
  }, [commissionableSales, sellers]);

  const totalCommission = useMemo(
    () => sellerCommissions.reduce((s, c) => s + c.commission, 0),
    [sellerCommissions],
  );

  const totalCommissionableAmount = useMemo(
    () => commissionableSales.reduce((s, sale) => s + (Number(sale.subtotal) || 0), 0),
    [commissionableSales],
  );

  const totalPendienteAmount = useMemo(
    () => creditoPendiente.reduce((s, sale) => s + ((Number(sale.total) || 0) - sale.paidAmount), 0),
    [creditoPendiente],
  );

  // Count sales without a seller (for warning)
  const salesWithoutSeller = useMemo(
    () => commissionableSales.filter((s) => !s.seller_id).length,
    [commissionableSales],
  );

  // Check if any seller has 0% commission
  const hasZeroRateSellers = useMemo(
    () => sellerCommissions.some((c) => Number(c.seller.commission_rate) === 0),
    [sellerCommissions],
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-full flex-col bg-slate-100">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3.5 print:hidden">
        <div className="flex items-center gap-2.5">
          <BadgeDollarSign className="h-5 w-5 text-green-600" />
          <h1 className="text-lg font-bold text-slate-800">Comisiones</h1>
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
            Contado + Crédito Cobrado
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="text-xs text-slate-400">hasta</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select
            value={selectedSellerId}
            onChange={(e) => setSelectedSellerId(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todos los vendedores</option>
            {sellers
              .filter((s) => s.is_active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <button
            onClick={handlePrint}
            disabled={loading || commissionableSales.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Imprimir Reporte
          </button>
        </div>
      </div>

      {/* Warning banners */}
      {(salesWithoutSeller > 0 || hasZeroRateSellers) && (
        <div className="flex shrink-0 flex-col gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 print:hidden">
          {salesWithoutSeller > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {salesWithoutSeller} factura(s) sin vendedor asignado. Asigna un vendedor en Facturacion para que generen comisión.
              </span>
            </div>
          )}
          {hasZeroRateSellers && (
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Hay vendedores con tasa de comisión al 0%. Configura la tasa en Admin &gt; Vendedores.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid shrink-0 grid-cols-1 gap-3 border-b border-slate-200 bg-white px-6 py-3 sm:grid-cols-4 print:grid-cols-4 print:border-b-2">
        <SummaryCard
          icon={<Wallet className="h-5 w-5 text-green-600" />}
          label="Ventas Comisionables"
          value={formatCurrency(totalCommissionableAmount)}
          sub={`${commissionableSales.length} facturas`}
        />
        <SummaryCard
          icon={<BadgeDollarSign className="h-5 w-5 text-blue-600" />}
          label="Total Comisiones"
          value={formatCurrency(totalCommission)}
          sub={`${sellerCommissions.length} vendedores`}
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5 text-amber-600" />}
          label="Promedio por Vendedor"
          value={formatCurrency(sellerCommissions.length > 0 ? totalCommission / sellerCommissions.length : 0)}
          sub="comisión promedio"
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-red-500" />}
          label="Crédito Pendiente"
          value={formatCurrency(totalPendienteAmount)}
          sub={`${creditoPendiente.length} facturas sin cobrar`}
        />
      </div>

      {/* Body: two panels */}
      <div className="flex flex-1 gap-4 overflow-hidden p-6 print:block print:overflow-visible print:p-0">
        {/* Left: per-seller summary */}
        <div className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white print:w-full print:border-2 print:break-after-page">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Resumen por Vendedor</h2>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : error ? (
              <div className="flex h-32 flex-col items-center justify-center text-red-500">
                <BadgeDollarSign className="mb-2 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">Error</p>
                <p className="mt-1 px-4 text-center text-xs text-red-400">{error}</p>
              </div>
            ) : sellerCommissions.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-slate-400">
                <BadgeDollarSign className="mb-2 h-10 w-10 opacity-30" />
                <p className="text-sm">No hay comisiones en este período</p>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {sellerCommissions.map((c) => (
                  <div
                    key={c.seller.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      selectedSellerId === c.seller.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {c.seller.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{c.seller.name}</p>
                          <p className="text-xs text-slate-400">{c.seller.seller_code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5">
                        <Percent className="h-3 w-3 text-green-600" />
                        <span className="text-xs font-semibold text-green-700">
                          {Number(c.seller.commission_rate) || 0}%
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {c.saleCount} ventas · {formatCurrency(c.totalAmount)}
                      </span>
                      <span className="font-bold text-green-700">{formatCurrency(c.commission)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: detail sales grouped by month */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white print:flex-1 print:border-2 print:overflow-visible">
          <div className="flex-1 overflow-y-auto scrollbar-thin print:overflow-visible">
            <MonthAccordion sales={filteredCommissionable} loading={loading} />
          </div>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <PrintHeader
          dateFrom={dateFrom}
          dateTo={dateTo}
          sellerName={
            selectedSellerId
              ? sellers.find((s) => s.id === selectedSellerId)?.name ?? 'Todos'
              : 'Todos los vendedores'
          }
          totalCommission={totalCommission}
          totalAmount={totalCommissionableAmount}
        />
      </div>
    </div>
  );
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PAGE_SIZE = 20;

type MonthGroup = {
  key: string;
  label: string;
  sales: SaleWithStatus[];
  totalSales: number;
  totalCommission: number;
};

function MonthAccordion({ sales, loading }: { sales: SaleWithStatus[]; loading: boolean }) {
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState<Record<string, number>>({});

  const groups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, SaleWithStatus[]>();
    for (const sale of sales) {
      const d = new Date(sale.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      const list = map.get(key) ?? [];
      list.push(sale);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, monthSales]) => {
        const [year, monthIdx] = key.split('-');
        const totalSales = monthSales.reduce((s, sale) => s + (Number(sale.subtotal) || 0), 0);
        const totalCommission = monthSales.reduce(
          (s, sale) => s + (Number(sale.subtotal) || 0) * ((Number(sale.sellers?.commission_rate) || 0) / 100),
          0,
        );
        return {
          key,
          label: `${MONTH_NAMES[Number(monthIdx)]} ${year}`,
          sales: monthSales,
          totalSales,
          totalCommission,
        };
      });
  }, [sales]);

  // Auto-open first month
  useEffect(() => {
    if (groups.length > 0 && openMonths.size === 0) {
      setOpenMonths(new Set([groups[0].key]));
    }
  }, [groups]);

  const toggle = (key: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center text-slate-400">
        <Receipt className="mb-2 h-10 w-10 opacity-30" />
        <p className="text-sm">No hay facturas comisionables en este período</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200">
      {groups.map((group) => {
        const isOpen = openMonths.has(group.key);
        const page = pages[group.key] ?? 0;
        const totalPages = Math.ceil(group.sales.length / PAGE_SIZE);
        const pagedSales = group.sales.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

        return (
          <div key={group.key} className="print:break-inside-avoid">
            <button
              onClick={() => toggle(group.key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                />
                <span className="text-sm font-semibold text-slate-800">{group.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {group.sales.length} facturas
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500">
                  Total Ventas: <span className="font-semibold text-slate-700">{formatCurrency(group.totalSales)}</span>
                </span>
                <span className="text-slate-500">
                  Comisión: <span className="font-semibold text-green-700">{formatCurrency(group.totalCommission)}</span>
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100">
                <SalesTable sales={pagedSales} loading={false} emptyMessage="" />
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
                    <span className="text-xs text-slate-500">
                      Página {page + 1} de {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPages((p) => ({ ...p, [group.key]: Math.max(0, page - 1) }))}
                        disabled={page === 0}
                        className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPages((p) => ({ ...p, [group.key]: Math.min(totalPages - 1, page + 1) }))}
                        disabled={page >= totalPages - 1}
                        className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SalesTable({
  sales,
  loading,
  emptyMessage,
  showPaidDate,
  showBalance,
  dimmed,
}: {
  sales: SaleWithStatus[];
  loading: boolean;
  emptyMessage: string;
  showPaidDate?: boolean;
  showBalance?: boolean;
  dimmed?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }
  if (sales.length === 0 && !emptyMessage) return null;
  if (sales.length === 0) {
    return (
      <div className="flex h-20 flex-col items-center justify-center text-slate-400">
        <Receipt className="mb-1 h-8 w-8 opacity-30" />
        <p className="text-xs">{emptyMessage}</p>
      </div>
    );
  }

  const totalAmount = sales.reduce((s, sale) => s + (Number(sale.subtotal) || 0), 0);
  const totalCommission = sales.reduce(
    (s, sale) => s + (Number(sale.subtotal) || 0) * ((Number(sale.sellers?.commission_rate) || 0) / 100),
    0,
  );

  return (
    <div className={`${dimmed ? 'opacity-60' : ''}`}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-white shadow-sm">
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5 font-semibold">Folio</th>
            <th className="px-4 py-2.5 font-semibold">Fecha</th>
            <th className="px-4 py-2.5 font-semibold">Vendedor</th>
            <th className="px-4 py-2.5 font-semibold">Cliente</th>
            {showPaidDate && <th className="px-4 py-2.5 font-semibold">Cobrado</th>}
            {showBalance && <th className="px-4 py-2.5 text-right font-semibold">Pagado</th>}
            {showBalance && <th className="px-4 py-2.5 text-right font-semibold">Saldo</th>}
            <th className="px-4 py-2.5 text-right font-semibold">Monto</th>
            <th className="px-4 py-2.5 text-right font-semibold">Comisión</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const rate = Number(sale.sellers?.commission_rate) || 0;
            const commission = (Number(sale.subtotal) || 0) * (rate / 100);
            return (
              <tr
                key={sale.id}
                className="border-b border-slate-100 transition-colors hover:bg-blue-50/30"
              >
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                  {sale.invoice_number ?? sale.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {formatDate(sale.created_at)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                      {sale.sellers?.name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <span className="text-xs font-medium text-slate-700">
                      {sale.sellers?.name ?? 'Sin vendedor'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {sale.customer_name ?? 'Consumidor final'}
                </td>
                {showPaidDate && (
                  <td className="px-4 py-2.5 text-xs text-green-600">
                    {sale.paidDate ? formatDate(sale.paidDate) : '—'}
                  </td>
                )}
                {showBalance && (
                  <td className="px-4 py-2.5 text-right text-xs text-green-600">
                    {formatCurrency(sale.paidAmount)}
                  </td>
                )}
                {showBalance && (
                  <td className="px-4 py-2.5 text-right text-xs font-semibold text-red-500">
                    {formatCurrency((Number(sale.total) || 0) - sale.paidAmount)}
                  </td>
                )}
                <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                  {formatCurrency(Number(sale.total) || 0)}
                </td>
                <td className={`px-4 py-2.5 text-right font-semibold ${dimmed ? 'text-slate-400' : 'text-green-700'}`}>
                  {dimmed ? '—' : formatCurrency(commission)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50">
            <td
              colSpan={showPaidDate ? 5 : showBalance ? 6 : 4}
              className="px-4 py-2.5 text-right text-sm font-semibold text-slate-700"
            >
              Total
            </td>
            <td className="px-4 py-2.5 text-right font-bold text-slate-800">
              {formatCurrency(totalAmount)}
            </td>
            <td className={`px-4 py-2.5 text-right font-bold ${dimmed ? 'text-slate-400' : 'text-green-700'}`}>
              {dimmed ? '—' : formatCurrency(totalCommission)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 print:border-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 print:hidden">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

function PrintHeader({
  dateFrom,
  dateTo,
  sellerName,
  totalCommission,
  totalAmount,
}: {
  dateFrom: string;
  dateTo: string;
  sellerName: string;
  totalCommission: number;
  totalAmount: number;
}) {
  return (
    <div className="mb-6 border-b-2 border-slate-300 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reporte de Comisiones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Período: {formatDateShort(dateFrom)} al {formatDateShort(dateTo)}
          </p>
          <p className="text-sm text-slate-500">Vendedor: {sellerName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Comisionable</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(totalAmount)}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400 mt-2">Total Comisiones</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalCommission)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Incluye facturas al contado y facturas a crédito totalmente cobradas en el período.
        Las facturas a crédito pendientes no generan comisión.
      </p>
    </div>
  );
}
