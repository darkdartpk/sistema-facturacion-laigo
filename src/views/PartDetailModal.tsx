import { useCallback, useEffect, useState } from 'react';
import { supabase, type PartWithRelations, type Branch } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  X,
  Package,
  Store,
  History,
  TrendingUp,
  DollarSign,
  Percent,
  ArrowDownToLine,
} from 'lucide-react';

type Tab = 'stock' | 'history' | 'entries';

type SaleHistoryRow = {
  sale_id: string;
  created_at: string;
  customer_name: string | null;
  sale_type: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  branch_name: string;
};

type EntryRow = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  created_at: string;
  branch_name: string;
};

export default function PartDetailModal({
  part,
  branchId,
  onClose,
}: {
  part: PartWithRelations;
  branchId: string;
  branchName: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('stock');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [saleHistory, setSaleHistory] = useState<SaleHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const loadBranches = useCallback(async () => {
    const { data } = await supabase.from('branches').select('*').order('name');
    if (data) setBranches(data as Branch[]);
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('sale_items')
      .select('sale_id, quantity, unit_price, subtotal, sales(created_at, customer_name, sale_type, branch_id, branches(name))')
      .eq('part_id', part.id)
      .order('created_at', { referencedTable: 'sales', ascending: false })
      .limit(50);
    if (data) {
      const rows: SaleHistoryRow[] = (data as unknown as SaleHistoryRowData[]).map((d) => ({
        sale_id: d.sale_id,
        created_at: d.sales.created_at,
        customer_name: d.sales.customer_name,
        sale_type: d.sales.sale_type,
        quantity: d.quantity,
        unit_price: d.unit_price,
        subtotal: d.subtotal,
        branch_name: d.sales.branches?.name ?? '—',
      }));
      setSaleHistory(rows);
    }
    setLoadingHistory(false);
  }, [part.id]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    const { data } = await supabase
      .from('stock_movements')
      .select('id, type, quantity, reason, created_at, branch_id, branches(name)')
      .eq('part_id', part.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setEntries((data as unknown as StockMovementData[]).map((d) => ({
        id: d.id,
        type: d.type,
        quantity: d.quantity,
        reason: d.reason,
        created_at: d.created_at,
        branch_name: d.branches?.name ?? '—',
      })));
    }
    setLoadingEntries(false);
  }, [part.id]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
    if (tab === 'entries') loadEntries();
  }, [tab, loadHistory, loadEntries]);

  const totalSold = saleHistory.reduce((s, r) => s + r.quantity, 0);
  const totalRevenue = saleHistory.reduce((s, r) => s + r.subtotal, 0);

  const unitCost = part.cost;
  const unitPrice = part.price;
  const unitProfit = unitPrice - unitCost;
  const profitMargin = unitCost > 0 ? (unitProfit / unitCost) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">{part.name}</h3>
              <p className="text-xs text-slate-500">
                {part.oem_code ?? 'Sin codigo'} · {part.brand} · {formatCurrency(part.price)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 border-b border-slate-200 px-5 pt-3">
          <TabButton active={tab === 'stock'} onClick={() => setTab('stock')} icon={<Store className="h-4 w-4" />}>
            Stock por Sucursal
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={<History className="h-4 w-4" />}>
            Historial de Ventas
          </TabButton>
          <TabButton active={tab === 'entries'} onClick={() => setTab('entries')} icon={<ArrowDownToLine className="h-4 w-4" />}>
            Historial de Entrada
          </TabButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          {/* STOCK TAB */}
          {tab === 'stock' && (
            <div className="space-y-3">
              {/* Cost & profit card */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                    <DollarSign className="h-3.5 w-3.5" />
                    Costo unitario
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(unitCost)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                    <DollarSign className="h-3.5 w-3.5" />
                    Precio venta
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(unitPrice)}</p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Ganancia unit.
                  </div>
                  <p className="mt-1 text-lg font-bold text-green-700">{formatCurrency(unitProfit)}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-blue-600">
                    <Percent className="h-3.5 w-3.5" />
                    Margen
                  </div>
                  <p className="mt-1 text-lg font-bold text-blue-700">
                    {profitMargin % 1 === 0 ? `${profitMargin.toFixed(0)}%` : `${profitMargin.toFixed(1)}%`}
                  </p>
                </div>
              </div>
              {branches.map((b) => {
                const inv = part.inventory.find((i) => i.branch_id === b.id);
                const qty = inv?.quantity ?? 0;
                const isCurrent = b.id === branchId;
                return (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between rounded-lg border p-4 ${
                      isCurrent ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isCurrent ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <Store className={`h-4 w-4 ${isCurrent ? 'text-blue-600' : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {b.name}
                          {isCurrent && (
                            <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                              Actual
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{b.address ?? 'Sin dirección'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xl font-bold ${
                          qty <= 0 ? 'text-red-600' : qty <= 5 ? 'text-amber-600' : 'text-green-600'
                        }`}
                      >
                        {qty}
                      </p>
                      <p className="text-xs text-slate-400">unidades</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Total vendido
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-800">{totalSold} unidades</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">Ingresos generados</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>

              {loadingHistory ? (
                <div className="py-8 text-center text-sm text-slate-400">Cargando historial...</div>
              ) : saleHistory.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  No hay ventas registradas para este producto.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs uppercase text-slate-400">
                        <th className="px-3 py-2 font-semibold">Fecha</th>
                        <th className="px-3 py-2 font-semibold">Folio</th>
                        <th className="px-3 py-2 font-semibold">Cliente</th>
                        <th className="px-3 py-2 text-center font-semibold">Cant.</th>
                        <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saleHistory.map((row, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-xs text-slate-500">{formatDate(row.created_at)}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">
                            {row.sale_id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {row.customer_name ?? 'Consumidor final'}
                          </td>
                          <td className="px-3 py-2 text-center text-xs font-semibold text-slate-700">
                            {row.quantity}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700">
                            {formatCurrency(row.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {/* ENTRIES TAB */}
          {tab === 'entries' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Total entradas
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-800">
                    {entries.filter((e) => e.type === 'in').reduce((s, e) => s + e.quantity, 0)} unidades
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">Movimientos registrados</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{entries.length}</p>
                </div>
              </div>

              {loadingEntries ? (
                <div className="py-8 text-center text-sm text-slate-400">Cargando historial...</div>
              ) : entries.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  No hay movimientos registrados para este producto.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs uppercase text-slate-400">
                        <th className="px-3 py-2 font-semibold">Fecha</th>
                        <th className="px-3 py-2 font-semibold">Tipo</th>
                        <th className="px-3 py-2 text-center font-semibold">Cant.</th>
                        <th className="px-3 py-2 font-semibold">Razon</th>
                        <th className="px-3 py-2 font-semibold">Sucursal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-xs text-slate-500">{formatDate(row.created_at)}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                row.type === 'in'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {row.type === 'in' ? 'Entrada' : 'Salida'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-xs font-semibold text-slate-700">
                            {row.type === 'in' ? '+' : '-'}{row.quantity}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{row.reason ?? '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{row.branch_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

type SaleHistoryRowData = {
  sale_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  sales: {
    created_at: string;
    customer_name: string | null;
    sale_type: string;
    branch_id: string;
    branches: { name: string } | null;
  };
};

type StockMovementData = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  created_at: string;
  branch_id: string;
  branches: { name: string } | null;
};
