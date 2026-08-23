import { useEffect, useMemo, useState } from 'react';
import { supabase, type Branch, type Seller } from '@/lib/supabase';
import CatalogView from '@/views/CatalogView';
import InventoryView from '@/views/InventoryView';
import PosView from '@/views/PosView';
import SalesView from '@/views/SalesView';
import CustomersView from '@/views/CustomersView';
import AdminView from '@/views/AdminView';
import CommissionsView from '@/views/CommissionsView';
import ContabilidadView from '@/views/ContabilidadView';
import SuppliersView from '@/views/SuppliersView';
import ConfigView from '@/views/ConfigView';
import PinLogin from '@/views/PinLogin';
import {
  Package,
  Boxes,
  ShoppingCart,
  Receipt,
  Users,
  Store,
  Wrench,
  UserCog,
  BadgeDollarSign,
  HandCoins,
  Truck,
  LogOut,
  Menu,
  X,
  Settings,
} from 'lucide-react';

type View = 'pos' | 'catalog' | 'inventory' | 'suppliers' | 'sales' | 'cobros' | 'customers' | 'admin' | 'commissions' | 'config';

const ALL_NAV_ITEMS: { id: View; label: string; icon: typeof Package; roles: string[] }[] = [
  { id: 'pos', label: 'Facturacion', icon: ShoppingCart, roles: ['admin', 'gerencia', 'supervisor', 'vendedor'] },
  { id: 'customers', label: 'Clientes', icon: Users, roles: ['admin', 'gerencia', 'supervisor', 'vendedor'] },
  { id: 'catalog', label: 'Catálogo', icon: Package, roles: ['admin', 'supervisor', 'ingresador', 'vendedor'] },
  { id: 'inventory', label: 'Inventario', icon: Boxes, roles: ['admin', 'supervisor', 'ingresador'] },
  { id: 'suppliers', label: 'Proveedores', icon: Truck, roles: ['admin', 'gerencia', 'ingresador'] },
  { id: 'sales', label: 'Caja', icon: Receipt, roles: ['admin', 'gerencia', 'supervisor', 'caja'] },
  { id: 'cobros', label: 'Contabilidad', icon: HandCoins, roles: ['admin', 'gerencia', 'supervisor', 'vendedor', 'caja'] },
  { id: 'commissions', label: 'Comisiones', icon: BadgeDollarSign, roles: ['admin', 'gerencia'] },
  { id: 'admin', label: 'Administración', icon: UserCog, roles: ['admin'] },
  { id: 'config', label: 'Configuración', icon: Settings, roles: ['admin', 'gerencia'] },
];

export default function App() {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [sellerPerms, setSellerPerms] = useState<string[]>([]);

  const [view, setView] = useState<View>('pos');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Force caja role to only allowed views
  useEffect(() => {
    if (seller && seller.role === 'caja' && view !== 'sales' && view !== 'cobros') {
      setView('sales');
    }
  }, [seller, view]);

  useEffect(() => {
    if (!seller) return;
    (async () => {
      const { data: permData } = await supabase
        .from('seller_permissions')
        .select('permission')
        .eq('seller_id', seller.id)
        .eq('granted', true);
      setSellerPerms((permData ?? []).map((p) => p.permission));

      const { data } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      if (data && data.length > 0) {
        setBranches(data as Branch[]);
        if (seller.branch_id && data.some(b => b.id === seller.branch_id)) {
          setActiveBranchId(seller.branch_id);
        } else {
          setActiveBranchId(data[0].id);
        }
      }
      setLoadingBranches(false);
    })();
  }, [seller]);

  const handleLogin = (s: Seller) => {
    setSeller(s);
    setView(s.role === 'caja' ? 'sales' : 'pos');
  };

  const handleLogout = () => {
    setSeller(null);
    setSellerPerms([]);
    setBranches([]);
    setActiveBranchId('');
    setLoadingBranches(true);
    setView('pos');
  };

  const reloadBranches = async () => {
    const { data } = await supabase.from('branches').select('*').order('name');
    if (data) setBranches(data as Branch[]);
  };

  const navItems = useMemo(() => {
    if (!seller) return [];
    return ALL_NAV_ITEMS.filter(item => {
      if (!item.roles.includes(seller.role)) return false;
      if (item.id === 'catalog' && seller.role === 'vendedor') {
        return sellerPerms.includes('view_catalog');
      }

      return true;
    });
  }, [seller, sellerPerms]);

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) ?? null,
    [branches, activeBranchId],
  );

  if (!seller) {
    return <PinLogin onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100" onContextMenu={(e) => e.preventDefault()}>
      {/* Desktop Header */}
      <header className="hidden lg:flex h-14 shrink-0 items-center gap-4 bg-slate-900 px-4 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Wrench className="h-4.5 w-4.5" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight uppercase">Laigo AutoParts</p>
            <p className="text-[10px] text-slate-400">Sistema Multi-Sucursal</p>
          </div>
        </div>

        <div className="mx-2 h-7 w-px bg-slate-700" />

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5">
            <Store className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-medium text-slate-300">Sucursal:</span>
            {loadingBranches ? (
              <div className="h-5 w-28 animate-pulse rounded bg-slate-700" />
            ) : (
              <select
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value)}
                disabled={seller.role === 'vendedor' && !!seller.branch_id}
                className="cursor-pointer rounded border-0 bg-transparent text-sm font-semibold text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-800">
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5">
            <span className="text-xs text-slate-400">{seller.name}</span>
            <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300 uppercase">
              {seller.role}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="flex lg:hidden h-14 shrink-0 items-center justify-between bg-slate-900 px-3 text-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
              <Wrench className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <p className="text-sm font-bold tracking-tight uppercase">Laigo</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!loadingBranches && (
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2 py-1">
              <Store className="h-3.5 w-3.5 text-blue-400" />
              <select
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value)}
                disabled={seller.role === 'vendedor' && !!seller.branch_id}
                className="cursor-pointer rounded border-0 bg-transparent text-xs font-semibold text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 max-w-[100px]"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-800">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile Slide-out Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-slate-900 shadow-2xl flex flex-col animate-slide-in">
            <div className="flex h-14 items-center justify-between px-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <Wrench className="h-4.5 w-4.5" strokeWidth={2.5} />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-bold tracking-tight uppercase text-white">Laigo AutoParts</p>
                  <p className="text-[10px] text-slate-400">Sistema Multi-Sucursal</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-300">
                    {seller.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{seller.name}</p>
                  <p className="text-[10px] text-blue-300 uppercase font-semibold">{seller.role}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-2 px-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors mb-0.5 ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        {activeBranchId && (
          <div className={view === 'pos' ? 'h-full' : 'hidden'}>
            <PosView branchId={activeBranchId} branchName={activeBranch?.name ?? ''} branch={activeBranch} currentSellerId={seller?.id} isVisible={view === 'pos'} />
          </div>
        )}
        {view === 'catalog' && activeBranchId && (
          <CatalogView branchId={activeBranchId} />
        )}
        {view === 'inventory' && activeBranchId && (
          <InventoryView branchId={activeBranchId} branches={branches} sellerRole={seller.role} />
        )}
        {view === 'suppliers' && activeBranchId && (
          <SuppliersView branchId={activeBranchId} branchName={activeBranch?.name ?? ''} />
        )}
        {view === 'sales' && activeBranchId && (
          <SalesView branchId={activeBranchId} branchName={activeBranch?.name ?? ''} branches={branches} />
        )}
        {view === 'cobros' && activeBranchId && (
          <ContabilidadView branchId={activeBranchId} branchName={activeBranch?.name ?? ''} sellerRole={seller.role} branches={branches} />
        )}
        {view === 'customers' && activeBranchId && <CustomersView sellerRole={seller?.role} branchId={activeBranchId} />}
        {view === 'commissions' && activeBranchId && <CommissionsView branchId={activeBranchId} />}
        {view === 'admin' && <AdminView branches={branches} branchId={activeBranchId} />}
        {view === 'config' && <ConfigView branches={branches} onBranchesUpdate={reloadBranches} />}
      </main>
    </div>
  );
}
