import React, { useState, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, SubmitHandler, UseFormRegister, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { studentRegistrationSchema, StudentRegistrationForm } from '../../schemas/authSchemas';
import { useToast } from '../../context/ToastContext';
import { PulseService } from '../../services/pulseService';
import './Login.css';

// --- SUB-COMPONENTS ---

interface InputFieldProps {
  label: string;
  name: keyof StudentRegistrationForm;
  register: UseFormRegister<StudentRegistrationForm>;
  errors: FieldErrors<StudentRegistrationForm>;
  type?: string;
  placeholder?: string;
  cols?: 1 | 2;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  name,
  register,
  errors,
  type = 'text',
  placeholder,
  cols = 1
}) => (
  <div className={cols === 2 ? 'col-span-1' : 'col-span-1 md:col-span-2'}>
    <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest">{label}</label>
    <div className="relative group">
      <input
        {...register(name)}
        type={type}
        placeholder={placeholder}
        className="block w-full rounded-xl px-4 py-2 text-sm outline-none transition-all placeholder:text-zinc-600"
        style={{ backgroundColor: '#16161a', border: `1px solid ${errors[name] ? 'rgba(225,29,72,0.6)' : 'rgba(255,255,255,0.08)'}`, color: '#ffffff' }}
      />
    </div>
    {errors[name] && (
      <p className="mt-1.5 ml-1 text-[11px] font-bold text-[#e11d48]">
        {errors[name]?.message}
      </p>
    )}
  </div>
);

const STEPS = [
  { id: 1, title: 'Cuenta' },
  { id: 2, title: 'Alumno' },
  { id: 3, title: 'Tutor' },
];

const StudentRegistration: React.FC = () => {
  const { registerStudent } = useStore();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    trigger,
    setError,
    setValue,
    formState: { errors },
    watch
  } = useForm<StudentRegistrationForm>({
    // @ts-ignore - TS mismatch between zod coerce and useForm infer
    resolver: zodResolver(studentRegistrationSchema),
    mode: 'onChange',
    defaultValues: {
      guardianRelationship: 'Padre',
      avatarUrl: ''
    }
  });

  const nextStep = async () => {
    let fieldsToValidate: (keyof StudentRegistrationForm)[] = [];
    if (currentStep === 1) fieldsToValidate = ['academyCode', 'email', 'password', 'confirmPassword'];
    else if (currentStep === 2) fieldsToValidate = ['name', 'age', 'birthDate', 'cellPhone', 'weight', 'height', 'bloodType'];

    const isStepValid = await trigger(fieldsToValidate);

    if (currentStep === 1 && isStepValid) {
      const email = watch('email');
      if (await PulseService.checkEmailExists(email)) {
        setError('email', { type: 'manual', message: 'Este correo ya está registrado.' });
        return;
      }
    }

    if (isStepValid) setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => setCurrentStep((prev) => prev - 1);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAvatarPreview(base64);
        setValue('avatarUrl', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit: SubmitHandler<StudentRegistrationForm> = async (data) => {
    setIsSubmitting(true);
    try {
      const result: any = await registerStudent(data);
      if (result) {
        navigate('/check-email');
      } else {
        addToast('Error al registrar.', 'error');
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Error inesperado', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-dark-theme min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-6 font-sans">
      <div className="enterprise-bg" />
      <div className="ambient-glow" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="mb-12 text-center space-y-4">
          <h1 className="text-4xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">ALTA DE ALUMNO</h1>
          <div className="flex justify-center gap-2 mt-4 max-w-[200px] mx-auto">
            {STEPS.map((step) => (
              <div key={step.id} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step.id <= currentStep ? 'bg-[#e11d48] shadow-[0_0_10px_rgba(225,29,72,0.5)]' : 'bg-white/10'}`}></div>
            ))}
          </div>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-2">
            {STEPS[currentStep - 1] ? `Paso ${currentStep} de ${STEPS.length}: ${STEPS[currentStep - 1].title}` : `Paso ${currentStep}`}
          </p>
        </div>

        {/* Form */}
        <div className="bg-[#0e0e11] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit as any)} className="animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* STEP 1 */}
            {currentStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputField register={register} errors={errors} label="Código de Academia" name="academyCode" placeholder="Ej. ACAD-1234" cols={2} />
                <InputField register={register} errors={errors} label="Email (Login)" name="email" type="email" placeholder="usuario@email.com" />
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <InputField register={register} errors={errors} label="Contraseña" name="password" type="password" placeholder="Mínimo 6 caracteres" cols={2} />
                  <InputField register={register} errors={errors} label="Confirmar" name="confirmPassword" type="password" placeholder="Repite la contraseña" cols={2} />
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {currentStep === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2 flex justify-center mb-6">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="size-28 bg-[#16161a] rounded-3xl flex items-center justify-center text-zinc-600 cursor-pointer hover:bg-[#1c1c21] hover:text-[#e11d48] transition-all overflow-hidden border border-white/5 shadow-inner group"
                  >
                    {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-4xl group-hover:scale-110 transition-transform">add_a_photo</span>}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                </div>
                <InputField register={register} errors={errors} label="Nombre Completo" name="name" placeholder="Nombre y Apellidos" />
                <InputField register={register} errors={errors} label="Celular" name="cellPhone" type="tel" placeholder="10 dígitos" />

                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-6">
                  <InputField register={register} errors={errors} label="Edad" name="age" type="number" placeholder="0" cols={2} />
                  <InputField register={register} errors={errors} label="Peso (kg)" name="weight" type="number" placeholder="0" cols={2} />
                  <InputField register={register} errors={errors} label="Estatura" name="height" type="number" placeholder="0" cols={2} />

                  <div className="col-span-1">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest">T. Sangre</label>
                    <select
                      {...register('bloodType')}
                      className="block w-full rounded-xl px-4 py-3 text-sm leading-normal focus:ring-1 outline-none transition-all appearance-none"
                      style={{ backgroundColor: '#16161a', borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'solid', borderWidth: '1px', color: '#ffffff' }}
                    >
                      <option value="">--</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <InputField register={register} errors={errors} label="Fecha Nacimiento" name="birthDate" type="date" />
              </div>
            )}

            {/* STEP 3 */}
            {currentStep === 3 && (
              <div className="space-y-10">
                <div>
                  <h3 className="text-[10px] font-black text-[#e11d48] uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">supervisor_account</span>
                    Datos del Tutor
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InputField register={register} errors={errors} label="Nombre Tutor" name="guardianName" placeholder="Nombre completo" />
                    <div className="col-span-1">
                      <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 ml-1 tracking-widest">Parentesco</label>
                      <select
                        {...register('guardianRelationship')}
                        className="block w-full rounded-xl px-4 py-3 text-sm leading-normal focus:ring-1 outline-none transition-all appearance-none"
                        style={{ backgroundColor: '#16161a', borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'solid', borderWidth: '1px', color: '#ffffff' }}
                      >
                        {['Padre', 'Madre', 'Tutor Legal', 'Familiar', 'Otro'].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <InputField register={register} errors={errors} label="Email Tutor" name="guardianEmail" type="email" />
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-[#e11d48] uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">call</span>
                    Contacto Emergencia
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <InputField register={register} errors={errors} label="Tel. Principal" name="guardianMainPhone" type="tel" cols={2} />
                    <InputField register={register} errors={errors} label="Tel. 2 (Opcional)" name="guardianSecondaryPhone" type="tel" cols={2} />
                    <InputField register={register} errors={errors} label="Tel. 3 (Opcional)" name="guardianTertiaryPhone" type="tel" cols={2} />
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-[#e11d48] uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">location_on</span>
                    Ubicación
                  </h3>
                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-4"><InputField register={register} errors={errors} label="Calle" name="street" cols={2} /></div>
                    <div className="col-span-2"><InputField register={register} errors={errors} label="No. Ext" name="exteriorNumber" cols={2} /></div>
                    <div className="col-span-2"><InputField register={register} errors={errors} label="Int" name="interiorNumber" cols={2} /></div>
                    <div className="col-span-2"><InputField register={register} errors={errors} label="Colonia" name="colony" cols={2} /></div>
                    <div className="col-span-2"><InputField register={register} errors={errors} label="CP" name="zipCode" cols={2} /></div>
                  </div>
                </div>
              </div>
            )}

            {/* Terms Link (Step 3 only) */}
            {currentStep === 3 && (
              <div className="mt-10 mb-2 text-center text-[11px] text-zinc-500 font-medium">
                Al completar el registro, aceptas los <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#e11d48] underline transition-colors">términos y condiciones</Link> de IKC Management.
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-5 mt-10">
              {currentStep > 1 ? (
                <button type="button" onClick={prevStep} className="px-8 py-4 rounded-2xl bg-zinc-800 text-white font-black hover:bg-zinc-700 transition-all text-xs uppercase tracking-widest active:scale-95 border border-white/5 shadow-xl">Atrás</button>
              ) : (
                <Link to="/login" className="px-8 py-4 rounded-2xl bg-zinc-800 text-zinc-400 font-black hover:bg-zinc-700 hover:text-white transition-all text-xs uppercase tracking-widest active:scale-95 border border-white/5 shadow-xl">Cancelar</Link>
              )}

              <button
                type="button"
                onClick={currentStep === 3 ? handleSubmit(onSubmit as any) : nextStep}
                disabled={isSubmitting}
                className="flex-1 bg-white hover:bg-[#e11d48] text-black hover:text-white font-black py-4 rounded-2xl transition-all disabled:opacity-50 text-xs uppercase tracking-widest active:scale-95 shadow-xl shadow-black/40"
              >
                {isSubmitting ? 'PROCESANDO...' : (currentStep === 3 ? 'Finalizar Registro' : 'Siguiente')}
              </button>
            </div>
          </form>
        </div>
        
        <div className="mt-8 text-center">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">¿Ya tienes cuenta? <Link to="/login" className="text-white hover:text-[#e11d48] font-black transition-colors ml-1">Inicia sesión</Link></p>
        </div>
      </div>
    </div>
  );
};

export default StudentRegistration;