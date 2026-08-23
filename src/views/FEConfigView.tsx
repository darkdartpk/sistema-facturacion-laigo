import { useCallback, useEffect, useState } from 'react';
import { supabase, type FEConfig } from '@/lib/supabase';
import {
  Settings,
  Save,
  Building2,
  Globe,
  Key,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Server,
  Plus,
  Trash2,
  Store,
} from 'lucide-react';

type FormData = {
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
  location_code: string;
  province: string;
  district: string;
  corregimiento: string;
};

const emptyForm: FormData = {
  ruc: '',
  dv: '',
  business_name: '',
  trade_name: '',
  address: '',
  branch_code: '000',
  pos_code: '001',
  economic_activity: '',
  pac_provider: '',
  pac_api_url: '',
  pac_api_key: '',
  pac_token_password: '',
  pac_environment: 'test',
  certificate_serial: '',
  next_invoice_number: 1,
  next_credit_note_number: 1,
  location_code: '8-1-1',
  province: 'Panamá',
  district: 'Panamá',
  corregimiento: 'Panamá',
};

function configToForm(c: FEConfig): FormData {
  return {
    ruc: c.ruc,
    dv: c.dv,
    business_name: c.business_name,
    trade_name: c.trade_name,
    address: c.address,
    branch_code: c.branch_code,
    pos_code: c.pos_code,
    economic_activity: c.economic_activity,
    pac_provider: c.pac_provider,
    pac_api_url: c.pac_api_url,
    pac_api_key: c.pac_api_key,
    pac_token_password: c.pac_token_password,
    pac_environment: c.pac_environment,
    certificate_serial: c.certificate_serial,
    next_invoice_number: c.next_invoice_number,
    next_credit_note_number: c.next_credit_note_number,
    location_code: (c as any).location_code ?? '8-1-1',
    province: (c as any).province ?? 'Panamá',
    district: (c as any).district ?? 'Panamá',
    corregimiento: (c as any).corregimiento ?? 'Panamá',
  };
}

export default function FEConfigView() {
  const [configs, setConfigs] = useState<FEConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [isNew, setIsNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fe_config')
      .select('*')
      .order('branch_code', { ascending: true });
    const list = (data ?? []) as FEConfig[];
    setConfigs(list);
    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0].id);
      setForm(configToForm(list[0]));
      setIsNew(false);
    } else if (list.length === 0) {
      setIsNew(true);
      setSelectedId(null);
      setForm({ ...emptyForm });
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectConfig(id: string) {
    const c = configs.find((x) => x.id === id);
    if (!c) return;
    setSelectedId(id);
    setForm(configToForm(c));
    setIsNew(false);
    setSaved(false);
    setConfirmDelete(false);
  }

  function startNewBranch() {
    setSelectedId(null);
    setIsNew(true);
    setSaved(false);
    setConfirmDelete(false);
    const nextCode = String(configs.length).padStart(3, '0');
    setForm({ ...emptyForm, branch_code: nextCode });
  }

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    const payload = {
      ...form,
      updated_at: new Date().toISOString(),
    };

    if (!isNew && selectedId) {
      await supabase.from('fe_config').update(payload).eq('id', selectedId);
    } else {
      const { data } = await supabase.from('fe_config').insert(payload).select().single();
      if (data) setSelectedId(data.id);
      setIsNew(false);
    }

    setSaving(false);
    setSaved(true);
    const { data: refreshed } = await supabase
      .from('fe_config')
      .select('*')
      .order('branch_code', { ascending: true });
    setConfigs((refreshed ?? []) as FEConfig[]);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    await supabase.from('fe_config').delete().eq('id', selectedId);
    setConfirmDelete(false);
    setSelectedId(null);
    const { data: refreshed } = await supabase
      .from('fe_config')
      .select('*')
      .order('branch_code', { ascending: true });
    const list = (refreshed ?? []) as FEConfig[];
    setConfigs(list);
    if (list.length > 0) {
      setSelectedId(list[0].id);
      setForm(configToForm(list[0]));
      setIsNew(false);
    } else {
      setIsNew(true);
      setForm({ ...emptyForm });
    }
  };

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const isConfigured = form.ruc && form.pac_api_url && form.pac_api_key && form.pac_token_password;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar - Branch List */}
      <div className="w-64 shrink-0">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-700">Sucursales</h3>
            <button
              onClick={startNewBranch}
              className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva
            </button>
          </div>
          <div className="max-h-[500px] overflow-y-auto p-2">
            {configs.length === 0 && !isNew && (
              <p className="px-3 py-4 text-center text-xs text-slate-400">
                No hay sucursales configuradas
              </p>
            )}
            {configs.map((c) => (
              <button
                key={c.id}
                onClick={() => selectConfig(c.id)}
                className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  selectedId === c.id && !isNew
                    ? 'bg-blue-50 ring-1 ring-blue-200'
                    : 'hover:bg-slate-50'
                }`}
              >
                <Store className={`h-4 w-4 shrink-0 ${selectedId === c.id && !isNew ? 'text-blue-600' : 'text-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${selectedId === c.id && !isNew ? 'text-blue-700' : 'text-slate-700'}`}>
                    {c.trade_name || c.business_name || 'Sin nombre'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Sucursal {c.branch_code} / POS {c.pos_code}
                  </p>
                </div>
                {c.pac_api_key ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                )}
              </button>
            ))}
            {isNew && (
              <div className="mb-1 flex w-full items-center gap-3 rounded-lg bg-green-50 px-3 py-2.5 ring-1 ring-green-200">
                <Plus className="h-4 w-4 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700">Nueva sucursal</p>
                  <p className="text-[11px] text-green-500">Sucursal {form.branch_code}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Config Form */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Status Banner */}
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 ${
            isNew
              ? 'border-blue-200 bg-blue-50'
              : isConfigured
                ? 'border-green-200 bg-green-50'
                : 'border-amber-200 bg-amber-50'
          }`}
        >
          {isNew ? (
            <Plus className="h-5 w-5 shrink-0 text-blue-600" />
          ) : isConfigured ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div>
            <p className={`text-sm font-semibold ${isNew ? 'text-blue-800' : isConfigured ? 'text-green-800' : 'text-amber-800'}`}>
              {isNew
                ? 'Configurar nueva sucursal'
                : isConfigured
                  ? 'Facturacion Electronica configurada'
                  : 'Configuracion incompleta'}
            </p>
            <p className={`text-xs ${isNew ? 'text-blue-600' : isConfigured ? 'text-green-600' : 'text-amber-600'}`}>
              {isNew
                ? 'Completa los datos para agregar esta sucursal.'
                : isConfigured
                  ? `Modo: ${form.pac_environment === 'production' ? 'Produccion' : 'Pruebas'} | PAC: ${form.pac_provider || 'No definido'}`
                  : 'Completa los datos del emisor y la configuracion del PAC.'}
            </p>
          </div>
        </div>

        {/* Business Info */}
        <Section icon={<Building2 className="h-4 w-4 text-blue-600" />} title="Datos del Emisor">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="RUC" value={form.ruc} onChange={(v) => updateField('ruc', v)} placeholder="12345-6-789012" />
            <Field label="DV" value={form.dv} onChange={(v) => updateField('dv', v)} placeholder="45" />
            <Field label="Razon Social" value={form.business_name} onChange={(v) => updateField('business_name', v)} placeholder="Mi Empresa S.A." full />
            <Field label="Nombre Comercial" value={form.trade_name} onChange={(v) => updateField('trade_name', v)} placeholder="Laigo AutoParts" full />
            <Field label="Direccion Fiscal" value={form.address} onChange={(v) => updateField('address', v)} placeholder="Ciudad de Panama, Calle 50..." full />
            <Field label="Codigo Ubicacion (Prov-Dist-Correg)" value={form.location_code} onChange={(v) => updateField('location_code', v)} placeholder="8-1-1" />
            <Field label="Provincia" value={form.province} onChange={(v) => updateField('province', v)} placeholder="Panamá" />
            <Field label="Distrito" value={form.district} onChange={(v) => updateField('district', v)} placeholder="Panamá" />
            <Field label="Corregimiento" value={form.corregimiento} onChange={(v) => updateField('corregimiento', v)} placeholder="Panamá" />
            <Field label="Actividad Economica" value={form.economic_activity} onChange={(v) => updateField('economic_activity', v)} placeholder="Venta de repuestos automotrices" full />
          </div>
        </Section>

        {/* Branch/POS codes */}
        <Section icon={<Server className="h-4 w-4 text-blue-600" />} title="Codigos de Sucursal">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Codigo de Sucursal" value={form.branch_code} onChange={(v) => updateField('branch_code', v)} placeholder="000" />
            <Field label="Codigo Punto de Facturacion" value={form.pos_code} onChange={(v) => updateField('pos_code', v)} placeholder="001" />
          </div>
        </Section>

        {/* PAC Configuration */}
        <Section icon={<Globe className="h-4 w-4 text-blue-600" />} title="Configuracion del PAC">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Proveedor (PAC)" value={form.pac_provider} onChange={(v) => updateField('pac_provider', v)} placeholder="Ej. Free Fiscal, HKA..." />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Ambiente</label>
              <select
                value={form.pac_environment}
                onChange={(e) => updateField('pac_environment', e.target.value as 'test' | 'production')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="test">Pruebas</option>
                <option value="production">Produccion</option>
              </select>
            </div>
            <Field label="URL Base API" value={form.pac_api_url} onChange={(v) => updateField('pac_api_url', v)} placeholder="https://integracion.thefactoryhka.com.pa/api" full />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Token Usuario</label>
              <div className="relative">
                <Key className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={form.pac_api_key}
                  onChange={(e) => updateField('pac_api_key', e.target.value)}
                  placeholder="xxxxx_tfhka"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Token Password</label>
              <div className="relative">
                <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={form.pac_token_password}
                  onChange={(e) => updateField('pac_token_password', e.target.value)}
                  placeholder="xxxxx"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Certificate */}
        <Section icon={<Shield className="h-4 w-4 text-blue-600" />} title="Certificado Digital">
          <Field label="Serial del Certificado" value={form.certificate_serial} onChange={(v) => updateField('certificate_serial', v)} placeholder="ABC123DEF456..." full />
        </Section>

        {/* Numbering */}
        <Section icon={<Settings className="h-4 w-4 text-blue-600" />} title="Numeracion">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Proximo N. Factura Electronica</label>
              <input
                type="number"
                value={form.next_invoice_number}
                onChange={(e) => updateField('next_invoice_number', parseInt(e.target.value) || 1)}
                min={1}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Proximo N. Nota de Credito</label>
              <input
                type="number"
                value={form.next_credit_note_number}
                onChange={(e) => updateField('next_credit_note_number', parseInt(e.target.value) || 1)}
                min={1}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </Section>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-5">
          <div>
            {!isNew && selectedId && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Confirmar eliminacion?</span>
                  <button
                    onClick={handleDelete}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Si, eliminar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar sucursal
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Guardado
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isNew ? 'Crear Sucursal' : 'Guardar Configuracion'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
