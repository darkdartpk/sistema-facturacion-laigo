import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type OperationalExpense } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  Receipt,
  Plus,
  X,
  Search,
  Trash2,
  Users,
  Home,
  Wrench,
  Zap,
  MoreHorizontal,
  Calendar,
  Filter,
  RefreshCw,
  Percent,
  ShieldCheck,
} from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Receipt; color: string; bg: string }> = {
  planilla: { label: 'Planilla', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  local: { label: 'Local / Alquiler', icon: Home, color: 'text-amber-600', bg: 'bg-amber-50' },
  servicios: { label: 'Servicios', icon: Zap, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  mantenimiento: { label: 'Mantenimiento', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50' },
  itbms: { label: 'ITBMS', icon: Percent, color: 'text-rose-600', bg: 'bg-rose-50' },
  seguros: { label: 'Seguros', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  otros: { label: 'Otros', icon: MoreHorizontal, color: 'text-slate-600', bg: 'bg-slate-50' },
};

export default function GastosOperativosTab({ branchId }: { branchId: string }) {
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('operational_expenses')
      .select('*')
      .eq('branch_id', branchId)
      .order('expense_date', { ascending: false });

    if (filterMonth) {
      const [year, month] = filterMonth.split('-');
      const start = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0);
      const end = `${year}-${month}-${String(endDate.getDate()).padStart(2, '0')}`;
      query = query.gte('expense_date', start).lte('expense_date', end);
    }

    if (filterCategory) {
      query = query.eq('category', filterCategory);
    }

    const { data } = await query;
    setExpenses((data as OperationalExpense[]) ?? []);
    setLoading(false);
  }, [branchId, filterMonth, filterCategory]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) => e.description.toLowerCase().includes(q) || (e.notes ?? '').toLowerCase().includes(q),
    );
  }, [expenses, search]);

  const totalMonth = filtered.reduce((s, e) => s + e.amount, 0);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filtered) {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    }
    return map;
  }, [filtered]);

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este gasto?')) return;
    await supabase.from('operational_expenses').delete().eq('id', id);
    load();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Summary */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Gastos del Mes
            </p>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalMonth)}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const amt = byCategory[key] ?? 0;
            return (
              <div
                key={key}
                className={`flex shrink-0 items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 ${cfg.bg}`}
              >
                <Icon className={`h-4 w-4 ${cfg.color}`} />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{cfg.label}</p>
                  <p className={`text-sm font-bold ${cfg.color}`}>{formatCurrency(amt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar gasto..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Registrar Gasto
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-slate-50 scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-slate-400">
            <Receipt className="mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm">Sin gastos registrados este mes</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Descripción</th>
                <th className="px-4 py-3 font-semibold">Método</th>
                <th className="px-4 py-3 text-center font-semibold">Recurrente</th>
                <th className="px-4 py-3 text-right font-semibold">Monto</th>
                <th className="px-4 py-3 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp) => {
                const cfg = CATEGORY_CONFIG[exp.category] ?? CATEGORY_CONFIG.otros;
                const Icon = cfg.icon;
                return (
                  <tr key={exp.id} className="border-b border-slate-100 bg-white hover:bg-slate-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="h-3 w-3" />
                        {formatDate(exp.expense_date)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-slate-700">{exp.description}</p>
                      {exp.notes && <p className="text-xs text-slate-400 mt-0.5">{exp.notes}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-500">
                        {exp.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {exp.recurring && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                          <RefreshCw className="h-3 w-3" />
                          Sí
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-red-600">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-slate-700">
                  Total del Periodo:
                </td>
                <td className="px-4 py-3 text-right text-base font-bold text-red-600">
                  {formatCurrency(totalMonth)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {showNew && (
        <NewExpenseModal branchId={branchId} onClose={() => setShowNew(false)} onCreated={load} />
      )}
    </div>
  );
}

function NewExpenseModal({
  branchId,
  onClose,
  onCreated,
}: {
  branchId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<string>('planilla');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recurring, setRecurring] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const num = parseFloat(amount);
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

    const { error: err } = await supabase.from('operational_expenses').insert({
      branch_id: branchId,
      category,
      description: description.trim(),
      amount: num,
      payment_method: paymentMethod,
      expense_date: expenseDate,
      recurring,
      notes: notes.trim() || null,
    });

    if (err) {
      setError('Error al registrar: ' + err.message);
      setSaving(false);
      return;
    }

    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-800">Registrar Gasto Operativo</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoría</label>
            <div className="mt-1 grid grid-cols-5 gap-1.5">
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      category === key
                        ? `border-current ${cfg.bg} ${cfg.color}`
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] leading-tight text-center">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Descripción</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Salario Juan Pérez, Alquiler mes julio..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</label>
              <div className="mt-1">
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Método de Pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-200 px-3 py-2.5 w-full hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">Recurrente</span>
                  <p className="text-[10px] text-slate-400">Se repite cada mes</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Registrar Gasto'}
          </button>
        </div>
      </div>
    </div>
  );
}
