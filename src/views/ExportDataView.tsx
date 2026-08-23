import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import {
  Download,
  FileSpreadsheet,
  Boxes,
  Users,
  Receipt,
  Truck,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

type ExportType = 'inventory' | 'customers' | 'sales' | 'suppliers';

const EXPORT_OPTIONS: { id: ExportType; label: string; description: string; icon: typeof Boxes }[] = [
  { id: 'inventory', label: 'Inventario', description: 'Todos los productos con stock, precios y costos', icon: Boxes },
  { id: 'customers', label: 'Clientes', description: 'Lista de clientes con datos de contacto y crédito', icon: Users },
  { id: 'sales', label: 'Ventas', description: 'Historial de ventas con detalle de artículos', icon: Receipt },
  { id: 'suppliers', label: 'Proveedores', description: 'Lista de proveedores con datos de contacto', icon: Truck },
];

export default function ExportDataView() {
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [done, setDone] = useState<ExportType | null>(null);

  async function handleExport(type: ExportType) {
    setExporting(type);
    setDone(null);

    try {
      let ws: XLSX.WorkSheet;
      let filename: string;

      switch (type) {
        case 'inventory': {
          const { data } = await supabase
            .from('parts')
            .select('*, inventory(*)')
            .order('name');
          const rows = (data ?? []).map((p: any) => ({
            Codigo: p.sku ?? '',
            OEM: p.oem_code ?? '',
            Descripcion: p.name,
            Marca: p.brand,
            Categoria: p.category ?? '',
            Precio: p.price,
            Precio2: p.price2,
            Costo: p.cost,
            CostoFOB: p.cost_fob,
            Stock: p.inventory?.[0]?.quantity ?? 0,
            StockMinimo: p.inventory?.[0]?.min_stock ?? 0,
            Ubicacion: p.location ?? '',
            Tipo: p.product_type ?? 'articulo',
          }));
          ws = XLSX.utils.json_to_sheet(rows);
          filename = `inventario_${dateStamp()}.xlsx`;
          break;
        }
        case 'customers': {
          const { data } = await supabase
            .from('customers')
            .select('*')
            .order('name');
          const rows = (data ?? []).map((c: any) => ({
            Numero: c.customer_number,
            Nombre: c.name,
            Telefono: c.phone ?? '',
            Email: c.email ?? '',
            Cedula: c.cedula ?? '',
            RUC: c.ruc ?? '',
            DV: c.dv ?? '',
            LimiteCredito: c.credit_limit,
            DiasCredito: c.credit_days,
            Saldo: c.balance,
            SaldoFavor: c.credit_balance,
            PuntosRecompensa: c.rewards_points,
            Bloqueado: c.is_blocked ? 'Si' : 'No',
          }));
          ws = XLSX.utils.json_to_sheet(rows);
          filename = `clientes_${dateStamp()}.xlsx`;
          break;
        }
        case 'sales': {
          const { data } = await supabase
            .from('sales')
            .select('*, sale_items(*)')
            .order('created_at', { ascending: false })
            .limit(5000);
          const rows = (data ?? []).flatMap((s: any) =>
            (s.sale_items ?? []).map((item: any) => ({
              Factura: s.invoice_number ?? '',
              Fecha: new Date(s.created_at).toLocaleDateString(),
              Cliente: s.customer_name ?? 'Público General',
              Tipo: s.sale_type,
              MetodoPago: s.payment_method,
              Articulo: item.part_name,
              Cantidad: item.quantity,
              PrecioUnit: item.unit_price,
              Subtotal: item.subtotal,
              ITBMS: item.tax_amount ?? 0,
              Total: s.total,
              Descuento: s.discount_percentage ? `${s.discount_percentage}%` : '',
            }))
          );
          ws = XLSX.utils.json_to_sheet(rows);
          filename = `ventas_${dateStamp()}.xlsx`;
          break;
        }
        case 'suppliers': {
          const { data } = await supabase
            .from('suppliers')
            .select('*')
            .order('name');
          const rows = (data ?? []).map((s: any) => ({
            Nombre: s.name,
            Contacto: s.contact_name ?? '',
            Telefono: s.phone ?? '',
            Email: s.email ?? '',
            Direccion: s.address ?? '',
            RUC: s.tax_id ?? '',
            Pais: s.country ?? '',
            Notas: s.notes ?? '',
            PresupuestoMensual: s.monthly_budget ?? 0,
          }));
          ws = XLSX.utils.json_to_sheet(rows);
          filename = `proveedores_${dateStamp()}.xlsx`;
          break;
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws!, type);
      XLSX.writeFile(wb, filename!);
      setDone(type);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Exportar Datos</h2>
          <p className="text-sm text-slate-500">Descarga respaldos de tus datos en formato Excel</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EXPORT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isExporting = exporting === opt.id;
          const isDone = done === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleExport(opt.id)}
              disabled={isExporting}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-green-300 hover:shadow-md disabled:opacity-60"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-green-50 group-hover:text-green-600">
                {isExporting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-500" />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{opt.description}</p>
              </div>
              <Download className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-green-600" />
            </button>
          );
        })}
      </div>

      {done && (
        <p className="mt-3 text-sm text-green-600 font-medium">
          Archivo descargado exitosamente.
        </p>
      )}
    </div>
  );
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
