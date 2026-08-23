import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey);

export type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  created_at: string;
  razon_social: string | null;
  nombre_comercial: string | null;
  ruc: string | null;
  dv: string | null;
  aviso_operacion: string | null;
  punto_emision: string | null;
  direccion_fiscal: string | null;
  telefono_fiscal: string | null;
};

export type Inventory = {
  id: string;
  part_id: string;
  branch_id: string;
  quantity: number;
  min_stock: number;
  max_stock: number;
  updated_at: string;
};

export type ProductType = 'articulo' | 'servicio' | 'kit';

export type Part = {
  id: string;
  sku: string | null;
  oem_code: string | null;
  name: string;
  brand: string;
  category: string | null;
  price: number;
  price2: number;
  cost: number;
  cost_fob: number;
  description: string | null;
  location: string | null;
  photo_url: string | null;
  barcode: string | null;
  code2: string | null;
  product_type: ProductType;
  created_at: string;
};

export type KitComponent = {
  id: string;
  kit_id: string;
  component_id: string;
  quantity: number;
  created_at: string;
};

export type PartWithRelations = Part & {
  inventory: Inventory[];
};

export type Customer = {
  id: string;
  customer_number: number;
  name: string;
  phone: string | null;
  email: string | null;
  cedula: string | null;
  ruc: string | null;
  dv: string | null;
  tax_id: string | null;
  credit_limit: number;
  credit_days: number;
  balance: number;
  credit_balance: number;
  pending_balance: number;
  rewards_percentage: number;
  rewards_points: number;
  reward_type: 'points' | 'cashback';
  is_blocked: boolean;
  photo_url: string | null;
  assigned_seller_id: string | null;
  branch_id: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  branch_id: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  customer_name: string | null;
  customer_id: string | null;
  sale_type: string;
  credit_days: number | null;
  payment_method: string;
  invoice_number: string | null;
  seller_id: string | null;
  discount_percentage: number;
  points_awarded: boolean;
  points_earned: number;
  credit_status: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  part_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_exempt: boolean;
  tax_discount_50: boolean;
  custom_name: string | null;
};

export type StockMovement = {
  id: string;
  part_id: string;
  branch_id: string;
  type: 'entrada' | 'salida';
  quantity: number;
  reason: string | null;
  created_at: string;
};

export type Closure = {
  id: string;
  branch_id: string;
  type: 'X' | 'Z';
  report_date: string;
  total_sales: number;
  total_amount: number;
  total_tax: number;
  total_cost: number;
  created_at: string;
};

export type Expense = {
  id: string;
  branch_id: string;
  invoice_number: string | null;
  description: string | null;
  total: number;
  created_at: string;
};

export type CashBox = {
  id: string;
  branch_id: string;
  opening_date: string;
  initial_amount: number;
  created_at: string;
};

export type Payment = {
  id: string;
  branch_id: string;
  customer_id: string | null;
  sale_id: string | null;
  amount: number;
  payment_method: string;
  created_at: string;
};

export type CreditNote = {
  id: string;
  sale_id: string | null;
  part_id: string;
  branch_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  reason: string | null;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  balance: number;
  monthly_budget: number | null;
  branch_id: string | null;
  created_at: string;
};

export type SupplierInvoice = {
  id: string;
  supplier_id: string;
  branch_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
};

export type SupplierInvoiceItem = {
  id: string;
  invoice_id: string;
  part_id: string | null;
  quantity: number;
  unit_cost: number;
  subtotal: number;
};

export type SupplierPayment = {
  id: string;
  supplier_id: string;
  branch_id: string | null;
  invoice_id: string | null;
  amount: number;
  payment_method: string;
  reference: string | null;
  payment_date: string | null;
  created_at: string;
};

export type SellerRole = 'admin' | 'gerencia' | 'supervisor' | 'ingresador' | 'vendedor' | 'caja';

export type Seller = {
  id: string;
  name: string;
  seller_code: string;
  pin: string;
  role: SellerRole;
  branch_id: string | null;
  is_active: boolean;
  commission_rate: number;
  vendor_number: string | null;
  created_at: string;
};

export type SellerPermission = {
  id: string;
  seller_id: string;
  permission: string;
  granted: boolean;
};

export const PERMISSION_KEYS = [
  'add_inventory',
  'edit_inventory',
  'view_costs',
  'apply_discounts',
  'manage_customers',
  'manage_suppliers',
  'process_credit_sales',
  'issue_credit_notes',
  'view_sales_reports',
  'view_catalog',
  'view_commissions',
  'view_accounting',
  'view_caja',
] as const;

export const PERMISSION_LABELS: Record<string, string> = {
  add_inventory: 'Agregar productos al inventario',
  edit_inventory: 'Editar stock / precios',
  view_costs: 'Ver costos',
  apply_discounts: 'Aplicar descuentos',
  manage_customers: 'Gestionar clientes',
  manage_suppliers: 'Proveedores',
  process_credit_sales: 'Ventas a crédito',
  issue_credit_notes: 'Emitir notas de crédito',
  view_sales_reports: 'Ver reportes de ventas',
  view_catalog: 'Ver catálogo de productos',
  view_commissions: 'Comisiones',
  view_accounting: 'Contabilidad',
  view_caja: 'Acceso a Caja',
};

export const ROLE_LABELS: Record<SellerRole, string> = {
  admin: 'Administrador',
  gerencia: 'Gerencia',
  supervisor: 'Supervisor',
  ingresador: 'Ingresador',
  vendedor: 'Vendedor',
  caja: 'Caja',
};

export type FEStatus = 'pending' | 'sent' | 'authorized' | 'rejected' | 'cancelled';
export type FEDocumentType = 'FE' | 'NC';

export type ElectronicInvoice = {
  id: string;
  sale_id: string | null;
  branch_id: string;
  invoice_number: string;
  cufe: string | null;
  qr_code: string | null;
  status: FEStatus;
  pac_response: Record<string, unknown> | null;
  xml_request: string | null;
  xml_response: string | null;
  authorization_date: string | null;
  error_message: string | null;
  receptor_ruc: string | null;
  receptor_name: string | null;
  receptor_dv: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  document_type: FEDocumentType;
  related_cufe: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
};

export type FEConfig = {
  id: string;
  ruc: string;
  dv: string;
  business_name: string;
  trade_name: string;
  address: string;
  branch_code: string;
  pos_code: string;
  economic_activity: string;
  pac_provider: string;
  pac_api_url: string;
  pac_api_key: string;
  pac_token_password: string;
  pac_environment: 'test' | 'production';
  certificate_serial: string;
  next_invoice_number: number;
  next_credit_note_number: number;
  created_at: string;
  updated_at: string;
};

export type FEActivityLog = {
  id: string;
  electronic_invoice_id: string;
  action: string;
  details: Record<string, unknown> | null;
  seller_id: string | null;
  created_at: string;
};

export type CashAccount = {
  id: string;
  branch_id: string;
  name: string;
  account_type: 'caja' | 'banco';
  balance: number;
  description: string | null;
  created_at: string;
};

export type AccountMovement = {
  id: string;
  account_id: string;
  branch_id: string;
  movement_type: 'ingreso' | 'egreso';
  amount: number;
  description: string;
  reference: string | null;
  category: string | null;
  created_at: string;
};

export type OperationalExpense = {
  id: string;
  branch_id: string;
  category: 'planilla' | 'local' | 'servicios' | 'mantenimiento' | 'otros';
  description: string;
  amount: number;
  payment_method: 'efectivo' | 'transferencia' | 'cheque';
  expense_date: string;
  recurring: boolean;
  notes: string | null;
  created_at: string;
};
