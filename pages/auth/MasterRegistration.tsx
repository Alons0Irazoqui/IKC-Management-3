import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { masterRegistrationSchema, MasterRegistrationForm } from '../../schemas/authSchemas';
import { PulseService } from '../../services/pulseService';
import './Login.css';

const MasterRegistration: React.FC = () => {
  const { registerMaster } = useStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError
  } = useForm<MasterRegistrationForm>({
    resolver: zodResolver(masterRegistrationSchema),
    defaultValues: { termsAccepted: false as unknown as true }
  });

  const onSubmit = async (data: MasterRegistrationForm) => {
    try {
      if (await PulseService.checkEmailExists(data.email)) {
        setError("email", { type: "manual", message: "Correo ya registrado." });
        return;
      }
    } catch (err) {
      console.warn("Email check failed (likely RLS), proceeding...", err);
    }
    const success = await registerMaster({
      name: data.name,
      email: data.email,
      academyName: data.academyName,
      password: data.password
    });
    if (success) {
      navigate('/check-email');
    } else {
      setError("root", { message: "Error al registrar. Intenta nuevamente." });
    }
  };

  return (
    <div className="login-dark-theme min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-6 font-sans">
      <div className="enterprise-bg" />
      <div className="ambient-glow" />

      <div className="w-full max-w-[480px] relative z-10">
        <div className="mb-12 text-center space-y-3">
          <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            REGISTRO IKC
          </h1>
          <p className="text-[#EF4444] text-xs font-black uppercase tracking-[0.4em]">
            Alta de nueva academia
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-[#0e0e11] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nombre Maestro</label>
            <input
              {...register('name')}
              className="w-full h-11 py-0 rounded-2xl bg-[#16161a] px-5 text-sm font-medium text-white border border-white/5 focus:border-[#e11d48] focus:ring-0 outline-none transition-all placeholder:text-zinc-600"
              placeholder="p. ej. Sensei Alejandro"
              type="text"
            />
            {errors.name && <p className="text-[11px] text-[#EF4444] font-bold ml-1">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Email Corporativo</label>
            <input
              {...register('email')}
              className="w-full h-11 py-0 rounded-2xl bg-[#16161a] px-5 text-sm font-medium text-white border border-white/5 focus:border-[#e11d48] focus:ring-0 outline-none transition-all placeholder:text-zinc-600"
              placeholder="ejemplo@ikc.com"
              type="email"
            />
            {errors.email && <p className="text-[11px] text-[#EF4444] font-bold ml-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nombre Academia</label>
            <input
              {...register('academyName')}
              className="w-full h-11 py-0 rounded-2xl bg-[#16161a] px-5 text-sm font-medium text-white border border-white/5 focus:border-[#e11d48] focus:ring-0 outline-none transition-all placeholder:text-zinc-600"
              placeholder="IKC Central"
              type="text"
            />
            {errors.academyName && <p className="text-[11px] text-[#EF4444] font-bold ml-1">{errors.academyName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Contraseña</label>
              <input
                {...register('password')}
                className="w-full h-11 py-0 rounded-2xl bg-[#16161a] px-5 text-sm font-medium text-white border border-white/5 focus:border-[#e11d48] focus:ring-0 outline-none transition-all placeholder:text-zinc-600"
                placeholder="••••••••"
                type="password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Confirmar</label>
              <input
                {...register('confirmPassword')}
                className="w-full h-11 py-0 rounded-2xl bg-[#16161a] px-5 text-sm font-medium text-white border border-white/5 focus:border-[#e11d48] focus:ring-0 outline-none transition-all placeholder:text-zinc-600"
                placeholder="••••••••"
                type="password"
              />
            </div>
          </div>
          {(errors.password || errors.confirmPassword) && <p className="text-[11px] text-[#EF4444] font-bold ml-1">Las contraseñas no coinciden.</p>}

          <div className="flex items-start gap-3 px-1 pt-2">
            <input
              type="checkbox"
              {...register('termsAccepted')}
              className="mt-1 h-4 w-4 rounded border-white/10 bg-white/5 text-[#e11d48] focus:ring-[#e11d48] cursor-pointer"
            />
            <label className="text-[11px] text-zinc-500 font-medium leading-relaxed cursor-pointer select-none">
              Acepto los <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#e11d48] underline transition-colors">términos y condiciones</Link> de IKC Management.
            </label>
          </div>
          {errors.termsAccepted && <p className="text-[11px] text-[#EF4444] font-bold ml-1">{errors.termsAccepted.message}</p>}

          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full rounded-2xl bg-white text-black font-black py-4 px-4 hover:bg-[#e11d48] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl active:scale-[0.98] mt-4"
          >
            {isSubmitting ? 'PROCESANDO...' : 'CREAR ACADEMIA'}
          </button>
        </form>

        <div className="mt-10 text-center">
          <Link className="text-sm font-bold text-zinc-500 hover:text-white transition-all flex items-center justify-center gap-2 uppercase tracking-widest" to="/login">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MasterRegistration;