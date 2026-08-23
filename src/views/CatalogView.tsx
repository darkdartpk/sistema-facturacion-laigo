import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, type PartWithRelations } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Search, X, ChevronRight, Package, Plus, Loader2, Camera, ImageIcon, Trash2, Pencil } from 'lucide-react';
import ProductEditModal from '@/views/ProductEditModal';


const PAGE_SIZE = 100;

export default function CatalogView({ branchId }: { branchId: string }) {
  const [parts, setParts] = useState<PartWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [selectedPart, setSelectedPart] = useState<PartWithRelations | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editPart, setEditPart] = useState<PartWithRelations | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; part: PartWithRelations } | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load categories & brands once
  useEffect(() => {
    supabase.from('parts').select('category').then(({ data }) => {
      if (data) setCategories([...new Set(data.map((r: any) => r.category).filter(Boolean))] as string[]);
    });
    supabase.from('parts').select('brand').then(({ data }) => {
      if (data) setBrands([...new Set(data.map((r: any) => r.brand).filter(Boolean))].sort() as string[]);
    });
  }, []);

  const buildQuery = useCallback((from: number, to: number) => {
    let query = supabase
      .from('parts')
      .select('*, inventory(*)', { count: 'exact' })
      .order('name')
      .range(from, to);

    if (categoryFilter) query = query.eq('category', categoryFilter);
    if (brandFilter) query = query.eq('brand', brandFilter);
    if (debouncedSearch.trim()) {
      const tokens = debouncedSearch.trim().split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        query = query.or(`sku.ilike.%${token}%,oem_code.ilike.%${token}%,code2.ilike.%${token}%,name.ilike.%${token}%,brand.ilike.%${token}%`);
      }
    }
    return query;
  }, [categoryFilter, brandFilter, debouncedSearch]);

  const loadParts = useCallback(async () => {
    setLoading(true);
    const query = buildQuery(0, PAGE_SIZE - 1);
    const { data, error, count } = await query;
    if (!error && data) {
      setParts(data as PartWithRelations[]);
      setTotalCount(count ?? 0);
      setHasMore((data.length) >= PAGE_SIZE);
    }
    setLoading(false);
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const from = parts.length;
    const to = from + PAGE_SIZE - 1;
    const query = buildQuery(from, to);
    const { data, error } = await query;
    if (!error && data) {
      setParts((prev) => [...prev, ...(data as PartWithRelations[])]);
      setHasMore(data.length >= PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [buildQuery, parts.length, loadingMore, hasMore]);

  useEffect(() => {
    loadParts();
  }, [loadParts]);

  // Infinite scroll handler
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        loadMore();
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [loadMore]);

  return (
    <div className="flex h-full flex-col">
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
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">
          {totalCount.toLocaleString()} producto{totalCount !== 1 ? 's' : ''}{parts.length < totalCount ? ` (mostrando ${parts.length})` : ''}
        </span>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo Repuesto
        </button>

      </div>

      {/* Table */}
      <div ref={scrollRef} className="flex-1 overflow-auto bg-slate-50 scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-sm">
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Codigo</th>
              <th className="px-4 py-3 font-semibold">Repuesto</th>
              <th className="px-4 py-3 font-semibold">Marca</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 text-right font-semibold">Precio</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  Cargando catálogo...
                </td>
              </tr>
            ) : parts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  No se encontraron repuestos.
                </td>
              </tr>
            ) : (
              parts.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedPart(p)}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, part: p }); }}
                  className="cursor-pointer border-b border-slate-100 bg-white transition-colors hover:bg-blue-50/30"
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-600">
                    {p.sku ?? p.oem_code ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt="" className="h-8 w-8 shrink-0 rounded-md border border-slate-200 object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100">
                          <Package className="h-4 w-4 text-slate-300" />
                        </div>
                      )}
                      <span className="font-medium text-slate-800">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.brand}</td>
                  <td className="px-4 py-3">
                    {p.category && (
                      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {p.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {formatCurrency(p.price)}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {loadingMore && (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <span className="ml-2 text-sm text-slate-500">Cargando más...</span>
          </div>
        )}
      </div>

      {selectedPart && (
        <PartDetailDrawer part={selectedPart} onClose={() => setSelectedPart(null)} />
      )}
      {showAddModal && (
        <AddPartModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            loadParts();
          }}
        />
      )}

      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        >
          <div
            className="absolute rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { setEditPart(contextMenu.part); setContextMenu(null); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"
            >
              <Pencil size={14} /> Editar producto
            </button>
          </div>
        </div>
      )}

      {editPart && (
        <ProductEditModal
          part={editPart}
          branchId={branchId}
          allParts={parts}
          onClose={() => setEditPart(null)}
          onSaved={() => { setEditPart(null); loadParts(); }}
        />
      )}

    </div>
  );
}

function PartDetailDrawer({
  part,
  onClose,
}: {
  part: PartWithRelations;
  onClose: () => void;
}) {
  const [photoUrl, setPhotoUrl] = useState(part.photo_url);
  const [uploading, setUploading] = useState(false);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${part.id}.${ext}`;
    await supabase.storage.from('product-photos').upload(path, file, { upsert: true });
    const { data: urlData } = supabase.storage.from('product-photos').getPublicUrl(path);
    const url = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('parts').update({ photo_url: url }).eq('id', part.id);
    setPhotoUrl(url);
    setUploading(false);
  }

  async function handlePhotoRemove() {
    const ext = (photoUrl ?? '').split('.').pop()?.split('?')[0] ?? 'jpg';
    const path = `${part.id}.${ext}`;
    await supabase.storage.from('product-photos').remove([path]);
    await supabase.from('parts').update({ photo_url: null }).eq('id', part.id);
    setPhotoUrl(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto bg-white shadow-xl scrollbar-thin">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-800">Detalle del Repuesto</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Photo */}
          <div className="flex flex-col items-center gap-3">
            {photoUrl ? (
              <div className="relative h-40 w-40 overflow-hidden rounded-xl border border-slate-200">
                <img src={photoUrl} alt={part.name} className="h-full w-full object-cover" />
                <button
                  onClick={handlePhotoRemove}
                  className="absolute right-1.5 top-1.5 rounded-full bg-red-600 p-1 text-white shadow hover:bg-red-700"
                  title="Eliminar foto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                <ImageIcon className="h-10 w-10 text-slate-300" />
              </div>
            )}
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${uploading ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {uploading ? 'Subiendo...' : photoUrl ? 'Cambiar foto' : 'Agregar foto'}
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
            </label>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800">{part.name}</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Marca" value={part.brand} />
            <InfoField label="Categoría" value={part.category ?? '—'} />
            <InfoField label="Codigo" value={part.sku ?? part.oem_code ?? '—'} />
            <InfoField label="Codigo #2" value={part.code2 ?? '—'} />
            <InfoField label="Precio" value={formatCurrency(part.price)} highlight />
          </div>

          {part.description && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Descripción
              </p>
              <p className="text-sm text-slate-600">{part.description}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Stock por Sucursal
            </p>
            <div className="space-y-2">
              {part.inventory.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                >
                  <span className="text-sm text-slate-600">Sucursal</span>
                  <span
                    className={`text-sm font-semibold ${
                      inv.quantity <= inv.min_stock ? 'text-red-600' : 'text-slate-800'
                    }`}
                  >
                    {inv.quantity} u.
                  </span>
                </div>
              ))}
              {part.inventory.length === 0 && (
                <p className="text-sm text-slate-400">Sin stock registrado.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Category = { id: string; name: string; profit_margin: number };
type Brand = { id: string; name: string };

function AddPartModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    brand: '',
    category: '',
    oem_code: '',
    code2: '',
    price: '',
    cost: '',
    description: '',
    location: '',
  });
  const [profitPct, setProfitPct] = useState('');
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [brandList, setBrandList] = useState<Brand[]>([]);

  useEffect(() => {
    supabase.from('categories').select('id, name, profit_margin').order('name').then(({ data }) => {
      if (data) setCategoryList(data);
    });
    supabase.from('brands').select('id, name').order('name').then(({ data }) => {
      if (data) setBrandList(data);
    });
  }, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const setField = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    const priceNum = parseFloat(form.price) || 0;
    const costNum = parseFloat(form.cost) || 0;
    if (priceNum < 0 || costNum < 0) {
      setError('Precio y costo no pueden ser negativos.');
      return;
    }
    setSaving(true);

    const { data: partData, error: partError } = await supabase
      .from('parts')
      .insert({
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        category: form.category.trim() || null,
        oem_code: form.oem_code.trim() || null,
        code2: form.code2.trim() || null,
        price: priceNum,
        cost: costNum,
        description: form.description.trim() || null,
        location: form.location.trim() || null,
      })
      .select()
      .single();

    if (partError) {
      setError(partError.code === '23505' ? 'Ya existe un repuesto con ese codigo.' : 'Error al guardar el repuesto.');
      setSaving(false);
      return;
    }

    if (photoFile && partData) {
      const ext = photoFile.name.split('.').pop() ?? 'jpg';
      const path = `${partData.id}.${ext}`;
      await supabase.storage.from('product-photos').upload(path, photoFile, { upsert: true });
      const { data: urlData } = supabase.storage.from('product-photos').getPublicUrl(path);
      await supabase.from('parts').update({ photo_url: urlData.publicUrl }).eq('id', partData.id);
    }

    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Plus className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-800">Nuevo Repuesto</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Codigo">
              <input
                value={form.oem_code}
                onChange={(e) => setField('oem_code', e.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </FormField>
            <FormField label="Codigo #2">
              <input
                value={form.code2}
                onChange={(e) => setField('code2', e.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </FormField>
          </div>

          <FormField label="Nombre *">
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Balata delantera"
              className={inputClass}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Marca">
              <SearchableSelect
                items={brandList.map((b) => b.name)}
                value={form.brand}
                onChange={(v) => setField('brand', v)}
                placeholder="Seleccionar o crear"
                onCreate={async (name) => {
                  const { data } = await supabase.from('brands').insert({ name }).select('id, name').single();
                  if (data) setBrandList((b) => [...b, data].sort((a, c) => a.name.localeCompare(c.name)));
                }}
              />
            </FormField>
            <FormField label="Categoría">
              <SearchableSelect
                items={categoryList.map((c) => c.name)}
                value={form.category}
                onChange={(v) => {
                  setField('category', v);
                  const cat = categoryList.find((c) => c.name === v);
                  if (cat && cat.profit_margin > 0) {
                    setProfitPct(String(cat.profit_margin));
                    const cost = parseFloat(form.cost) || 0;
                    if (cost > 0) {
                      setForm((f) => ({ ...f, category: v, price: (cost * (1 + cat.profit_margin / 100)).toFixed(2) }));
                    } else {
                      setField('category', v);
                    }
                  } else {
                    setField('category', v);
                  }
                }}
                placeholder="Seleccionar o crear"
                onCreate={async (name) => {
                  const { data } = await supabase.from('categories').insert({ name, profit_margin: 0 }).select('id, name, profit_margin').single();
                  if (data) setCategoryList((c) => [...c, data].sort((a, b) => a.name.localeCompare(b.name)));
                }}
              />
            </FormField>
          </div>

          <FormField label="Ubicación">
            <input
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="Ej. Estante A-3"
              className={inputClass}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Costo (B/)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={(e) => {
                  setField('cost', e.target.value);
                  const c = parseFloat(e.target.value) || 0;
                  const p = parseFloat(profitPct) || 0;
                  if (c > 0 && p > 0) {
                    setForm((f) => ({ ...f, cost: e.target.value, price: (c * (1 + p / 100)).toFixed(2) }));
                  } else {
                    setField('cost', e.target.value);
                  }
                }}
                placeholder="0.00"
                className={inputClass}
              />
            </FormField>
            <FormField label="% Ganancia">
              <input
                type="number"
                step="0.01"
                min="0"
                value={profitPct}
                onChange={(e) => {
                  setProfitPct(e.target.value);
                  const c = parseFloat(form.cost) || 0;
                  const p = parseFloat(e.target.value) || 0;
                  if (c > 0 && p > 0) {
                    setForm((f) => ({ ...f, price: (c * (1 + p / 100)).toFixed(2) }));
                  }
                }}
                placeholder="Ej. 30"
                className={inputClass}
              />
              {categoryList.find((c) => c.name === form.category)?.profit_margin ? (
                <p className="mt-1 text-xs text-slate-400">
                  Margen de la categoría: {categoryList.find((c) => c.name === form.category)!.profit_margin}%
                </p>
              ) : null}
            </FormField>
          </div>

          <FormField label="Precio (B/)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setField('price', e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </FormField>

          <FormField label="Foto del Producto">
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                  <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute right-0.5 top-0.5 rounded-full bg-red-600 p-0.5 text-white hover:bg-red-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
                  <ImageIcon className="h-6 w-6 text-slate-300" />
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200">
                <Camera className="h-3.5 w-3.5" />
                {photoPreview ? 'Cambiar' : 'Seleccionar foto'}
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
            </div>
          </FormField>

          <FormField label="Descripción">
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Opcional"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </FormField>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
        </form>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Guardando...' : 'Guardar Repuesto'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function SearchableSelect({
  items,
  value,
  onChange,
  onCreate,
  placeholder,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  onCreate: (name: string) => Promise<void>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => items.filter((i) => i.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;
    await onCreate(name);
    onChange(name);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          placeholder={placeholder || 'Buscar...'}
          className={`${inputClass} pr-8`}
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg scrollbar-thin">
            {filtered.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  onChange(item);
                  setQuery('');
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${item === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700'}`}
              >
                {item}
              </button>
            ))}
            {query.trim() && !filtered.some((i) => i.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={handleCreate}
                className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear "{query.trim()}"
              </button>
            )}
            {filtered.length === 0 && !query.trim() && (
              <p className="px-3 py-2 text-sm text-slate-400">Sin resultados</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm ${highlight ? 'font-bold text-blue-700' : 'text-slate-700'}`}>
        {value}
      </p>
    </div>
  );
}
