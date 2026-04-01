import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const MasterPinEntry: React.FC = () => {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const correctPin = "24332433";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      navigate('/register/master');
    } else {
      setError('Código no autorizado.');
      setPin('');
    }
  };

  return (
    <div className="login-dark-theme min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-6 font-sans">
      <div className="enterprise-bg" />
      <div className="ambient-glow" />

      <div className="w-full max-w-sm relative z-10">
        
        <div className="flex flex-col items-center mb-10 text-center animate-in fade-in duration-700">
            <span className="material-symbols-outlined text-5xl text-white mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">lock</span>
            <h1 className="text-4xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">ACCESO RESTRINGIDO</h1>
            <p className="text-[#EF4444] mt-3 text-[10px] font-black uppercase tracking-[0.4em]">
                Solo personal autorizado de IKC.
            </p>
        </div>

        <div className="bg-[#0e0e11] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8 animate-in zoom-in-95 duration-500">
            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-center block">Ingresa tu código de acceso</label>
                    <input 
                        type="password" 
                        autoFocus
                        required 
                        className="w-full h-16 rounded-2xl bg-[#16161a] border border-white/5 px-4 text-center text-4xl font-black tracking-[0.5em] text-white focus:border-[#e11d48] focus:ring-0 transition-all outline-none shadow-inner" 
                        placeholder="••••••••"
                        value={pin}
                        onChange={(e) => {
                            setPin(e.target.value);
                            setError('');
                        }}
                        maxLength={8}
                    />
                </div>

                {error && (
                    <div className="text-[#EF4444] text-[11px] font-bold text-center animate-in shake-in duration-300">
                        {error}
                    </div>
                )}

                <button 
                    type="submit" 
                    className="w-full bg-white hover:bg-[#e11d48] text-black hover:text-white font-black py-4 rounded-2xl transition-all shadow-xl active:scale-95 text-xs uppercase tracking-widest"
                >
                    Verificar
                </button>
            </form>

            <div className="text-center">
                <Link to="/role-selection" className="text-zinc-500 font-black hover:text-white text-[10px] uppercase tracking-[0.3em] transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg">close</span>
                    CANCELAR
                </Link>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MasterPinEntry;
