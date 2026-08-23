import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  supabase,
  type Seller,
  type SellerPermission,
  type Branch,
  type SellerRole,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  ROLE_LABELS,
} from '@/lib/supabase';
import {
  UserCog,
  Plus,
  Search,
  Shield,
  KeyRound,
  Trash2,
  X,
  Check,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Boxes,
  FileCheck2,
  Download,
  BarChart3,
  Clock,
  History,
  Wifi,
  PackageSearch,
} from 'lucide-react';
import RestockReportView from '@/views/RestockReportView';
import InventoryReportView from '@/views/InventoryReportView';
import FEConfigView from '@/views/FEConfigView';
import ExportDataView from '@/views/ExportDataView';
import StatsView from '@/views/StatsView';
import AgingReportView from '@/views/AgingReportView';
import AuditLogView from '@/views/AuditLogView';
import OfflineModeView from '@/views/OfflineModeView';

type SellerWithPerms = Seller & {
  permissions: SellerPermission[];
  branch_name?: string;
};

type AdminTab = 'sellers' | 'restock' | 'inventoryReport' | 'feConfig' | 'export' | 'stats' | 'aging' | 'audit' | 'offline';

export default function AdminView({ branches, branchId }: { branches: Branch[]; branchId?: string }) {
  const [tab, setTab] = useState<AdminTab>('sellers');
  const [sellers, setSellers] = useState<SellerWithPerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('sellers').select('*').order('created_at');
    const { data: sellerRows } = await q;

    const { data: permRows } = await supabase
      .from('seller_permissions')
      .select('*');

    if (!sellerRows) {
      setLoading(false);
      return;
    }

    const enriched: SellerWithPerms[] = sellerRows.map((s: Seller) => ({
      ...s,
      permissions: (permRows ?? []).filter((p: SellerPermission) => p.seller_id === s.id),
      branch_name: branches.find((b) => b.id === s.branch_id)?.name,
    }));

    setSellers(enriched);
    setLoading(false);
  }, [branches]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.seller_code.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q),
    );
  }, [sellers, search]);

  const toggleActive = async (seller: Seller) => {
    await supabase
      .from('sellers')
      .update({ is_active: !seller.is_active })
      .eq('id', seller.id);
    fetchSellers();
  };

  const deleteSeller = async (seller: Seller) => {
    if (!confirm(`¿Eliminar al vendedor "${seller.name}"?`)) return;
    await supabase.from('seller_permissions').delete().eq('seller_id', seller.id);
    await supabase.from('sellers').delete().eq('id', seller.id);
    fetchSellers();
  };

  const togglePermission = async (seller: SellerWithPerms, permKey: string) => {
    const existing = seller.permissions.find((p) => p.permission === permKey);
    if (existing) {
      await supabase
        .from('seller_permissions')
        .update({ granted: !existing.granted })
        .eq('id', existing.id);
    } else {
      await supabase.from('seller_permissions').insert({
        seller_id: seller.id,
        permission: permKey,
        granted: true,
      });
    }
    fetchSellers();
  };

  const updateRole = async (seller: Seller, role: SellerRole) => {
    await supabase.from('sellers').update({ role }).eq('id', seller.id);
    fetchSellers();
  };

  const updatePin = async (seller: Seller, pin: string) => {
    if (!/^\d{4,6}$/.test(pin)) {
      alert('El PIN debe tener entre 4 y 6 dígitos numéricos.');
      return;
    }
    await supabase.from('sellers').update({ pin }).eq('id', seller.id);
    fetchSellers();
  };

  const updateCommissionRate = async (seller: Seller, rate: string) => {
    const num = parseFloat(rate);
    if (isNaN(num) || num < 0 || num > 100) {
      alert('La comisión debe ser un porcentaje entre 0 y 100.');
      return;
    }
    await supabase.from('sellers').update({ commission_rate: num }).eq('id', seller.id);
    fetchSellers();
  };

  const updateVendorNumber = async (seller: Seller, value: string) => {
    if (value && !/^\d{1,2}$/.test(value)) {
      alert('El número de vendedor debe ser de 00 a 99.');
      return;
    }
    const formatted = value ? value.padStart(2, '0') : null;
    const { error } = await supabase.from('sellers').update({ vendor_number: formatted }).eq('id', seller.id);
    if (error) {
      alert(error.message.includes('unique') ? 'Ese número ya está asignado a otro vendedor.' : error.message);
      return;
    }
    fetchSellers();
  };

  const updateBranch = async (seller: Seller, branchIdVal: string) => {
    await supabase
      .from('sellers')
      .update({ branch_id: branchIdVal || null })
      .eq('id', seller.id);
    fetchSellers();
  };

  return (
    <div className="flex h-full flex-col bg-slate-100">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <UserCog className="h-5 w-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-800">Administración</h1>
        </div>
        {/* Tabs - scrollable */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto max-w-[60vw]">
          <TabButton active={tab === 'sellers'} onClick={() => setTab('sellers')} icon={<UserCog className="h-4 w-4" />} label="Usuarios" />
          <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} icon={<BarChart3 className="h-4 w-4" />} label="Estadisticas" />
          <TabButton active={tab === 'aging'} onClick={() => setTab('aging')} icon={<Clock className="h-4 w-4" />} label="Antiguedad" />
          <TabButton active={tab === 'audit'} onClick={() => setTab('audit')} icon={<History className="h-4 w-4" />} label="Historial" />
          <TabButton active={tab === 'export'} onClick={() => setTab('export')} icon={<Download className="h-4 w-4" />} label="Exportar" />
          <TabButton active={tab === 'restock'} onClick={() => setTab('restock')} icon={<PackageSearch className="h-4 w-4" />} label="Reabastecimiento" />
          <TabButton active={tab === 'inventoryReport'} onClick={() => setTab('inventoryReport')} icon={<Boxes className="h-4 w-4" />} label="Informe Inv." />
          <TabButton active={tab === 'feConfig'} onClick={() => setTab('feConfig')} icon={<FileCheck2 className="h-4 w-4" />} label="Fact. Electr." />
          <TabButton active={tab === 'offline'} onClick={() => setTab('offline')} icon={<Wifi className="h-4 w-4" />} label="Offline" />
        </div>
        {tab === 'sellers' && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar vendedor..."
                className="w-56 rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nuevo usuario
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {tab === 'stats' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <StatsView branchId={branchId ?? ''} />
        </div>
      ) : tab === 'aging' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <AgingReportView branchId={branchId ?? ''} />
        </div>
      ) : tab === 'audit' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <AuditLogView />
        </div>
      ) : tab === 'export' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <ExportDataView />
        </div>
      ) : tab === 'restock' ? (
        <RestockReportView branches={branches} branchId={branchId} />
      ) : tab === 'inventoryReport' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <InventoryReportView branches={branches} />
        </div>
      ) : tab === 'feConfig' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <FEConfigView />
        </div>
      ) : tab === 'offline' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <OfflineModeView />
        </div>
      ) : (
        <>
          {/* Seller list */}
          <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-slate-400">
            <UserCog className="mb-3 h-12 w-12" />
            <p className="text-sm">No se encontraron vendedores</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            {filtered.map((seller) => {
              const expanded = expandedId === seller.id;
              const grantedCount = seller.permissions.filter((p) => p.granted).length;
              return (
                <div
                  key={seller.id}
                  className={`overflow-hidden rounded-xl border bg-white transition-shadow ${
                    expanded ? 'border-blue-300 shadow-md' : 'border-slate-200 shadow-sm'
                  }`}
                >
                  {/* Row header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        seller.role === 'admin'
                          ? 'bg-blue-100 text-blue-700'
                          : seller.role === 'supervisor'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {seller.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-800">
                          {seller.name}
                        </h3>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            seller.role === 'admin'
                              ? 'bg-blue-100 text-blue-700'
                              : seller.role === 'gerencia'
                                ? 'bg-emerald-100 text-emerald-700'
                                : seller.role === 'supervisor'
                                  ? 'bg-amber-100 text-amber-700'
                                  : seller.role === 'ingresador'
                                    ? 'bg-cyan-100 text-cyan-700'
                                    : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {ROLE_LABELS[seller.role]}
                        </span>
                        {!seller.is_active && (
                          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <KeyRound className="h-3 w-3" />
                          {seller.seller_code}
                        </span>
                        {seller.vendor_number && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono font-semibold text-blue-700">
                            #{seller.vendor_number}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {grantedCount} permiso{grantedCount !== 1 ? 's' : ''}
                        </span>
                        {seller.branch_name && (
                          <span className="truncate">{seller.branch_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleActive(seller)}
                        title={seller.is_active ? 'Desactivar' : 'Activar'}
                        className={`rounded-lg p-2 transition-colors ${
                          seller.is_active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {seller.is_active ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => deleteSeller(seller)}
                        title="Eliminar"
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setExpandedId(expanded ? null : seller.id)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100"
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                      {/* Role + Branch + PIN + Commission */}
                      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Rol
                          </label>
                          <select
                            value={seller.role}
                            onChange={(e) => updateRole(seller, e.target.value as SellerRole)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="admin">Administrador</option>
                            <option value="gerencia">Gerencia</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="ingresador">Ingresador</option>
                            <option value="vendedor">Vendedor</option>
                            <option value="caja">Caja</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Sucursal
                          </label>
                          <select
                            value={seller.branch_id ?? ''}
                            onChange={(e) => updateBranch(seller, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Todas</option>
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            PIN
                          </label>
                          <input
                            type="text"
                            defaultValue={seller.pin}
                            key={seller.pin}
                            onBlur={(e) => {
                              if (e.target.value !== seller.pin) {
                                updatePin(seller, e.target.value);
                              }
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="0000"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Comisión %
                          </label>
                          <input
                            type="number"
                            defaultValue={seller.commission_rate}
                            key={String(seller.commission_rate)}
                            min="0"
                            max="100"
                            step="0.5"
                            onBlur={(e) => {
                              if (e.target.value !== String(seller.commission_rate)) {
                                updateCommissionRate(seller, e.target.value);
                              }
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            No. Vendedor (00-99)
                          </label>
                          <input
                            type="text"
                            defaultValue={seller.vendor_number ?? ''}
                            key={`vn-${seller.vendor_number}`}
                            maxLength={2}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (seller.vendor_number ?? '')) {
                                updateVendorNumber(seller, val);
                              }
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="00"
                          />
                        </div>
                      </div>

                      {/* Permissions */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Permisos
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {PERMISSION_KEYS.map((permKey) => {
                            const perm = seller.permissions.find(
                              (p) => p.permission === permKey,
                            );
                            const granted = perm?.granted ?? false;
                            return (
                              <button
                                key={permKey}
                                onClick={() => togglePermission(seller, permKey)}
                                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                  granted
                                    ? 'border-blue-200 bg-blue-50 text-slate-800'
                                    : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <div
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                                    granted
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-200 text-transparent'
                                  }`}
                                >
                                  <Check className="h-3 w-3" />
                                </div>
                                <span className="text-xs font-medium">
                                  {PERMISSION_LABELS[permKey]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}

      {/* Add seller modal */}
      {showAddModal && (
        <AddSellerModal
          branches={branches}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            fetchSellers();
          }}
        />
      )}
    </div>
  );
}

function AddSellerModal({
  branches,
  onClose,
  onCreated,
}: {
  branches: Branch[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<SellerRole>('vendedor');
  const [pin, setPin] = useState('1234');
  const [branchId, setBranchId] = useState('');
  const [vendorNumber, setVendorNumber] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const togglePerm = (key: string) => {
    const next = new Set(selectedPerms);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedPerms(next);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError('El PIN debe tener entre 4 y 6 dígitos numéricos.');
      return;
    }

    setSaving(true);
    setError('');

    const { data: existing } = await supabase
      .from('sellers')
      .select('seller_code')
      .like('seller_code', 'VND%')
      .order('seller_code', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (existing && existing.length > 0) {
      const match = (existing[0] as { seller_code: string }).seller_code.match(/VND(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const sellerCode = `VND${String(nextNum).padStart(3, '0')}`;

    const { data: sellerRow, error: insertErr } = await supabase
      .from('sellers')
      .insert({
        name: name.trim(),
        seller_code: sellerCode,
        pin,
        role,
        branch_id: branchId || null,
        vendor_number: vendorNumber ? vendorNumber.padStart(2, '0') : null,
      })
      .select()
      .single();

    if (insertErr || !sellerRow) {
      setError('Error al crear el vendedor: ' + (insertErr?.message ?? 'desconocido'));
      setSaving(false);
      return;
    }

    if (selectedPerms.size > 0) {
      const permRows = Array.from(selectedPerms).map((p) => ({
        seller_id: sellerRow.id,
        permission: p,
        granted: true,
      }));
      await supabase.from('seller_permissions').insert(permRows);
    }

    setSaving(false);
    onCreated();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-bold text-slate-800">Nuevo usuario</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as SellerRole)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="admin">Administrador</option>
                <option value="gerencia">Gerencia</option>
                <option value="supervisor">Supervisor</option>
                <option value="ingresador">Ingresador</option>
                <option value="vendedor">Vendedor</option>
                <option value="caja">Caja</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">PIN</label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Sucursal</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">No. Vendedor</label>
              <input
                type="text"
                value={vendorNumber}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setVendorNumber(v);
                }}
                maxLength={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="00"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Permisos
            </p>
            <div className="grid grid-cols-1 gap-2">
              {PERMISSION_KEYS.map((permKey) => {
                const checked = selectedPerms.has(permKey);
                return (
                  <button
                    key={permKey}
                    onClick={() => togglePerm(permKey)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      checked
                        ? 'border-blue-200 bg-blue-50 text-slate-800'
                        : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                        checked ? 'bg-blue-600 text-white' : 'bg-slate-200 text-transparent'
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-medium">{PERMISSION_LABELS[permKey]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Crear usuario
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
