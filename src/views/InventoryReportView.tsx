import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type Part, type Inventory, type Branch } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Boxes, AlertTriangle, Package, TrendingDown, DollarSign, Download, Search } from 'lucide-react';

type PartWithInv = Part & {
  inventory: Inventory[];
};

export default function InventoryReportView({ branches }: { branches: Branch[] }) {
  const [parts, setParts] = useState<PartWithInv[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'ok'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    let allParts: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data } = await supabase.from('parts').select('*').order('name').range(from, from + batchSize - 1);
      if (!data || data.length === 0) break;
      allParts = allParts.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    let allInv: Inventory[] = [];
    from = 0;
    while (true) {
      const { data } = await supabase.from('inventory').select('*').range(from, from + batchSize - 1);
      if (!data || data.length === 0) break;
      allInv = allInv.concat(data as Inventory[]);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    const invMap: Record<string, Inventory[]> = {};
    for (const inv of allInv) {
      if (!invMap[inv.part_id]) invMap[inv.part_id] = [];
      invMap[inv.part_id].push(inv);
    }
    const enriched = ((allParts as Part[]) ?? []).map((p) => ({
      ...p,
      inventory: invMap[p.id] ?? [],
    }));
    setParts(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getQty = (part: PartWithInv) => {
    if (branchFilter) {
      return part.inventory.find((i) => i.branch_id === branchFilter)?.quantity ?? 0;
    }
    return part.inventory.reduce((s, i) => s + i.quantity, 0);
  };

  const getMinStock = (part: PartWithInv) => {
    if (branchFilter) {
      return part.inventory.find((i) => i.branch_id === branchFilter)?.min_stock ?? 0;
    }
    return Math.max(0, ...part.inventory.map((i) => i.min_stock));
  };

  const filtered = useMemo(() => {
    let list = parts;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.oem_code?.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q),
      );
    }
    list = list.filter((p) => {
      const qty = getQty(p);
      const min = getMinStock(p);
      if (stockFilter === 'out') return qty <= 0;
      if (stockFilter === 'low') return qty > 0 && qty <= min;
      if (stockFilter === 'ok') return qty > min;
      return true;
    });
    return list;
  }, [parts, search, stockFilter, branchFilter]);

  const stats = useMemo(() => {
    let totalUnits = 0;
    let totalValue = 0;
    let totalRetail = 0;
    let lowStock = 0;
    let outStock = 0;
    for (const p of parts) {
      const qty = getQty(p);
      totalUnits += qty;
      totalValue += qty * p.cost;
      totalRetail += qty * p.price;
      if (qty <= 0) outStock++;
      else if (qty <= getMinStock(p)) lowStock++;
    }
    return { totalUnits, totalValue, totalRetail, lowStock, outStock, totalParts: parts.length };
  }, [parts, branchFilter]);

  const exportCsv = () => {
    const headers = ['Código', 'Nombre', 'Marca', 'Categoria', 'Stock', 'Minimo', 'Costo', 'Precio', 'Valor Inventario', 'Valor Venta'];
    const rows = filtered.map((p) => {
      const qty = getQty(p);
      const min = getMinStock(p);
      return [
        p.sku ?? '',
        p.name,
        p.brand,
        p.category ?? '',
        qty,
        min,
        p.cost.toFixed(2),
        p.price.toFixed(2),
        (qty * p.cost).toFixed(2),
        (qty * p.price).toFixed(2),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_inventario_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sucursal
          </label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todas</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Estado de stock
          </label>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as 'all' | 'low' | 'out' | 'ok')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todo el inventario</option>
            <option value="ok">Stock suficiente</option>
            <option value="low">Stock bajo</option>
            <option value="out">Agotado</option>
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Buscar
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, código, marca..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Boxes className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Total Unidades</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{stats.totalUnits.toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-slate-400">{stats.totalParts} productos</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Valor Costo</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-700">{formatCurrency(stats.totalValue)}</p>
          <p className="mt-0.5 text-xs text-slate-400">Inventario a costo</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Valor Venta</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{formatCurrency(stats.totalRetail)}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Margen: {formatCurrency(stats.totalRetail - stats.totalValue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Alertas</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{stats.lowStock + stats.outStock}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {stats.outStock} agotados · {stats.lowStock} bajos
          </p>
        </div>
      </div>

      {/* Detail table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-700">
            Detalle de inventario ({filtered.length} productos)
          </h3>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-slate-400">
              <Package className="mb-2 h-8 w-8" />
              <p className="text-sm">No hay productos que coincidan</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Producto</th>
                  <th className="px-4 py-2 text-left font-semibold">Código</th>
                  <th className="px-4 py-2 text-left font-semibold">Marca</th>
                  <th className="px-4 py-2 text-right font-semibold">Stock</th>
                  <th className="px-4 py-2 text-right font-semibold">Mínimo</th>
                  <th className="px-4 py-2 text-right font-semibold">Costo</th>
                  <th className="px-4 py-2 text-right font-semibold">Precio</th>
                  <th className="px-4 py-2 text-right font-semibold">Valor</th>
                  <th className="px-4 py-2 text-center font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => {
                  const qty = getQty(p);
                  const min = getMinStock(p);
                  const status = qty <= 0 ? 'out' : qty <= min ? 'low' : 'ok';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs font-medium text-slate-700">{p.name}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{p.sku ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{p.brand}</td>
                      <td className="px-4 py-2 text-right text-sm font-bold text-slate-700">{qty}</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-400">{min}</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-500">{formatCurrency(p.cost)}</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-600">{formatCurrency(p.price)}</td>
                      <td className="px-4 py-2 text-right text-xs font-medium text-slate-600">
                        {formatCurrency(qty * p.cost)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          status === 'out'
                            ? 'bg-red-100 text-red-700'
                            : status === 'low'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                        }`}>
                          {status === 'out' ? 'Agotado' : status === 'low' ? 'Bajo' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
