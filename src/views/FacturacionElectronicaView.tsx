import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type ElectronicInvoice, type FEStatus } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';

import {
  FileCheck2,
  FileX2,
  Clock,
  Send,
  RefreshCw,
  Search,
  X,
  CheckCircle2,
  XCircle,
  FileText,
  QrCode,
  Copy,
  Ban,
  Eye,
  Printer,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type EIWithSale = ElectronicInvoice & {
  sales?: { invoice_number: string | null; customer_name: string | null; payment_method: string } | null;
};

const STATUS_CONFIG: Record<FEStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  sent: { label: 'Enviada', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Send },
  authorized: { label: 'Autorizada', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  rejected: { label: 'Rechazada', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  cancelled: { label: 'Anulada', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Ban },
};

type DateRange = 'today' | '7days' | 'month' | 'custom';

const PAGE_SIZE = 50;

function getDateBounds(range: DateRange, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (range === 'today') {
    return { from: `${todayStr}T00:00:00`, to: `${todayStr}T23:59:59.999` };
  }
  if (range === '7days') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: `${d.toISOString().slice(0, 10)}T00:00:00`, to: `${todayStr}T23:59:59.999` };
  }
  if (range === 'month') {
    const firstDay = `${todayStr.slice(0, 7)}-01`;
    return { from: `${firstDay}T00:00:00`, to: `${todayStr}T23:59:59.999` };
  }
  // custom
  const f = customFrom || todayStr;
  const t = customTo || todayStr;
  return { from: `${f}T00:00:00`, to: `${t}T23:59:59.999` };
}

export default function FacturacionElectronicaView({ branchId }: { branchId: string }) {
  const [invoices, setInvoices] = useState<EIWithSale[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FEStatus | 'all'>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'FE' | 'NC'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<EIWithSale | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>('today');
  const todayStr = new Date().toISOString().slice(0, 10);
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateBounds(dateRange, customFrom, customTo);
    const rangeStart = page * PAGE_SIZE;
    const rangeEnd = rangeStart + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from('electronic_invoices')
      .select('*, sales(invoice_number, customer_name, payment_method)', { count: 'exact' })
      .eq('branch_id', branchId)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .range(rangeStart, rangeEnd);

    if (!error && data) setInvoices(data as EIWithSale[]);
    if (count !== null && count !== undefined) setTotalCount(count);
    setLoading(false);
  }, [branchId, dateRange, customFrom, customTo, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [dateRange, customFrom, customTo, branchId]);

  const filtered = useMemo(() => {
    let result = invoices;
    if (statusFilter !== 'all') {
      result = result.filter((i) => i.status === statusFilter);
    }
    if (docTypeFilter !== 'all') {
      result = result.filter((i) => i.document_type === docTypeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (i) =>
          i.invoice_number.toLowerCase().includes(q) ||
          (i.cufe ?? '').toLowerCase().includes(q) ||
          (i.receptor_name ?? '').toLowerCase().includes(q) ||
          (i.receptor_ruc ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [invoices, statusFilter, docTypeFilter, search]);

  const stats = useMemo(() => {
    const pending = invoices.filter((i) => i.status === 'pending').length;
    const authorized = invoices.filter((i) => i.status === 'authorized').length;
    const rejected = invoices.filter((i) => i.status === 'rejected').length;
    return { pending, authorized, rejected, total: totalCount };
  }, [invoices, totalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const callHka = async (action: string, params: Record<string, unknown>) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hka-proxy`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action, ...params }),
    });
    const text = await res.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Respuesta invalida del servidor (status ${res.status}): ${text.substring(0, 200)}`);
    }
    if (!res.ok) {
      throw new Error(body?.error ?? `Error ${res.status}`);
    }
    return body;
  };

  const handleSend = async (invoice: EIWithSale) => {
    setSending(invoice.id);
    try {
      const result = await callHka('send', { invoiceId: invoice.id });
      if (result.success) {
        alert(`Factura autorizada!\nCUFE: ${result.cufe}`);
      } else {
        alert(`Rechazada por HKA: ${result.error ?? 'Error desconocido'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Error al enviar: ${msg}`);
    }
    setSending(null);
    load();
  };

  const handleCancel = async (invoice: EIWithSale) => {
    const motivo = prompt('Motivo de anulacion:');
    if (!motivo) return;
    try {
      await callHka('cancel', { invoiceId: invoice.id, motivo });
      alert('Documento anulado.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Error al anular: ${msg}`);
    }
    load();
  };

  const handlePreview = async (invoice: EIWithSale) => {
    if (!invoice.cufe) {
      alert('Este documento aún no ha sido autorizado por la DGI. Envíelo primero para poder ver el PDF.');
      return;
    }
    setLoadingPdf(true);
    try {
      const result = await callHka('pdf', { invoiceId: invoice.id });
      if (!result.success || !result.pdf) {
        throw new Error('No se pudo obtener el PDF de HKA.');
      }
      const byteChars = atob(result.pdf);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Error al obtener PDF: ${msg}`);
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Stats */}
      <div className="grid shrink-0 grid-cols-4 gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <StatCard
          label="Total Documentos"
          value={String(stats.total)}
          icon={<FileText className="h-5 w-5 text-slate-400" />}
        />
        <StatCard
          label="Pendientes"
          value={String(stats.pending)}
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          highlight={stats.pending > 0 ? 'amber' : undefined}
        />
        <StatCard
          label="Autorizadas"
          value={String(stats.authorized)}
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
        />
        <StatCard
          label="Rechazadas"
          value={String(stats.rejected)}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          highlight={stats.rejected > 0 ? 'red' : undefined}
        />
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Facturacion Electronica</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Filter */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
            <Calendar className="ml-1.5 h-3.5 w-3.5 text-slate-400" />
            <FilterBtn active={dateRange === 'today'} onClick={() => setDateRange('today')} label="Hoy" />
            <FilterBtn active={dateRange === '7days'} onClick={() => setDateRange('7days')} label="7 dias" />
            <FilterBtn active={dateRange === 'month'} onClick={() => setDateRange('month')} label="Este Mes" />
            <FilterBtn active={dateRange === 'custom'} onClick={() => setDateRange('custom')} label="Rango" />
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">a</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por numero, CUFE, cliente..."
              className="w-56 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
            <FilterBtn active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="Todos" />
            <FilterBtn active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} label="Pendientes" />
            <FilterBtn active={statusFilter === 'authorized'} onClick={() => setStatusFilter('authorized')} label="Autorizadas" />
            <FilterBtn active={statusFilter === 'rejected'} onClick={() => setStatusFilter('rejected')} label="Rechazadas" />
          </div>

          {/* Doc Type Filter */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
            <FilterBtn active={docTypeFilter === 'all'} onClick={() => setDocTypeFilter('all')} label="Todos" />
            <FilterBtn active={docTypeFilter === 'FE'} onClick={() => setDocTypeFilter('FE')} label="Facturas" />
            <FilterBtn active={docTypeFilter === 'NC'} onClick={() => setDocTypeFilter('NC')} label="N. Credito" />
          </div>

          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-slate-50 scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-sm">
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Documento</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Receptor</th>
              <th className="px-4 py-3 font-semibold">CUFE</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    Cargando documentos electronicos...
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileX2 className="h-10 w-10 opacity-30" />
                    <p>No hay documentos electronicos</p>
                    <p className="text-xs">Los documentos aparecen aqui al facturar desde el POS</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((inv) => {
                const cfg = STATUS_CONFIG[inv.status];
                const StatusIcon = cfg.icon;
                return (
                  <tr
                    key={inv.id}
                    className="cursor-pointer border-b border-slate-100 bg-white transition-colors hover:bg-blue-50/30"
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {inv.invoice_number}
                      </span>
                      {inv.sales?.invoice_number && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Venta: {inv.sales.invoice_number}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          inv.document_type === 'FE'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        {inv.document_type === 'FE' ? 'FACTURA' : 'NOTA CREDITO'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-slate-700">
                        {inv.receptor_name ?? 'Consumidor Final'}
                      </p>
                      {inv.receptor_ruc && (
                        <p className="text-[11px] text-slate-400">
                          RUC: {inv.receptor_ruc}-{inv.receptor_dv}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {inv.cufe ? (
                        <span className="font-mono text-[10px] text-slate-500">
                          {inv.cufe.slice(0, 12)}...
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-300">Sin CUFE</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(inv.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {(inv.status === 'pending' || inv.status === 'rejected') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSend(inv);
                            }}
                            disabled={sending === inv.id}
                            className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                            title="Enviar al PAC"
                          >
                            {sending === inv.id ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        {inv.status === 'authorized' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreview(inv);
                              }}
                              className="rounded-lg p-1.5 text-green-600 transition-colors hover:bg-green-50"
                              title="Descargar PDF"
                              disabled={loadingPdf}
                            >
                              {loadingPdf ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancel(inv);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Anular"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          title="Ver detalle"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalCount > PAGE_SIZE && (
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-2.5">
          <p className="text-xs text-slate-500">
            Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount} documentos
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </button>
            <span className="px-2 text-xs font-medium text-slate-600">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedInvoice && (
        <FEDetailDrawer
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onResend={() => handleSend(selectedInvoice)}
          onCancel={() => handleCancel(selectedInvoice)}
          onPreview={() => handlePreview(selectedInvoice)}
        />
      )}

      {/* Error Modal */}
      {errorMsg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setErrorMsg(null)}>
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-700">Error</h3>
              <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <textarea
              readOnly
              value={errorMsg}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800"
              rows={6}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(errorMsg); }}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Copiar
              </button>
              <button
                onClick={() => setErrorMsg(null)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="relative flex h-[95vh] w-full max-w-[900px] flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-700">PDF - Factura Electronica (HKA)</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfUrl}
                  download="factura.pdf"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Printer size={14} />
                  Descargar PDF
                </a>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewPdfUrl);
                    setPreviewPdfUrl(null);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={previewPdfUrl}
              className="flex-1 rounded-b-xl"
              style={{ border: 'none', width: '100%' }}
              title="PDF factura electronica"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FEDetailDrawer({
  invoice,
  onClose,
  onResend,
  onCancel,
  onPreview,
}: {
  invoice: EIWithSale;
  onClose: () => void;
  onResend: () => void;
  onCancel: () => void;
  onPreview: () => void;
}) {
  const cfg = STATUS_CONFIG[invoice.status];
  const StatusIcon = cfg.icon;
  const [showXml, setShowXml] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-y-auto bg-white shadow-xl scrollbar-thin">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              invoice.document_type === 'FE' ? 'bg-blue-50' : 'bg-orange-50'
            }`}>
              <FileCheck2 className={`h-5 w-5 ${
                invoice.document_type === 'FE' ? 'text-blue-600' : 'text-orange-600'
              }`} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                {invoice.document_type === 'FE' ? 'Factura Electronica' : 'Nota de Credito Electronica'}
              </h2>
              <p className="text-xs text-slate-500">{invoice.invoice_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Status Banner */}
          <div className={`flex items-center gap-3 rounded-xl border p-4 ${cfg.color}`}>
            <StatusIcon className="h-6 w-6 shrink-0" />
            <div>
              <p className="text-sm font-bold">{cfg.label}</p>
              {invoice.error_message && (
                <p className="mt-0.5 text-xs opacity-80">{invoice.error_message}</p>
              )}
              {invoice.authorization_date && (
                <p className="mt-0.5 text-xs opacity-80">
                  Autorizada: {formatDate(invoice.authorization_date)}
                </p>
              )}
            </div>
          </div>

          {/* CUFE */}
          {invoice.cufe && (
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">CUFE</span>
                <button
                  onClick={() => copyToClipboard(invoice.cufe!)}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50"
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </button>
              </div>
              <p className="break-all font-mono text-xs text-slate-600">{invoice.cufe}</p>
            </div>
          )}

          {/* Document Info */}
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Datos del Documento
            </p>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Numero" value={invoice.invoice_number} />
              <InfoRow label="Tipo" value={invoice.document_type === 'FE' ? 'Factura' : 'Nota de Credito'} />
              <InfoRow label="Subtotal" value={formatCurrency(invoice.subtotal)} />
              <InfoRow label="ITBMS" value={formatCurrency(invoice.tax_amount)} />
              <InfoRow label="Total" value={formatCurrency(invoice.total)} bold />
              <InfoRow label="Intentos de envio" value={String(invoice.retry_count)} />
            </div>
          </div>

          {/* Receptor Info */}
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Receptor
            </p>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Nombre" value={invoice.receptor_name ?? 'Consumidor Final'} />
              <InfoRow label="RUC" value={invoice.receptor_ruc ? `${invoice.receptor_ruc}-${invoice.receptor_dv}` : 'N/A'} />
            </div>
          </div>

          {/* Related CUFE for credit notes */}
          {invoice.document_type === 'NC' && invoice.related_cufe && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600">
                Factura Original (CUFE)
              </p>
              <p className="break-all font-mono text-xs text-slate-600">{invoice.related_cufe}</p>
            </div>
          )}

          {/* QR Code data */}
          {invoice.qr_code && (
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Datos QR
                </span>
              </div>
              <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{invoice.qr_code}</p>
            </div>
          )}

          {/* PAC Response */}
          {invoice.pac_response && (
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Respuesta del PAC
              </p>
              <pre className="max-h-40 overflow-auto rounded bg-slate-800 p-3 text-[11px] text-green-400 scrollbar-thin">
                {JSON.stringify(invoice.pac_response, null, 2)}
              </pre>
            </div>
          )}

          {/* XML Toggle */}
          {(invoice.xml_request || invoice.xml_response) && (
            <div>
              <button
                onClick={() => setShowXml(!showXml)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <FileText className="h-3.5 w-3.5" />
                {showXml ? 'Ocultar XML' : 'Ver XML'}
              </button>
              {showXml && (
                <div className="mt-2 space-y-3">
                  {invoice.xml_request && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-slate-400">XML Enviado</p>
                      <pre className="max-h-48 overflow-auto rounded bg-slate-800 p-3 text-[10px] text-slate-300 scrollbar-thin">
                        {invoice.xml_request}
                      </pre>
                    </div>
                  )}
                  {invoice.xml_response && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-slate-400">XML Respuesta</p>
                      <pre className="max-h-48 overflow-auto rounded bg-slate-800 p-3 text-[10px] text-slate-300 scrollbar-thin">
                        {invoice.xml_response}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          {(invoice.status === 'pending' || invoice.status === 'rejected') && (
            <button
              onClick={onResend}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
              {invoice.status === 'rejected' ? 'Reintentar' : 'Enviar al PAC'}
            </button>
          )}
          {invoice.status === 'authorized' && (
            <>
              <button
                onClick={onPreview}
                className="flex items-center gap-1.5 rounded-lg border border-green-200 px-4 py-2 text-sm font-semibold text-green-600 transition-colors hover:bg-green-50"
              >
                <Printer className="h-4 w-4" />
                Descargar PDF
              </button>
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                <Ban className="h-4 w-4" />
                Anular Documento
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`text-sm ${bold ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>
        {value}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: 'amber' | 'red';
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        highlight === 'amber'
          ? 'border-amber-200 bg-amber-50/50'
          : highlight === 'red'
            ? 'border-red-200 bg-red-50/50'
            : 'border-slate-200 bg-white'
      }`}
    >
      {icon}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  );
}
