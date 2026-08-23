import { supabase } from '@/lib/supabase';

type AuditAction = 'insert' | 'update' | 'delete' | 'price_change' | 'stock_adjust' | 'sale' | 'payment';

export async function logAudit(params: {
  tableName: string;
  recordId?: string;
  action: AuditAction;
  changes?: Record<string, any>;
  sellerName?: string;
  sellerId?: string;
}) {
  try {
    await supabase.from('audit_log').insert({
      table_name: params.tableName,
      record_id: params.recordId ?? null,
      action: params.action,
      changes: params.changes ?? {},
      seller_name: params.sellerName ?? 'Sistema',
      seller_id: params.sellerId ?? null,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
