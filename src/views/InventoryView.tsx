import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, type Branch, type PartWithRelations } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { logAudit } from '@/lib/audit';
import { Search, Boxes, AlertTriangle, Save, Check, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X, Pencil, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
// @ts-ignore – no type declarations for cpexcel
import * as cpexcel from 'xlsx/dist/cpexcel.full.mjs';
XLSX.set_cptable(cpexcel);
import JsBarcode from 'jsbarcode';
import ProductEditModal from '@/views/ProductEditModal';

type EditState = Record<string, { quantity: string; min_stock: string; max_stock: string }>;

export default function InventoryView({
  branchId,
  branches,
  sellerRole,
}: {
  branchId: string;
  branches: Branch[];
  sellerRole: string;
}) {
  const [parts, setParts] = useState<PartWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [edits, setEdits] = useState<EditState>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingPart, setEditingPart] = useState<PartWithRelations | null>(null);
  const [barcodePart, setBarcodePart] = useState<PartWithRelations | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; part: PartWithRelations } | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 100;
  const [totalCount, setTotalCount] = useState(0);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load brands & categories once
  useEffect(() => {
    supabase.from('parts').select('brand').then(({ data }) => {
      if (data) setAllBrands([...new Set(data.map((r: any) => r.brand).filter(Boolean))].sort() as string[]);
    });
    supabase.from('parts').select('category').then(({ data }) => {
      if (data) setAllCategories([...new Set(data.map((r: any) => r.category).filter(Boolean))].sort() as string[]);
    });
  }, []);

  // Load stats (low stock + total units) per branch
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('inventory').select('quantity, min_stock, max_stock').eq('branch_id', branchId);
      if (data) {
        setTotalUnits(data.reduce((sum, i) => sum + (i.quantity ?? 0), 0));
        setLowStockCount(data.filter(i => i.quantity <= i.min_stock).length);
      }
    })();
  }, [branchId]);

  const load = useCallback(async () => {
    setLoading(true);
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('parts')
      .select('*, inventory!inner(*)', { count: 'exact' })
      .eq('inventory.branch_id', branchId)
      .order('name')
      .range(from, to);

    if (brandFilter) query = query.eq('brand', brandFilter);
    if (categoryFilter) query = query.eq('category', categoryFilter);
    if (showLowOnly) query = query.lte('inventory.quantity', 0);
    if (debouncedSearch.trim()) {
      const tokens = debouncedSearch.trim().split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        query = query.or(`sku.ilike.%${token}%,oem_code.ilike.%${token}%,name.ilike.%${token}%,brand.ilike.%${token}%,barcode.ilike.%${token}%`);
      }
    }

    const { data, error, count } = await query;
    if (!error && data) {
      setParts(data as PartWithRelations[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [branchId, currentPage, brandFilter, categoryFilter, showLowOnly, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const activeBranch = branches.find((b) => b.id === branchId);

  const rows = useMemo(() => {
    return parts.map((p) => {
      const inv = p.inventory.find((i: any) => i.branch_id === branchId) ?? p.inventory[0];
      return { part: p, inv };
    }).filter(({ inv }) => !!inv);
  }, [parts, branchId]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);


  async function saveEdit(invId: string) {
    const ed = edits[invId];
    if (!ed) return;
    setSaving(invId);
    const qty = parseInt(ed.quantity, 10);
    const min = parseInt(ed.min_stock, 10);
    const max = parseInt(ed.max_stock, 10);
    if (isNaN(qty) || qty < 0 || isNaN(min) || min < 0 || isNaN(max) || max < 0) {
      setSaving(null);
      return;
    }
    const { error } = await supabase
      .from('inventory')
      .update({ quantity: qty, min_stock: min, max_stock: max })
      .eq('id', invId);
    if (!error) {
      const partRow = parts.find(p => p.inventory.some(i => i.id === invId));
      logAudit({
        tableName: 'inventory',
        recordId: invId,
        action: 'stock_adjust',
        changes: {
          producto: partRow?.name ?? invId,
          cantidad: { old: partRow?.inventory.find(i => i.id === invId)?.quantity, new: qty },
          stock_minimo: { old: partRow?.inventory.find(i => i.id === invId)?.min_stock, new: min },
          stock_maximo: { old: partRow?.inventory.find(i => i.id === invId)?.max_stock, new: max },
        },
        sellerName: 'Admin',
      });
      setSavedFlash(invId);
      setTimeout(() => setSavedFlash(null), 1500);
      setEdits((e) => {
        const next = { ...e };
        delete next[invId];
        return next;
      });
      await load();
    }
    setSaving(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Stats */}
      <div className="grid shrink-0 grid-cols-3 gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <StatCard label="Total Unidades" value={String(totalUnits)} icon={<Boxes className="h-4 w-4" />} color="blue" />
        <StatCard label="Repuestos" value={String(totalCount)} icon={<Boxes className="h-4 w-4" />} color="slate" />
        <StatCard label="Stock Bajo" value={String(lowStockCount)} icon={<AlertTriangle className="h-4 w-4" />} color="red" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar: fil ford, balata toyota..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showLowOnly}
            onChange={(e) => { setShowLowOnly(e.target.checked); setCurrentPage(0); }}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Solo stock bajo el mínimo
        </label>
        <select
          value={brandFilter}
          onChange={(e) => { setBrandFilter(e.target.value); setCurrentPage(0); }}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todas las marcas</option>
          {allBrands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(0); }}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todas categorias</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {activeBranch && (
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
            {activeBranch.name}
          </span>
        )}
        {sellerRole === 'admin' && (
          <button
            onClick={() => setShowImportModal(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
          >
            <Upload className="h-4 w-4" />
            Importar Excel
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-slate-50 scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-sm">
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Codigo1</th>
              <th className="px-4 py-3 font-semibold">Codigo2</th>
              <th className="px-4 py-3 font-semibold">Cod. Barras</th>
              <th className="px-4 py-3 font-semibold">Repuesto</th>
              <th className="px-4 py-3 font-semibold">Marca</th>
              <th className="px-4 py-3 text-right font-semibold">Precio</th>
              <th className="px-4 py-3 text-center font-semibold">Stock</th>
              <th className="px-4 py-3 text-center font-semibold">Mínimo</th>
              <th className="px-4 py-3 text-center font-semibold">Máximo</th>
              <th className="px-4 py-3 text-center font-semibold">Estado</th>
              <th className="px-4 py-3 text-center font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                  Cargando inventario...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                  No hay repuestos que coincidan.
                </td>
              </tr>
            ) : (
              rows.map(({ part, inv }) => {
                if (!inv) return null;
                const isLow = inv.quantity <= inv.min_stock;
                const editing = edits[inv.id];
                const isSaved = savedFlash === inv.id;
                return (
                  <tr
                    key={part.id}
                    className="border-b border-slate-100 bg-white transition-colors hover:bg-blue-50/30"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, part });
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{part.sku ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{part.oem_code ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{part.barcode ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{part.name}</td>
                    <td className="px-4 py-3 text-slate-600">{part.brand}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCurrency(part.price)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editing ? (
                        <input
                          type="number"
                          value={editing.quantity}
                          onChange={(e) =>
                            setEdits((s) => ({
                              ...s,
                              [inv.id]: { ...s[inv.id], quantity: e.target.value },
                            }))
                          }
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                          {inv.quantity}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editing ? (
                        <input
                          type="number"
                          value={editing.min_stock}
                          onChange={(e) =>
                            setEdits((s) => ({
                              ...s,
                              [inv.id]: { ...s[inv.id], min_stock: e.target.value },
                            }))
                          }
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        <span className="text-slate-500">{inv.min_stock}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editing ? (
                        <input
                          type="number"
                          value={editing.max_stock}
                          onChange={(e) =>
                            setEdits((s) => ({
                              ...s,
                              [inv.id]: { ...s[inv.id], max_stock: e.target.value },
                            }))
                          }
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        <span className="text-slate-500">{inv.max_stock || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Bajo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-600">
                          <Check className="h-3 w-3" />
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => saveEdit(inv.id)}
                            disabled={saving === inv.id}
                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Save className="h-3 w-3" />
                            {saving === inv.id ? '...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() =>
                              setEdits((e) => {
                                const n = { ...e };
                                delete n[inv.id];
                                return n;
                              })
                            }
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : isSaved ? (
                        <span className="text-xs font-medium text-green-600">¡Guardado!</span>
                      ) : (
                        <button
                          onClick={() => setEditingPart(part)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          <Pencil className="h-3 w-3" />
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-2">
          <p className="text-xs text-slate-500">
            Mostrando {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} de {totalCount} productos
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Primera
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Ant.
            </button>
            <span className="px-2 text-xs font-medium text-slate-700">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Sig.
            </button>
            <button
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Ultima
            </button>
          </div>
        </div>
      )}

      {showImportModal && (
        <ExcelImportModal
          branchId={branchId}
          onClose={() => setShowImportModal(false)}
          onDone={() => {
            setShowImportModal(false);
            load();
          }}
        />
      )}

      {contextMenu && (
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        >
          <div
            className="absolute rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { setBarcodePart(contextMenu.part); setContextMenu(null); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              <Printer className="h-4 w-4" />
              {contextMenu.part.barcode ? 'Imprimir Código de Barras' : 'Generar Código de Barras'}
            </button>
            <button
              onClick={() => { setEditingPart(contextMenu.part); setContextMenu(null); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              <Pencil className="h-4 w-4" />
              Editar Producto
            </button>
          </div>
        </div>
      )}

      {barcodePart && (
        <BarcodeModal
          part={barcodePart}
          onClose={() => setBarcodePart(null)}
          onBarcodeUpdated={() => load()}
        />
      )}

      {editingPart && (
        <ProductEditModal
          part={editingPart}
          branchId={branchId}
          allParts={parts}
          onClose={() => setEditingPart(null)}
          onSaved={() => {
            setEditingPart(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'slate' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

type ParsedRow = {
  sku: string;
  name: string;
  brand: string;
  category: string;
  cost: number;
  price: number;
  quantity: number;
  min_stock: number;
  location: string;
  oem_code: string;
  supplier: string;
  barcode: string;
};

function ExcelImportModal({
  branchId,
  onClose,
  onDone,
}: {
  branchId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', codepage: 1252 });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const parsed: ParsedRow[] = [];
        const errs: string[] = [];
        json.forEach((row, i) => {
          const name = String(row['DESCRIP1'] || row['descrip1'] || row['nombre'] || row['Nombre'] || row['name'] || row['Name'] || '').trim();
          const brand = String(row['MARCA'] || row['marca'] || row['Marca'] || row['brand'] || row['Brand'] || '').trim();
          if (!name) {
            errs.push(`Fila ${i + 2}: descripción vacía, se omitió.`);
            return;
          }
          parsed.push({
            sku: String(row['CODIGO1'] || row['codigo1'] || row['Codigo1'] || row['codigo'] || row['Codigo'] || row['código'] || row['Código'] || '').trim(),
            name,
            brand,
            category: String(row['categoria'] || row['Categoria'] || row['categoría'] || row['Categoría'] || row['category'] || '').trim(),
            cost: parseFloat(String(row['COSTOCIF'] || row['costocif'] || row['COSTO'] || row['costo'] || row['Costo'] || row['cost'] || row['Cost'] || 0)) || 0,
            price: parseFloat(String(row['PRECIO1'] || row['precio1'] || row['precio'] || row['Precio'] || row['price'] || row['Price'] || 0)) || 0,
            quantity: parseInt(String(row['INV1'] || row['inv1'] || row['INVENTARIO'] || row['inventario'] || row['Inventario'] || row['cantidad'] || row['Cantidad'] || row['qty'] || row['stock'] || row['Stock'] || 0)) || 0,
            min_stock: parseInt(String(row['min_stock'] || row['Min Stock'] || row['minimo'] || row['Minimo'] || 0)) || 0,
            location: String(row['ubicacion'] || row['Ubicacion'] || row['ubicación'] || row['Ubicación'] || row['location'] || '').trim(),
            oem_code: String(row['CODIGO2'] || row['codigo2'] || row['Codigo2'] || row['oem'] || row['OEM'] || '').trim(),
            supplier: String(row['PROVEEDOR'] || row['proveedor'] || row['Proveedor'] || row['supplier'] || '').trim(),
            barcode: String(row['BARCODE'] || row['barcode'] || row['Barcode'] || row['CODIGO_BARRAS'] || row['codigo_barras'] || '').trim(),
          });
        });
        setRows(parsed);
        setErrors(errs);
        setStep('preview');
      } catch {
        setErrors(['No se pudo leer el archivo. Asegúrate de que sea un Excel válido (.xlsx, .xls, .csv).']);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function doImport() {
    setStep('importing');
    let done = 0;
    for (const row of rows) {
      let partId: string | null = null;

      // Try to find existing part by SKU or name+brand
      if (row.sku) {
        const { data: existing } = await supabase
          .from('parts')
          .select('id')
          .eq('sku', row.sku)
          .maybeSingle();
        if (existing) partId = existing.id;
      }
      if (!partId) {
        const { data: existing } = await supabase
          .from('parts')
          .select('id')
          .eq('name', row.name)
          .eq('brand', row.brand)
          .maybeSingle();
        if (existing) partId = existing.id;
      }

      if (partId) {
        // Update existing part
        await supabase
          .from('parts')
          .update({
            oem_code: row.oem_code || undefined,
            category: row.category || undefined,
            cost: row.cost,
            price: row.price,
            location: row.location || undefined,
            barcode: row.barcode || undefined,
          })
          .eq('id', partId);
      } else {
        // Insert new part
        const { data: inserted } = await supabase
          .from('parts')
          .insert({
            sku: row.sku || null,
            oem_code: row.oem_code || null,
            name: row.name,
            brand: row.brand,
            category: row.category || null,
            cost: row.cost,
            price: row.price,
            location: row.location || null,
            barcode: row.barcode || null,
          })
          .select('id')
          .single();
        if (inserted) partId = inserted.id;
      }

      if (partId) {
        // Check if inventory row exists for this part+branch
        const { data: existingInv } = await supabase
          .from('inventory')
          .select('id')
          .eq('part_id', partId)
          .eq('branch_id', branchId)
          .maybeSingle();

        if (existingInv) {
          await supabase
            .from('inventory')
            .update({ quantity: row.quantity, min_stock: row.min_stock })
            .eq('id', existingInv.id);
        } else {
          await supabase
            .from('inventory')
            .insert({
              part_id: partId,
              branch_id: branchId,
              quantity: row.quantity,
              min_stock: row.min_stock,
            });
        }
      }
      done++;
      setProgress(Math.round((done / rows.length) * 100));
    }
    setStep('done');
  }

  function downloadTemplate() {
    const tpl = [
      ['CODIGO1', 'DESCRIP1', 'INVENTARIO', 'PRECIO1', 'CODIGO2', 'PROVEEDOR', 'MARCA', 'COSTO'],
      ['001-ABC', 'Pastillas de Freno Delanteras', 10, 25.0, '7501234567890', 'Proveedor A', 'Brembo', 12.5],
    ];
    const ws = XLSX.utils.aoa_to_sheet(tpl);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, 'plantilla_inventario.xlsx');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-bold text-slate-800">Importar inventario desde Excel</h2>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              className={`flex flex-col items-center rounded-xl border-2 border-dashed p-10 transition-colors ${dragOver ? 'border-green-400 bg-green-50' : 'border-slate-200'}`}
            >
              <Upload className="mb-3 h-10 w-10 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">Arrastra tu archivo Excel aquí</p>
              <p className="mt-1 text-xs text-slate-400">o haz clic para seleccionar</p>
              <label className="mt-4 cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                Seleccionar archivo
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
            </div>
            <button onClick={downloadTemplate} className="text-sm text-blue-600 underline hover:text-blue-700">
              Descargar plantilla de ejemplo (.xlsx)
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {errors.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3">
                {errors.map((er, i) => (
                  <p key={i} className="text-xs text-amber-700">{er}</p>
                ))}
              </div>
            )}
            <p className="text-sm text-slate-600">{rows.length} repuesto(s) listos para importar:</p>
            <div className="max-h-60 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left">CODIGO1</th>
                    <th className="px-2 py-1.5 text-left">DESCRIP1</th>
                    <th className="px-2 py-1.5 text-right">INV</th>
                    <th className="px-2 py-1.5 text-right">PRECIO1</th>
                    <th className="px-2 py-1.5 text-left">CODIGO2</th>
                    <th className="px-2 py-1.5 text-left">MARCA</th>
                    <th className="px-2 py-1.5 text-right">COSTO</th>
                    <th className="px-2 py-1.5 text-left">BARCODE</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1">{r.sku}</td>
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1 text-right">{r.quantity}</td>
                      <td className="px-2 py-1 text-right">{formatCurrency(r.price)}</td>
                      <td className="px-2 py-1">{r.oem_code}</td>
                      <td className="px-2 py-1">{r.brand}</td>
                      <td className="px-2 py-1 text-right">{formatCurrency(r.cost)}</td>
                      <td className="px-2 py-1">{r.barcode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && <p className="text-xs text-slate-400">...y {rows.length - 50} más</p>}
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={doImport} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                Importar {rows.length} repuesto(s)
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center py-10">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-green-600" />
            <p className="text-sm text-slate-600">Importando... {progress}%</p>
            <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center py-10">
            <CheckCircle2 className="mb-4 h-14 w-14 text-green-500" />
            <p className="text-lg font-semibold text-slate-800">Importación completada</p>
            <p className="mt-1 text-sm text-slate-500">{rows.length} repuesto(s) agregados/actualizados.</p>
            {errors.length > 0 && (
              <div className="mt-4 max-h-32 w-full overflow-auto rounded-lg bg-amber-50 p-3">
                {errors.map((er, i) => (
                  <p key={i} className="flex items-center gap-1 text-xs text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {er}
                  </p>
                ))}
              </div>
            )}
            <button onClick={onDone} className="mt-6 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BarcodeModal({ part, onClose, onBarcodeUpdated }: { part: PartWithRelations; onClose: () => void; onBarcodeUpdated?: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [saved, setSaved] = useState(false);

  const barcodeValue = part.barcode || part.oem_code || part.sku || part.id.slice(0, 12).toUpperCase();

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, barcodeValue, { format: 'CODE128', width: 1, height: 25, displayValue: false, margin: 0 });
      } catch {
        JsBarcode(svgRef.current, part.id.slice(0, 12), { format: 'CODE128', width: 1, height: 25, displayValue: false, margin: 0 });
      }
    }
  }, [barcodeValue, part.id]);

  const saveBarcode = async () => {
    if (part.barcode) return;
    await supabase.from('parts').update({ barcode: barcodeValue }).eq('id', part.id);
    setSaved(true);
    onBarcodeUpdated?.();
  };

  useEffect(() => {
    if (!part.barcode) { saveBarcode(); }
  }, []);

  const handlePrint = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const labels = Array.from({ length: quantity }, () => `
      <div class="barcode-label-container">
        <div class="barcode-title">${part.name}</div>
        <div class="barcode-oem">${part.oem_code ?? ''}</div>
        <div class="barcode-price">${Number(part.price).toFixed(2)}</div>
        ${svgData}
        <div class="barcode-text">${barcodeValue}</div>
      </div>
    `).join('');

    const win = window.open('', '_blank', 'width=400,height=300');
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>Etiquetas</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #fff; }
            .barcode-label-container {
              width: 38mm; height: 25mm;
              display: flex; flex-direction: column;
              padding: 1mm 1.5mm; overflow: hidden;
              page-break-after: always;
            }
            .barcode-label-container:last-child { page-break-after: auto; }
            .barcode-title { font-size: 6.5px; line-height: 7.5px; font-family: sans-serif; text-transform: uppercase; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .barcode-oem { font-size: 6px; font-family: monospace; color: #333; margin: 0.3mm 0; }
            .barcode-price { font-size: 8px; font-weight: bold; font-family: sans-serif; margin: 0 0 0.5mm 0; }
            .barcode-label-container svg { width: 32mm; max-width: 32mm; height: 7mm; max-height: 7mm; display: block; margin: 0 auto; }
            .barcode-text { font-size: 7px; font-family: monospace; margin: 0.3mm 0 0 0; text-align: center; }
            @media print {
              @page { size: 38mm 25mm !important; margin: 0 !important; }
              html, body { width: 38mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
              .barcode-label-container { width: 38mm !important; height: 25mm !important; padding: 1mm 1.5mm !important; page-break-inside: avoid !important; }
              .barcode-title { font-size: 6.5px !important; line-height: 7.5px !important; text-transform: uppercase !important; display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; }
              .barcode-oem { font-size: 6px !important; font-family: monospace !important; color: #333 !important; }
              .barcode-price { font-size: 8px !important; font-weight: bold !important; }
              .barcode-label-container svg { width: 32mm !important; height: 7mm !important; display: block !important; margin: 0 auto !important; }
              .barcode-text { font-size: 7px !important; font-family: monospace !important; text-align: center !important; }
            }
          </style>
        </head>
        <body>
          ${labels}
          <script>window.onload = function() { window.print(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Código de Barras</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {saved && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
            <Check className="h-3.5 w-3.5" />
            Código guardado en la base de datos
          </div>
        )}

        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4" style={{ width: '38mm', height: '25mm', margin: '0 auto' }}>
          <p className="text-[6.5px] leading-[7.5px] font-medium text-slate-900 uppercase text-left line-clamp-2">{part.name}</p>
          <p className="text-[5.5px] font-mono text-slate-700 text-left">{part.oem_code ?? ''}</p>
          <p className="text-[8px] font-bold text-slate-900 text-left mt-[0.3mm]">${Number(part.price).toFixed(2)}</p>
          <div className="flex-1 flex items-center justify-center">
            <svg ref={svgRef} />
          </div>
          <p className="text-[7px] font-mono text-slate-900 text-center">{barcodeValue}</p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">Cantidad:</label>
          <input
            type="number"
            min={1}
            max={100}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            className="w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-center focus:border-blue-500 focus:outline-none"
          />
          <span className="text-xs text-slate-400">etiquetas</span>
        </div>

        <button
          onClick={handlePrint}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" />
          Imprimir {quantity > 1 ? `${quantity} etiquetas` : 'Etiqueta'}
        </button>
      </div>
    </div>
  );
}
