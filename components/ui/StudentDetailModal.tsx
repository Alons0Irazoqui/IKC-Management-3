import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Student, TuitionRecord, RankColor } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useToast } from '../../context/ToastContext';
import { formatDateDisplay } from '../../utils/dateUtils';
import Avatar from './Avatar';
import UpdateCredentialsModal from './UpdateCredentialsModal';

interface StudentDetailModalProps {
    isOpen: boolean;
    student: Student | null;
    onClose: () => void;
    onEdit: (student: Student) => void;
    financialRecords: TuitionRecord[];
}

const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
    isOpen, student, onClose, onEdit, financialRecords
}) => {
    const { deleteStudent, purgeStudentDebts, academySettings, updateStudent } = useStore();
    const { confirm } = useConfirmation();
    const { addToast } = useToast();

    const [activeTab, setActiveTab] = useState<'info' | 'payments'>('info');
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditingCredentials, setIsEditingCredentials] = useState(false);
    const [formData, setFormData] = useState<Student | null>(null);
    // Search state — only for the finances tab
    const [paymentSearch, setPaymentSearch] = useState('');

    useEffect(() => {
        if (student && isEditing) setFormData(JSON.parse(JSON.stringify(student)));
    }, [student, isEditing]);

    const { progressPercent, requiredAttendance } = useMemo(() => {
        if (!student) return { progressPercent: 0, requiredAttendance: 0 };
        const cfg = academySettings.ranks.find(r => r.id === student.rankId);
        const required = cfg?.requiredAttendance || 0;
        const percent = required > 0 ? Math.min(Math.round((student.attendance / required) * 100), 100) : 100;
        return { progressPercent: percent, requiredAttendance: required };
    }, [student, academySettings]);

    // Filtered financial records
    const filteredRecords = useMemo(() => {
        const q = paymentSearch.trim().toLowerCase();
        if (!q) return financialRecords;
        return financialRecords.filter(r =>
            r.concept?.toLowerCase().includes(q)
        );
    }, [financialRecords, paymentSearch]);

    if (!student) return null;

    const handleDelete = () => {
        confirm({
            title: 'Eliminar Expediente',
            message: `¿Deseas eliminar permanentemente a ${student.name}? Esta acción borrará registros de asistencia y deudas.`,
            type: 'danger', confirmText: 'Confirmar Eliminación',
            onConfirm: async () => {
                setIsDeleting(true);
                try { await deleteStudent(student.id); purgeStudentDebts(student.id); onClose(); }
                catch (e) { addToast('Ocurrió un error al eliminar.', 'error'); }
                finally { setIsDeleting(false); }
            }
        });
    };

    const handlePromote = () => {
        const ranks = academySettings.ranks || [];
        const currentIndex = ranks.findIndex(r => r.id === student.rankId || r.name === student.rank);
        
        if (currentIndex === -1 || currentIndex === ranks.length - 1) {
            addToast('El estudiante ya se encuentra en el grado más alto.', 'error');
            return;
        }

        const nextRank = ranks[currentIndex + 1];

        confirm({
            title: 'Promover Alumno',
            message: `¿Deseas promover a ${student.name} de ${student.rank} a ${nextRank.name}?`,
            type: 'info',
            confirmText: 'Promover',
            onConfirm: () => {
                updateStudent({
                    ...student,
                    rank: nextRank.name,
                    rankId: nextRank.id,
                    rankColor: nextRank.color,
                    attendance: 0 // Reset class count for the new rank (keeps history intact)
                });
                addToast(`${student.name} ha sido promovido a ${nextRank.name} exitosamente`, 'success');
            }
        });
    };

    const handleSaveChanges = () => {
        if (!formData) return;
        if (!formData.name || !formData.email) { addToast('Nombre y Email son obligatorios', 'error'); return; }
        updateStudent(formData);
        addToast('Datos actualizados correctamente', 'success');
        setIsEditing(false);
    };

    const updateNestedField = (path: string, value: any) => {
        setFormData(prev => {
            if (!prev) return null;
            const next = { ...prev };
            const keys = path.split('.');
            let cur: any = next;
            for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
            cur[keys[keys.length - 1]] = value;
            return next;
        });
    };

    const statusMap: Record<string, { label: string; dot: string; badgeBg: string; badgeText: string }> = {
        active:     { label: 'Activo',         dot: 'bg-emerald-400', badgeBg: 'bg-emerald-500/15 border-emerald-500/30', badgeText: 'text-emerald-400' },
        debtor:     { label: 'Adeudo',          dot: 'bg-red-400',     badgeBg: 'bg-red-500/15 border-red-500/30',         badgeText: 'text-red-400' },
        exam_ready: { label: 'Listo p/ Examen', dot: 'bg-sky-400',     badgeBg: 'bg-sky-500/15 border-sky-500/30',         badgeText: 'text-sky-400' },
        inactive:   { label: 'Inactivo',        dot: 'bg-zinc-500',    badgeBg: 'bg-zinc-800 border-zinc-700',             badgeText: 'text-zinc-500' },
    };
    const sMap = statusMap[student.status] || statusMap.inactive;

    const kyuImageMap: Record<string, string> = {
        'Blanca':       '/Grados/10%20kyu.png',
        'Blanca Av.':   '/Grados/9%20kyu.png',
        'Amarilla':     '/Grados/8%20kyu.png',
        'Amarilla Av.': '/Grados/7%20kyu.png',
        'Verde':        '/Grados/6%20kyu.png',
        'Verde Av.':    '/Grados/5%20kyu.png',
        'Azul':         '/Grados/4%20kyu.png',
        'Azul Av.':     '/Grados/3%20kyu.png',
        'Cafe':         '/Grados/2%20kyu.png',
        'Cafe Av.':     '/Grados/1%20kyu.png',
        'Shodan Ho':    '/Grados/1%20kyu.png',
        'Negra':        '/Grados/negra.png',
    };
    const beltImg = kyuImageMap[student.rank] || null;

    return (
        <>
            {isOpen && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[100] overflow-y-auto"
                        style={{ background: '#07070a', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
                    >
                        {isEditing && formData ? (
                            /* ═══════════════ EDIT MODE ═══════════════ */
                            <div className="min-h-screen flex flex-col">
                                <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090d]/95 backdrop-blur-md px-6 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setIsEditing(false)}
                                            className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm font-medium">
                                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                            Cancelar
                                        </button>
                                        <span className="text-zinc-800">/</span>
                                        <span className="text-white text-sm font-semibold">{student.name}</span>
                                    </div>
                                    <button onClick={handleSaveChanges}
                                        className="px-5 py-3 md:py-2 rounded-lg text-base md:text-sm font-semibold text-black bg-white hover:bg-zinc-200 transition-all shadow-lg min-h-[48px] md:min-h-[40px]">
                                        Guardar Cambios
                                    </button>
                                </header>

                                <main className="max-w-3xl mx-auto w-full px-6 py-10 space-y-12 pb-20">
                                    <EditSection label="Datos del Alumno">
                                        <div className="grid grid-cols-12 gap-5">
                                            <div className="col-span-12 md:col-span-7"><EInput label="Nombre Completo" value={formData.name} onChange={v => updateNestedField('name', v)} /></div>
                                            <div className="col-span-12 md:col-span-5"><EInput label="Email" value={formData.email} onChange={v => updateNestedField('email', v)} type="email" /></div>
                                            <div className="col-span-6 md:col-span-4"><EInput label="Celular" value={formData.cellPhone} onChange={v => updateNestedField('cellPhone', v)} type="tel" /></div>
                                            <div className="col-span-6 md:col-span-4"><EInput label="Nacimiento" value={formData.birthDate} onChange={v => updateNestedField('birthDate', v)} type="date" /></div>
                                            <div className="col-span-3 md:col-span-2"><EInput label="Peso kg" value={formData.weight?.toString() || ''} onChange={v => updateNestedField('weight', parseFloat(v))} type="number" /></div>
                                            <div className="col-span-3 md:col-span-2"><EInput label="Alt. cm" value={formData.height?.toString() || ''} onChange={v => updateNestedField('height', parseInt(v))} type="number" /></div>
                                            <div className="col-span-6 md:col-span-4"><ESelect label="Tipo de Sangre" value={(formData as any).bloodType || ''} onChange={v => updateNestedField('bloodType', v)} options={['A+','A-','B+','B-','AB+','AB-','O+','O-']} /></div>
                                            <div className="col-span-6 md:col-span-4">
                                                <ESelect label="Rango" value={formData.rank}
                                                    onChange={v => { const r = academySettings.ranks.find(rank => rank.name === v); if (r) { updateNestedField('rank', r.name); updateNestedField('rankId', r.id); updateNestedField('rankColor', r.color); } }}
                                                    options={academySettings.ranks.map(r => r.name)} />
                                            </div>
                                        </div>
                                    </EditSection>

                                    <EditSection label="Domicilio">
                                        <div className="grid grid-cols-12 gap-5">
                                            <div className="col-span-12 md:col-span-6"><EInput label="Calle" value={formData.guardian.address.street} onChange={v => updateNestedField('guardian.address.street', v)} /></div>
                                            <div className="col-span-6 md:col-span-3"><EInput label="Núm. Ext." value={formData.guardian.address.exteriorNumber} onChange={v => updateNestedField('guardian.address.exteriorNumber', v)} /></div>
                                            <div className="col-span-6 md:col-span-3"><EInput label="Núm. Int." value={formData.guardian.address.interiorNumber || ''} onChange={v => updateNestedField('guardian.address.interiorNumber', v)} /></div>
                                            <div className="col-span-12 md:col-span-8"><EInput label="Colonia" value={formData.guardian.address.colony} onChange={v => updateNestedField('guardian.address.colony', v)} /></div>
                                            <div className="col-span-6 md:col-span-4"><EInput label="C.P." value={formData.guardian.address.zipCode} onChange={v => updateNestedField('guardian.address.zipCode', v)} /></div>
                                        </div>
                                    </EditSection>

                                    <EditSection label="Tutor y Emergencias">
                                        <div className="grid grid-cols-12 gap-5">
                                            <div className="col-span-12 md:col-span-6"><EInput label="Nombre del Tutor" value={formData.guardian.fullName} onChange={v => updateNestedField('guardian.fullName', v)} /></div>
                                            <div className="col-span-6 md:col-span-3"><ESelect label="Parentesco" value={formData.guardian.relationship} onChange={v => updateNestedField('guardian.relationship', v)} options={['Padre','Madre','Tutor Legal','Familiar','Otro']} /></div>
                                            <div className="col-span-6 md:col-span-3"><EInput label="Email Tutor" value={formData.guardian.email} onChange={v => updateNestedField('guardian.email', v)} type="email" /></div>
                                            <div className="col-span-6 md:col-span-4"><EInput label="Tel. Principal" value={formData.guardian.phones.main} onChange={v => updateNestedField('guardian.phones.main', v)} type="tel" /></div>
                                            <div className="col-span-6 md:col-span-4"><EInput label="Tel. Secundario" value={formData.guardian.phones.secondary || ''} onChange={v => updateNestedField('guardian.phones.secondary', v)} type="tel" /></div>
                                        </div>
                                    </EditSection>
                                </main>
                            </div>

                        ) : (
                            /* ═══════════════ READ MODE ═══════════════ */
                            <div className="min-h-screen">

                                {/* ── TOPBAR ── */}
                                <div className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#09090d]/92 backdrop-blur-xl">
                                    <div className="max-w-5xl mx-auto px-6 h-13 py-3 flex items-center justify-between">
                                        <span className="text-xs text-zinc-600 uppercase tracking-[0.15em] font-semibold">Expediente de Alumno</span>
                                        <div className="flex items-center gap-1">
                                            <TopBtn icon="edit"   label="Editar"  onClick={() => setIsEditing(true)} />
                                            <TopBtn icon="key"    label="Acceso"  onClick={() => setIsEditingCredentials(true)} />
                                            <div className="w-px h-4 bg-white/10 mx-1.5" />
                                            <button onClick={handleDelete} disabled={isDeleting}
                                                className="h-12 md:h-8 px-4 md:px-3 flex items-center gap-1.5 rounded-lg text-sm md:text-xs font-semibold text-red-500/80 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
                                                {isDeleting
                                                    ? <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                                                    : <span className="material-symbols-outlined text-[15px]">delete</span>}
                                                Eliminar
                                            </button>
                                            <div className="w-px h-4 bg-white/10 mx-1.5" />
                                            <button onClick={onClose} className="w-12 h-12 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-white hover:bg-white/8 transition-all">
                                                <span className="material-symbols-outlined text-[24px] md:text-[20px]">close</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ── HERO SECTION ── */}
                                <div className="relative overflow-hidden border-b border-white/[0.05]">
                                    {/* Ambient background glows */}
                                    <div className="absolute inset-0 pointer-events-none select-none">
                                        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[700px] h-[400px]"
                                            style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.10) 0%, transparent 65%)' }} />
                                        <div className="absolute -top-10 left-0 w-[400px] h-[250px]"
                                            style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />
                                        <div className="absolute top-0 right-0 w-[300px] h-[200px]"
                                            style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.06) 0%, transparent 70%)' }} />
                                    </div>

                                    <div className="relative max-w-5xl mx-auto px-6 pt-10 pb-7">
                                        <div className="flex items-end gap-8">
                                            {/* Avatar */}
                                            <div className="relative flex-shrink-0">
                                                <div className="absolute -inset-3 rounded-full opacity-30 blur-2xl"
                                                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.8) 0%, rgba(220,38,38,0.4) 100%)' }} />
                                                <div className="relative p-[3px] rounded-full" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #dc2626 100%)' }}>
                                                    <div className="p-[3px] rounded-full bg-[#07070a]">
                                                        <Avatar
                                                            src={student.avatarUrl}
                                                            name={student.name}
                                                            className="w-28 h-28 rounded-full object-cover text-3xl font-black"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Identity */}
                                            <div className="pb-1 flex-1 min-w-0">
                                                <h1 className="text-4xl font-black text-white tracking-tight leading-none mb-3 truncate">
                                                    {student.name}
                                                </h1>
                                                <div className="flex items-center gap-2 flex-wrap mb-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${sMap.badgeBg} ${sMap.badgeText}`}>
                                                        <span className={`w-2 h-2 rounded-full ${sMap.dot}`} />
                                                        {sMap.label}
                                                    </span>
                                                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-indigo-500/25 bg-indigo-500/10 text-indigo-400">
                                                        {student.rank}
                                                    </span>
                                                    <button onClick={handlePromote}
                                                        className="h-12 md:h-8 px-4 md:px-3 rounded-lg text-xs md:text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-[16px] md:text-[14px]">upgrade</span>
                                                        Promover
                                                    </button>
                                                </div>
                                                {/* Stats row */}
                                                <div className="flex items-center gap-6 flex-wrap">
                                                    <HeroStat label="Asistencias" value={String(student.attendance)} />
                                                    <div className="w-px h-8 bg-white/8" />
                                                    <HeroStat label="Progreso" value={`${progressPercent}%`} accent />
                                                    <div className="w-px h-8 bg-white/8" />
                                                    <HeroStat
                                                        label="Saldo"
                                                        value={`$${student.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                                                        danger={student.balance > 0}
                                                        success={student.balance === 0}
                                                    />

                                                </div>
                                            </div>
                                            
                                            {/* Belt Graphic (Right Side) */}
                                            {beltImg && (
                                                <div className="hidden sm:flex flex-col items-center justify-center flex-shrink-0 w-48 md:w-64 relative">
                                                    {/* Destello rojo de fondo */}
                                                    <div className="absolute inset-0 pointer-events-none opacity-80" 
                                                         style={{ background: 'radial-gradient(circle at center, rgba(220,38,38,0.2) 0%, transparent 60%)' }} />
                                                    <img src={beltImg} alt={`Cinturón ${student.rank}`} className="w-full object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] relative z-10" style={{ maxHeight: '150px' }} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-8">
                                            <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progressPercent}%` }}
                                                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                                                    className="absolute inset-y-0 left-0 rounded-full"
                                                    style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7, #dc2626)' }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-2">
                                                <span className="text-xs text-zinc-600">Progreso al siguiente grado</span>
                                                <span className="text-xs text-zinc-600">{student.attendance} / {requiredAttendance} clases requeridas</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tabs */}
                                    <div className="max-w-5xl mx-auto px-6 flex gap-1">
                                        <ETab label="Expediente"      active={activeTab === 'info'}     onClick={() => setActiveTab('info')} />
                                        <ETab label="Finanzas & Pagos" active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} />
                                    </div>
                                </div>

                                {/* ── CONTENT ── */}
                                <div className="max-w-5xl mx-auto px-6 py-8 pb-24">
                                    {activeTab === 'info' ? (
                                        <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                                            className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                            {/* CONTACT */}
                                            <GlassCard label="Información de Contacto" icon="contacts">
                                                <InfoRow label="Email"      value={student.email} mono />
                                                <InfoRow label="Celular"    value={student.cellPhone} link={`tel:${student.cellPhone}`} />
                                                <InfoRow label="Nacimiento" value={formatDateDisplay(student.birthDate)} />
                                                <InfoRow label="Dirección"
                                                    value={[
                                                        `${student.guardian.address.street} ${student.guardian.address.exteriorNumber}`,
                                                        student.guardian.address.interiorNumber ? `Int. ${student.guardian.address.interiorNumber}` : '',
                                                        student.guardian.address.colony,
                                                        `CP ${student.guardian.address.zipCode}`
                                                    ].filter(Boolean).join(', ')}
                                                />
                                            </GlassCard>

                                            {/* BIOMETRY */}
                                            <GlassCard label="Biometría" icon="accessibility">
                                                <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.05]">
                                                    <BigStat label="Edad"     value={student.age ? `${student.age} años` : '—'} />
                                                    <BigStat label="Peso"     value={student.weight ? `${student.weight} kg` : '—'} />
                                                    <BigStat label="Estatura" value={student.height ? `${student.height} cm` : '—'} />
                                                    <BigStat label="Sangre"   value={(student as any).bloodType || 'N/R'} />
                                                </div>
                                            </GlassCard>

                                            {/* GUARDIAN */}
                                            <GlassCard label="Responsable / Emergencias" icon="family_history">
                                                <InfoRow label="Nombre"         value={student.guardian.fullName || '—'} />
                                                <InfoRow label="Parentesco"     value={student.guardian.relationship || '—'} />
                                                {student.guardian.email && <InfoRow label="Email" value={student.guardian.email} mono />}
                                                <InfoRow label="Tel. Principal" value={student.guardian.phones.main} link={`tel:${student.guardian.phones.main}`} />
                                                {student.guardian.phones.secondary && <InfoRow label="Tel. Secundario" value={student.guardian.phones.secondary} link={`tel:${student.guardian.phones.secondary}`} />}
                                                {student.guardian.phones.tertiary  && <InfoRow label="Tel. Extra"      value={student.guardian.phones.tertiary}   link={`tel:${student.guardian.phones.tertiary}`} />}
                                            </GlassCard>

                                            {/* META */}
                                            <GlassCard label="Metadatos del Registro" icon="fingerprint">
                                                <div className="px-5 py-5 space-y-4">
                                                    <div>
                                                        <p className="text-xs text-zinc-600 uppercase tracking-widest font-semibold mb-2">ID de Registro</p>
                                                        <p className="text-xs font-mono text-zinc-500 break-all leading-relaxed">{student.id}</p>
                                                    </div>
                                                    <div className="border-t border-white/[0.05] pt-4">
                                                        <p className="text-xs text-zinc-600 uppercase tracking-widest font-semibold mb-2">Última Asistencia</p>
                                                        <p className="text-base font-bold text-zinc-300">
                                                            {student.lastAttendance ? formatDateDisplay(student.lastAttendance) : '—'}
                                                        </p>
                                                    </div>
                                                    {progressPercent >= 100 && (
                                                        <div className="border-t border-white/[0.05] pt-4 flex items-start gap-3">
                                                            <span className="material-symbols-outlined text-[20px] text-emerald-400 flex-shrink-0">verified</span>
                                                            <p className="text-sm text-emerald-400 font-semibold leading-snug">Ha completado los requisitos para examen de grado.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </GlassCard>
                                        </motion.div>

                                    ) : (
                                        /* ── FINANCES ── */
                                        <motion.div key="payments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-5">

                                            {/* Balance card */}
                                            <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0e0e13] p-7 flex items-center justify-between">
                                                <div className="absolute top-0 left-0 w-80 h-full pointer-events-none"
                                                    style={{ background: 'radial-gradient(ellipse at -10% center, rgba(220,38,38,0.09) 0%, transparent 70%)' }} />
                                                <div className="relative">
                                                    <p className="text-xs text-zinc-600 uppercase tracking-[0.15em] font-semibold mb-2">Estado de Cuenta</p>
                                                    <h2 className={`text-5xl font-black tabular-nums tracking-tighter ${student.balance > 0 ? 'text-red-400' : 'text-white'}`}>
                                                        ${student.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                    </h2>
                                                </div>
                                                <div className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest border ${student.balance > 0 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                                    <span className={`w-2 h-2 rounded-full ${student.balance > 0 ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                                    {student.balance > 0 ? 'Adeudo pendiente' : 'Al corriente'}
                                                </div>
                                            </div>

                                            {/* ── SEARCH BAR ── */}
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-zinc-600 pointer-events-none select-none">
                                                    search
                                                </span>
                                                <input
                                                    type="text"
                                                    placeholder="Buscar movimientos por concepto…"
                                                    value={paymentSearch}
                                                    onChange={e => setPaymentSearch(e.target.value)}
                                                    className="w-full bg-[#0e0e13] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/20 focus:bg-[#12121a] transition-all"
                                                />
                                                {paymentSearch && (
                                                    <button onClick={() => setPaymentSearch('')}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-zinc-700 hover:bg-zinc-600 transition-colors">
                                                        <span className="material-symbols-outlined text-[13px] text-zinc-300">close</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Transactions table */}
                                            <div className="rounded-2xl border border-white/[0.07] bg-[#0e0e13] overflow-hidden">
                                                {/* Table header */}
                                                <div className="grid grid-cols-[1fr_2fr_1fr_1fr] border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
                                                    <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Fecha</span>
                                                    <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Concepto</span>
                                                    <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest text-right">Monto</span>
                                                    <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest text-right">Estatus</span>
                                                </div>

                                                {filteredRecords.length > 0 ? (
                                                    <div className="divide-y divide-white/[0.04]">
                                                        {filteredRecords.map(record => (
                                                            <motion.div
                                                                key={record.id}
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                className="grid grid-cols-[1fr_2fr_1fr_1fr] px-5 py-4 hover:bg-white/[0.025] transition-colors items-center"
                                                            >
                                                                <span className="text-sm text-zinc-500">{formatDateDisplay(record.dueDate)}</span>
                                                                <span className="text-sm font-medium text-zinc-200">{record.concept}</span>
                                                                <span className="text-sm font-black text-white tabular-nums text-right">
                                                                    ${((record.amount || 0) + (record.penaltyAmount || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                                </span>
                                                                <div className="flex justify-end">
                                                                    <EPaymentBadge status={record.status} />
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                                                        <span className="material-symbols-outlined text-[40px] text-zinc-800">search_off</span>
                                                        <p className="text-zinc-600 text-sm font-medium">
                                                            {paymentSearch ? `Sin resultados para "${paymentSearch}"` : 'Sin transacciones registradas.'}
                                                        </p>
                                                        {paymentSearch && (
                                                            <button onClick={() => setPaymentSearch('')}
                                                                className="text-xs text-zinc-500 hover:text-white transition-colors underline underline-offset-4">
                                                                Limpiar búsqueda
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {filteredRecords.length > 0 && (
                                                    <div className="border-t border-white/[0.05] px-5 py-3 flex items-center justify-between">
                                                        <p className="text-xs text-zinc-600">
                                                            {paymentSearch
                                                                ? `${filteredRecords.length} de ${financialRecords.length} movimientos`
                                                                : `${financialRecords.length} movimiento${financialRecords.length !== 1 ? 's' : ''}`}
                                                        </p>
                                                        {paymentSearch && (
                                                            <button onClick={() => setPaymentSearch('')}
                                                                className="text-xs text-zinc-500 hover:text-white transition-colors">
                                                                Limpiar filtro ×
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}

            {isEditingCredentials && createPortal(
                <UpdateCredentialsModal isOpen={isEditingCredentials} student={student} onClose={() => setIsEditingCredentials(false)} />,
                document.body
            )}
        </>
    );
};

// ─── PRIMITIVES ──────────────────────────────────────────────────────────────

const HeroStat: React.FC<{ label: string; value: string; accent?: boolean; danger?: boolean; success?: boolean; muted?: boolean }> = ({ label, value, accent, danger, success, muted }) => (
    <div>
        <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-semibold mb-1">{label}</p>
        <p className={`text-xl font-black tabular-nums ${danger ? 'text-red-400' : success ? 'text-emerald-400' : accent ? 'text-indigo-400' : muted ? 'text-zinc-400' : 'text-white'}`}>
            {value}
        </p>
    </div>
);

const ETab: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button onClick={onClick}
        className={`px-5 py-3.5 text-base md:text-sm font-semibold border-b-2 transition-all -mb-px min-h-[48px] ${active ? 'border-white text-white' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}>
        {label}
    </button>
);

const TopBtn: React.FC<{ icon: string; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
    <button onClick={onClick}
        className="h-12 md:h-8 px-4 md:px-3 flex items-center gap-1.5 rounded-lg text-sm md:text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/8 transition-all">
        <span className="material-symbols-outlined text-[18px] md:text-[15px]">{icon}</span>
        {label}
    </button>
);

const GlassCard: React.FC<{ label: string; icon: string; children: React.ReactNode }> = ({ label, icon, children }) => (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0e0e13] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-3">
            <span className="material-symbols-outlined text-[17px] text-zinc-600">{icon}</span>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{label}</p>
        </div>
        {children}
    </div>
);

const InfoRow: React.FC<{ label: string; value: string; link?: string; mono?: boolean }> = ({ label, value, link, mono }) => (
    <div className="px-5 py-4 flex flex-col gap-1 border-b border-white/[0.04] last:border-0">
        <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">{label}</span>
        {link
            ? <a href={link} className={`text-white hover:text-indigo-400 transition-colors font-semibold ${mono ? 'font-mono text-sm' : 'text-base'}`}>{value}</a>
            : <span className={`text-white font-semibold ${mono ? 'font-mono text-sm' : 'text-base'}`}>{value}</span>
        }
    </div>
);

const BigStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="px-5 py-6 flex flex-col gap-1.5">
        <p className="text-xs text-zinc-600 uppercase tracking-widest font-semibold">{label}</p>
        <p className="text-2xl font-black text-white">{value}</p>
    </div>
);

const EditSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <div className="flex items-center gap-4 mb-6">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex-shrink-0">{label}</p>
            <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
        {children}
    </div>
);

const EInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
    <div>
        <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl text-base md:text-sm text-white font-medium px-4 py-3 min-h-[48px] outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all" />
    </div>
);

const ESelect: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: string[] }> = ({ label, value, onChange, options }) => (
    <div>
        <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl text-base md:text-sm text-white font-medium px-4 py-3 min-h-[48px] outline-none focus:border-indigo-500/50 transition-all appearance-none">
            <option value="">—</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);

const EPaymentBadge: React.FC<{ status: string }> = ({ status }) => {
    const map: Record<string, { label: string; cls: string }> = {
        paid:      { label: 'Pagado',      cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
        pending:   { label: 'Pendiente',   cls: 'text-amber-400   bg-amber-500/10   border-amber-500/25' },
        overdue:   { label: 'Vencido',     cls: 'text-red-400     bg-red-500/10     border-red-500/25' },
        in_review: { label: 'En Revisión', cls: 'text-blue-400    bg-blue-500/10    border-blue-500/25' },
        partial:   { label: 'Parcial',     cls: 'text-orange-400  bg-orange-500/10  border-orange-500/25' },
        charged:   { label: 'Cargado',     cls: 'text-purple-400  bg-purple-500/10  border-purple-500/25' },
    };
    const { label, cls } = map[status] || map.pending;
    return <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${cls}`}>{label}</span>;
};

export default StudentDetailModal;
