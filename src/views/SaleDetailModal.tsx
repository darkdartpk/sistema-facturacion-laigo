import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { X, Package, Receipt, Truck } from 'lucide-react';

type SaleDetail = {
  id: string;
  invoice_number: string | null;
  total: number;
  subtotal: number;
  tax_amount: number;
  discount_percentage: number;
  payment_method: string;
  sale_type: string;
  customer_name: string | null;
  created_at: string;
};

type SaleItemDetail = {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_exempt: boolean;
  tax_discount_50: boolean;
  part: {
    sku: string | null;
    name: string;
    oem_code: string | null;
  } | null;
  supplierName?: string | null;
};

export default function SaleDetailModal({
  saleId,
  onClose,
}: {
  saleId: string;
  onClose: () => void;
}) {
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [items, setItems] = useState<SaleItemDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const [saleRes, itemsRes] = await Promise.all([
        supabase.from('sales').select('*').eq('id', saleId).maybeSingle(),
        supabase
          .from('sale_items')
          .select('id, quantity, unit_price, subtotal, tax_exempt, tax_discount_50, part_id')
          .eq('sale_id', saleId),
      ]);

      if (saleRes.data) setSale(saleRes.data as SaleDetail);

      const saleItems = (itemsRes.data ?? []) as (SaleItemDetail & { part_id: string })[];

      const partIds = saleItems.map((i) => i.part_id).filter(Boolean);
      let partsMap: Record<string, { sku: string | null; name: string; oem_code: string | null }> = {};

      if (partIds.length > 0) {
        const { data: parts } = await supabase
          .from('parts')
          .select('id, sku, name, oem_code')
          .in('id', partIds);
        if (parts) {
          partsMap = Object.fromEntries(parts.map((p) => [p.id, { sku: p.sku, name: p.name, oem_code: p.oem_code }]));
        }
      }

      // Fetch last supplier for each part
      let supplierMap: Record<string, string> = {};
      if (partIds.length > 0) {
        const { data: siItems } = await supabase
          .from('supplier_invoice_items')
          .select('part_id, invoice_id, supplier_invoices!inner(supplier_id, suppliers!inner(name))')
          .in('part_id', partIds);
        if (siItems) {
          for (const si of siItems as any[]) {
            const name = si.supplier_invoices?.suppliers?.name;
            if (name) supplierMap[si.part_id] = name;
          }
        }
      }

      setItems(
        saleItems.map((item) => ({
          ...item,
          part: partsMap[item.part_id] ?? null,
          supplierName: supplierMap[item.part_id] ?? null,
        })),
      );

      setLoading(false);
    })();
  }, [saleId]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-800">
              Detalle de Factura
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : !sale ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            No se encontró la factura.
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-4">
              <div>
                <span className="text-[11px] font-medium uppercase text-slate-400">Ref.</span>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-700">
                  {sale.invoice_number ?? sale.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-medium uppercase text-slate-400">Fecha</span>
                <p className="mt-0.5 text-sm text-slate-700">{formatDate(sale.created_at)}</p>
              </div>
              <div>
                <span className="text-[11px] font-medium uppercase text-slate-400">Cliente</span>
                <p className="mt-0.5 text-sm text-slate-700">{sale.customer_name ?? 'Consumidor final'}</p>
              </div>
              <div>
                <span className="text-[11px] font-medium uppercase text-slate-400">Pago</span>
                <p className="mt-0.5 text-sm text-slate-700">{sale.payment_method}</p>
              </div>
              {sale.discount_percentage > 0 && (
                <div>
                  <span className="text-[11px] font-medium uppercase text-slate-400">Descuento</span>
                  <p className="mt-0.5 text-sm text-red-600">{sale.discount_percentage}%</p>
                </div>
              )}
              <div>
                <span className="text-[11px] font-medium uppercase text-slate-400">Tipo</span>
                <p className="mt-0.5 text-sm text-slate-700">{sale.sale_type}</p>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Productos ({items.length})
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-2 font-semibold">Descripción</th>
                    <th className="pb-2 pr-2 text-center font-semibold">Cant.</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Precio</th>
                    <th className="pb-2 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                          <div>
                            <p className="text-xs font-medium text-slate-700">
                              {item.part?.name ?? 'Producto eliminado'}
                            </p>
                            {(item.part?.oem_code || item.part?.sku) && (
                              <p className="font-mono text-[10px] text-slate-400">
                                {item.part.oem_code && <span>Cod: {item.part.oem_code}</span>}
                                {item.part.oem_code && item.part.sku && <span> | </span>}
                                {item.part.sku && <span>SKU: {item.part.sku}</span>}
                              </p>
                            )}
                            {item.supplierName && (
                              <p className="flex items-center gap-1 text-[10px] text-emerald-600">
                                <Truck className="h-2.5 w-2.5" />
                                {item.supplierName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-center text-xs text-slate-600">{item.quantity}</td>
                      <td className="py-2 pr-2 text-right text-xs text-slate-600">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="py-2 text-right text-xs font-medium text-slate-700">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>ITBMS</span>
                <span>{formatCurrency(sale.tax_amount)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
                <span className="text-sm font-bold text-slate-700">Total</span>
                <span className="text-sm font-bold text-blue-700">{formatCurrency(sale.total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
