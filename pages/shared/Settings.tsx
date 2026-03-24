
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { RankColor, Rank, Student } from '../../types';
import ConfirmationModal from '../../components/ConfirmationModal';
import EmergencyCard from '../../components/ui/EmergencyCard';
import Avatar from '../../components/ui/Avatar';

const Settings: React.FC = () => {
    const { currentUser, students, academySettings, updateAcademySettings, updateUserProfile, changePassword, updateStudentProfile } = useStore();
    const { addToast } = useToast();

    // --- TABS & NAVIGATION ---
    const [activeTab, setActiveTab] = useState<'profile' | 'academy' | 'emergency'>('profile');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- DATA LOADING ---
    const student = students.find(s => s.id === currentUser?.studentId);

    // --- LOCAL STATE: PROFILE ---
    const [profileData, setProfileData] = useState({
        name: currentUser?.name || '',
        email: currentUser?.email || '',
        avatarUrl: currentUser?.avatarUrl || ''
    });

    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [showPassword, setShowPassword] = useState(false); // Estado para mostrar/ocultar contraseña

    // --- LOCAL STATE: ACADEMY (MASTER ONLY) ---
    const [academyData, setAcademyData] = useState(academySettings);

    useEffect(() => {
        setAcademyData(academySettings);
    }, [academySettings]);

    // --- LOCAL STATE: EMERGENCY (STUDENT) ---
    const [emergencyData, setEmergencyData] = useState<Student | null>(student ? JSON.parse(JSON.stringify(student)) : null);

    useEffect(() => {
        if (student) {
            setEmergencyData(JSON.parse(JSON.stringify(student)));
        }
    }, [student]);

    // --- LOCAL STATE: MODALS ---
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, action: () => void }>({
        isOpen: false, title: '', message: '', action: () => { }
    });

    // --- HANDLERS: PROFILE ---

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateUserProfile({ name: profileData.name, avatarUrl: profileData.avatarUrl });
    };

    const handlePasswordChange = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            addToast('Las contraseñas nuevas no coinciden', 'error');
            return;
        }
        if (passwords.new.length < 6) {
            addToast('La contraseña es muy corta', 'error');
            return;
        }
        changePassword(passwords.new);
        setPasswords({ current: '', new: '', confirm: '' });
        addToast('Contraseña actualizada con éxito', 'success');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                setProfileData(prev => ({ ...prev, avatarUrl: base64 }));
                await updateUserProfile({ avatarUrl: base64 });
            };
            reader.readAsDataURL(file);
        }
    };
    const triggerFileInput = () => fileInputRef.current?.click();

    // --- HANDLERS: EMERGENCY ---
    const handleEmergencySave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!emergencyData || !student) return;

        updateStudentProfile(student.id, {
            cellPhone: emergencyData.cellPhone,
            height: emergencyData.height,
            weight: emergencyData.weight,
            guardian: emergencyData.guardian
        });
    };

    // --- HANDLERS: ACADEMY CONFIGURATION ---

    const isValidBillingDates = academyData.paymentSettings.lateFeeDay > academyData.paymentSettings.billingDay;

    const handleAcademySave = (e: React.FormEvent) => {
        e.preventDefault();

        if (!isValidBillingDates) {
            addToast('Error: El día de recargo debe ser posterior al día de corte.', 'error');
            return;
        }

        if (academyData.ranks.length === 0) {
            addToast('Error: La academia debe tener al menos un grado.', 'error');
            return;
        }

        updateAcademySettings(academyData);
        addToast('Configuración de la academia guardada exitosamente', 'success');
    };

    const handleRankChange = (id: string, field: keyof Rank, value: any) => {
        setAcademyData(prev => ({
            ...prev,
            ranks: prev.ranks.map(r => r.id === id ? { ...r, [field]: value } : r)
        }));
    };

    const handleAddRank = () => {
        const currentRanks = academyData.ranks;
        const nextOrder = currentRanks.length > 0
            ? Math.max(...currentRanks.map(r => r.order)) + 1
            : 1;

        const newRank: Rank = {
            id: `rank-${Date.now()}`,
            name: `Nuevo Grado ${nextOrder}`,
            color: 'white',
            order: nextOrder,
            requiredAttendance: 50
        };

        setAcademyData(prev => ({
            ...prev,
            ranks: [...prev.ranks, newRank]
        }));
    };

    const handleDeleteRank = (id: string) => {
        if (academyData.ranks.length <= 1) {
            addToast('No puedes eliminar el único grado existente.', 'error');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Eliminar Grado',
            message: '¿Estás seguro? Los alumnos en este grado deberán ser reasignados manualmente. Esta acción se guardará al confirmar la configuración global.',
            action: () => {
                setAcademyData(prev => ({
                    ...prev,
                    ranks: prev.ranks.filter(r => r.id !== id)
                }));
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const copyCode = () => {
        navigator.clipboard.writeText(academySettings.code);
        addToast('Código copiado al portapapeles', 'success');
    };



    const kyuOptions = [
        '10 Kyu', '9 Kyu', '8 Kyu', '7 Kyu', '6 Kyu',
        '5 Kyu', '4 Kyu', '3 Kyu', '2 Kyu', '1 Kyu',
        'Shodan Ho', 'Cinta Negra'
    ];

    const billingDays = Array.from({ length: 28 }, (_, i) => i + 1);

    return (
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 md:p-8 lg:p-10 w-full animate-in fade-in slide-in-from-bottom-2 duration-700 pb-24 text-zinc-300">
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.action}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                type="danger"
            />

            <header className="mb-10">
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--color-brand)' }}>IKC Management</p>
                <h1 className="text-3xl font-black tracking-tighter text-white">Configuración</h1>
                <p className="text-sm text-zinc-500 mt-1">Gestiona tu perfil, preferencias y seguridad del sistema.</p>
            </header>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Sidebar Navigation */}
                <nav className="w-full lg:w-72 flex flex-col gap-1 p-1 rounded-2xl sticky top-4" style={{ backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)' }}>
                    {[
                        { id: 'profile', label: 'Perfil y Seguridad', icon: 'security' },
                        ...(currentUser?.role === 'master' ? [{ id: 'academy', label: 'Academia & Pagos', icon: 'domain' }] : []),
                        ...(student ? [{ id: 'emergency', label: 'Información del Alumno', icon: 'contact_emergency' }] : []),
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all relative overflow-hidden group ${activeTab === item.id
                                ? 'text-white'
                                : 'text-zinc-500 hover:text-white'
                                }`}
                        >
                            {activeTab === item.id && (
                                <div className="absolute inset-0 bg-white/5 animate-in fade-in duration-300"></div>
                            )}
                            <span className={`material-symbols-outlined text-[20px] relative z-10 ${activeTab === item.id ? 'filled text-red-500' : 'text-zinc-600'}`}>{item.icon}</span>
                            <span className="relative z-10">{item.label}</span>
                            {activeTab === item.id && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-red-600 rounded-full"></div>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="flex-1 w-full space-y-8">
                    {/* --- TAB: PROFILE --- */}
                    {activeTab === 'profile' && (
                        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <form onSubmit={handleProfileSave} className="rounded-3xl p-8 border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
                                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-8 border-b border-zinc-900 pb-4">Información del Perfil</h3>
                                <div className="flex items-center gap-8 mb-10">
                                    <div className="relative group cursor-pointer" onClick={triggerFileInput}>
                                        <Avatar
                                            src={profileData.avatarUrl}
                                            name={profileData.name}
                                            className="size-28 rounded-full ring-4 ring-zinc-900/50 text-3xl font-black italic shadow-2xl"
                                        />
                                        <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm border-2 border-red-500/30">
                                            <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                                        </div>
                                    </div>
                                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                                    <div className="space-y-2">
                                        <button type="button" onClick={triggerFileInput} className="px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold border border-zinc-800 hover:bg-zinc-800 transition-all active:scale-95 uppercase tracking-widest">Cambiar Foto</button>
                                        <p className="text-[10px] text-zinc-600 font-medium">PNG o JPG hasta 2MB recomendado.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nombre Completo</label>
                                        <input value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Correo Electrónico</label>
                                        <input value={profileData.email} disabled className="w-full rounded-xl border-zinc-800 bg-zinc-900/20 px-5 py-3.5 text-sm text-zinc-600 cursor-not-allowed font-semibold" />
                                    </div>
                                </div>
                                <div className="mt-10 flex justify-end">
                                    <button type="submit" className="px-8 py-3 rounded-xl bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-600/10 hover:bg-red-500 transition-all active:scale-95 uppercase tracking-widest">Guardar Cambios</button>
                                </div>
                            </form>

                            {/* Password Form with Show Toggle */}
                            <form onSubmit={handlePasswordChange} className="rounded-3xl p-8 border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
                                <div className="flex justify-between items-center mb-8 border-b border-zinc-900 pb-4">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Seguridad de la Cuenta</h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-[10px] font-bold text-zinc-500 flex items-center gap-1.5 hover:text-white transition-colors bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 uppercase tracking-widest"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                        {showPassword ? 'Ocultar' : 'Mostrar'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nueva Contraseña</label>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={passwords.new}
                                            onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                                            className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all placeholder:text-zinc-800"
                                            placeholder="Mínimo 6 caracteres"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Confirmar Contraseña</label>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={passwords.confirm}
                                            onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                                            className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all placeholder:text-zinc-800"
                                            placeholder="Repite la nueva contraseña"
                                        />
                                    </div>
                                </div>
                                <div className="mt-10 flex justify-end">
                                    <button type="submit" className="px-8 py-3 rounded-xl bg-zinc-100 text-black text-xs font-bold shadow-lg hover:bg-white transition-all active:scale-95 uppercase tracking-widest">Actualizar Contraseña</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* --- TAB: ACADEMY (MASTER ONLY) --- */}
                    {activeTab === 'academy' && currentUser?.role === 'master' && (
                        <form onSubmit={handleAcademySave} className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-500">

                            {/* 1. ACADEMY INFO & LINK CODE */}
                            <div className="rounded-3xl p-8 shadow-xl relative overflow-hidden border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
                                <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 blur-[100px] -mr-32 -mt-32"></div>
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
                                    <div className="space-y-4">
                                        <h3 className="text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3">
                                            <span className="material-symbols-outlined text-red-500 text-xl">key</span>
                                            Código de Vinculación
                                        </h3>
                                        <div className="flex items-center gap-4 bg-black/30 p-2 pr-4 rounded-2xl border border-zinc-800 backdrop-blur-sm">
                                            <span className="text-4xl font-black tracking-[0.2em] font-mono pl-4 text-white uppercase">{academySettings.code}</span>
                                            <button type="button" onClick={copyCode} className="size-11 bg-zinc-900 text-white rounded-xl flex items-center justify-center hover:bg-zinc-800 transition-all shadow-sm border border-zinc-800 active:scale-90"><span className="material-symbols-outlined text-xl">content_copy</span></button>
                                        </div>
                                        <p className="text-[10px] text-zinc-600 italic">Comparte este código con tus alumnos para que se registren en tu academia.</p>
                                    </div>

                                    <div className="w-full md:w-1/2 space-y-3">
                                        <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Nombre de la Academia</label>
                                        <input
                                            value={academyData.name}
                                            onChange={e => setAcademyData({ ...academyData, name: e.target.value })}
                                            className="w-full rounded-2xl border-zinc-800 bg-[#050505] px-6 py-4 text-white placeholder-zinc-700 focus:border-red-600/50 outline-none font-black text-xl italic tracking-tight transition-all"
                                            placeholder="Nombre de tu Dojo / Academia"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 2. PAYMENT CONFIGURATION */}
                            <div className={`rounded-3xl p-8 border transition-all duration-300 ${!isValidBillingDates ? 'border-red-500 bg-red-500/5 shadow-[0_0_50px_rgba(239,68,68,0.1)]' : 'border-zinc-800 shadow-none'}`} style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: !isValidBillingDates ? undefined : 'var(--color-border-subtle)' }}>
                                <div className="flex justify-between items-end mb-8 border-b border-zinc-900 pb-4">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 flex items-center gap-3">
                                            <span className="material-symbols-outlined text-emerald-500 text-xl">payments</span>
                                            Reglas de Cobro Automático
                                        </h3>
                                        <p className="text-[11px] text-zinc-600 mt-1 font-medium italic">Configura montos y plazos para la facturación mensual del sistema.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Amounts */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Mensualidad Estándar ($)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={academyData.paymentSettings.monthlyTuition}
                                                onChange={e => setAcademyData({ ...academyData, paymentSettings: { ...academyData.paymentSettings, monthlyTuition: parseFloat(e.target.value) } })}
                                                className="w-full rounded-xl border-zinc-800 bg-[#050505] text-sm text-white focus:border-red-600/50 outline-none font-bold tabular-nums transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Recargo por Mora ($)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={academyData.paymentSettings.lateFeeAmount}
                                                onChange={e => setAcademyData({ ...academyData, paymentSettings: { ...academyData.paymentSettings, lateFeeAmount: parseFloat(e.target.value) } })}
                                                className="w-full rounded-xl border-zinc-800 bg-[#050505] pr-5 py-3.5 text-sm text-red-500 focus:border-red-600/50 outline-none font-bold tabular-nums transition-all !pl-[70px]"
                                            />
                                        </div>
                                    </div>

                                    {/* Dates */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Día de Corte (Generación)</label>
                                        <select
                                            value={academyData.paymentSettings.billingDay}
                                            onChange={e => setAcademyData({ ...academyData, paymentSettings: { ...academyData.paymentSettings, billingDay: parseInt(e.target.value) } })}
                                            className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold"
                                        >
                                            {billingDays.map(day => <option key={`bill-${day}`} value={day} className="bg-zinc-950">Día {day} de cada mes</option>)}
                                        </select>
                                        <p className="text-[9px] text-zinc-700 font-medium ml-1">Fecha en que el sistema crea los registros de pago pendientes.</p>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Día Límite (Inicio Recargo)</label>
                                        <select
                                            value={academyData.paymentSettings.lateFeeDay}
                                            onChange={e => setAcademyData({ ...academyData, paymentSettings: { ...academyData.paymentSettings, lateFeeDay: parseInt(e.target.value) } })}
                                            className={`w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm focus:border-red-600/50 outline-none transition-all font-semibold ${!isValidBillingDates ? 'text-red-500' : 'text-white'}`}
                                        >
                                            {billingDays.map(day => <option key={`late-${day}`} value={day} className="bg-zinc-950">Día {day} de cada mes</option>)}
                                        </select>
                                        <p className="text-[9px] text-zinc-700 font-medium ml-1">Día en que el estado cambia a VENCIDO y se suma la mora.</p>
                                    </div>
                                </div>

                                {!isValidBillingDates && (
                                    <div className="mt-8 p-4 bg-red-600/10 border border-red-600/30 rounded-2xl flex items-center gap-3 text-red-500 animate-pulse">
                                        <span className="material-symbols-outlined text-xl">error</span>
                                        <span className="text-xs font-black uppercase tracking-wider">Error Crítico: El día de recargo debe ser posterior al día de corte.</span>
                                    </div>
                                )}
                            </div>

                            {/* 3. BANK DETAILS */}
                            <div className="rounded-3xl p-8 border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
                                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-8 flex items-center gap-3 border-b border-zinc-900 pb-4">
                                    <span className="material-symbols-outlined text-blue-500 text-xl">account_balance</span>
                                    Datos Bancarios para Transferencias
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Institución Bancaria</label>
                                        <input
                                            value={academyData.bankDetails?.bankName || ''}
                                            onChange={e => setAcademyData({ ...academyData, bankDetails: { ...academyData.bankDetails!, bankName: e.target.value } })}
                                            className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold"
                                            placeholder="Ej. BBVA, Santander, etc."
                                        />
                                        <p className="text-[9px] text-zinc-700 ml-1">Nombre oficial del banco.</p>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Titular de la Cuenta</label>
                                        <input
                                            value={academyData.bankDetails?.accountHolder || ''}
                                            onChange={e => setAcademyData({ ...academyData, bankDetails: { ...academyData.bankDetails!, accountHolder: e.target.value } })}
                                            className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold"
                                            placeholder="Nombre completo"
                                        />
                                        <p className="text-[9px] text-zinc-700 ml-1">Persona o empresa que recibe el pago.</p>
                                    </div>
                                    <div className="space-y-3 md:col-span-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">CLABE Interbancaria / Cuenta</label>
                                        <input
                                            value={academyData.bankDetails?.clabe || ''}
                                            onChange={e => setAcademyData({ ...academyData, bankDetails: { ...academyData.bankDetails!, clabe: e.target.value } })}
                                            className="w-full rounded-xl border-zinc-800 bg-[#050505] px-6 py-4 text-lg text-white focus:border-red-600/50 outline-none transition-all font-mono font-bold tracking-[0.1em]"
                                            placeholder="18 dígitos para CLABE"
                                        />
                                    </div>
                                    <div className="space-y-3 md:col-span-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Mensaje para el Alumno (Instrucciones)</label>
                                        <textarea
                                            value={academyData.bankDetails?.instructions || ''}
                                            onChange={e => setAcademyData({ ...academyData, bankDetails: { ...academyData.bankDetails!, instructions: e.target.value } })}
                                            className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-medium min-h-[100px]"
                                            placeholder="Ej. Enviar comprobante por WhatsApp al 55..."
                                        />
                                        <p className="text-[9px] text-zinc-700 ml-1 italic">Este texto aparecerá en los recibos y el panel de pagos del alumno.</p>
                                    </div>
                                </div>
                            </div>

                            {/* 4. RANK MANAGEMENT */}
                            <div className="rounded-3xl p-8 border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
                                <div className="flex justify-between items-end mb-8 border-b border-zinc-900 pb-4">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 flex items-center gap-3">
                                            <span className="material-symbols-outlined text-purple-500 text-xl">workspace_premium</span>
                                            Grados y Jerarquía Académica
                                        </h3>
                                        <p className="text-[11px] text-zinc-600 mt-1 font-medium italic">Define los niveles de tu academia y los requisitos para examen.</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 gap-6 pb-3 border-b border-zinc-900/50 text-[10px] font-black text-zinc-700 uppercase tracking-widest px-4">
                                        <div className="col-span-1 text-center">Nivel</div>
                                        <div className="col-span-4">Nombre del Cinturón</div>
                                        <div className="col-span-3">Kyu</div>
                                        <div className="col-span-3 text-center">Clases el Periodo</div>
                                        <div className="col-span-1"></div>
                                    </div>

                                    {/* Rank Rows */}
                                    <div className="space-y-3">
                                        {academyData.ranks
                                            .sort((a, b) => a.order - b.order)
                                            .map((rank, idx) => (
                                                <div key={rank.id} className="grid grid-cols-12 gap-6 items-center group animate-in fade-in slide-in-from-left-2 duration-300 p-2 rounded-2xl hover:bg-white/5 transition-all">
                                                    <div className="col-span-1 flex justify-center">
                                                        <div className="size-8 rounded-full bg-zinc-950 font-black text-red-600 flex items-center justify-center text-xs border border-zinc-800 tabular-nums italic">
                                                            {idx + 1}
                                                        </div>
                                                    </div>

                                                    <div className="col-span-4">
                                                        <input
                                                            value={rank.name}
                                                            onChange={(e) => handleRankChange(rank.id, 'name', e.target.value)}
                                                            className="w-full rounded-xl border-zinc-800 bg-[#050505] px-4 py-3 text-sm text-white focus:border-red-600/50 outline-none transition-all font-bold tracking-tight"
                                                            placeholder="Ej. Cinta Blanca"
                                                        />
                                                    </div>

                                                    <div className="col-span-3">
                                                        <select
                                                            value={rank.color}
                                                            onChange={(e) => handleRankChange(rank.id, 'color', e.target.value as any)}
                                                            className="w-full rounded-xl border-zinc-800 bg-[#050505] px-3 py-3 text-xs text-white focus:border-red-600/50 outline-none transition-all appearance-none font-bold uppercase tracking-wider"
                                                        >
                                                            {kyuOptions.map(kyu => (
                                                                <option key={kyu} value={kyu} className="bg-zinc-950">{kyu}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="col-span-3 relative group/input">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={rank.requiredAttendance}
                                                            onChange={(e) => handleRankChange(rank.id, 'requiredAttendance', parseInt(e.target.value))}
                                                            className="w-full rounded-xl border-zinc-800 bg-[#050505] px-4 py-3 text-sm text-center font-black text-red-500 focus:border-red-600/50 outline-none transition-all tabular-nums"
                                                        />
                                                    </div>

                                                    <div className="col-span-1 flex justify-end pr-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteRank(rank.id)}
                                                            className="size-10 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-zinc-700 hover:text-red-500 transition-all active:scale-90"
                                                            title="Eliminar grado"
                                                        >
                                                            <span className="material-symbols-outlined text-xl">delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddRank}
                                    className="mt-6 w-full py-5 border border-dashed border-zinc-800 rounded-2xl flex items-center justify-center gap-3 text-zinc-500 hover:text-white hover:border-zinc-500 hover:bg-white/5 transition-all group active:scale-[0.99]"
                                >
                                    <span className="material-symbols-outlined group-hover:scale-125 transition-transform text-xl">add_circle</span>
                                    <span className="font-black text-[10px] uppercase tracking-[0.2em]">Agregar Nuevo Grado</span>
                                </button>
                            </div>

                            {/* GLOBAL SAVE BUTTON */}
                            <div className="sticky bottom-6 flex justify-end pt-8 pb-4 -mx-6 px-6 md:-mx-10 md:px-10 z-20">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none -bottom-10"></div>
                                <button
                                    type="submit"
                                    disabled={!isValidBillingDates}
                                    className={`px-10 py-5 rounded-2xl text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl transform transition-all active:scale-95 flex items-center gap-3 relative z-10 ${!isValidBillingDates ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700 shadow-none' : 'bg-red-600 hover:bg-red-500 shadow-red-600/20'}`}
                                >
                                    <span className="material-symbols-outlined filled text-xl">save</span>
                                    <span>Guardar Configuración General</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* --- TAB: EMERGENCY (STUDENT) --- */}
                    {activeTab === 'emergency' && student && emergencyData && (
                        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Read-Only View of Current Data */}
                            <EmergencyCard student={emergencyData} />
                            <form onSubmit={handleEmergencySave} className="rounded-3xl p-8 border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
                                <div className="flex justify-between items-start mb-10 border-b border-zinc-900 pb-4">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Editar Perfil del Alumno</h3>
                                        <p className="text-[11px] text-zinc-600 mt-1 font-medium italic">Actualiza tus datos físicos y de contacto de emergencia.</p>
                                    </div>
                                </div>

                                <div className="space-y-10">
                                    {/* DATOS FÍSICOS */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Celular Personal</label>
                                            <input value={emergencyData.cellPhone} onChange={e => setEmergencyData({ ...emergencyData, cellPhone: e.target.value })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Estatura (cm)</label>
                                            <input type="number" value={emergencyData.height || ''} onChange={e => setEmergencyData({ ...emergencyData, height: parseInt(e.target.value) })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold tabular-nums" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Peso (kg)</label>
                                            <input type="number" step="0.1" value={emergencyData.weight || ''} onChange={e => setEmergencyData({ ...emergencyData, weight: parseFloat(e.target.value) })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold tabular-nums" />
                                        </div>
                                    </div>

                                    {/* DATOS DEL TUTOR */}
                                    <div className="pt-10 border-t border-zinc-900">
                                        <h4 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-8">Información del Tutor / Tutor Legal</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nombre Completo del Tutor</label>
                                                <input value={emergencyData.guardian.fullName} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, fullName: e.target.value } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Correo del Tutor</label>
                                                <input value={emergencyData.guardian.email} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, email: e.target.value } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Parentesco</label>
                                                <select value={emergencyData.guardian.relationship} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, relationship: e.target.value as any } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold">
                                                    {['Padre', 'Madre', 'Tutor Legal', 'Familiar', 'Otro'].map(r => <option key={r} value={r} className="bg-zinc-950">{r}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Tel. Principal</label>
                                                <input value={emergencyData.guardian.phones.main} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, phones: { ...emergencyData.guardian.phones, main: e.target.value } } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Tel. Alternativo</label>
                                                <input value={emergencyData.guardian.phones.secondary || ''} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, phones: { ...emergencyData.guardian.phones, secondary: e.target.value } } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Tel. Emergencia 3</label>
                                                <input value={emergencyData.guardian.phones.tertiary || ''} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, phones: { ...emergencyData.guardian.phones, tertiary: e.target.value } } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* DIRECCIÓN */}
                                    <div className="pt-10 border-t border-zinc-900">
                                        <h4 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-8">Dirección de Residencia</h4>
                                        <div className="grid grid-cols-12 gap-5">
                                            <div className="col-span-12 md:col-span-9 space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Calle</label>
                                                <input placeholder="Av. Principal, Calle Falsa..." value={emergencyData.guardian.address.street} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, address: { ...emergencyData.guardian.address, street: e.target.value } } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                            </div>
                                            <div className="col-span-12 md:col-span-3 space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">No. Ext</label>
                                                <input placeholder="123" value={emergencyData.guardian.address.exteriorNumber} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, address: { ...emergencyData.guardian.address, exteriorNumber: e.target.value } } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                            </div>
                                            <div className="col-span-6 md:col-span-3 space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Int.</label>
                                                <input placeholder="A-1" value={emergencyData.guardian.address.interiorNumber || ''} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, address: { ...emergencyData.guardian.address, interiorNumber: e.target.value } } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                            </div>
                                            <div className="col-span-6 md:col-span-6 space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Colonia</label>
                                                <input placeholder="Centro..." value={emergencyData.guardian.address.colony} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, address: { ...emergencyData.guardian.address, colony: e.target.value } } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold" />
                                            </div>
                                            <div className="col-span-12 md:col-span-3 space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Código Postal</label>
                                                <input placeholder="00000" value={emergencyData.guardian.address.zipCode} onChange={e => setEmergencyData({ ...emergencyData, guardian: { ...emergencyData.guardian, address: { ...emergencyData.guardian.address, zipCode: e.target.value } } })} className="w-full rounded-xl border-zinc-800 bg-[#050505] px-5 py-3.5 text-sm text-white focus:border-red-600/50 outline-none transition-all font-semibold tabular-nums" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12 flex justify-end">
                                    <button type="submit" className="px-10 py-4 rounded-xl bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-600/10 hover:bg-red-500 transition-all active:scale-95 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined filled text-xl">person_edit</span>
                                        Actualizar Mis Datos
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
