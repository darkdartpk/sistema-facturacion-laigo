import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type Sale, type Seller, type Branch } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  Receipt, TrendingUp, Wallet, CreditCard, Store,
  Smartphone, FileText, FileMinus,
  DollarSign, BarChart3, PieChart, AlertTriangle, Printer,
  ArrowDownToLine, RefreshCw,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SaleWithCost = Sale & { seller_name?: string };

interface SalePaymentRow {
  sale_id: string;
  payment_method: string;
  amount: number;
}

interface SaleItemCost {
  quantity: number;
  parts: { cost: number } | null;
}

interface Payment {
  id: string;
  branch_id: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  created_at: string;
}

interface CreditNote {
  id: string;
  branch_id: string;
  subtotal: number;
  quantity: number;
  reason: string | null;
  resolution_type: string | null;
  created_at: string;
  parts: { name: string } | null;
  sales: {
    invoice_number: string | null;
    customer_name: string | null;
    sale_type: string;
    credit_status: string | null;
  } | null;
}

interface Expense {
  id: string;
  branch_id: string;
  description: string;
  total: number;
  invoice_number: string | null;
  created_at: string;
}

interface CustomerCredit {
  id: string;
  name: string;
  credit_balance: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

type DatePreset = 'today' | 'week' | 'month' | 'custom';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SalesReportView({ branches }: { branches: Branch[] }) {
  const [preset, setPreset] = useState<DatePreset>('today');
  const [startDate, setStartDate] = useState(getLocalDate);
  const [endDate, setEndDate] = useState(getLocalDate);
  const [sales, setSales] = useState<SaleWithCost[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [customerCredits, setCustomerCredits] = useState<CustomerCredit[]>([]);
  const [saleItemCosts, setSaleItemCosts] = useState<{ sale_id: string; items: SaleItemCost[] }[]>([]);
  const [salePayments, setSalePayments] = useState<SalePaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>(branches[0]?.id ?? '');

  function applyPreset(p: DatePreset) {
    setPreset(p);
    if (p === 'today') {
      setStartDate(getLocalDate());
      setEndDate(getLocalDate());
    } else if (p === 'week') {
      setStartDate(startOfWeek());
      setEndDate(getLocalDate());
    } else if (p === 'month') {
      setStartDate(startOfMonth());
      setEndDate(getLocalDate());
    }
  }

  const fetchSellers = useCallback(async () => {
    const { data } = await supabase.from('sellers').select('*');
    setSellers((data as Seller[]) ?? []);
  }, []);

  const fetchCustomerCredits = useCallback(async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, credit_balance')
      .gt('credit_balance', 0);
    setCustomerCredits((data as CustomerCredit[]) ?? []);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const start = `${startDate}T00:00:00-05:00`;
    const end = `${endDate}T23:59:59.999-05:00`;
    const [salesRes, paymentsRes, cnRes, expRes, costRes, spRes] = await Promise.all([
      supabase
        .from('sales')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false }),
      supabase
        .from('payments')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase
        .from('credit_notes')
        .select('id, branch_id, subtotal, quantity, reason, resolution_type, created_at, parts:part_id(name), sales:sale_id(invoice_number, customer_name, sale_type, credit_status)')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false }),
      supabase
        .from('sales')
        .select('id, sale_items(quantity, parts(cost))')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase
        .from('sale_payments')
        .select('sale_id, payment_method, amount')
        .gte('created_at', start)
        .lte('created_at', end),
    ]);
    setSales((salesRes.data as Sale[]) ?? []);
    setPayments((paymentsRes.data as Payment[]) ?? []);
    setCreditNotes((cnRes.data as unknown as CreditNote[]) ?? []);
    setExpenses((expRes.data as Expense[]) ?? []);
    const costData = (costRes.data ?? []) as unknown as { id: string; sale_items: SaleItemCost[] }[];
    setSaleItemCosts(costData.map((s) => ({ sale_id: s.id, items: s.sale_items ?? [] })));
    setSalePayments((spRes.data as SalePaymentRow[]) ?? []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchSellers(); fetchCustomerCredits(); }, [fetchSellers, fetchCustomerCredits]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const sellerName = (id: string | null) => sellers.find((s) => s.id === id)?.name ?? 'Sin vendedor';

  const enriched = useMemo(
    () => sales.map((s) => ({ ...s, seller_name: sellerName(s.seller_id) })),
    [sales, sellers],
  );

  const filtered = useMemo(
    () => {
      const nonQuotes = enriched.filter((s) => s.sale_type !== 'Cotizacion');
      return branchFilter ? nonQuotes.filter((s) => s.branch_id === branchFilter) : nonQuotes;
    },
    [enriched, branchFilter],
  );

  const filteredPayments = useMemo(
    () => (branchFilter ? payments.filter((p) => p.branch_id === branchFilter) : payments),
    [payments, branchFilter],
  );

  const filteredCreditNotes = useMemo(
    () => (branchFilter ? creditNotes.filter((cn) => cn.branch_id === branchFilter) : creditNotes),
    [creditNotes, branchFilter],
  );

  const filteredExpenses = useMemo(
    () => (branchFilter ? expenses.filter((e) => e.branch_id === branchFilter) : expenses),
    [expenses, branchFilter],
  );

  /* ---------- Metrics ---------- */

  const metrics = useMemo(() => {
    const grossSales = filtered.reduce((s, x) => s + x.total, 0);
    const filteredIds = new Set(filtered.map((s) => s.id));
    const totalCost = saleItemCosts
      .filter((s) => filteredIds.has(s.sale_id))
      .reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.quantity * (i.parts?.cost ?? 0), 0), 0);
    const totalTax = filtered.reduce((s, x) => s + x.tax_amount, 0);
    const creditNotesTotal = filteredCreditNotes.reduce((s, cn) => s + Number(cn.subtotal), 0);
    const netSales = grossSales - creditNotesTotal;
    const grossProfit = netSales - totalCost;
    const margin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const expensesTotal = filteredExpenses.reduce((s, e) => s + Number(e.total), 0);
    const netProfit = grossProfit - expensesTotal;

    // NC refunds: credit notes resolved as cash/card refund (not "Saldo a Favor")
    const ncRefunds: Record<string, number> = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Yappy: 0, Cheque: 0 };
    for (const cn of filteredCreditNotes) {
      const rt = cn.resolution_type ?? '';
      if (rt === 'Efectivo' || rt === 'Tarjeta' || rt === 'Transferencia' || rt === 'Yappy' || rt === 'Cheque') {
        ncRefunds[rt] += Number(cn.subtotal);
      }
    }
    const totalNcRefunds = Object.values(ncRefunds).reduce((s, v) => s + v, 0);

    // Build sale_payments lookup for mixed payment support
    const spMap = new Map<string, SalePaymentRow[]>();
    for (const sp of salePayments) {
      if (!filteredIds.has(sp.sale_id)) continue;
      if (!spMap.has(sp.sale_id)) spMap.set(sp.sale_id, []);
      spMap.get(sp.sale_id)!.push(sp);
    }

    // Reconciliation: use sale_payments rows when available, else fall back to sales.payment_method
    const methodAccum: Record<string, number> = {
      Efectivo: 0, Tarjeta: 0, Transferencia: 0, Yappy: 0, Cheque: 0, 'Nota de Crédito': 0, Canje: 0,
    };

    const nonCreditSales = filtered.filter((s) => s.sale_type !== 'Credito' && s.payment_method !== 'Crédito' && s.payment_method !== 'Pendiente');
    for (const sale of nonCreditSales) {
      const spRows = spMap.get(sale.id);
      if (spRows && spRows.length > 0) {
        for (const sp of spRows) {
          const key = sp.payment_method in methodAccum ? sp.payment_method : 'Efectivo';
          methodAccum[key] += Number(sp.amount);
        }
      } else {
        const key = sale.payment_method in methodAccum ? sale.payment_method : 'Efectivo';
        methodAccum[key] += sale.total;
      }
    }

    const creditSalesTotal = filtered.filter((s) => s.sale_type === 'Credito').reduce((s, x) => s + x.total, 0);

    // Add credit payment (cobros) amounts by method
    for (const p of filteredPayments) {
      const key = p.payment_method in methodAccum ? p.payment_method : 'Efectivo';
      methodAccum[key] += Number(p.amount);
    }

    const totalCustomerCredits = customerCredits.reduce((s, c) => s + (c.credit_balance ?? 0), 0);

    return {
      grossSales, creditNotesTotal, netSales, totalCost, grossProfit, margin, totalTax, expensesTotal, netProfit,
      cash: methodAccum.Efectivo,
      card: methodAccum.Tarjeta,
      transfer: methodAccum.Transferencia,
      yappy: methodAccum.Yappy,
      cheque: methodAccum.Cheque,
      canje: methodAccum.Canje,
      ncApplied: methodAccum['Nota de Crédito'],
      ncRefunds,
      totalNcRefunds,
      creditPending: creditSalesTotal,
      totalCustomerCredits,
      salesCount: filtered.length,
      cnCount: filteredCreditNotes.length,
    };
  }, [filtered, filteredPayments, filteredCreditNotes, filteredExpenses, customerCredits, saleItemCosts, salePayments]);

  /* ---------- Daily chart data ---------- */

  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; sales: number; cost: number; cn: number }> = {};
    for (const s of filtered) {
      const day = s.created_at.slice(0, 10);
      if (!map[day]) map[day] = { date: day, sales: 0, cost: 0, cn: 0 };
      map[day].sales += s.total;
      const costEntry = saleItemCosts.find((c) => c.sale_id === s.id);
      map[day].cost += costEntry ? costEntry.items.reduce((is, i) => is + i.quantity * (i.parts?.cost ?? 0), 0) : 0;
    }
    for (const cn of filteredCreditNotes) {
      const day = cn.created_at.slice(0, 10);
      if (!map[day]) map[day] = { date: day, sales: 0, cost: 0, cn: 0 };
      map[day].cn += Number(cn.subtotal);
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered, filteredCreditNotes, saleItemCosts]);

  const maxDailySales = Math.max(...dailyData.map((d) => d.sales), 1);

  /* ---------- Payment method chart data ---------- */

  const paymentMethods = useMemo(() => {
    const items = [
      { label: 'Efectivo', value: metrics.cash, color: 'bg-emerald-500', icon: <Wallet className="h-3.5 w-3.5 text-emerald-600" /> },
      { label: 'Tarjeta', value: metrics.card, color: 'bg-blue-500', icon: <CreditCard className="h-3.5 w-3.5 text-blue-600" /> },
      { label: 'ACH / Transf.', value: metrics.transfer, color: 'bg-slate-500', icon: <Store className="h-3.5 w-3.5 text-slate-600" /> },
      { label: 'Yappy', value: metrics.yappy, color: 'bg-pink-500', icon: <Smartphone className="h-3.5 w-3.5 text-pink-600" /> },
      { label: 'Cheque', value: metrics.cheque, color: 'bg-amber-500', icon: <FileText className="h-3.5 w-3.5 text-amber-600" /> },
      { label: 'NC Aplicada', value: metrics.ncApplied, color: 'bg-rose-400', icon: <FileMinus className="h-3.5 w-3.5 text-rose-500" /> },
    ].filter((m) => m.value > 0);
    const total = items.reduce((s, i) => s + i.value, 0);
    return { items, total };
  }, [metrics]);

  /* ---------- By seller ---------- */

  const bySeller = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number }> = {};
    for (const s of filtered) {
      const key = s.seller_id ?? 'none';
      if (!map[key]) map[key] = { name: s.seller_name ?? 'Sin vendedor', count: 0, total: 0 };
      map[key].count++;
      map[key].total += s.total;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  /* ---------- Export CSV ---------- */

  const exportCsv = () => {
    const headers = ['Fecha', 'Factura', 'Cliente', 'Tipo', 'Metodo', 'Vendedor', 'Subtotal', 'ITBMS', 'Costo', 'Total'];
    const rows = filtered.map((s) => [
      formatDate(s.created_at),
      s.invoice_number ?? '',
      s.customer_name ?? '',
      s.sale_type,
      s.payment_method,
      s.seller_name ?? '',
      s.subtotal.toFixed(2),
      s.tax_amount.toFixed(2),
      (saleItemCosts.find((c) => c.sale_id === s.id)?.items.reduce((is, i) => is + i.quantity * (i.parts?.cost ?? 0), 0) ?? 0).toFixed(2),
      s.total.toFixed(2),
    ]);

    const summary = [
      [], ['--- ESTADO DE RESULTADOS (CIERRE Z) ---'],
      ['Ventas Brutas', metrics.grossSales.toFixed(2)],
      ['(-) Devoluciones / NC', metrics.creditNotesTotal.toFixed(2)],
      ['= Ventas Netas', metrics.netSales.toFixed(2)],
      ['(-) Costo de Ventas', metrics.totalCost.toFixed(2)],
      ['= Utilidad Bruta', metrics.grossProfit.toFixed(2)],
      ['(-) Gastos Operativos', metrics.expensesTotal.toFixed(2)],
      ['= Utilidad Neta Real', metrics.netProfit.toFixed(2)],
      ['ITBMS Recaudado', metrics.totalTax.toFixed(2)],
      [],
      ['--- CONCILIACION DE COBROS ---'],
      ['Efectivo', metrics.cash.toFixed(2)],
      ['Tarjeta', metrics.card.toFixed(2)],
      ['ACH / Transferencias', metrics.transfer.toFixed(2)],
      ['Yappy', metrics.yappy.toFixed(2)],
      ['Cheque', metrics.cheque.toFixed(2)],
      ['NC Aplicadas', metrics.ncApplied.toFixed(2)],
      ['(-) Reembolsos NC Efectivo', metrics.ncRefunds.Efectivo.toFixed(2)],
      ['(-) Reembolsos NC Tarjeta', metrics.ncRefunds.Tarjeta.toFixed(2)],
      ['Efectivo Neto en Caja', (metrics.cash - metrics.ncRefunds.Efectivo).toFixed(2)],
      [],
      ['--- PASIVOS ---'],
      ['Saldos a Favor Pendientes', metrics.totalCustomerCredits.toFixed(2)],
    ];

    const csv = [headers, ...rows, ...summary].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_contable_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- Export PDF (print) ---------- */

  const exportPdf = () => {
    const brName = branches.find((b) => b.id === branchFilter)?.name ?? 'Todas';
    const dateLabel = startDate === endDate ? formatDate(`${startDate}T12:00:00`) : `${formatDate(`${startDate}T12:00:00`)} - ${formatDate(`${endDate}T12:00:00`)}`;

    const L: string[] = [];
    L.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte Contable</title>');
    L.push('<style>');
    L.push('body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:24px;font-size:12px;color:#1e293b;line-height:1.5}');
    L.push('h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;margin:20px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}');
    L.push('.meta{color:#64748b;font-size:11px;margin-bottom:16px}');
    L.push('table{width:100%;border-collapse:collapse;font-size:11px;margin:8px 0}');
    L.push('th{text-align:left;padding:4px 8px;background:#f1f5f9;border-bottom:1px solid #cbd5e1;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b}');
    L.push('td{padding:4px 8px;border-bottom:1px solid #f1f5f9}');
    L.push('.right{text-align:right}.bold{font-weight:700}');
    L.push('.card{display:inline-block;width:23%;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:4px 0.5%;vertical-align:top}');
    L.push('.card-label{font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;letter-spacing:0.5px}');
    L.push('.card-value{font-size:18px;font-weight:700;margin-top:4px}');
    L.push('.green{color:#059669}.red{color:#dc2626}.blue{color:#2563eb}');
    L.push('@media print{body{padding:12px}@page{margin:15mm}}');
    L.push('</style></head><body>');

    L.push('<h1>Reporte Contable — Devengado</h1>');
    L.push(`<p class="meta">${brName} · ${dateLabel} · Generado ${new Date().toLocaleString('es-PA')}</p>`);

    L.push('<h2>Estado de Resultados (Cierre Z)</h2>');
    L.push('<table>');
    L.push(`<tr><td>Ventas Brutas</td><td class="right">${formatCurrency(metrics.grossSales)}</td></tr>`);
    L.push(`<tr><td>(-) Devoluciones / NC</td><td class="right red">- ${formatCurrency(metrics.creditNotesTotal)}</td></tr>`);
    L.push(`<tr class="bold"><td>= Ventas Netas</td><td class="right blue">${formatCurrency(metrics.netSales)}</td></tr>`);
    L.push(`<tr><td>(-) Costo de Ventas (COGS)</td><td class="right">- ${formatCurrency(metrics.totalCost)}</td></tr>`);
    L.push(`<tr class="bold"><td>= Utilidad Bruta</td><td class="right green">${formatCurrency(metrics.grossProfit)}</td></tr>`);
    L.push(`<tr><td>(-) Gastos Operativos</td><td class="right">- ${formatCurrency(metrics.expensesTotal)}</td></tr>`);
    L.push(`<tr class="bold"><td>= Utilidad Neta Real</td><td class="right ${metrics.netProfit >= 0 ? 'green' : 'red'}">${formatCurrency(metrics.netProfit)}</td></tr>`);
    L.push(`<tr><td>ITBMS Recaudado</td><td class="right">${formatCurrency(metrics.totalTax)}</td></tr>`);
    L.push('</table>');

    L.push('<h2>Conciliacion de Cobros</h2>');
    L.push('<table><tr><th>Metodo</th><th class="right">Monto</th><th class="right">%</th></tr>');
    const methods = [
      ['Efectivo', metrics.cash], ['Tarjeta', metrics.card],
      ['ACH / Transferencias', metrics.transfer], ['Yappy', metrics.yappy],
      ['Cheque', metrics.cheque], ['NC Aplicadas', metrics.ncApplied],
    ];
    const cobroTotal = methods.reduce((s, m) => s + (m[1] as number), 0);
    for (const [label, val] of methods) {
      if ((val as number) > 0) {
        const pct = cobroTotal > 0 ? ((val as number) / cobroTotal * 100).toFixed(1) : '0';
        L.push(`<tr><td>${label}</td><td class="right">${formatCurrency(val as number)}</td><td class="right">${pct}%</td></tr>`);
      }
    }
    L.push(`<tr class="bold"><td>Total Cobrado (bruto)</td><td class="right">${formatCurrency(cobroTotal)}</td><td class="right">100%</td></tr>`);
    if (metrics.totalNcRefunds > 0) {
      L.push(`<tr><td>(-) Reembolsos por NC</td><td class="right red">- ${formatCurrency(metrics.totalNcRefunds)}</td><td></td></tr>`);
      L.push(`<tr class="bold"><td>Efectivo Neto en Caja</td><td class="right">${formatCurrency(metrics.cash - metrics.ncRefunds.Efectivo)}</td><td></td></tr>`);
    }
    L.push('</table>');

    L.push('<h2>Desglose Adicional</h2>');
    L.push('<table>');
    L.push(`<tr><td>Creditos Pendientes de Cobro</td><td class="right">${formatCurrency(metrics.creditPending)}</td></tr>`);
    L.push(`<tr class="bold"><td>Saldos a Favor Pendientes (Pasivo)</td><td class="right red">${formatCurrency(metrics.totalCustomerCredits)}</td></tr>`);
    L.push('</table>');

    if (bySeller.length > 0) {
      L.push('<h2>Ventas por Vendedor</h2>');
      L.push('<table><tr><th>Vendedor</th><th class="right">Ventas</th><th class="right">Total</th></tr>');
      for (const s of bySeller) {
        L.push(`<tr><td>${s.name}</td><td class="right">${s.count}</td><td class="right">${formatCurrency(s.total)}</td></tr>`);
      }
      L.push('</table>');
    }

    L.push('</body></html>');

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:800px;height:600px';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(L.join('\n'));
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
  };

  /* ---------- Render ---------- */

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-1">
          {([['today', 'Hoy'], ['week', 'Semana'], ['month', 'Mes'], ['custom', 'Rango']] as [DatePreset, string][]).map(([p, label]) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                preset === p ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Desde</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hasta</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none" />
            </div>
          </>
        )}

        {branches.length > 1 && (
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sucursal</label>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none">
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <button onClick={fetchData}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>

        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <ArrowDownToLine className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={exportPdf} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <Printer className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {!loading && (
        <>
          {/* Estado de Resultados - Cierre Z */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
              <BarChart3 className="h-4 w-4 text-blue-500" /> Estado de Resultados (Cierre Z)
            </h3>
            <div className="space-y-1">
              <PLRow label="Ventas Brutas" value={metrics.grossSales} level={0} count={`${metrics.salesCount} facturas`} />
              <PLRow label="(-) Devoluciones / Notas de Credito" value={-metrics.creditNotesTotal} level={0} sub count={`${metrics.cnCount} notas`} />
              <PLRow label="= Ventas Netas" value={metrics.netSales} level={0} bold accent="blue" />
              <div className="my-1 border-t border-slate-100" />
              <PLRow label="(-) Costo de Ventas (COGS)" value={-metrics.totalCost} level={0} sub />
              <PLRow label="= Utilidad Bruta" value={metrics.grossProfit} level={0} bold accent="green" hint={`Margen: ${metrics.margin.toFixed(1)}%`} />
              <div className="my-1 border-t border-slate-100" />
              <PLRow label="(-) Gastos Operativos" value={-metrics.expensesTotal} level={0} sub />
              <PLRow label="= Utilidad Neta Real" value={metrics.netProfit} level={0} bold accent={metrics.netProfit >= 0 ? 'green' : 'red'} />
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard icon={<Receipt className="h-4 w-4" />} label="Ventas Brutas" value={formatCurrency(metrics.grossSales)}
              sub={`${metrics.salesCount} facturas`} color="slate" />
            <MetricCard icon={<DollarSign className="h-4 w-4" />} label="Ventas Netas" value={formatCurrency(metrics.netSales)}
              sub="Brutas - NC" color="blue" />
            <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Utilidad Bruta" value={formatCurrency(metrics.grossProfit)}
              sub={`Margen: ${metrics.margin.toFixed(1)}%`} color="green" />
            <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Utilidad Neta" value={formatCurrency(metrics.netProfit)}
              sub="Bruta - Gastos Op." color={metrics.netProfit >= 0 ? 'green' : 'red'} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Daily sales chart */}
            <div className="col-span-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-700">Ventas por Dia</h3>
              </div>
              {dailyData.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">Sin datos en el periodo</p>
              ) : (
                <div className="flex items-end gap-1" style={{ height: 180 }}>
                  {dailyData.map((d) => {
                    const h = (d.sales / maxDailySales) * 160;
                    const cnH = (d.cn / maxDailySales) * 160;
                    const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('es-PA', { day: '2-digit', month: 'short' });
                    return (
                      <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end" style={{ minWidth: 20 }}>
                        <div className="absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] shadow-lg group-hover:block" style={{ whiteSpace: 'nowrap' }}>
                          <p className="font-semibold text-slate-700">{formatCurrency(d.sales)}</p>
                          {d.cn > 0 && <p className="text-red-500">NC: -{formatCurrency(d.cn)}</p>}
                        </div>
                        {cnH > 0 && <div className="w-full rounded-t bg-red-300" style={{ height: Math.max(cnH, 2) }} />}
                        <div className="w-full rounded-t bg-blue-500 transition-all group-hover:bg-blue-600" style={{ height: Math.max(h, 2) }} />
                        <span className="mt-1 text-[9px] text-slate-400">{dailyData.length <= 14 ? dayLabel : ''}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {dailyData.length > 0 && (
                <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-blue-500" /> Ventas</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-300" /> Devoluciones</span>
                </div>
              )}
            </div>

            {/* Payment methods donut-like */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-700">Metodos de Pago</h3>
              </div>
              {paymentMethods.items.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">Sin datos</p>
              ) : (
                <div className="space-y-2.5">
                  {paymentMethods.items.map((m) => {
                    const pct = paymentMethods.total > 0 ? (m.value / paymentMethods.total) * 100 : 0;
                    return (
                      <div key={m.label}>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">{m.icon}{m.label}</span>
                          <span className="text-xs font-bold text-slate-700">{formatCurrency(m.value)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${m.color} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right text-[10px] font-semibold text-slate-400">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Reconciliation & Liabilities */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Conciliación de cobros */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <Wallet className="h-4 w-4 text-emerald-500" /> Conciliacion de Cobros
              </h3>
              <div className="space-y-1">
                <ReconcRow label="Efectivo (ventas + abonos)" value={metrics.cash} />
                <ReconcRow label="Tarjeta (punto de venta)" value={metrics.card} />
                <ReconcRow label="ACH / Transferencias" value={metrics.transfer} />
                <ReconcRow label="Yappy" value={metrics.yappy} />
                <ReconcRow label="Cheque" value={metrics.cheque} />
                <ReconcRow label="Cubierto con NC / Saldo a favor" value={metrics.ncApplied} />
                <ReconcRow label="Canje / Garantia (sin flujo $)" value={metrics.canje} muted />
                <div className="border-t border-slate-200 pt-1">
                  <ReconcRow label="Total Cobrado (bruto)" value={metrics.cash + metrics.card + metrics.transfer + metrics.yappy + metrics.cheque + metrics.ncApplied} bold />
                </div>
                {metrics.totalNcRefunds > 0 && (
                  <div className="border-t border-dashed border-slate-200 pt-1">
                    <ReconcRow label="(-) Reembolsos por NC (efectivo/tarjeta)" value={-metrics.totalNcRefunds} warning />
                    {metrics.ncRefunds.Efectivo > 0 && <ReconcRow label="   Reembolso Efectivo" value={-metrics.ncRefunds.Efectivo} muted />}
                    {metrics.ncRefunds.Tarjeta > 0 && <ReconcRow label="   Reembolso Tarjeta" value={-metrics.ncRefunds.Tarjeta} muted />}
                    {metrics.ncRefunds.Transferencia > 0 && <ReconcRow label="   Reembolso ACH" value={-metrics.ncRefunds.Transferencia} muted />}
                    <div className="pt-1">
                      <ReconcRow label="Efectivo Neto en Caja" value={metrics.cash - metrics.ncRefunds.Efectivo} bold />
                    </div>
                  </div>
                )}
                <div className="border-t border-dashed border-slate-200 pt-1">
                  <ReconcRow label="Creditos Pendientes de Cobro" value={metrics.creditPending} warning />
                </div>
              </div>
            </div>

            {/* Pasivos - Saldos a Favor */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Pasivos — Saldos a Favor Pendientes
              </h3>
              <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-700">
                  Notas de credito emitidas como "Saldo a Favor" que aun no se han aplicado ni reembolsado.
                  Representan una obligacion pendiente con los clientes.
                </p>
              </div>
              <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">Total Pasivo por Saldos a Favor</span>
                <span className="text-xl font-bold text-amber-600">{formatCurrency(metrics.totalCustomerCredits)}</span>
              </div>
              {customerCredits.length > 0 ? (
                <div className="max-h-48 space-y-1 overflow-y-auto scrollbar-thin">
                  {customerCredits.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-slate-50">
                      <span className="text-xs text-slate-600">{c.name}</span>
                      <span className="text-xs font-semibold text-amber-600">{formatCurrency(c.credit_balance)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-slate-400">No hay saldos a favor pendientes</p>
              )}
            </div>
          </div>

          {/* Seller breakdown + Additional metrics */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-700">Ventas por Vendedor</h3>
              {bySeller.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sin datos</p>
              ) : (
                <div className="space-y-2">
                  {bySeller.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.count} ventas</p>
                      </div>
                      <p className="text-sm font-bold text-slate-700">{formatCurrency(s.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-700">Desglose Adicional</h3>
              <div className="space-y-2">
                <DetailRow label="ITBMS Recaudado" value={formatCurrency(metrics.totalTax)} />
                <DetailRow label="Costo de Ventas (COGS)" value={formatCurrency(metrics.totalCost)} />
                <DetailRow label="Gastos Operativos" value={formatCurrency(metrics.expensesTotal)} />
                <DetailRow label="Devoluciones / NC" value={`- ${formatCurrency(metrics.creditNotesTotal)}`} />
                <div className="border-t border-slate-200 pt-2">
                  <DetailRow label="Utilidad Bruta" value={formatCurrency(metrics.grossProfit)} bold accent="green" />
                  <DetailRow label="Utilidad Neta Real" value={formatCurrency(metrics.netProfit)} bold accent={metrics.netProfit >= 0 ? 'green' : 'red'} />
                </div>
              </div>
            </div>
          </div>

          {/* Sales detail table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-700">Detalle de Ventas</h3>
              <span className="text-xs text-slate-400">{filtered.length} registros</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-slate-400">
                  <Receipt className="mb-2 h-8 w-8" />
                  <p className="text-sm">No hay ventas en este periodo</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Fecha</th>
                      <th className="px-4 py-2 text-left font-semibold">Factura</th>
                      <th className="px-4 py-2 text-left font-semibold">Cliente</th>
                      <th className="px-4 py-2 text-left font-semibold">Tipo</th>
                      <th className="px-4 py-2 text-left font-semibold">Metodo</th>
                      <th className="px-4 py-2 text-left font-semibold">Vendedor</th>
                      <th className="px-4 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-xs text-slate-500">{formatDate(s.created_at)}</td>
                        <td className="px-4 py-2 text-xs font-medium text-slate-600">{s.invoice_number ?? '—'}</td>
                        <td className="px-4 py-2 text-xs text-slate-600">{s.customer_name ?? 'Consumidor Final'}</td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            s.sale_type === 'Credito' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {s.sale_type === 'Credito' ? 'Credito' : 'Contado'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">{s.payment_method}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{s.seller_name ?? '—'}</td>
                        <td className="px-4 py-2 text-right text-sm font-bold text-slate-700">{formatCurrency(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MetricCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: 'green' | 'red' | 'blue' | 'slate';
}) {
  const colors = {
    green: 'text-emerald-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    slate: 'text-slate-800',
  };
  const iconBg = {
    green: 'bg-emerald-50 text-emerald-500',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-500',
    slate: 'bg-slate-100 text-slate-500',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg[color]}`}>{icon}</div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      <p className={`mt-2 text-xl font-bold ${colors[color]}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}

function ReconcRow({ label, value, bold, warning, muted }: {
  label: string; value: number; bold?: boolean; warning?: boolean; muted?: boolean;
}) {
  const isNeg = value < 0;
  const displayVal = isNeg ? `- ${formatCurrency(Math.abs(value))}` : formatCurrency(value);
  return (
    <div className={`flex items-center justify-between py-1 ${bold ? 'font-semibold' : ''}`}>
      <span className={`text-xs ${warning ? 'text-amber-600' : muted ? 'text-slate-400 italic' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-xs ${bold ? 'text-sm font-bold text-slate-800' : warning ? 'font-semibold text-amber-600' : muted ? 'text-slate-400' : isNeg ? 'font-semibold text-red-500' : 'font-semibold text-slate-700'}`}>
        {displayVal}
      </span>
    </div>
  );
}

function DetailRow({ label, value, bold, accent }: {
  label: string; value: string; bold?: boolean; accent?: 'green' | 'red';
}) {
  const accentClass = accent === 'green' ? 'text-emerald-600' : accent === 'red' ? 'text-red-600' : 'text-slate-700';
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-xs ${bold ? 'font-semibold' : ''} text-slate-600`}>{label}</span>
      <span className={`text-xs ${bold ? 'text-sm font-bold' : 'font-semibold'} ${accentClass}`}>{value}</span>
    </div>
  );
}

function PLRow({ label, value, level, bold, sub, accent, hint, count }: {
  label: string; value: number; level: number; bold?: boolean; sub?: boolean; accent?: 'green' | 'red' | 'blue'; hint?: string; count?: string;
}) {
  const accentClass = accent === 'green' ? 'text-emerald-600' : accent === 'red' ? 'text-red-600' : accent === 'blue' ? 'text-blue-600' : 'text-slate-700';
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? 'bg-slate-50 rounded-lg px-3 -mx-3' : ''}`} style={{ paddingLeft: level * 16 }}>
      <div className="flex items-center gap-2">
        <span className={`text-xs ${bold ? 'font-bold text-slate-800' : sub ? 'text-slate-500' : 'text-slate-700'}`}>{label}</span>
        {count && <span className="text-[10px] text-slate-400">({count})</span>}
        {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      </div>
      <span className={`text-xs ${bold ? 'text-sm font-bold' : 'font-semibold'} ${sub ? 'text-slate-500' : accentClass}`}>
        {value < 0 ? `- ${formatCurrency(Math.abs(value))}` : formatCurrency(value)}
      </span>
    </div>
  );
}
