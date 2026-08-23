import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type CashAccount, type AccountMovement } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  Landmark,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  TrendingUp,
  TrendingDown,
  Building2,
  Search,
  Trash2,
} from 'lucide-react';


export default function CajaBancoTab({ branchId }: { branchId: string }) {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchMovement, setSearchMovement] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: accts }, { data: movs }] = await Promise.all([
      supabase
        .from('cash_accounts')
        .select('*')
        .eq('branch_id', branchId)
        .order('account_type')
        .order('name'),
      supabase
        .from('account_movements')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    setAccounts((accts as CashAccount[]) ?? []);
    setMovements((movs as AccountMovement[]) ?? []);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('caja-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_movements', filter: `branch_id=eq.${branchId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_accounts', filter: `branch_id=eq.${branchId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [branchId, load]);

  const totalCaja = accounts
    .filter((a) => a.account_type === 'caja')
    .reduce((s, a) => s + a.balance, 0);
  const totalBanco = accounts
    .filter((a) => a.account_type === 'banco')
    .reduce((s, a) => s + a.balance, 0);

  const filteredMovements = useMemo(() => {
    let list = movements;
    if (selectedAccountId) {
      list = list.filter((m) => m.account_id === selectedAccountId);
    }
    if (searchMovement.trim()) {
      const q = searchMovement.toLowerCase();
      list = list.filter(
        (m) =>
          m.description.toLowerCase().includes(q) ||
          (m.reference ?? '').toLowerCase().includes(q) ||
          (m.category ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [movements, selectedAccountId, searchMovement]);

  const getAccountName = (accountId: string) =>
    accounts.find((a) => a.id === accountId)?.name ?? 'Desconocida';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Summary cards */}
      <div className="grid shrink-0 grid-cols-3 gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
            <Wallet className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Efectivo en Caja</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalCaja)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Landmark className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saldo en Banco</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(totalBanco)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
            <Building2 className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Disponible</p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(totalCaja + totalBanco)}</p>
          </div>
        </div>
      </div>

      {/* Accounts row */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cuentas</p>
          <button
            onClick={() => setShowNewAccount(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva Cuenta
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedAccountId(null)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              !selectedAccountId
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todas
          </button>
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id === selectedAccountId ? null : acc.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                selectedAccountId === acc.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {acc.account_type === 'caja' ? (
                <Wallet className="h-3.5 w-3.5" />
              ) : (
                <Landmark className="h-3.5 w-3.5" />
              )}
              <span>{acc.name}</span>
              <span className={`text-xs font-bold ${acc.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(acc.balance)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchMovement}
            onChange={(e) => setSearchMovement(e.target.value)}
            placeholder="Buscar movimiento..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowNewMovement(true)}
          disabled={accounts.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Registrar Movimiento
        </button>
      </div>

      {/* Movements list */}
      <div className="flex-1 overflow-auto bg-slate-50 scrollbar-thin">
        {filteredMovements.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-slate-400">
            <Wallet className="mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm">Sin movimientos registrados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Cuenta</th>
                <th className="px-4 py-3 font-semibold">Descripción</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Referencia</th>
                <th className="px-4 py-3 text-right font-semibold">Monto</th>
                <th className="px-4 py-3 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 bg-white hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-xs text-slate-500">{formatDate(m.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                      {accounts.find((a) => a.id === m.account_id)?.account_type === 'banco' ? (
                        <Landmark className="h-3 w-3 text-blue-500" />
                      ) : (
                        <Wallet className="h-3 w-3 text-emerald-500" />
                      )}
                      {getAccountName(m.account_id)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-700">{m.description}</td>
                  <td className="px-4 py-2.5">
                    {m.category && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {m.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{m.reference ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-bold ${
                        m.movement_type === 'ingreso' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {m.movement_type === 'ingreso' ? (
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      )}
                      {formatCurrency(m.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={async () => {
                        if (!confirm('Eliminar este movimiento?')) return;
                        const mov = m;
                        await supabase.from('account_movements').delete().eq('id', mov.id);
                        const adjustment = mov.movement_type === 'ingreso' ? -mov.amount : mov.amount;
                        await supabase
                          .from('cash_accounts')
                          .update({ balance: (accounts.find(a => a.id === mov.account_id)?.balance ?? 0) + adjustment })
                          .eq('id', mov.account_id);
                        load();
                      }}
                      className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Account Modal */}
      {showNewAccount && (
        <NewAccountModal
          branchId={branchId}
          onClose={() => setShowNewAccount(false)}
          onCreated={load}
        />
      )}

      {/* New Movement Modal */}
      {showNewMovement && (
        <NewMovementModal
          branchId={branchId}
          accounts={accounts}
          onClose={() => setShowNewMovement(false)}
          onCreated={load}
        />
      )}

    </div>
  );
}

function NewAccountModal({
  branchId,
  onClose,
  onCreated,
}: {
  branchId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<'caja' | 'banco'>('caja');
  const [initialBalance, setInitialBalance] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Ingresa un nombre para la cuenta.');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: err } = await supabase.from('cash_accounts').insert({
      branch_id: branchId,
      name: name.trim(),
      account_type: accountType,
      balance: parseFloat(initialBalance) || 0,
      description: description.trim() || null,
    });

    if (err) {
      setError('Error al crear cuenta: ' + err.message);
      setSaving(false);
      return;
    }

    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-800">Nueva Cuenta</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Caja General, Banco Nacional..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</label>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => setAccountType('caja')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  accountType === 'caja'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Wallet className="h-4 w-4" />
                Caja
              </button>
              <button
                onClick={() => setAccountType('banco')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  accountType === 'banco'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Landmark className="h-4 w-4" />
                Banco
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saldo Inicial</label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Descripción (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nota o referencia..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear Cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewMovementModal({
  branchId,
  accounts,
  onClose,
  onCreated,
}: {
  branchId: string;
  accounts: CashAccount[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [movementType, setMovementType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (!accountId) {
      setError('Selecciona una cuenta.');
      return;
    }
    if (isNaN(num) || num <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    if (!description.trim()) {
      setError('Ingresa una descripción.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: mvErr } = await supabase.from('account_movements').insert({
      account_id: accountId,
      branch_id: branchId,
      movement_type: movementType,
      amount: num,
      description: description.trim(),
      reference: reference.trim() || null,
      category: category.trim() || null,
    });

    if (mvErr) {
      setError('Error al registrar: ' + mvErr.message);
      setSaving(false);
      return;
    }

    const account = accounts.find((a) => a.id === accountId);
    if (account) {
      const newBalance =
        movementType === 'ingreso' ? account.balance + num : account.balance - num;
      await supabase.from('cash_accounts').update({ balance: newBalance }).eq('id', accountId);
    }

    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-800">Registrar Movimiento</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cuenta</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_type === 'caja' ? '💵' : '🏦'} {a.name} ({formatCurrency(a.balance)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</label>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => setMovementType('ingreso')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  movementType === 'ingreso'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Ingreso
              </button>
              <button
                onClick={() => setMovementType('egreso')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  movementType === 'egreso'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <TrendingDown className="h-4 w-4" />
                Egreso
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-lg font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Descripción</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Venta del día, Depósito bancario..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Sin categoría</option>
                <option value="ventas">Ventas</option>
                <option value="cobros">Cobros</option>
                <option value="deposito">Depósito</option>
                <option value="retiro">Retiro</option>
                <option value="transferencia">Transferencia</option>
                <option value="pago_proveedor">Pago Proveedor</option>
                <option value="gastos">Gastos</option>
                <option value="otros">Otros</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Referencia</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="# Factura, recibo..."
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              movementType === 'ingreso'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {saving ? 'Guardando...' : movementType === 'ingreso' ? 'Registrar Ingreso' : 'Registrar Egreso'}
          </button>
        </div>
      </div>
    </div>
  );
}
