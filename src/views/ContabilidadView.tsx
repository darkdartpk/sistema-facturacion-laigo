import { useState, useMemo } from 'react';
import CobrosView from '@/views/CobrosView';
import CajaBancoTab from '@/views/CajaBancoTab';
import GastosOperativosTab from '@/views/GastosOperativosTab';
import SalesReportView from '@/views/SalesReportView';
import { type Branch } from '@/lib/supabase';
import {
  HandCoins,
  Wallet,
  Receipt,
  BarChart3,
} from 'lucide-react';

type Tab = 'cobros' | 'caja_banco' | 'gastos' | 'salesReport';

const ALL_TABS: { id: Tab; label: string; icon: typeof HandCoins }[] = [
  { id: 'cobros', label: 'Cobros', icon: HandCoins },
  { id: 'caja_banco', label: 'Caja / Banco', icon: Wallet },
  { id: 'gastos', label: 'Gastos Operativos', icon: Receipt },
  { id: 'salesReport', label: 'Reporte Contable', icon: BarChart3 },
];

export default function ContabilidadView({
  branchId,
  branchName,
  sellerRole,
  branches,
}: {
  branchId: string;
  branchName: string;
  sellerRole: string;
  branches: Branch[];
}) {
  const tabs = useMemo(() => {
    if (sellerRole === 'vendedor') {
      return ALL_TABS.filter((t) => t.id === 'cobros');
    }
    return ALL_TABS;
  }, [sellerRole]);

  const [tab, setTab] = useState<Tab>('cobros');

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      {tabs.length > 1 && (
        <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-4 pt-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50/50 text-blue-700'
                    : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'cobros' && <CobrosView branchId={branchId} branchName={branchName} sellerRole={sellerRole} />}
        {tab === 'caja_banco' && sellerRole !== 'vendedor' && <CajaBancoTab branchId={branchId} />}
        {tab === 'gastos' && sellerRole !== 'vendedor' && <GastosOperativosTab branchId={branchId} />}
        {tab === 'salesReport' && sellerRole !== 'vendedor' && (
          <div className="h-full overflow-y-auto p-6">
            <SalesReportView branches={branches} />
          </div>
        )}
      </div>
    </div>
  );
}
