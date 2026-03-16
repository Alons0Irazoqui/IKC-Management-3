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
    isOpen,
    student,
    onClose,
    onEdit,
    financialRecords
}) => {
    const { deleteStudent, purgeStudentDebts, academySettings, updateStudent } = useStore();
    const { confirm } = useConfirmation();
    const { addToast } = useToast();

    // ESTADOS LOCALES
    const [activeTab, setActiveTab] = useState<'info' | 'payments'>('info');
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditingCredentials, setIsEditingCredentials] = useState(false);
    const [formData, setFormData] = useState<Student | null>(null);

    // Sincronizar formData cuando el estudiante cambia o se entra en modo edición
    useEffect(() => {
        if (student && isEditing) {
            setFormData(JSON.parse(JSON.stringify(student)));
        }
    }, [student, isEditing]);

    // CÁLCULO DE PROGRESO
    const { progressPercent, requiredAttendance } = useMemo(() => {
        if (!student) return { progressPercent: 0, requiredAttendance: 0 };
        const currentRankConfig = academySettings.ranks.find(r => r.id === student.rankId);
        const required = currentRankConfig?.requiredAttendance || 0;
        const percent = required > 0 ? Math.min(Math.round((student.attendance / required) * 100), 100) : 100;
        return { progressPercent: percent, requiredAttendance: required };
    }, [student, academySettings]);

    if (!student) return null;

    const handleDelete = () => {
        confirm({
            title: 'Eliminar Expediente',
            message: `¿Deseas eliminar permanentemente a ${student.name}? Esta acción borrará registros de asistencia y deudas.`,
            type: 'danger',
            confirmText: 'Confirmar Eliminación',
            onConfirm: async () => {
                setIsDeleting(true);
                try {
                    await deleteStudent(student.id);
                    purgeStudentDebts(student.id);
                    onClose();
                } catch (e) {
                    addToast('Ocurrió un error al eliminar.', 'error');
                } finally {
                    setIsDeleting(false);
                }
            }
        });
    };

    const handleSaveChanges = () => {
        if (!formData) return;

        // Validación básica
        if (!formData.name || !formData.email) {
            addToast('Nombre y Email son obligatorios', 'error');
            return;
        }

        updateStudent(formData);
        addToast('Datos actualizados correctamente', 'success');
        setIsEditing(false);
    };

    // Helpers para actualización de campos anidados
    const updateNestedField = (path: string, value: any) => {
        setFormData(prev => {
            if (!prev) return null;
            const next = { ...prev };
            const keys = path.split('.');
            let current: any = next;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return next;
        });
    };

    const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
        active:     { label: 'Activo',        color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
        debtor:     { label: 'Adeudo',        color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
        exam_ready: { label: 'Listo p/Examen',color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
        inactive:   { label: 'Inactivo',      color: 'text-gray-500',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20' },
    };
    const sConfig = statusConfig[student.status] || statusConfig.inactive;

    return (
        <>
            {isOpen && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-[#0a0a0d] overflow-y-auto font-sans"
                    >
                        {isEditing && formData ? (
                            /* --- MODO EDICIÓN: DARK ENTERPRISE FORM --- */
                            <div className="min-h-screen flex flex-col">
                                <header className="bg-[#0e0e11] border-b border-white/5 px-8 py-5 sticky top-0 z-50 backdrop-blur-md">
                                    <div className="max-w-5xl mx-auto flex justify-between items-center">
                                        <div>
                                            <h2 className="text-xl font-black text-white tracking-tight">Editar Expediente</h2>
                                            <p className="text-gray-500 text-xs font-medium mt-0.5">Actualiza la información técnica y personal del alumno.</p>
                                        </div>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-all"
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                </header>

                                <main className="flex-1 max-w-5xl mx-auto w-full p-8 pb-32">
                                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

                                        {/* SECCIÓN 1: DATOS DEL ALUMNO */}
                                        <section>
                                            <DarkSectionTitle icon="person" title="Información del Alumno" />
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <div className="md:col-span-2">
                                                    <DarkEditInput label="Nombre Completo" value={formData.name} onChange={v => updateNestedField('name', v)} />
                                                </div>
                                                <DarkEditInput label="Email de Acceso" value={formData.email} onChange={v => updateNestedField('email', v)} type="email" />
                                                <DarkEditInput label="Celular Alumno" value={formData.cellPhone} onChange={v => updateNestedField('cellPhone', v)} type="tel" />
                                                <DarkEditInput label="Fecha Nacimiento" value={formData.birthDate} onChange={v => updateNestedField('birthDate', v)} type="date" />
                                                <DarkEditSelect
                                                    label="Tipo de Sangre"
                                                    value={(formData as any).bloodType || ''}
                                                    onChange={v => updateNestedField('bloodType', v)}
                                                    options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']}
                                                />
                                                <DarkEditInput label="Peso (kg)" value={formData.weight?.toString() || ''} onChange={v => updateNestedField('weight', parseFloat(v))} type="number" />
                                                <DarkEditInput label="Estatura (cm)" value={formData.height?.toString() || ''} onChange={v => updateNestedField('height', parseInt(v))} type="number" />
                                                <DarkEditSelect
                                                    label="Rango Actual"
                                                    value={formData.rank}
                                                    onChange={v => {
                                                        const r = academySettings.ranks.find(rank => rank.name === v);
                                                        if (r) {
                                                            updateNestedField('rank', r.name);
                                                            updateNestedField('rankId', r.id);
                                                            updateNestedField('rankColor', r.color);
                                                        }
                                                    }}
                                                    options={academySettings.ranks.map(r => r.name)}
                                                />
                                            </div>
                                        </section>

                                        {/* SECCIÓN 2: DIRECCIÓN */}
                                        <section>
                                            <DarkSectionTitle icon="location_on" title="Domicilio Residencial" />
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                                <div className="md:col-span-2">
                                                    <DarkEditInput label="Calle" value={formData.guardian.address.street} onChange={v => updateNestedField('guardian.address.street', v)} />
                                                </div>
                                                <DarkEditInput label="Núm. Exterior" value={formData.guardian.address.exteriorNumber} onChange={v => updateNestedField('guardian.address.exteriorNumber', v)} />
                                                <DarkEditInput label="Núm. Interior" value={formData.guardian.address.interiorNumber || ''} onChange={v => updateNestedField('guardian.address.interiorNumber', v)} />
                                                <div className="md:col-span-3">
                                                    <DarkEditInput label="Colonia" value={formData.guardian.address.colony} onChange={v => updateNestedField('guardian.address.colony', v)} />
                                                </div>
                                                <DarkEditInput label="Código Postal" value={formData.guardian.address.zipCode} onChange={v => updateNestedField('guardian.address.zipCode', v)} />
                                            </div>
                                        </section>

                                        {/* SECCIÓN 3: TUTOR */}
                                        <section>
                                            <DarkSectionTitle icon="family_history" title="Tutor y Emergencias" />
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <div className="md:col-span-2">
                                                    <DarkEditInput label="Nombre del Tutor" value={formData.guardian.fullName} onChange={v => updateNestedField('guardian.fullName', v)} />
                                                </div>
                                                <DarkEditSelect
                                                    label="Parentesco"
                                                    value={formData.guardian.relationship}
                                                    onChange={v => updateNestedField('guardian.relationship', v)}
                                                    options={['Padre', 'Madre', 'Tutor Legal', 'Familiar', 'Otro']}
                                                />
                                                <DarkEditInput label="Email Tutor" value={formData.guardian.email} onChange={v => updateNestedField('guardian.email', v)} type="email" />
                                                <DarkEditInput label="Teléfono Principal" value={formData.guardian.phones.main} onChange={v => updateNestedField('guardian.phones.main', v)} type="tel" />
                                                <DarkEditInput label="Teléfono Secundario" value={formData.guardian.phones.secondary || ''} onChange={v => updateNestedField('guardian.phones.secondary', v)} type="tel" />
                                            </div>
                                        </section>

                                    </div>
                                </main>

                                {/* BARRA DE ACCIONES FIJA */}
                                <footer className="fixed bottom-0 left-0 right-0 bg-[#0e0e11]/90 backdrop-blur-md border-t border-white/5 p-5 z-50">
                                    <div className="max-w-5xl mx-auto flex gap-3">
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="flex-1 py-3.5 bg-white/5 text-gray-400 rounded-xl font-bold hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest text-xs"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSaveChanges}
                                            className="flex-[2] py-3.5 bg-white text-black rounded-xl font-bold hover:bg-gray-100 transition-all shadow-xl uppercase tracking-widest text-xs active:scale-[0.98]"
                                        >
                                            Guardar Cambios
                                        </button>
                                    </div>
                                </footer>
                            </div>
                        ) : (
                            /* --- MODO LECTURA: DARK ENTERPRISE VIEW --- */
                            <>
                                {/* --- STICKY TOP BAR --- */}
                                <header className="sticky top-0 z-50 bg-[#0e0e11]/90 backdrop-blur-md border-b border-white/5">
                                    <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                                        {/* IZQUIERDA: IDENTIDAD */}
                                        <div className="flex items-center gap-4">
                                            <Avatar
                                                src={student.avatarUrl}
                                                name={student.name}
                                                className="w-12 h-12 rounded-2xl object-cover text-base font-black ring-1 ring-white/10"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    <h1 className="text-lg font-bold text-white tracking-tight">{student.name}</h1>
                                                    <span className="bg-white/10 text-gray-300 border border-white/10 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                                        {student.rank}
                                                    </span>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${sConfig.bg} ${sConfig.color} ${sConfig.border}`}>
                                                        {sConfig.label}
                                                    </span>
                                                </div>
                                                <p className="text-gray-600 text-[11px] font-medium mt-0.5">
                                                    Alumno desde: {student.joinDate}
                                                </p>
                                            </div>
                                        </div>

                                        {/* DERECHA: ACCIONES */}
                                        <div className="flex items-center gap-1">
                                            <ActionBtn icon="edit" title="Editar" onClick={() => setIsEditing(true)} color="text-gray-400 hover:text-white hover:bg-white/10" />
                                            <ActionBtn icon="key" title="Claves" onClick={() => setIsEditingCredentials(true)} color="text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10" />

                                            <button
                                                onClick={handleDelete}
                                                title="Eliminar"
                                                disabled={isDeleting}
                                                className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${isDeleting ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'}`}
                                            >
                                                {isDeleting ? (
                                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                )}
                                            </button>

                                            <div className="w-px h-5 bg-white/10 mx-1" />

                                            <ActionBtn icon="close" title="Cerrar" onClick={onClose} color="text-gray-400 hover:text-white hover:bg-white/10" />
                                        </div>
                                    </div>

                                    {/* TABS */}
                                    <div className="max-w-7xl mx-auto px-6">
                                        <nav className="flex gap-0">
                                            <DarkTabBtn active={activeTab === 'info'} onClick={() => setActiveTab('info')} label="Expediente" />
                                            <DarkTabBtn active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} label="Finanzas & Pagos" />
                                        </nav>
                                    </div>
                                </header>

                                {/* --- CONTENIDO PRINCIPAL --- */}
                                <main className="max-w-7xl mx-auto p-6 pb-24">
                                    {activeTab === 'info' ? (
                                        <div className="grid grid-cols-12 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-400">

                                            {/* 1. PROGRESO DE GRADO */}
                                            <div className="col-span-12 lg:col-span-8 bg-[#0e0e11] rounded-2xl border border-white/5 p-6">
                                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-5">Progreso de Grado</p>
                                                <div className="flex items-end justify-between mb-4">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-5xl font-black text-white tabular-nums">{student.attendance}</span>
                                                        <span className="text-gray-600 font-bold uppercase text-xs">Clases asistidas</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-2xl font-black text-white">{progressPercent}<span className="text-lg text-gray-500">%</span></span>
                                                        <p className="text-[10px] text-gray-600 font-bold uppercase mt-0.5">Meta: {requiredAttendance} clases</p>
                                                    </div>
                                                </div>
                                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${progressPercent}%` }}
                                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                                                    />
                                                </div>
                                                {student.lastAttendance && (
                                                    <p className="text-[11px] text-gray-600 mt-3">
                                                        Última asistencia: <span className="text-gray-400 font-semibold">{formatDateDisplay(student.lastAttendance)}</span>
                                                    </p>
                                                )}
                                            </div>

                                            {/* 2. BIOMETRÍA */}
                                            <div className="col-span-12 lg:col-span-4 bg-[#0e0e11] rounded-2xl border border-white/5 p-6">
                                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-5">Biometría</p>
                                                <div className="grid grid-cols-2 gap-5">
                                                    <DarkBiometryField label="Edad" value={student.age ? `${student.age} años` : '—'} />
                                                    <DarkBiometryField label="Peso" value={student.weight ? `${student.weight} kg` : '—'} />
                                                    <DarkBiometryField label="Estatura" value={student.height ? `${student.height} cm` : '—'} />
                                                    <DarkBiometryField label="Sangre" value={(student as any).bloodType || 'N/R'} />
                                                </div>
                                            </div>

                                            {/* 3. CONTACTO */}
                                            <div className="col-span-12 lg:col-span-6 bg-[#0e0e11] rounded-2xl border border-white/5 p-6">
                                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-5">Información de Contacto</p>
                                                <div className="space-y-4">
                                                    <DarkContactRow label="Celular Alumno" value={student.cellPhone} isLink={`tel:${student.cellPhone}`} icon="smartphone" />
                                                    <DarkContactRow label="Email Personal" value={student.email} icon="alternate_email" />
                                                    <DarkContactRow label="Nacimiento" value={formatDateDisplay(student.birthDate)} icon="cake" />
                                                    <div className="pt-4 border-t border-white/5">
                                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1.5">Dirección Residencial</p>
                                                        <p className="text-white font-semibold text-sm">
                                                            {student.guardian.address.street} {student.guardian.address.exteriorNumber}
                                                            {student.guardian.address.interiorNumber ? `, Int. ${student.guardian.address.interiorNumber}` : ''}
                                                        </p>
                                                        <p className="text-gray-500 text-sm mt-0.5">{student.guardian.address.colony}, CP {student.guardian.address.zipCode}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 4. TUTOR LEGAL */}
                                            <div className="col-span-12 lg:col-span-6 bg-[#0e0e11] rounded-2xl border border-white/5 p-6">
                                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-5">Responsable / Emergencias</p>
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <DarkBiometryField label="Tutor" value={student.guardian.fullName || '—'} />
                                                        <DarkBiometryField label="Parentesco" value={student.guardian.relationship || '—'} />
                                                    </div>
                                                    <div className="bg-white/3 rounded-xl border border-white/5 p-4 space-y-3 mt-2">
                                                        <DarkEmergencyPhone label="Teléfono Principal" value={student.guardian.phones.main} />
                                                        {student.guardian.phones.secondary && (
                                                            <DarkEmergencyPhone label="Secundario" value={student.guardian.phones.secondary} />
                                                        )}
                                                        {student.guardian.phones.tertiary && (
                                                            <DarkEmergencyPhone label="Contacto Extra" value={student.guardian.phones.tertiary} />
                                                        )}
                                                    </div>
                                                    {student.guardian.email && (
                                                        <div className="flex items-center gap-2 pt-1">
                                                            <span className="material-symbols-outlined text-[16px] text-gray-600">alternate_email</span>
                                                            <span className="text-gray-400 text-sm">{student.guardian.email}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    ) : (
                                        /* --- TAB 2: FINANZAS DARK --- */
                                        <div className="space-y-4 animate-in fade-in duration-400">
                                            {/* Hero Saldo */}
                                            <div className="bg-[#0e0e11] rounded-2xl border border-white/5 p-8 flex flex-col items-center text-center">
                                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-3">Estado de Cuenta</p>
                                                <h2 className={`text-6xl font-black tracking-tighter tabular-nums ${student.balance > 0 ? 'text-red-400' : 'text-white'}`}>
                                                    ${student.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                </h2>
                                                <div className={`mt-4 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest border ${student.balance > 0 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                                    {student.balance > 0 ? 'Adeudo Pendiente' : 'Al corriente'}
                                                </div>
                                            </div>

                                            {/* Tabla de Pagos */}
                                            <div className="bg-[#0e0e11] rounded-2xl border border-white/5 overflow-hidden">
                                                <table className="w-full text-left">
                                                    <thead className="border-b border-white/5">
                                                        <tr>
                                                            <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Fecha</th>
                                                            <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Concepto</th>
                                                            <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Monto</th>
                                                            <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">Estatus</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {financialRecords.length > 0 ? (
                                                            financialRecords.map(record => (
                                                                <tr key={record.id} className="hover:bg-white/3 transition-colors">
                                                                    <td className="px-6 py-4 text-sm font-bold text-gray-300">{formatDateDisplay(record.dueDate)}</td>
                                                                    <td className="px-6 py-4 text-sm text-gray-400 font-medium">{record.concept}</td>
                                                                    <td className="px-6 py-4 text-right font-black text-white tabular-nums">
                                                                        ${(record.amount + record.penaltyAmount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-center">
                                                                        <DarkPaymentBadge status={record.status} />
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr>
                                                                <td colSpan={4} className="px-8 py-20 text-center text-gray-700 italic font-medium text-sm">
                                                                    No hay transacciones registradas para este alumno.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </main>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}

            <UpdateCredentialsModal
                isOpen={isEditingCredentials}
                student={student}
                onClose={() => setIsEditingCredentials(false)}
            />
        </>
    );
};

// --- DARK ENTERPRISE COMPONENTS ---

const ActionBtn: React.FC<{ icon: string; title: string; onClick: () => void; color: string }> = ({ icon, title, onClick, color }) => (
    <button
        onClick={onClick}
        title={title}
        className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${color}`}
    >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
);

const DarkTabBtn: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`py-4 px-5 border-b-2 text-sm font-bold transition-all ${
            active ? 'border-white text-white' : 'border-transparent text-gray-600 hover:text-gray-400'
        }`}
    >
        {label}
    </button>
);

const DarkSectionTitle: React.FC<{ icon: string; title: string }> = ({ icon, title }) => (
    <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
        <div className="size-9 bg-white/5 text-gray-400 rounded-xl flex items-center justify-center border border-white/5">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
        <h3 className="text-sm font-black text-gray-300 uppercase tracking-wider">{title}</h3>
    </div>
);

const DarkEditInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
    <div>
        <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1.5">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm font-medium text-white focus:bg-white/8 focus:border-white/20 focus:ring-0 transition-all outline-none placeholder:text-gray-700"
        />
    </div>
);

const DarkEditSelect: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: string[] }> = ({ label, value, onChange, options }) => (
    <div>
        <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1.5">{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm font-medium text-white focus:bg-white/8 focus:border-white/20 focus:ring-0 transition-all outline-none appearance-none"
        >
            <option value="">Seleccionar...</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);

const DarkBiometryField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
    </div>
);

const DarkContactRow: React.FC<{ label: string; value: string; isLink?: string; icon: string }> = ({ label, value, isLink, icon }) => (
    <div className="flex items-center gap-3">
        <div className="size-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-600 flex-shrink-0">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
        <div>
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</p>
            {isLink ? (
                <a href={isLink} className="text-white font-semibold text-sm hover:text-indigo-400 transition-colors">
                    {value}
                </a>
            ) : (
                <p className="text-white font-semibold text-sm">{value}</p>
            )}
        </div>
    </div>
);

const DarkEmergencyPhone: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between items-center">
        <div>
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</p>
            <p className="text-base font-bold text-white">{value}</p>
        </div>
        <a
            href={`tel:${value}`}
            className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"
        >
            <span className="material-symbols-outlined text-[18px] filled">call</span>
        </a>
    </div>
);

const DarkPaymentBadge: React.FC<{ status: string }> = ({ status }) => {
    const config: any = {
        paid:      { label: 'Pagado',     cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
        pending:   { label: 'Pendiente',  cls: 'bg-amber-500/10  text-amber-400  border-amber-500/20' },
        overdue:   { label: 'Vencido',    cls: 'bg-red-500/10    text-red-400    border-red-500/20' },
        in_review: { label: 'En Revisión',cls: 'bg-blue-500/10   text-blue-400   border-blue-500/20' },
        partial:   { label: 'Parcial',    cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
        charged:   { label: 'Cargado',    cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    };
    const { label, cls } = config[status] || config.pending;
    return (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${cls}`}>
            {label}
        </span>
    );
};

export default StudentDetailModal;
