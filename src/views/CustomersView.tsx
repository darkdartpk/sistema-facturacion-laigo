import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type Customer } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import {
  Users,
  Search,
  Plus,
  X,
  Wallet,
  Gift,
  Pencil,
  Trash2,
  Ban,
  CheckCircle2,
  DollarSign,
  Camera,
  Banknote,
  Printer,
} from 'lucide-react';


export default function CustomersView({ sellerRole, branchId }: { sellerRole?: string; branchId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [blockCustomer, setBlockCustomer] = useState<Customer | null>(null);
  const [balanceCustomer, setBalanceCustomer] = useState<Customer | null>(null);
  const [balanceForm, setBalanceForm] = useState({ invoice_number: '', description: '', amount: '', debt_date: '' });
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [redeemCashback, setRedeemCashback] = useState<Customer | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showForm || editing) { setShowForm(false); setEditing(null); }
        else if (confirmDelete) setConfirmDelete(null);
        else if (blockCustomer) setBlockCustomer(null);
        else if (balanceCustomer) setBalanceCustomer(null);
        else if (redeemCashback) setRedeemCashback(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showForm, editing, confirmDelete, blockCustomer, balanceCustomer, redeemCashback]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('branch_id', branchId)
      .order('name');
    if (!error && data) setCustomers(data as Customer[]);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        ((c as any).secondary_name ?? '').toLowerCase().includes(q) ||
        ((c as any).location ?? '').toLowerCase().includes(q) ||
        (c.cedula ?? '').toLowerCase().includes(q) ||
        (c.ruc ?? '').toLowerCase().includes(q) ||
        String(c.customer_number).padStart(2, '0').includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="flex h-full flex-col bg-slate-100">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800">Clientes</h2>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            {customers.length}
          </span>
        </div>

        <div className="relative ml-4 flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cédula/RUC o teléfono..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <Users className="h-12 w-12" strokeWidth={1.5} />
            <p className="text-sm font-medium">
              {search ? 'No se encontraron clientes.' : 'No hay clientes registrados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5 hidden sm:table-cell">Documento</th>
                  <th className="px-4 py-2.5 hidden md:table-cell">Teléfono</th>
                  <th className="px-4 py-2.5 hidden lg:table-cell">Crédito</th>
                  <th className="px-4 py-2.5">Saldo Pend.</th>
                  <th className="px-4 py-2.5 hidden lg:table-cell">Saldo Favor</th>
                  <th className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="group transition-colors hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-400">
                      {String(c.customer_number).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 overflow-hidden">
                          {c.photo_url ? (
                            <img src={c.photo_url} alt={c.name} className="h-full w-full object-cover" />
                          ) : (
                            c.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-slate-800">{c.name}</span>
                            {c.is_blocked && (
                              <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Bloqueado</span>
                            )}
                          </div>
                          {(c as any).secondary_name && (
                            <span className="text-xs text-slate-400">{(c as any).secondary_name}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell">
                      {c.ruc ? `${c.ruc}${c.dv ? '-' + c.dv : ''}` : c.cedula || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">
                      {c.phone || '—'}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <div className="text-xs">
                        <span className="font-medium text-slate-700">{formatCurrency(c.credit_limit ?? 0)}</span>
                        <span className="ml-1.5 text-slate-400">{c.credit_days ?? 0}d</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {(c.pending_balance ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                          {formatCurrency(c.pending_balance ?? 0)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">$0.00</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      {(c.credit_balance ?? 0) > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                            {formatCurrency(c.credit_balance ?? 0)}
                          </span>
                          <button
                            onClick={() => setRedeemCashback(c)}
                            className="rounded p-1 text-green-600 hover:bg-green-100"
                            title="Canjear"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">$0.00</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => {
                            setEditing(c);
                            setShowForm(true);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {sellerRole === 'admin' && (
                          <button
                            onClick={() => {
                              setBalanceCustomer(c);
                              setBalanceForm({ invoice_number: '', description: '', amount: '', debt_date: '' });
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                            title="Ajustar saldo"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setBlockCustomer(c)}
                          className={`rounded-lg p-1.5 hover:bg-slate-100 ${c.is_blocked ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'}`}
                          title={c.is_blocked ? 'Desbloquear' : 'Bloquear'}
                        >
                          {c.is_blocked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        </button>
                        {sellerRole === 'admin' && (
                          <button
                            onClick={() => setConfirmDelete(c)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <CustomerFormModal
          customer={editing}
          branchId={branchId}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}


      {/* Block confirm */}
      {blockCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${blockCustomer.is_blocked ? 'bg-green-100' : 'bg-red-100'}`}>
                {blockCustomer.is_blocked ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Ban className="h-5 w-5 text-red-600" />}
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                {blockCustomer.is_blocked ? 'Desbloquear cliente' : 'Bloquear cliente'}
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {blockCustomer.is_blocked
                ? `¿Deseas desbloquear a ${blockCustomer.name}? Podrá volver a comprar a crédito.`
                : `Al bloquear a ${blockCustomer.name}, no podrá hacer compras a crédito hasta que se desbloquee.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setBlockCustomer(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await supabase
                    .from('customers')
                    .update({ is_blocked: !blockCustomer.is_blocked })
                    .eq('id', blockCustomer.id);
                  setBlockCustomer(null);
                  load();
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${blockCustomer.is_blocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {blockCustomer.is_blocked ? 'Desbloquear' : 'Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">Eliminar cliente</h3>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              ¿Seguro que deseas eliminar a <span className="font-semibold text-slate-700">{confirmDelete.name}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await supabase.from('customers').delete().eq('id', confirmDelete.id);
                  setConfirmDelete(null);
                  load();
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance adjustment modal */}
      {balanceCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                  <DollarSign className="h-4 w-4 text-red-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">Agregar Deuda</h3>
              </div>
              <button onClick={() => setBalanceCustomer(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-red-50 p-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-slate-700">{balanceCustomer.name}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">Saldo pendiente actual</span>
                <span className="font-bold text-red-700">
                  {formatCurrency(balanceCustomer.pending_balance ?? 0)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">N. Factura</label>
                <input
                  type="text"
                  value={balanceForm.invoice_number}
                  onChange={(e) => setBalanceForm({ ...balanceForm, invoice_number: e.target.value })}
                  placeholder="Ej: FAC-001"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Descripcion</label>
                <input
                  type="text"
                  value={balanceForm.description}
                  onChange={(e) => setBalanceForm({ ...balanceForm, description: e.target.value })}
                  placeholder="Ej: Deuda pendiente por cobrar"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Cantidad ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={balanceForm.amount}
                  onChange={(e) => setBalanceForm({ ...balanceForm, amount: e.target.value })}
                  placeholder="Ej: 150.00"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">Fecha de la deuda</label>
                <input
                  type="date"
                  value={balanceForm.debt_date}
                  onChange={(e) => setBalanceForm({ ...balanceForm, debt_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setBalanceCustomer(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                disabled={balanceSaving || !balanceForm.description || !balanceForm.amount}
                onClick={async () => {
                  setBalanceSaving(true);
                  const amount = parseFloat(balanceForm.amount);
                  if (isNaN(amount)) {
                    setBalanceSaving(false);
                    return;
                  }
                  const newBalance = (balanceCustomer.pending_balance ?? 0) + amount;
                  await supabase.from('balance_adjustments').insert({
                    customer_id: balanceCustomer.id,
                    invoice_number: balanceForm.invoice_number || null,
                    description: balanceForm.description,
                    amount,
                    debt_date: balanceForm.debt_date || null,
                  });
                  await supabase
                    .from('customers')
                    .update({ pending_balance: newBalance })
                    .eq('id', balanceCustomer.id);
                  setBalanceSaving(false);
                  setBalanceCustomer(null);
                  load();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                <DollarSign className="h-4 w-4" />
                {balanceSaving ? 'Guardando...' : 'Agregar Deuda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {redeemCashback && (
        <RedeemCashbackModal
          customer={redeemCashback}
          onClose={() => setRedeemCashback(null)}
          onRedeemed={() => {
            setRedeemCashback(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CustomerFormModal({
  customer,
  branchId,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
  branchId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCredit = customer ? ((customer.credit_limit ?? 0) > 0 || (customer.credit_days ?? 0) > 0) : false;
  const [name, setName] = useState(customer?.name ?? '');
  const [secondaryName, setSecondaryName] = useState((customer as any)?.secondary_name ?? '');
  const [location, setLocation] = useState((customer as any)?.location ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [cedulaRuc, setCedulaRuc] = useState(customer?.ruc ?? customer?.cedula ?? '');
  const [dv, setDv] = useState(customer?.dv ?? '');
  const [taxpayerType, setTaxpayerType] = useState<'natural' | 'juridica'>((customer as any)?.taxpayer_type === 'juridica' ? 'juridica' : 'natural');
  const [customerType, setCustomerType] = useState<'contado' | 'credito'>(isCredit ? 'credito' : 'contado');
  const [creditLimit, setCreditLimit] = useState(String(customer?.credit_limit ?? ''));
  const [creditDays, setCreditDays] = useState(String(customer?.credit_days ?? ''));
  const [assignedSellerId, setAssignedSellerId] = useState(customer?.assigned_seller_id ?? '');
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
  const [rewardsPct, setRewardsPct] = useState(String(customer?.rewards_percentage ?? 0));
  const [photoUrl, setPhotoUrl] = useState<string | null>(customer?.photo_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('sellers').select('id, name').eq('branch_id', branchId).order('name').then(({ data }) => {
      if (data) setSellers(data);
    });
  }, [branchId]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        let w = img.width;
        let h = img.height;
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    const daysNum = parseInt(creditDays, 10) || 0;
    const limitNum = parseFloat(creditLimit) || 0;
    if (taxpayerType === 'juridica') {
      if (!cedulaRuc.trim()) {
        setError('El RUC es obligatorio para Persona Jurídica.');
        return;
      }
      if (!dv.trim()) {
        setError('El DV es obligatorio para Persona Jurídica.');
        return;
      }
    }
    if (customerType === 'credito') {
      if (!phone.trim()) {
        setError('El teléfono es obligatorio para clientes a crédito.');
        return;
      }
      if (!cedulaRuc.trim()) {
        setError('La cédula/RUC es obligatoria para clientes a crédito.');
        return;
      }
      if (!assignedSellerId) {
        setError('El vendedor encargado es obligatorio para clientes a crédito.');
        return;
      }
      if (daysNum <= 0) {
        setError('Los días de crédito son obligatorios para clientes a crédito.');
        return;
      }
      if (limitNum <= 0) {
        setError('El límite de crédito es obligatorio para clientes a crédito.');
        return;
      }
    }
    if (daysNum < 0) {
      setError('Los días de crédito deben ser un número válido.');
      return;
    }
    setSaving(true);
    setError(null);
    const isRuc = taxpayerType === 'juridica' || cedulaRuc.trim().length > 6;
    const payload = {
      name: name.trim(),
      secondary_name: secondaryName.trim() || null,
      location: location.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      cedula: isRuc ? null : (cedulaRuc.trim() || null),
      ruc: isRuc ? (cedulaRuc.trim() || null) : null,
      dv: dv.trim() || null,
      taxpayer_type: taxpayerType,
      credit_limit: customerType === 'credito' ? limitNum : 0,
      credit_days: customerType === 'credito' ? daysNum : 0,
      assigned_seller_id: customerType === 'credito' ? assignedSellerId : null,
      rewards_percentage: Math.min(100, Math.max(0, parseFloat(rewardsPct) || 0)),
      reward_type: 'cashback' as const,
      photo_url: photoUrl,
    };

    let result;
    if (customer) {
      result = await supabase.from('customers').update(payload).eq('id', customer.id).select().single();
    } else {
      result = await supabase.from('customers').insert({ ...payload, branch_id: branchId }).select().single();
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-800">
              {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 p-4 overflow-y-auto flex-1">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex flex-col items-center gap-2">
            <div className="relative h-20 w-20 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt="Foto" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-blue-700">
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </span>
              )}
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-full">
                <Camera className="h-5 w-5 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
            {photoUrl && (
              <button type="button" onClick={() => setPhotoUrl(null)} className="text-xs text-red-500 hover:underline">
                Quitar foto
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
              Nombre *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo o razón social"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                Nombre Secundario
              </label>
              <input
                value={secondaryName}
                onChange={(e) => setSecondaryName(e.target.value)}
                placeholder="Alias o nombre alterno"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                Ubicación
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Dirección o zona"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                Teléfono{customerType === 'credito' && ' *'}
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
              Tipo de Contribuyente
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTaxpayerType('natural')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  taxpayerType === 'natural'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Persona Natural
              </button>
              <button
                type="button"
                onClick={() => setTaxpayerType('juridica')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  taxpayerType === 'juridica'
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Persona Jurídica
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
              {taxpayerType === 'juridica' ? 'RUC de Empresa *' : '#Cédula/RUC'}{customerType === 'credito' && taxpayerType === 'natural' ? ' *' : ''}
            </label>
            <div className="flex gap-2">
              <input
                value={cedulaRuc}
                onChange={(e) => setCedulaRuc(e.target.value)}
                placeholder={taxpayerType === 'juridica' ? 'RUC (ej: 155XXXXX-1-XXXXXX)' : 'Cédula o RUC'}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="w-16">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                  DV{taxpayerType === 'juridica' ? ' *' : ''}
                </label>
                <input
                  value={dv}
                  onChange={(e) => setDv(e.target.value)}
                  placeholder="DV"
                  maxLength={2}
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-center text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
              Tipo de Cliente
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCustomerType('contado')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  customerType === 'contado'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Contado
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('credito')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  customerType === 'credito'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Crédito
              </button>
            </div>
          </div>

          {customerType === 'credito' && (
          <>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
              Vendedor Encargado *
            </label>
            <select
              value={assignedSellerId}
              onChange={(e) => setAssignedSellerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Seleccionar vendedor...</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                Límite de Crédito *
              </label>
              <input
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="0.00"
                min="1"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                Días de Crédito *
              </label>
              <input
                type="number"
                value={creditDays}
                onChange={(e) => setCreditDays(e.target.value)}
                placeholder="30"
                min="1"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          </>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
              Cashback (%)
            </label>
            <input
              type="number"
              value={rewardsPct}
              onChange={(e) => setRewardsPct(e.target.value)}
              placeholder="0"
              min="0"
              max="100"
              step="0.5"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Porcentaje de cada compra que se acredita como saldo a favor. Ej: 10% de $100 = $10.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : customer ? 'Guardar Cambios' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RedeemCashbackModal({
  customer,
  onClose,
  onRedeemed,
}: {
  customer: Customer;
  onClose: () => void;
  onRedeemed: () => void;
}) {
  const maxBalance = customer.credit_balance ?? 0;
  const [amount, setAmount] = useState(String(maxBalance));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Math.min(maxBalance, Math.max(0, parseFloat(amount) || 0));

  async function handleRedeem() {
    if (amountNum <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    if (amountNum > maxBalance) {
      setError(`El cliente solo tiene ${formatCurrency(maxBalance)} de saldo a favor.`);
      return;
    }
    setSaving(true);
    setError(null);

    const newBalance = maxBalance - amountNum;
    const { error: updateError } = await supabase
      .from('customers')
      .update({ credit_balance: newBalance })
      .eq('id', customer.id);

    setSaving(false);
    if (updateError) {
      setError('No se pudo procesar. Intenta de nuevo.');
      return;
    }

    printReceipt(amountNum, newBalance);
    onRedeemed();
  }

  function printReceipt(paidAmount: number, remaining: number) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });

    const html = `
      <html>
      <head>
        <title>Cashback</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', sans-serif; padding: 20px; max-width: 300px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 12px; margin-bottom: 12px; }
          .header h2 { font-size: 16px; margin-bottom: 4px; }
          .header p { font-size: 11px; color: #666; }
          .info { margin-bottom: 12px; }
          .info .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
          .info .row .label { color: #666; }
          .info .row .value { font-weight: 600; }
          .total { border-top: 2px dashed #ccc; border-bottom: 2px dashed #ccc; padding: 10px 0; margin: 12px 0; text-align: center; }
          .total .amount { font-size: 22px; font-weight: 700; color: #16a34a; }
          .total .desc { font-size: 11px; color: #666; margin-top: 2px; }
          .footer { text-align: center; font-size: 10px; color: #999; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>CASHBACK CANJEADO</h2>
          <p>${dateStr} - ${timeStr}</p>
        </div>
        <div class="info">
          <div class="row"><span class="label">Cliente:</span><span class="value">${customer.name}</span></div>
          ${customer.cedula ? `<div class="row"><span class="label">Cédula:</span><span class="value">${customer.cedula}</span></div>` : ''}
          <div class="row"><span class="label">Saldo anterior:</span><span class="value">${formatCurrency(maxBalance)}</span></div>
          <div class="row"><span class="label">Saldo restante:</span><span class="value">${formatCurrency(remaining)}</span></div>
        </div>
        <div class="total">
          <div class="desc">Monto pagado al cliente</div>
          <div class="amount">${formatCurrency(paidAmount)}</div>
        </div>
        <div class="footer">
          <p>Comprobante de pago de cashback</p>
        </div>
      </body>
      </html>
    `;

    const win = window.open('', '_blank', 'width=350,height=500');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.print(); }, 300);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <Banknote className="h-4 w-4 text-green-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Canjear Cashback</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-green-50 p-3">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-slate-700">{customer.name}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">Saldo a favor disponible</span>
            <span className="font-bold text-green-700">{formatCurrency(maxBalance)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400">
              Monto a pagar
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              max={maxBalance}
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAmount(String((maxBalance / 2).toFixed(2)))}
              className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              Mitad
            </button>
            <button
              onClick={() => setAmount(String(maxBalance))}
              className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              Todo
            </button>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Saldo restante</span>
              <span className="font-semibold text-slate-700">
                {formatCurrency(maxBalance - amountNum)}
              </span>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleRedeem}
            disabled={saving || amountNum <= 0}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            {saving ? 'Procesando...' : 'Pagar e Imprimir'}
          </button>
        </div>
      </div>
    </div>
  );
}
