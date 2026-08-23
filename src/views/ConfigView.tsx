import { useState } from 'react';
import { supabase, type Branch } from '@/lib/supabase';
import {
  Settings, Store, FileText, Save, X, CheckCircle2, AlertCircle, Building2, Phone, MapPin, Hash,
} from 'lucide-react';

type FiscalForm = {
  razon_social: string;
  nombre_comercial: string;
  ruc: string;
  dv: string;
  aviso_operacion: string;
  punto_emision: string;
  direccion_fiscal: string;
  telefono_fiscal: string;
};

export default function ConfigView({ branches, onBranchesUpdate }: { branches: Branch[]; onBranchesUpdate: () => void }) {
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<FiscalForm>({
    razon_social: '',
    nombre_comercial: '',
    ruc: '',
    dv: '',
    aviso_operacion: '',
    punto_emision: '',
    direccion_fiscal: '',
    telefono_fiscal: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(branch: Branch) {
    setEditingBranch(branch);
    setForm({
      razon_social: branch.razon_social ?? '',
      nombre_comercial: branch.nombre_comercial ?? '',
      ruc: branch.ruc ?? '',
      dv: branch.dv ?? '',
      aviso_operacion: branch.aviso_operacion ?? '',
      punto_emision: branch.punto_emision ?? '',
      direccion_fiscal: branch.direccion_fiscal ?? '',
      telefono_fiscal: branch.telefono_fiscal ?? '',
    });
    setError(null);
    setSuccess(false);
  }

  function closeEdit() {
    setEditingBranch(null);
    setSuccess(false);
    setError(null);
  }

  async function handleSave() {
    if (!editingBranch) return;
    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from('branches')
      .update({
        razon_social: form.razon_social.trim() || null,
        nombre_comercial: form.nombre_comercial.trim() || null,
        ruc: form.ruc.trim() || null,
        dv: form.dv.trim() || null,
        aviso_operacion: form.aviso_operacion.trim() || null,
        punto_emision: form.punto_emision.trim() || null,
        direccion_fiscal: form.direccion_fiscal.trim() || null,
        telefono_fiscal: form.telefono_fiscal.trim() || null,
      })
      .eq('id', editingBranch.id);

    setSaving(false);
    if (err) {
      setError('No se pudieron guardar los cambios. Intenta de nuevo.');
    } else {
      setSuccess(true);
      onBranchesUpdate();
      setTimeout(() => setSuccess(false), 2500);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Configuración</h1>
              <p className="text-sm text-slate-500">Gestiona los datos fiscales de cada sucursal</p>
            </div>
          </div>
        </div>

        {/* Branch list */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Sucursales</h2>
          {branches.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No hay sucursales registradas.</p>
          )}
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50">
                    <Store className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">{branch.name}</h3>
                    <p className="text-xs text-slate-500">
                      {branch.direccion_fiscal || branch.address || 'Sin dirección registrada'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openEdit(branch)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  <FileText className="h-4 w-4" />
                  Editar Datos Fiscales
                </button>
              </div>

              {/* Fiscal data summary */}
              {branch.ruc && (
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-400">RUC</p>
                    <p className="text-xs font-medium text-slate-700">{branch.ruc}{branch.dv ? ` DV ${branch.dv}` : ''}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-400">Punto Emisión</p>
                    <p className="text-xs font-medium text-slate-700">{branch.punto_emision || '---'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-400">Aviso Op.</p>
                    <p className="text-xs font-medium text-slate-700">{branch.aviso_operacion || '---'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-400">Teléfono</p>
                    <p className="text-xs font-medium text-slate-700">{branch.telefono_fiscal || '---'}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                  <Building2 className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Datos Fiscales</h3>
                  <p className="text-xs text-slate-500">{editingBranch.name}</p>
                </div>
              </div>
              <button onClick={closeEdit} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {success && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Datos fiscales guardados correctamente.
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Razón Social</label>
                  <input
                    value={form.razon_social}
                    onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                    placeholder="Ej: Auto Repuesto y Electrónica Nueva Era, S.A."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre Comercial</label>
                  <input
                    value={form.nombre_comercial}
                    onChange={(e) => setForm({ ...form, nombre_comercial: e.target.value })}
                    placeholder="Ej: Electrónica Nueva Era"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">RUC</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        value={form.ruc}
                        onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                        placeholder="Ej: 8-863-1871"
                        className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">DV</label>
                    <input
                      value={form.dv}
                      onChange={(e) => setForm({ ...form, dv: e.target.value })}
                      placeholder="Ej: 71"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-center focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Número de Aviso de Operación</label>
                  <input
                    value={form.aviso_operacion}
                    onChange={(e) => setForm({ ...form, aviso_operacion: e.target.value })}
                    placeholder="Ej: 8-102-3456"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Punto de Emisión / Código de Sucursal</label>
                  <input
                    value={form.punto_emision}
                    onChange={(e) => setForm({ ...form, punto_emision: e.target.value })}
                    placeholder="Ej: 001"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Dirección Física Completa</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <textarea
                      value={form.direccion_fiscal}
                      onChange={(e) => setForm({ ...form, direccion_fiscal: e.target.value })}
                      placeholder="Ej: Av. Central, Santiago, Veraguas, Panamá"
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Teléfono</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.telefono_fiscal}
                      onChange={(e) => setForm({ ...form, telefono_fiscal: e.target.value })}
                      placeholder="Ej: 6305-4816"
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 border-t border-slate-200 px-5 py-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar Datos Fiscales'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
