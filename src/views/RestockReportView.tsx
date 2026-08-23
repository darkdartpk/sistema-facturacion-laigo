import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type Branch } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import {
  Search,
  PackageX,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Truck,
  Package,
  ArrowDownUp,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  Square,
  ShoppingCart,
} from 'lucide-react';
import * as XLSX from 'xlsx';
// @ts-ignore
import * as cpexcel from 'xlsx/dist/cpexcel.full.mjs';
XLSX.set_cptable(cpexcel);

type RestockItem = {
  partId: string;
  partName: string;
  sku: string | null;
  oem_code: string | null;
  brand: string | null;
  category: string | null;
  cost: number;
  currentQty: number;
  minStock: number;
  maxStock: number;
  deficit: number;
  orderQty: number;
  salesLastMonth: number;
  supplierId: string | null;
  supplierName: string | null;
};

type SortField = 'deficit' | 'name' | 'supplier' | 'currentQty' | 'orderQty' | 'salesLastMonth';
type ViewTab = 'restock' | 'suggest';

export default function RestockReportView({
  branches,
  branchId,
}: {
  branches: Branch[];
  branchId?: string;
}) {
  const [items, setItems] = useState<RestockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(branchId || '');
  const [filterMode, setFilterMode] = useState<'all' | 'zero' | 'low'>('all');
  const [sortField, setSortField] = useState<SortField>('deficit');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>('restock');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const bId = selectedBranch || branchId;
    if (!bId) { setItems([]); setLoading(false); return; }

    const { data: invRows } = await supabase
      .from('inventory')
      .select('part_id, quantity, min_stock, max_stock')
      .eq('branch_id', bId);

    if (!invRows || invRows.length === 0) { setItems([]); setLoading(false); return; }

    const lowStockInv = invRows.filter((r) => r.quantity <= r.min_stock);
    if (lowStockInv.length === 0) { setItems([]); setLoading(false); return; }

    const partIds = lowStockInv.map((r) => r.part_id);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const isoThirty = thirtyDaysAgo.toISOString();

    const [partsRes, invoiceItemsRes, salesRes] = await Promise.all([
      supabase.from('parts').select('id, name, sku, oem_code, brand, category, cost').in('id', partIds),
      supabase.from('supplier_invoice_items')
        .select('part_id, invoice_id, supplier_invoices!inner(supplier_id, suppliers!inner(id, name))')
        .in('part_id', partIds),
      supabase.from('sale_items')
        .select('part_id, quantity, sales!inner(created_at, branch_id)')
        .in('part_id', partIds)
        .gte('sales.created_at', isoThirty)
        .eq('sales.branch_id', bId),
    ]);

    const latestSupplierMap = new Map<string, { id: string; name: string }>();
    if (invoiceItemsRes.data) {
      for (const ii of invoiceItemsRes.data) {
        const si = ii.supplier_invoices as unknown as { supplier_id: string; suppliers: { id: string; name: string } };
        if (si?.suppliers) latestSupplierMap.set(ii.part_id, { id: si.suppliers.id, name: si.suppliers.name });
      }
    }

    const salesMap = new Map<string, number>();
    if (salesRes.data) {
      for (const si of salesRes.data) {
        salesMap.set(si.part_id, (salesMap.get(si.part_id) || 0) + si.quantity);
      }
    }

    const partMap = new Map((partsRes.data ?? []).map((p) => [p.id, p]));

    const result: RestockItem[] = lowStockInv
      .map((inv) => {
        const part = partMap.get(inv.part_id);
        if (!part) return null;
        const supplier = latestSupplierMap.get(inv.part_id);
        const maxStock = inv.max_stock || 0;
        const orderQty = maxStock > inv.quantity ? maxStock - inv.quantity : inv.min_stock - inv.quantity;
        return {
          partId: inv.part_id,
          partName: part.name,
          sku: part.sku,
          oem_code: part.oem_code,
          brand: part.brand,
          category: part.category,
          cost: part.cost,
          currentQty: inv.quantity,
          minStock: inv.min_stock,
          maxStock,
          deficit: inv.min_stock - inv.quantity,
          orderQty: Math.max(orderQty, 0),
          salesLastMonth: salesMap.get(inv.part_id) || 0,
          supplierId: supplier?.id ?? null,
          supplierName: supplier?.name ?? null,
        };
      })
      .filter(Boolean) as RestockItem[];

    setItems(result);
    setLoading(false);
  }, [selectedBranch, branchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = items;
    if (filterMode === 'zero') list = list.filter((i) => i.currentQty === 0);
    else if (filterMode === 'low') list = list.filter((i) => i.currentQty > 0 && i.currentQty <= i.minStock);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.partName.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.oem_code?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q) ||
        i.supplierName?.toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'deficit': cmp = a.deficit - b.deficit; break;
        case 'name': cmp = a.partName.localeCompare(b.partName); break;
        case 'supplier': cmp = (a.supplierName || 'zzz').localeCompare(b.supplierName || 'zzz'); break;
        case 'currentQty': cmp = a.currentQty - b.currentQty; break;
        case 'orderQty': cmp = a.orderQty - b.orderQty; break;
        case 'salesLastMonth': cmp = a.salesLastMonth - b.salesLastMonth; break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [items, filterMode, search, sortField, sortAsc]);

  const groupedBySupplier = useMemo(() => {
    const groups = new Map<string, { name: string; items: RestockItem[] }>();
    for (const item of filtered) {
      const key = item.supplierId || '_sin_proveedor';
      const name = item.supplierName || 'Sin proveedor asignado';
      if (!groups.has(key)) groups.set(key, { name, items: [] });
      groups.get(key)!.items.push(item);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === '_sin_proveedor') return 1;
      if (b[0] === '_sin_proveedor') return -1;
      return a[1].name.localeCompare(b[1].name);
    });
  }, [filtered]);

  const totalZero = items.filter((i) => i.currentQty === 0).length;
  const totalLow = items.filter((i) => i.currentQty > 0).length;
  const totalCostToRestock = filtered.reduce((s, i) => s + i.orderQty * i.cost, 0);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  function toggleSupplier(key: string) {
    setExpandedSupplier(expandedSupplier === key ? null : key);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((i) => i.partId)));
  }

  function getSelectedItems() {
    return filtered.filter((i) => selectedIds.has(i.partId));
  }

  async function exportToExcel() {
    setExporting(true);
    try {
      const itemsToExport = selectedIds.size > 0 ? getSelectedItems() : filtered;
      const grouped = new Map<string, RestockItem[]>();
      for (const item of itemsToExport) {
        const key = item.supplierName || 'Sin proveedor';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(item);
      }

      const wb = XLSX.utils.book_new();
      for (const [supplier, supplierItems] of grouped) {
        const rows = supplierItems.map((i) => ({
          'Codigo OEM': i.oem_code || i.sku || '',
          'Descripcion': i.partName,
          'Marca': i.brand || '',
          'Stock Actual': i.currentQty,
          'Ventas Ult. Mes': i.salesLastMonth,
          'Cantidad a Pedir': i.orderQty,
          'Costo Unit.': i.cost,
          'Costo Total': i.orderQty * i.cost,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
          { wch: 18 }, { wch: 35 }, { wch: 15 }, { wch: 12 },
          { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
        ];
        const sheetName = supplier.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
      XLSX.writeFile(wb, `Pedido_Sugerido_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  async function exportToPDF() {
    setExporting(true);
    try {
      const itemsToExport = selectedIds.size > 0 ? getSelectedItems() : filtered;
      const grouped = new Map<string, RestockItem[]>();
      for (const item of itemsToExport) {
        const key = item.supplierName || 'Sin proveedor';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(item);
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido Sugerido</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; color: #333; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          h2 { font-size: 14px; margin-top: 24px; margin-bottom: 8px; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 4px; }
          .date { font-size: 11px; color: #666; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-size: 11px; border: 1px solid #e2e8f0; }
          td { padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 11px; }
          .right { text-align: right; }
          .center { text-align: center; }
          .total-row { font-weight: bold; background: #f8fafc; }
          @media print { body { padding: 0; } }
        </style></head><body>
        <h1>Pedido Sugerido</h1>
        <p class="date">Fecha: ${new Date().toLocaleDateString('es-PA')}</p>`;

      for (const [supplier, supplierItems] of grouped) {
        const totalCost = supplierItems.reduce((s, i) => s + i.orderQty * i.cost, 0);
        const totalUnits = supplierItems.reduce((s, i) => s + i.orderQty, 0);
        html += `<h2>${supplier}</h2>
          <table><thead><tr>
            <th>Codigo OEM</th><th>Descripcion</th><th>Marca</th>
            <th class="center">Stock</th><th class="center">Vtas/Mes</th>
            <th class="center">Cant. a Pedir</th><th class="right">Costo Unit.</th><th class="right">Costo Total</th>
          </tr></thead><tbody>`;
        for (const i of supplierItems) {
          html += `<tr>
            <td>${i.oem_code || i.sku || '-'}</td><td>${i.partName}</td><td>${i.brand || '-'}</td>
            <td class="center">${i.currentQty}</td><td class="center">${i.salesLastMonth}</td>
            <td class="center">${i.orderQty}</td>
            <td class="right">$${i.cost.toFixed(2)}</td><td class="right">$${(i.orderQty * i.cost).toFixed(2)}</td>
          </tr>`;
        }
        html += `<tr class="total-row">
          <td colspan="5">Total ${supplier}</td>
          <td class="center">${totalUnits}</td><td></td><td class="right">$${totalCost.toFixed(2)}</td>
        </tr></tbody></table>`;
      }
      html += '</body></html>';
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    } finally {
      setExporting(false);
    }
  }

  async function convertToOrder() {
    const itemsToConvert = getSelectedItems();
    if (itemsToConvert.length === 0) return;

    const grouped = new Map<string, RestockItem[]>();
    for (const item of itemsToConvert) {
      if (!item.supplierId) continue;
      if (!grouped.has(item.supplierId)) grouped.set(item.supplierId, []);
      grouped.get(item.supplierId)!.push(item);
    }

    if (grouped.size === 0) {
      alert('Los productos seleccionados no tienen proveedor asignado.');
      return;
    }

    const bId = selectedBranch || branchId;
    if (!bId) return;

    let created = 0;
    for (const [supplierId, supplierItems] of grouped) {
      const subtotal = supplierItems.reduce((s, i) => s + i.orderQty * i.cost, 0);
      const { data: invData, error: invErr } = await supabase
        .from('supplier_invoices')
        .insert({
          supplier_id: supplierId,
          branch_id: bId,
          invoice_number: `PED-${Date.now().toString(36).toUpperCase()}`,
          invoice_date: new Date().toISOString().slice(0, 10),
          subtotal,
          tax_amount: 0,
          total: subtotal,
          status: 'Pendiente',
          notes: 'Pedido sugerido desde Reabastecimiento',
        })
        .select()
        .single();

      if (invErr || !invData) continue;

      const itemRows = supplierItems.map((it) => ({
        invoice_id: invData.id,
        part_id: it.partId,
        quantity: it.orderQty,
        unit_cost: it.cost,
        subtotal: it.orderQty * it.cost,
      }));

      await supabase.from('supplier_invoice_items').insert(itemRows);
      created++;
    }

    if (created > 0) {
      alert(`Se crearon ${created} orden(es) de compra exitosamente.`);
      setSelectedIds(new Set());
    }
  }

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setViewTab('restock')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            viewTab === 'restock' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Package className="h-4 w-4" />
          Reabastecimiento
        </button>
        <button
          onClick={() => setViewTab('suggest')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            viewTab === 'suggest' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Sugerir Pedido
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <PackageX className="h-5 w-5" />
            <span className="text-sm font-medium">Agotados</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{totalZero}</p>
          <p className="text-xs text-red-500">productos con stock en 0</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">Stock Bajo</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{totalLow}</p>
          <p className="text-xs text-amber-500">por debajo del minimo</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Truck className="h-5 w-5" />
            <span className="text-sm font-medium">Costo Estimado</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalCostToRestock)}</p>
          <p className="text-xs text-blue-500">para reabastecer</p>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar producto, codigo, marca o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
          />
        </div>

        {branches.length > 1 && (
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 outline-none"
          >
            <option value="">Sucursal</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

        <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              filterMode === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todos ({items.length})
          </button>
          <button
            onClick={() => setFilterMode('zero')}
            className={`px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
              filterMode === 'zero' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Agotados ({totalZero})
          </button>
          <button
            onClick={() => setFilterMode('low')}
            className={`px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
              filterMode === 'low' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Bajo ({totalLow})
          </button>
        </div>
      </div>

      {/* Suggest tab action bar */}
      {viewTab === 'suggest' && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {selectedIds.size === filtered.length
              ? <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
              : <Square className="h-3.5 w-3.5" />
            }
            {selectedIds.size === filtered.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
          {selectedIds.size > 0 && (
            <span className="text-xs text-slate-500">{selectedIds.size} seleccionados</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={exportToExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Exportar Excel
            </button>
            <button
              onClick={exportToPDF}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              Exportar PDF
            </button>
            <button
              onClick={convertToOrder}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Crear Orden de Compra
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Package className="h-16 w-16 mb-3" />
          <p className="text-lg font-medium">
            {items.length === 0 ? 'Todo el inventario esta por encima del minimo' : 'Sin resultados para esta busqueda'}
          </p>
        </div>
      ) : viewTab === 'restock' ? (
        <RestockTable
          groupedBySupplier={groupedBySupplier}
          expandedSupplier={expandedSupplier}
          toggleSupplier={toggleSupplier}
          toggleSort={toggleSort}
          sortField={sortField}
        />
      ) : (
        <SuggestTable
          groupedBySupplier={groupedBySupplier}
          expandedSupplier={expandedSupplier}
          toggleSupplier={toggleSupplier}
          toggleSort={toggleSort}
          sortField={sortField}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
        />
      )}
    </div>
  );
}

function RestockTable({
  groupedBySupplier,
  expandedSupplier,
  toggleSupplier,
  toggleSort,
  sortField,
}: {
  groupedBySupplier: [string, { name: string; items: RestockItem[] }][];
  expandedSupplier: string | null;
  toggleSupplier: (k: string) => void;
  toggleSort: (f: SortField) => void;
  sortField: SortField;
}) {
  return (
    <div className="space-y-3">
      {groupedBySupplier.map(([key, group]) => {
        const isExpanded = expandedSupplier === key || groupedBySupplier.length === 1;
        const groupDeficit = group.items.reduce((s, i) => s + i.deficit, 0);
        const groupCost = group.items.reduce((s, i) => s + i.deficit * i.cost, 0);

        return (
          <div key={key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => toggleSupplier(key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${
                  key === '_sin_proveedor' ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'
                }`}>
                  <Truck className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-800">{group.name}</p>
                  <p className="text-xs text-slate-500">
                    {group.items.length} producto{group.items.length !== 1 ? 's' : ''} &middot;{' '}
                    {groupDeficit} unid. faltantes &middot; Costo est. ${groupCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-2 text-left cursor-pointer hover:text-slate-700" onClick={() => toggleSort('name')}>
                        <span className="flex items-center gap-1">Producto {sortField === 'name' && <ArrowDownUp className="h-3 w-3" />}</span>
                      </th>
                      <th className="px-4 py-2 text-left">Codigo</th>
                      <th className="px-4 py-2 text-left">Marca</th>
                      <th className="px-4 py-2 text-center cursor-pointer hover:text-slate-700" onClick={() => toggleSort('currentQty')}>
                        <span className="flex items-center justify-center gap-1">Stock {sortField === 'currentQty' && <ArrowDownUp className="h-3 w-3" />}</span>
                      </th>
                      <th className="px-4 py-2 text-center">Minimo</th>
                      <th className="px-4 py-2 text-center cursor-pointer hover:text-slate-700" onClick={() => toggleSort('deficit')}>
                        <span className="flex items-center justify-center gap-1">Faltante {sortField === 'deficit' && <ArrowDownUp className="h-3 w-3" />}</span>
                      </th>
                      <th className="px-4 py-2 text-right">Costo Unit.</th>
                      <th className="px-4 py-2 text-right">Costo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <tr key={item.partId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[200px] truncate">{item.partName}</td>
                        <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{item.sku || item.oem_code || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-500">{item.brand || '-'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-bold ${
                            item.currentQty === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>{item.currentQty}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-500">{item.minStock}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700">{item.deficit}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-800">${(item.deficit * item.cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SuggestTable({
  groupedBySupplier,
  expandedSupplier,
  toggleSupplier,
  toggleSort,
  sortField,
  selectedIds,
  toggleSelect,
}: {
  groupedBySupplier: [string, { name: string; items: RestockItem[] }][];
  expandedSupplier: string | null;
  toggleSupplier: (k: string) => void;
  toggleSort: (f: SortField) => void;
  sortField: SortField;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {groupedBySupplier.map(([key, group]) => {
        const isExpanded = expandedSupplier === key || groupedBySupplier.length === 1;
        const groupOrderQty = group.items.reduce((s, i) => s + i.orderQty, 0);
        const groupCost = group.items.reduce((s, i) => s + i.orderQty * i.cost, 0);
        const selectedInGroup = group.items.filter((i) => selectedIds.has(i.partId)).length;

        return (
          <div key={key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => toggleSupplier(key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${
                  key === '_sin_proveedor' ? 'bg-slate-100 text-slate-400' : 'bg-teal-50 text-teal-600'
                }`}>
                  <Truck className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-800">{group.name}</p>
                  <p className="text-xs text-slate-500">
                    {group.items.length} producto{group.items.length !== 1 ? 's' : ''} &middot;{' '}
                    {groupOrderQty} unid. a pedir &middot; Costo est. ${groupCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    {selectedInGroup > 0 && (
                      <span className="ml-2 text-blue-600 font-medium">({selectedInGroup} seleccionados)</span>
                    )}
                  </p>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="px-3 py-2 text-center w-10"></th>
                      <th className="px-4 py-2 text-left cursor-pointer hover:text-slate-700" onClick={() => toggleSort('name')}>
                        <span className="flex items-center gap-1">Descripcion {sortField === 'name' && <ArrowDownUp className="h-3 w-3" />}</span>
                      </th>
                      <th className="px-4 py-2 text-left">Codigo OEM</th>
                      <th className="px-4 py-2 text-left">Marca</th>
                      <th className="px-4 py-2 text-center cursor-pointer hover:text-slate-700" onClick={() => toggleSort('currentQty')}>
                        <span className="flex items-center justify-center gap-1">Stock {sortField === 'currentQty' && <ArrowDownUp className="h-3 w-3" />}</span>
                      </th>
                      <th className="px-4 py-2 text-center cursor-pointer hover:text-slate-700" onClick={() => toggleSort('salesLastMonth')}>
                        <span className="flex items-center justify-center gap-1">Vtas/Mes {sortField === 'salesLastMonth' && <ArrowDownUp className="h-3 w-3" />}</span>
                      </th>
                      <th className="px-4 py-2 text-center cursor-pointer hover:text-slate-700" onClick={() => toggleSort('orderQty')}>
                        <span className="flex items-center justify-center gap-1">Cant. a Pedir {sortField === 'orderQty' && <ArrowDownUp className="h-3 w-3" />}</span>
                      </th>
                      <th className="px-4 py-2 text-right">Costo Unit.</th>
                      <th className="px-4 py-2 text-right">Costo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((item) => {
                      const isSelected = selectedIds.has(item.partId);
                      return (
                        <tr
                          key={item.partId}
                          onClick={() => toggleSelect(item.partId)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center">
                            {isSelected
                              ? <CheckSquare className="h-4 w-4 text-blue-600 mx-auto" />
                              : <Square className="h-4 w-4 text-slate-300 mx-auto" />
                            }
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[200px] truncate">{item.partName}</td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{item.oem_code || item.sku || '-'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{item.brand || '-'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-bold ${
                              item.currentQty === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>{item.currentQty}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-semibold ${item.salesLastMonth > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
                              {item.salesLastMonth}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-bold bg-teal-100 text-teal-700">
                              {item.orderQty}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-800">${(item.orderQty * item.cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
