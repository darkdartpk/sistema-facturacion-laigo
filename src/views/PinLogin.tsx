import { useState, useRef, useEffect } from 'react';
import { supabase, type Seller } from '@/lib/supabase';
import { Wrench, Shield, AlertCircle } from 'lucide-react';

interface Props {
  onLogin: (seller: Seller) => void;
}

export default function PinLogin({ onLogin }: Props) {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    const fullPin = newPin.join('');
    if (fullPin.length >= 4 && newPin.slice(0, 4).every(d => d !== '')) {
      const trimmed = newPin.filter(d => d !== '').join('');
      if (trimmed.length >= 4) {
        attemptLogin(trimmed);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const fullPin = pin.filter(d => d !== '').join('');
      if (fullPin.length >= 4) {
        attemptLogin(fullPin);
      }
    }
  };

  const attemptLogin = async (fullPin: string) => {
    setLoading(true);
    const { data, error: dbError } = await supabase
      .from('sellers')
      .select('*')
      .eq('pin', fullPin)
      .eq('is_active', true);

    if (dbError || !data || data.length === 0) {
      setError('PIN incorrecto o usuario inactivo');
      setPin(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
      setLoading(false);
      return;
    }

    if (data.length > 1) {
      setError('PIN duplicado. Contacte al administrador.');
      setPin(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
      setLoading(false);
      return;
    }

    onLogin(data[0] as Seller);
    setLoading(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 mb-4 shadow-lg shadow-blue-600/30">
            <Wrench className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Laigo AutoParts</h1>
          <p className="text-slate-400 text-sm mt-1">Sistema Multi-Sucursal</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
          <div className="flex items-center gap-2 mb-6 justify-center">
            <Shield className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Ingrese su PIN</h2>
          </div>

          <div className="flex gap-2.5 justify-center mb-6">
            {pin.slice(0, 6).map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className="h-14 w-11 rounded-xl bg-slate-700/80 border border-slate-600 text-center text-xl font-bold text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:opacity-50 transition-all"
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm justify-center mb-4 animate-pulse">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="flex justify-center">
              <div className="h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <p className="text-slate-500 text-xs text-center mt-4">
            Ingrese su PIN de 4-6 digitos para acceder
          </p>
        </div>
      </div>
    </div>
  );
}
