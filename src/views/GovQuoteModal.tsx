import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Eye, Landmark, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import { GOV_LOGO_DATA_URL } from '@/lib/govLogo';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';

interface Part {
  id: string;
  oem_code: string | null;
  sku: string | null;
  name: string;
  brand: string | null;
  price: number;
}

type GovQuoteItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  country: string;
  brand: string;
  manufacturer: string;
};

type TaxMode = 'full' | 'half' | 'exempt';

type SavedQuote = {
  id: string;
  quote_number: number;
  entity: string;
  notes: string;
  tax_mode: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  created_at: string;
};

type Tab = 'new' | 'history';

export default function GovQuoteModal({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('new');
  const [items, setItems] = useState<GovQuoteItem[]>([]);
  const [entity, setEntity] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(true);
  const [searchResults, setSearchResults] = useState<Part[]>([]);
  const [searching, setSearching] = useState(false);
  const [taxMode, setTaxMode] = useState<TaxMode>('full');
  const [quoteNumber, setQuoteNumber] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

  const [history, setHistory] = useState<SavedQuote[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: existing } = await supabase
        .from('gov_quote_sequences')
        .select('last_number')
        .eq('branch_id', branchId)
        .maybeSingle();
      const next = (existing?.last_number ?? 0) + 1;
      await supabase
        .from('gov_quote_sequences')
        .upsert({ branch_id: branchId, last_number: next }, { onConflict: 'branch_id' });
      setQuoteNumber(next);
    })();
  }, [branchId]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('gov_quotes')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(100);
    setHistory((data ?? []) as SavedQuote[]);
    setLoadingHistory(false);
  }, [branchId]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  const searchParts = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const tokens = q.trim().split(/\s+/).filter(Boolean);
    let query = supabase
      .from('parts')
      .select('id, oem_code, sku, name, brand, price')
      .order('name')
      .limit(20);
    for (const token of tokens) {
      query = query.or(`oem_code.ilike.%${token}%,sku.ilike.%${token}%,name.ilike.%${token}%,brand.ilike.%${token}%,barcode.ilike.%${token}%`);
    }
    const { data } = await query;
    setSearchResults((data ?? []) as Part[]);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchParts(search), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, searchParts]);

  function addFromPart(part: Part) {
    setItems((prev) => [
      ...prev,
      {
        description: `${part.oem_code || ''} ${part.name}`.trim(),
        quantity: 1,
        unitPrice: part.price,
        country: '',
        brand: part.brand || '',
        manufacturer: '',
      },
    ]);
    setSearch('');
    searchRef.current?.focus();
  }

  function addManualItem() {
    setItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0, country: '', brand: '', manufacturer: '' }]);
  }

  function updateItem(index: number, field: keyof GovQuoteItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const taxRate = taxMode === 'full' ? 0.07 : taxMode === 'half' ? 0.035 : 0;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  const taxLabel = taxMode === 'full' ? 'ITBMS 7%' : taxMode === 'half' ? 'ITBMS 50% (3.5%)' : 'Exento';

  async function saveQuote() {
    const validItems = items.filter((it) => it.description.trim());
    if (validItems.length === 0 || quoteNumber === null) return;

    setSaving(true);

    if (editingQuoteId) {
      await supabase.from('gov_quotes').update({
        entity,
        notes,
        tax_mode: taxMode,
        subtotal,
        tax_amount: taxAmount,
        total,
      }).eq('id', editingQuoteId);

      await supabase.from('gov_quote_items').delete().eq('quote_id', editingQuoteId);

      await supabase.from('gov_quote_items').insert(
        validItems.map((it, i) => ({
          quote_id: editingQuoteId,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          country: it.country,
          brand: it.brand,
          manufacturer: it.manufacturer,
          sort_order: i,
        }))
      );
    } else {
      const { data: quoteRow } = await supabase.from('gov_quotes').insert({
        branch_id: branchId,
        quote_number: quoteNumber,
        entity,
        notes,
        tax_mode: taxMode,
        subtotal,
        tax_amount: taxAmount,
        total,
      }).select('id').maybeSingle();

      if (quoteRow) {
        await supabase.from('gov_quote_items').insert(
          validItems.map((it, i) => ({
            quote_id: quoteRow.id,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unitPrice,
            country: it.country,
            brand: it.brand,
            manufacturer: it.manufacturer,
            sort_order: i,
          }))
        );
        setEditingQuoteId(quoteRow.id);
      }
    }

    setSaving(false);
  }

  async function handlePrintAndSave() {
    await saveQuote();
    handlePrint();
  }

  async function loadQuote(quoteId: string) {
    const { data: q } = await supabase
      .from('gov_quotes')
      .select('*')
      .eq('id', quoteId)
      .maybeSingle();
    if (!q) return;

    const { data: qItems } = await supabase
      .from('gov_quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order');

    setEntity(q.entity);
    setNotes(q.notes);
    setTaxMode(q.tax_mode as TaxMode);
    setQuoteNumber(q.quote_number);
    setEditingQuoteId(q.id);
    setItems(
      (qItems ?? []).map((it: any) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: Number(it.unit_price),
        country: it.country,
        brand: it.brand,
        manufacturer: it.manufacturer,
      }))
    );
    setTab('new');
  }

  function startNewQuote() {
    setEditingQuoteId(null);
    setItems([]);
    setEntity('');
    setNotes('');
    setTaxMode('full');
    (async () => {
      const { data: existing } = await supabase
        .from('gov_quote_sequences')
        .select('last_number')
        .eq('branch_id', branchId)
        .maybeSingle();
      const next = (existing?.last_number ?? 0) + 1;
      await supabase
        .from('gov_quote_sequences')
        .upsert({ branch_id: branchId, last_number: next }, { onConflict: 'branch_id' });
      setQuoteNumber(next);
    })();
    setTab('new');
  }

  function handlePrint() {
    const validItems = items.filter((it) => it.description.trim());
    if (validItems.length === 0) return;

    const d = '\u0024';
    const rowsHtml = validItems.map((it, i) =>
      '<tr>' +
        '<td style="border:1px solid #ddd;padding:3px 6px;text-align:center;font-size:12px">' + (i + 1) + '</td>' +
        '<td style="border:1px solid #ddd;padding:3px 6px;font-size:12px">' + it.description +
          '<br/><span style="font-size:10px;color:#555">Pa\u00eds: ' + (it.country || '-') + ' | Marca: ' + (it.brand || '-') + ' | Casa Productora: ' + (it.manufacturer || '-') + '</span>' +
        '</td>' +
        '<td style="border:1px solid #ddd;padding:3px 6px;text-align:center;font-size:12px">' + it.quantity + '</td>' +
        '<td style="border:1px solid #ddd;padding:3px 6px;text-align:right;font-size:12px">' + d + it.unitPrice.toFixed(2) + '</td>' +
        '<td style="border:1px solid #ddd;padding:3px 6px;text-align:right;font-size:12px">' + d + (it.quantity * it.unitPrice).toFixed(2) + '</td>' +
      '</tr>'
    ).join('');

    const html = '<!DOCTYPE html><html><head><title>Cotizacion Gobierno</title>' +
      '<style>' +
        'body{font-family:Arial,sans-serif;padding:40px;color:#333}' +
        'table{width:100%;border-collapse:collapse;margin-top:20px}' +
        'th{background:#1e3a5f;color:white;padding:5px 6px;text-align:center;font-weight:bold;font-size:12px}' +
        'h1{color:#1e3a5f;font-size:22px}' +
        '.summary td{font-weight:bold;background:#f8f8f8}' +
        '.biz-header{margin-bottom:10px}' +
      '</style></head><body>' +
      '<div class="biz-header" style="display:flex;align-items:flex-start;gap:20px;margin-bottom:10px;padding-top:10px">' +
      '<div style="width:180px;flex-shrink:0;background:#fff;padding:4px;border-radius:4px"><img src="' + GOV_LOGO_DATA_URL + '" style="width:100%;height:auto;object-fit:contain;display:block;"/></div>' +
      '<div style="text-align:right;flex:1">' +
      '<p style="margin:0;font-size:14px;font-weight:bold">AUTOREPUESTO Y ELECTRONICA NUEVA ERA</p>' +
      '<p style="margin:2px 0;font-size:12px">RUC: 8-863-1871 DV71</p>' +
      '<p style="margin:2px 0;font-size:12px">INTERAMERICANA FRENTE A AUTO CENTRO</p>' +
      '<p style="margin:2px 0;font-size:12px">CELL: 6305-4816</p>' +
      '<p style="margin:2px 0;font-size:12px">CORREO: JOSUECASTILLO0117@GMAIL.COM</p>' +
      '</div></div>' +
      '<hr style="border:none;border-top:2px solid #1e3a5f;margin:10px 0"/>' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
      '<div>' +
      (quoteNumber ? '<p style="margin:0;font-size:13px"><strong>DOCUMENTO:</strong> ' + String(quoteNumber).padStart(4, '0') + '</p>' : '') +
      '<p style="margin:2px 0;font-size:13px"><strong>FECHA:</strong> ' + new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }) + '</p>' +
      '<p style="margin:2px 0;font-size:13px"><strong>CLIENTE:</strong> ' + (entity || 'N/A') + '</p>' +
      '</div>' +
      '<h2 style="margin:0;font-size:16px;color:#1e3a5f">COTIZACI\u00d3N</h2>' +
      '</div>' +
      (notes ? '<p style="font-size:12px"><strong>Notas:</strong> ' + notes + '</p>' : '') +
      '<table>' +
        '<thead><tr><th>#</th><th>Descripci\u00f3n</th><th>Cant.</th><th>P. Unit.</th><th>Total</th></tr></thead>' +
        '<tbody>' + rowsHtml +
          '<tr><td colspan="4" style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:12px">Subtotal</td>' +
            '<td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:12px">' + d + subtotal.toFixed(2) + '</td></tr>' +
          '<tr><td colspan="4" style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:12px">' + taxLabel + '</td>' +
            '<td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:12px">' + d + taxAmount.toFixed(2) + '</td></tr>' +
          '<tr class="summary"><td colspan="4" style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:14px">TOTAL</td>' +
            '<td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:14px">' + d + total.toFixed(2) + '</td></tr>' +
        '</tbody>' +
      '</table>' +
      '<div style="margin-top:50px;text-align:center">' +
        '<div style="border-top:1px solid #333;width:200px;margin:0 auto"></div>' +
        '<p style="margin:4px 0 0;font-size:11px">Firma autorizada</p>' +
      '</div>' +
      '<p style="margin-top:30px;font-size:12px;color:#888">Cotizaci\u00f3n v\u00e1lida por 30 d\u00edas.</p>' +
      '</body></html>';

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      const img = doc.querySelector('img');
      const doPrint = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 100);
      };
      if (img && !img.complete) {
        img.onload = doPrint;
        img.onerror = doPrint;
      } else {
        doPrint();
      }
    };

    setTimeout(() => {
      try { iframe.contentWindow?.print(); } catch (_) {}
      setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} }, 1000);
    }, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <Landmark className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Cotización a Gobierno
              {tab === 'new' && quoteNumber ? ` — N° ${String(quoteNumber).padStart(4, '0')}` : ''}
              {editingQuoteId ? ' (editando)' : ''}
            </h2>
            <p className="text-xs text-slate-500">
              {tab === 'new' ? 'Busca productos por código o agrega manualmente' : 'Historial de cotizaciones guardadas'}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
          <button
            onClick={() => setTab('new')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'new' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            {editingQuoteId ? 'Editar Cotización' : 'Nueva Cotización'}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'history' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Historial
          </button>
        </div>

        {tab === 'new' ? (
          <>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Entity & Notes */}
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Entidad Gubernamental</label>
                  <input
                    value={entity}
                    onChange={(e) => setEntity(e.target.value)}
                    placeholder="Nombre de la entidad..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Notas</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observaciones opcionales..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Search bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowSearch(true); }}
                  placeholder="Buscar producto por código, nombre o marca..."
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                {search.trim() && showSearch && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {searching ? (
                      <p className="px-4 py-3 text-sm text-slate-400">Buscando...</p>
                    ) : searchResults.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400">Sin resultados</p>
                    ) : (
                      searchResults.map((part) => (
                        <button
                          key={part.id}
                          onClick={() => { addFromPart(part); setShowSearch(false); }}
                          className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-blue-50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-700">{part.oem_code || part.sku || '\u2014'} · {part.name}</p>
                            <p className="text-xs text-slate-400">{part.brand || 'Sin marca'}</p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-blue-600">${part.price.toFixed(2)}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Items list */}
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-start gap-2">
                      <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <input
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          placeholder="Descripción del producto..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-slate-400">País de Procedencia</label>
                            <input
                              value={item.country}
                              onChange={(e) => updateItem(idx, 'country', e.target.value)}
                              placeholder="Ej: Panamá, USA..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Marca</label>
                            <input
                              value={item.brand}
                              onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                              placeholder="Ej: Toyota, Brembo..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Casa Productora</label>
                            <input
                              value={item.manufacturer}
                              onChange={(e) => updateItem(idx, 'manufacturer', e.target.value)}
                              placeholder="Ej: Denso, Bosch..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Cantidad</label>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[11px] font-medium text-slate-400">Precio Unitario</label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.unitPrice || ''}
                              onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeItem(idx)} className="mt-1.5 text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addManualItem}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600"
              >
                <Plus className="h-4 w-4" />
                Agregar producto manual
              </button>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-6 py-4">
              {/* Tax selector */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">ITBMS:</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setTaxMode('full')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${taxMode === 'full' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    7%
                  </button>
                  <button
                    onClick={() => setTaxMode('half')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${taxMode === 'half' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    50% (3.5%)
                  </button>
                  <button
                    onClick={() => setTaxMode('exempt')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${taxMode === 'exempt' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Exento
                  </button>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-500">Subtotal: <span className="font-medium text-slate-700">${subtotal.toFixed(2)}</span></p>
                  <p className="text-xs text-slate-500">{taxLabel}: <span className="font-medium text-slate-700">${taxAmount.toFixed(2)}</span></p>
                  <p className="text-lg font-bold text-slate-800">Total: ${total.toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  {editingQuoteId && (
                    <button
                      onClick={startNewQuote}
                      className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Nueva
                    </button>
                  )}
                  <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    Cancelar
                  </button>
                  <button
                    onClick={handlePrintAndSave}
                    disabled={saving || items.length === 0 || items.every((i) => !i.description.trim())}
                    className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-40"
                  >
                    <Printer className="h-4 w-4" />
                    {saving ? 'Guardando...' : 'Guardar e Imprimir'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* History tab */
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingHistory ? (
              <p className="py-12 text-center text-sm text-slate-400">Cargando historial...</p>
            ) : history.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-500">No hay cotizaciones guardadas aún</p>
                <p className="mt-1 text-xs text-slate-400">Las cotizaciones se guardan automáticamente al imprimir</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => loadQuote(q.id)}
                    className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50/30"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-700">
                      {String(q.quote_number).padStart(4, '0')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {q.entity || 'Sin entidad'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(q.created_at).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {q.notes ? ` — ${q.notes}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">{formatCurrency(q.total)}</p>
                      <p className="text-[11px] text-slate-400">
                        {q.tax_mode === 'full' ? '7% ITBMS' : q.tax_mode === 'half' ? '3.5% ITBMS' : 'Exento'}
                      </p>
                    </div>
                    <Eye className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
