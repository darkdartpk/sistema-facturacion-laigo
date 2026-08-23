import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, type PartWithRelations, type ProductType, type KitComponent } from '@/lib/supabase';
import { formatCurrency, matchesTokens } from '@/lib/format';
import { logAudit } from '@/lib/audit';
import JsBarcode from 'jsbarcode';
import {
  X,
  Save,
  Package,
  Wrench,
  Layers,
  DollarSign,
  Search,
  Plus,
  Trash2,
  Loader2,
  Printer,
} from 'lucide-react';

type KitComponentRow = KitComponent & { component?: { name: string; oem_code: string | null; brand: string } };

interface Props {
  part: PartWithRelations;
  branchId: string;
  allParts: PartWithRelations[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ProductEditModal({ part, branchId, allParts, onClose, onSaved }: Props) {
  const inv = part.inventory.find((i) => i.branch_id === branchId);

  const [price, setPrice] = useState(String(part.price));
  const [price2, setPrice2] = useState(String(part.price2 ?? 0));
  const [cost, setCost] = useState(String(part.cost));
  const [costFob, setCostFob] = useState(String(part.cost_fob ?? 0));
  const [location, setLocation] = useState(part.location ?? '');
  const [name, setName] = useState(part.name);
  const [oemCode, setOemCode] = useState(part.oem_code ?? '');
  const [code2, setCode2] = useState(part.code2 ?? '');
  const [barcode, setBarcode] = useState(part.barcode ?? '');
  const [brand, setBrand] = useState(part.brand);
  const [showBarcodePrint, setShowBarcodePrint] = useState(false);
  const [productType, setProductType] = useState<ProductType>(part.product_type ?? 'articulo');
  const [minStock, setMinStock] = useState(String(inv?.min_stock ?? 0));
  const [quantity, setQuantity] = useState(String(inv?.quantity ?? 0));

  const [kitComponents, setKitComponents] = useState<KitComponentRow[]>([]);
  const [kitSearch, setKitSearch] = useState('');
  const [loadingKit, setLoadingKit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (part.product_type === 'kit' || productType === 'kit') {
      loadKitComponents();
    }
  }, []);

  async function loadKitComponents() {
    setLoadingKit(true);
    const { data } = await supabase
      .from('kit_components')
      .select('*, component:component_id(name, oem_code, brand)')
      .eq('kit_id', part.id);
    if (data) setKitComponents(data as KitComponentRow[]);
    setLoadingKit(false);
  }

  const kitSearchResults = useMemo(() => {
    if (!kitSearch.trim()) return [];
    return allParts
      .filter((p) => {
        if (p.id === part.id) return false;
        if (p.product_type === 'kit') return false;
        if (kitComponents.some((kc) => kc.component_id === p.id)) return false;
        const hay = `${p.oem_code || ''} ${p.sku || ''} ${p.name} ${p.brand}`;
        return matchesTokens(hay, kitSearch);
      })
      .slice(0, 10);
  }, [kitSearch, allParts, kitComponents, part.id]);

  function addKitComponent(comp: PartWithRelations) {
    setKitComponents((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${comp.id}`,
        kit_id: part.id,
        component_id: comp.id,
        quantity: 1,
        created_at: new Date().toISOString(),
        component: { name: comp.name, oem_code: comp.oem_code, brand: comp.brand },
      },
    ]);
    setKitSearch('');
  }

  function removeKitComponent(idx: number) {
    setKitComponents((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateKitComponentQty(idx: number, qty: number) {
    if (qty < 1) return;
    setKitComponents((prev) => prev.map((item, i) => (i === idx ? { ...item, quantity: qty } : item)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const numPrice = parseFloat(price) || 0;
      const numPrice2 = parseFloat(price2) || 0;
      const numCost = parseFloat(cost) || 0;
      const numCostFob = parseFloat(costFob) || 0;

      await supabase
        .from('parts')
        .update({
          name: name.trim(),
          oem_code: oemCode.trim() || null,
          code2: code2.trim() || null,
          barcode: barcode.trim() || null,
          brand: brand.trim(),
          price: numPrice,
          price2: numPrice2,
          cost: numCost,
          cost_fob: numCostFob,
          location: location.trim() || null,
          product_type: productType,
        })
        .eq('id', part.id);

      if (inv) {
        const numQty = parseInt(quantity) || 0;
        const numMin = parseInt(minStock) || 0;
        await supabase
          .from('inventory')
          .update({ quantity: numQty, min_stock: numMin })
          .eq('id', inv.id);
      }

      if (productType === 'kit') {
        await supabase.from('kit_components').delete().eq('kit_id', part.id);
        if (kitComponents.length > 0) {
          const rows = kitComponents.map((kc) => ({
            kit_id: part.id,
            component_id: kc.component_id,
            quantity: kc.quantity,
          }));
          await supabase.from('kit_components').insert(rows);
        }
      }

      logAudit({
        tableName: 'parts',
        recordId: part.id,
        action: part.price !== numPrice ? 'price_change' : 'update',
        changes: {
          producto: part.name,
          ...(part.price !== numPrice && { precio: { old: part.price, new: numPrice } }),
          ...(part.cost !== numCost && { costo: { old: part.cost, new: numCost } }),
          ...(part.product_type !== productType && { tipo: { old: part.product_type, new: productType } }),
        },
        sellerName: 'Admin',
      });

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const typeOptions: { value: ProductType; label: string; icon: typeof Package; desc: string }[] = [
    { value: 'articulo', label: 'Artículo', icon: Package, desc: 'Producto fisico con inventario' },
    { value: 'servicio', label: 'Servicio', icon: Wrench, desc: 'No afecta inventario' },
    { value: 'kit', label: 'Kit', icon: Layers, desc: 'Compuesto por otros productos' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-slate-800">{part.name}</h2>
            <p className="text-xs text-slate-500">{part.oem_code ?? part.sku ?? 'Sin código'} · {part.brand}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
          {/* Basic Info */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-slate-400" />
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Información Básica</label>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Marca</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Código</label>
                  <input
                    type="text"
                    value={oemCode}
                    onChange={(e) => setOemCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Código #2</label>
                  <input
                    type="text"
                    value={code2}
                    onChange={(e) => setCode2(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Ubicación</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Código de Barras</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Escanear o ingresar manualmente"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setShowBarcodePrint(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir Código de Barras
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Product Type */}
          <div className="mb-5">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Tipo de Producto
            </label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = productType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setProductType(opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all ${
                      active
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-slate-700'}`}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-slate-400 text-center">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prices Section */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-slate-400" />
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Precios y Costos</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Costo</label>
                <input
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-green-600">% Ganancia</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    value={
                      (parseFloat(cost) || 0) > 0
                        ? (((parseFloat(price) || 0) - (parseFloat(cost) || 0)) / (parseFloat(cost) || 1) * 100).toFixed(1)
                        : ''
                    }
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value);
                      if (!isNaN(pct)) {
                        const c = parseFloat(cost) || 0;
                        setPrice((c + c * pct / 100).toFixed(2));
                      }
                    }}
                    placeholder="0"
                    className="w-full rounded-lg border border-green-200 bg-green-50/50 px-3 py-2 pr-8 text-sm font-medium text-green-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-green-500">%</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Precio Venta</label>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Precio 2 (Mayorista)</label>
                <input
                  type="number"
                  step="0.01"
                  value={price2}
                  onChange={(e) => setPrice2(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Costo FOB</label>
                <input
                  type="number"
                  step="0.01"
                  value={costFob}
                  onChange={(e) => setCostFob(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Stock (only for articulo) */}
          {productType !== 'servicio' && (
            <div className="mb-5">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Inventario
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Cantidad en Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Stock Mínimo</label>
                  <input
                    type="number"
                    min={0}
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Kit Components */}
          {productType === 'kit' && (
            <div className="mb-5">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Componentes del Kit
              </label>
              <p className="mb-3 text-xs text-slate-400">
                Al vender este kit, se descontarán estos productos del inventario.
              </p>

              {/* Search to add */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={kitSearch}
                  onChange={(e) => setKitSearch(e.target.value)}
                  placeholder="Buscar producto para agregar al kit..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {kitSearch.trim() && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {kitSearchResults.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400">Sin resultados</p>
                    ) : (
                      kitSearchResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => addKitComponent(p)}
                          className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-blue-50"
                        >
                          <Plus className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-700">
                              {p.oem_code || p.sku || '—'} · {p.name}
                            </p>
                            <p className="text-[11px] text-slate-400">{p.brand}</p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-slate-500">{formatCurrency(p.price)}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Kit items list */}
              {loadingKit ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                </div>
              ) : kitComponents.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-slate-200 py-6 text-center">
                  <Layers className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  <p className="text-xs text-slate-400">No hay componentes. Busca productos para agregarlos.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {kitComponents.map((kc, idx) => (
                    <div
                      key={kc.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-700">
                          {kc.component?.name ?? 'N/A'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {kc.component?.oem_code ?? ''}{kc.component?.brand ? ` · ${kc.component.brand}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-slate-400">Cant:</label>
                        <input
                          type="number"
                          min={1}
                          value={kc.quantity}
                          onChange={(e) => updateKitComponentQty(idx, parseInt(e.target.value) || 1)}
                          className="w-14 rounded border border-slate-200 px-2 py-1 text-center text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => removeKitComponent(idx)}
                        className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-xs text-slate-400">
            Margen: {((parseFloat(price) || 0) - (parseFloat(cost) || 0)).toFixed(2)} ({((parseFloat(cost) || 0) > 0 ? (((parseFloat(price) || 0) - (parseFloat(cost) || 0)) / (parseFloat(cost) || 1) * 100).toFixed(0) : 0)}%)
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </button>
          </div>
        </div>
      </div>
      {showBarcodePrint && (
        <BarcodePrintModal
          part={{ ...part, barcode: barcode || part.barcode, name, oem_code: oemCode, price: parseFloat(price) || part.price }}
          onClose={() => setShowBarcodePrint(false)}
        />
      )}
    </div>
  );
}

function BarcodePrintModal({ part, onClose }: { part: { id: string; name: string; oem_code: string | null; barcode: string | null; price: number }; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [quantity, setQuantity] = useState(1);
  const barcodeValue = part.barcode || part.oem_code || part.id.slice(0, 12).toUpperCase();

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, barcodeValue, { format: 'CODE128', width: 1, height: 25, displayValue: false, margin: 0 });
      } catch {
        JsBarcode(svgRef.current, part.id.slice(0, 12), { format: 'CODE128', width: 1, height: 25, displayValue: false, margin: 0 });
      }
    }
  }, [barcodeValue]);

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
    win.document.write(`<html><head><title>Etiquetas</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{background:#fff}
      .barcode-label-container{width:38mm;height:25mm;display:flex;flex-direction:column;padding:1mm 1.5mm;overflow:hidden;page-break-after:always}
      .barcode-label-container:last-child{page-break-after:auto}
      .barcode-title{font-size:6.5px;line-height:7.5px;font-family:sans-serif;text-transform:uppercase;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .barcode-oem{font-size:6px;font-family:monospace;color:#333;margin:0.3mm 0}
      .barcode-price{font-size:8px;font-weight:bold;font-family:sans-serif;margin:0 0 0.5mm 0}
      .barcode-label-container svg{width:32mm;max-width:32mm;height:7mm;max-height:7mm;display:block;margin:0 auto}
      .barcode-text{font-size:7px;font-family:monospace;margin:0.3mm 0 0 0;text-align:center}
      @media print{@page{size:38mm 25mm!important;margin:0!important}html,body{width:38mm!important;margin:0!important;padding:0!important;overflow:hidden!important}
      .barcode-label-container{width:38mm!important;height:25mm!important;padding:1mm 1.5mm!important;page-break-inside:avoid!important}}
    </style></head><body>${labels}<script>window.onload=function(){window.print()}<\/script></body></html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Vista previa de etiqueta</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-col rounded-lg border border-slate-200 p-3" style={{ width: '38mm', height: '25mm', margin: '0 auto' }}>
          <p className="text-[6.5px] leading-[7.5px] font-medium text-slate-900 uppercase line-clamp-2">{part.name}</p>
          <p className="text-[5.5px] font-mono text-slate-700">{part.oem_code ?? ''}</p>
          <p className="text-[8px] font-bold text-slate-900 mt-[0.3mm]">${Number(part.price).toFixed(2)}</p>
          <div className="flex-1 flex items-center justify-center"><svg ref={svgRef} /></div>
          <p className="text-[7px] font-mono text-slate-900 text-center">{barcodeValue}</p>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Cantidad:</label>
          <input type="number" min={1} max={100} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 rounded border border-slate-200 px-2 py-1 text-sm text-center focus:border-blue-500 focus:outline-none" />
        </div>
        <button onClick={handlePrint} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Printer className="h-4 w-4" />
          Imprimir {quantity > 1 ? `${quantity} etiquetas` : 'Etiqueta'}
        </button>
      </div>
    </div>
  );
}
