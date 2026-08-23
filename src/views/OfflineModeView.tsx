import { useEffect, useState } from 'react';
import { Wifi, WifiOff, HardDrive, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function OfflineModeView() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [swRegistered, setSwRegistered] = useState(false);
  const [cacheSize, setCacheSize] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        setSwRegistered(!!reg);
      });
    }

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((est) => {
        if (est.usage) {
          const mb = (est.usage / (1024 * 1024)).toFixed(2);
          setCacheSize(`${mb} MB`);
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function enableOfflineMode() {
    setEnabling(true);
    try {
      if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js');
        setSwRegistered(true);
      }
    } catch (err) {
      console.error('SW registration failed:', err);
    }
    setEnabling(false);
  }

  async function clearCache() {
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
      setCacheSize('0 MB');
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.unregister();
        setSwRegistered(false);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
          {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Modo Sin Internet</h2>
          <p className="text-sm text-slate-500">
            Permite que la aplicacion funcione parcialmente sin conexion
          </p>
        </div>
      </div>

      {/* Connection status */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${isOnline ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        {isOnline ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-800">Conectado</p>
              <p className="text-xs text-green-600">La aplicacion esta funcionando con conexion a internet</p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-800">Sin Conexion</p>
              <p className="text-xs text-red-600">No hay conexion a internet. Solo funciones en cache disponibles.</p>
            </div>
          </>
        )}
      </div>

      {/* Service Worker status */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Cache Local</p>
              <p className="text-xs text-slate-500">
                {swRegistered
                  ? 'Modo offline activado - la app se carga desde cache'
                  : 'Modo offline desactivado'}
              </p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${swRegistered ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {swRegistered ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        {cacheSize && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Almacenamiento usado:</span>
            <span className="font-medium text-slate-700">{cacheSize}</span>
          </div>
        )}

        <div className="flex gap-2">
          {!swRegistered ? (
            <button
              onClick={enableOfflineMode}
              disabled={enabling}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Wifi className="h-4 w-4" />
              {enabling ? 'Activando...' : 'Activar Modo Offline'}
            </button>
          ) : (
            <button
              onClick={clearCache}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <RefreshCw className="h-4 w-4" />
              Desactivar y limpiar cache
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Como funciona
        </p>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">1</span>
            La aplicacion se guarda localmente en tu dispositivo
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">2</span>
            Si pierdes internet, puedes seguir viendo la pantalla del sistema
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">3</span>
            Las operaciones que requieren guardar datos (ventas, ediciones) necesitan conexion
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-600">!</span>
            Se recomienda exportar respaldos frecuentemente desde la seccion "Exportar Datos"
          </li>
        </ul>
      </div>
    </div>
  );
}
