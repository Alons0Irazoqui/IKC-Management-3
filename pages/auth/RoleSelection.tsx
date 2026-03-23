import React from 'react';
import { Link } from 'react-router-dom';
import './Login.css';

const RoleSelection: React.FC = () => {
  return (
    <div className="login-dark-theme min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-6 font-sans">
      {/* Background Elements */}
      <div className="enterprise-bg" />
      <div className="ambient-glow" />

      <div className="max-w-3xl w-full flex flex-col items-center gap-12 relative z-10">
        <div className="text-center space-y-4">
            <h1 className="text-6xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">IKC</h1>
            <p className="text-xs font-black text-[#EF4444] uppercase tracking-[0.4em]">Selecciona tu perfil</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
            {/* Master Option */}
            <Link to="/register/verify-pin" 
                  className="group relative overflow-hidden bg-[#0e0e11] hover:bg-[#16161a] p-10 rounded-3xl transition-all duration-500 flex flex-col gap-6 cursor-pointer border border-white/5 hover:border-[#e11d48]/30 shadow-2xl active:scale-[0.98]">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-125 transition-transform duration-700">
                    <span className="material-symbols-outlined text-[100px]">security</span>
                </div>
                <div className="size-16 bg-[#16161a] group-hover:bg-[#e11d48]/10 text-zinc-500 group-hover:text-[#e11d48] rounded-2xl flex items-center justify-center transition-all duration-300 border border-white/5 group-hover:border-[#e11d48]/30 shadow-inner">
                    <span className="material-symbols-outlined text-4xl">sports_martial_arts</span>
                </div>
                <div className="relative z-10">
                    <h3 className="text-2xl font-black text-white group-hover:text-[#e11d48] transition-colors tracking-tight">Soy Maestro</h3>
                    <p className="text-zinc-500 text-sm mt-3 leading-relaxed font-medium">
                        Acceso administrativo para gestión integral del dojo.
                    </p>
                </div>
            </Link>

            {/* Student Option */}
            <Link to="/register/student" 
                  className="group relative overflow-hidden bg-[#0e0e11] hover:bg-[#16161a] p-10 rounded-3xl transition-all duration-500 flex flex-col gap-6 cursor-pointer border border-white/5 hover:border-[#e11d48]/30 shadow-2xl active:scale-[0.98]">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-125 transition-transform duration-700">
                    <span className="material-symbols-outlined text-[100px]">person</span>
                </div>
                <div className="size-16 bg-[#16161a] group-hover:bg-[#e11d48]/10 text-zinc-500 group-hover:text-[#e11d48] rounded-2xl flex items-center justify-center transition-all duration-300 border border-white/5 group-hover:border-[#e11d48]/30 shadow-inner">
                    <span className="material-symbols-outlined text-4xl">person</span>
                </div>
                <div className="relative z-10">
                    <h3 className="text-2xl font-black text-white group-hover:text-[#e11d48] transition-colors tracking-tight">Soy Alumno</h3>
                    <p className="text-zinc-500 text-sm mt-3 leading-relaxed font-medium">
                        Acceso a mi dojo, seguimiento de clases y pagos.
                    </p>
                </div>
            </Link>
        </div>
        
        <Link to="/" className="text-zinc-500 font-bold hover:text-white transition-all flex items-center gap-2 text-sm uppercase tracking-widest mt-4 group">
            <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Volver
        </Link>
      </div>
    </div>
  );
};

export default RoleSelection;
