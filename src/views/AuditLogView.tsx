import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { History, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

type AuditEntry = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  changes: Record<string, any>;
  seller_name: string;
  created_at: string;
};

const TABLE_LABELS: Record<string, string> = {
  parts: 'Productos',
  inventory: 'Inventario',
  sales: 'Ventas',
  sale_items: 'Items de Venta',
  customers: 'Clientes',
  payments: 'Pagos',
  credit_notes: 'Notas de Credito',
  sellers: 'Vendedores',
  suppliers: 'Proveedores',
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  insert: { label: 'Creado', color: 'bg-green-100 text-green-700' },
  update: { label: 'Modificado', color: 'bg-blue-100 text-blue-700' },
  delete: { label: 'Eliminado', color: 'bg-red-100 text-red-700' },
  price_change: { label: 'Cambio Precio', color: 'bg-amber-100 text-amber-700' },
  stock_adjust: { label: 'Ajuste Stock', color: 'bg-purple-100 text-purple-700' },
  sale: { label: 'Venta', color: 'bg-emerald-100 text-emerald-700' },
  payment: { label: 'Pago', color: 'bg-cyan-100 text-cyan-700' },
};

const PAGE_SIZE = 50;

export default function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (tableFilter) {
      query = query.eq('table_name', tableFilter);
    }
    if (search.trim()) {
      query = query.or(`seller_name.ilike.%${search.trim()}%,record_id.ilike.%${search.trim()}%`);
    }

    const { data, count } = await query;
    setEntries((data ?? []) as AuditEntry[]);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, tableFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [tableFilter, search]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Historial de Cambios</h2>
            <p className="text-sm text-slate-500">{totalCount} registros</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuario..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todas las tablas</option>
          {Object.entries(TABLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center text-slate-400">
          <History className="mb-2 h-10 w-10" />
          <p className="text-sm">No hay registros de auditoria</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                <th className="px-4 py-3 text-left font-semibold">Tabla</th>
                <th className="px-4 py-3 text-left font-semibold">Accion</th>
                <th className="px-4 py-3 text-left font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const actionInfo = ACTION_LABELS[entry.action] ?? { label: entry.action, color: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={entry.id} className="border-b border-slate-100 hover:bg-blue-50/30">
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-700">
                      {entry.seller_name}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {TABLE_LABELS[entry.table_name] ?? entry.table_name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionInfo.color}`}>
                        {actionInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[300px]">
                      <ChangeDetail changes={entry.changes} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Pagina {page + 1} de {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeDetail({ changes }: { changes: Record<string, any> }) {
  if (!changes || Object.keys(changes).length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const entries = Object.entries(changes).slice(0, 3);
  return (
    <div className="space-y-0.5">
      {entries.map(([key, val]) => (
        <div key={key} className="text-xs text-slate-600 truncate">
          <span className="font-medium text-slate-500">{key}:</span>{' '}
          {typeof val === 'object' && val !== null ? (
            <span>
              {val.old !== undefined && <span className="line-through text-red-400">{String(val.old)}</span>}
              {val.old !== undefined && ' → '}
              {val.new !== undefined && <span className="text-green-600">{String(val.new)}</span>}
              {val.old === undefined && val.new === undefined && JSON.stringify(val).slice(0, 50)}
            </span>
          ) : (
            <span>{String(val).slice(0, 60)}</span>
          )}
        </div>
      ))}
      {Object.keys(changes).length > 3 && (
        <span className="text-[10px] text-slate-400">+{Object.keys(changes).length - 3} mas</span>
      )}
    </div>
  );
}
