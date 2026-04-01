import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { Student, StudentStatus } from '../../types';
import { exportToCSV } from '../../utils/csvExport';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import EmptyState from '../../components/ui/EmptyState';
import { PulseService } from '../../services/pulseService';
import Avatar from '../../components/ui/Avatar';
import { getStatusLabel } from '../../utils/textUtils';
import StudentDetailModal from '../../components/ui/StudentDetailModal';
import UpdateCredentialsModal from '../../components/ui/UpdateCredentialsModal';

// Fix for type errors with motion components
const MotionDiv = motion.div as any;
const MotionTbody = motion.tbody as any;
const MotionTr = motion.tr as any;

const StudentsList: React.FC = () => {
    const { students, updateStudent, deleteStudent, addStudent, academySettings, promoteStudent, records, isLoading, purgeStudentDebts, refreshData, refreshFinance } = useStore();
    const { addToast } = useToast();
    const { confirm } = useConfirmation();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterRank, setFilterRank] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');


    const [showModal, setShowModal] = useState(false);
    const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [credentialsStudent, setCredentialsStudent] = useState<Student | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const initialFormState: Partial<Student> = {
        name: '',
        email: '',
        cellPhone: '',
        age: undefined,
        birthDate: '',
        weight: undefined,
        height: undefined,
        rank: 'White Belt',
        status: 'active',
        program: 'Adults',
        balance: 0,
        avatarUrl: '',
        password: '',
        guardian: {
            fullName: '',
            email: '',
            relationship: 'Padre',
            phones: { main: '', secondary: '', tertiary: '' },
            address: { street: '', exteriorNumber: '', interiorNumber: '', colony: '', zipCode: '' }
        }
    };
    const [formData, setFormData] = useState<any>(initialFormState);

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
    };

    const filteredStudents = useMemo(() => {
        const normalize = (text: string | undefined | null) => {
            return (text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        };

        const term = normalize(searchTerm);

        return students.filter(student => {
            const matchName = normalize(student.name).includes(term);
            const matchEmail = normalize(student.email).includes(term);
            const matchGuardian = normalize(student.guardian?.fullName).includes(term);
            const matchPhone = normalize(student.cellPhone).includes(term);

            const matchesSearch = matchName || matchEmail || matchGuardian || matchPhone;
            const matchesStatus = filterStatus === 'all' || student.status === filterStatus;
            const matchesRank = filterRank === 'all' || student.rankId === filterRank;

            return matchesSearch && matchesStatus && matchesRank;
        });
    }, [students, searchTerm, filterStatus, filterRank]);

    const isSearchActive = searchTerm !== '' || filterStatus !== 'all' || filterRank !== 'all';
    const emptyTitle = !isSearchActive && students.length === 0 ? "Aún no hay alumnos" : "Sin resultados";
    const emptyDesc = !isSearchActive && students.length === 0
        ? "Comparte el código de tu academia para que se registren o agrégalos manualmente."
        : "Intenta cambiar los filtros de búsqueda.";

    const reactiveViewingStudent = useMemo(() => {
        if (!viewingStudent) return null;
        return students.find(s => s.id === viewingStudent.id) || viewingStudent;
    }, [students, viewingStudent]);

    const studentFinancialRecords = useMemo(() => {
        if (!reactiveViewingStudent || !records) return [];
        return records
            .filter(r => r.studentId === reactiveViewingStudent.id)
            .sort((a, b) => {
                const dateA = new Date(a.paymentDate || a.dueDate).getTime();
                const dateB = new Date(b.paymentDate || b.dueDate).getTime();
                return dateB - dateA;
            });
    }, [reactiveViewingStudent, records]);

    const handleExport = () => {
        const dataToExport = filteredStudents.map(s => ({
            ID: s.id,
            Nombre: s.name,
            Email: s.email,
            Celular: s.cellPhone,
            Tutor: s.guardian.fullName,
            Tutor_Tel: s.guardian.phones.main,
            Rango: s.rank,
            Estado: getStatusLabel(s.status),
            Balance: s.balance,
            Peso_kg: s.weight || '-',
            Estatura_cm: s.height || '-'
        }));
        exportToCSV(dataToExport, 'Listado_Alumnos_Completo');
        addToast('Archivo CSV generado', 'success');
    };

    const getStatusStyle = (status: string): React.CSSProperties => {
        switch (status) {
            case 'active': return { color: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' };
            case 'debtor': return { color: 'var(--color-brand)', backgroundColor: 'var(--color-brand-glow)', border: '1px solid rgba(225,29,72,0.3)' };
            case 'exam_ready': return { color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)' };
            default: return { color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-strong)' };
        }
    };
    // Keep old for any remaining references
    const getStatusColor = (_status: string) => '';

    const handleDelete = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        confirm({
            title: 'Eliminar Alumno',
            message: '¿Estás seguro? Se eliminará TOTALMENTE el registro del alumno, incluyendo credenciales, clases, eventos y deudas pendientes.',
            type: 'danger',
            onConfirm: async () => {
                await deleteStudent(id);
                // Purge debts is also a side-effect, just in case wait as well if it's async
                await purgeStudentDebts(id);
            }
        });
    };

    const handleEdit = (student: Student, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingStudent(student);

        const safeData = JSON.parse(JSON.stringify(student));
        const mergedFormData = {
            ...initialFormState,
            ...safeData,
            guardian: {
                ...initialFormState.guardian!,
                ...(safeData.guardian || {}),
                phones: {
                    ...initialFormState.guardian!.phones,
                    ...(safeData.guardian?.phones || {})
                },
                address: {
                    ...initialFormState.guardian!.address,
                    ...(safeData.guardian?.address || {})
                }
            },
            password: ''
        };

        setFormData(mergedFormData);
        setShowModal(true);
    };

    const handleCredentialsEdit = (student: Student, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCredentialsStudent(student);
    };

    const handleViewDetails = (student: Student, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setViewingStudent(student);
    };

    const handleCreate = () => {
        setEditingStudent(null);
        setFormData({ ...initialFormState, avatarUrl: '' });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting) return;

        if (!formData.name || !formData.email || !formData.cellPhone || !formData.guardian.fullName || !formData.guardian.phones.main) {
            addToast("Por favor completa el los campos obligatorios (*)", 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            if (!editingStudent || (editingStudent && editingStudent.email !== formData.email)) {
                const emailExists = await PulseService.checkEmailExists(formData.email);
                if (emailExists) {
                    addToast("Este correo electrónico ya está registrado.", 'error');
                    setIsSubmitting(false);
                    return;
                }
            }

            if (editingStudent) {
                const selectedRank = academySettings.ranks.find(r => r.name === formData.rank);
                await updateStudent({
                    ...editingStudent,
                    ...formData,
                    rankId: selectedRank?.id || editingStudent.rankId,
                    rankColor: selectedRank?.color || editingStudent.rankColor,
                });
                setShowModal(false);
            } else {
                if (!formData.password) {
                    addToast('La contraseña es obligatoria', 'error');
                    setIsSubmitting(false);
                    return;
                }
                const selectedRank = academySettings.ranks.find(r => r.name === formData.rank);

                await addStudent({
                    id: '', userId: '', academyId: '', ...formData,
                    rankId: selectedRank?.id || 'rank-1',
                    rankColor: selectedRank?.color || 'white',
                    stripes: 0, attendance: 0, totalAttendance: 0,
                    joinDate: new Date().toLocaleDateString(),
                    classesId: [], attendanceHistory: [],
                    status: formData.status
                });

                if (refreshFinance) refreshFinance();
                setShowModal(false);
            }
        } catch (err) {
            console.error("Error submitting form:", err);
            // Error already toasted in AcademyContext / PulseService, so we just finish loading state
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:px-10 h-full">
            <div className="max-w-[1600px] mx-auto flex flex-col gap-6">

                {/* ── Header & Controls ── */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div>
                        <p className="text-xs md:text-[9px] font-bold uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--color-brand)' }}>IKC Management</p>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Gestión de Alumnos</h2>
                        <p className="text-base md:text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Administra tu lista de estudiantes y contactos de emergencia.</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={handleExport}
                            className="p-2.5 min-h-[48px] min-w-[48px] md:min-h-0 md:min-w-0 flex items-center justify-center rounded-md transition-all"
                            title="Exportar CSV"
                            style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                        </button>

                        <div className="flex p-0.5 rounded-md" style={{ border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)' }}>
                            <button onClick={() => setViewMode('grid')}
                                className="p-2.5 min-h-[48px] min-w-[48px] md:min-h-[36px] md:min-w-[36px] flex items-center justify-center rounded transition-all"
                                style={viewMode === 'grid'
                                    ? { color: 'var(--color-brand)', backgroundColor: 'var(--color-bg-raised)' }
                                    : { color: 'var(--color-text-muted)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>grid_view</span>
                            </button>
                            <button onClick={() => setViewMode('table')}
                                className="p-2.5 min-h-[48px] min-w-[48px] md:min-h-[36px] md:min-w-[36px] flex items-center justify-center rounded transition-all"
                                style={viewMode === 'table'
                                    ? { color: 'var(--color-brand)', backgroundColor: 'var(--color-bg-raised)' }
                                    : { color: 'var(--color-text-muted)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>table_rows</span>
                            </button>
                        </div>

                        <button onClick={handleCreate}
                            className="flex items-center gap-2 px-4 py-2.5 min-h-[48px] md:min-h-0 text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                            style={{ backgroundColor: 'var(--color-brand)', color: '#fff', borderRadius: '6px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span>
                            <span className="hidden sm:inline">Nuevo Alumno</span>
                        </button>
                    </div>
                </div>

                {/* ── Tabs & Search Bar Hybrid ── */}
                <div className="flex flex-col mt-4 rounded-xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--color-border-subtle)' }}>

                    {/* Enterprise Tabs */}
                    <div className="flex overflow-x-auto scrollbar-hide bg-black/20" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        {(['all', 'active', 'debtor', 'inactive'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className="px-6 py-4 md:py-3.5 min-h-[48px] md:min-h-0 text-xs md:text-[11px] font-bold uppercase tracking-[0.05em] whitespace-nowrap transition-all relative"
                                style={filterStatus === status
                                    ? { color: 'var(--color-text-primary)' }
                                    : { color: 'var(--color-text-muted)' }}
                            >
                                {status === 'all' ? 'Todos' : getStatusLabel(status as StudentStatus)}
                                {filterStatus === status && (
                                    <div className="absolute bottom-[-1px] left-0 right-0 h-[2px]" style={{ backgroundColor: 'var(--color-brand)' }}></div>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="p-3">
                        <div className="relative w-full flex items-center">
                            <span 
                                className="material-symbols-outlined absolute top-1/2 -translate-y-1/2 pointer-events-none" 
                                style={{ left: '16px', fontSize: '20px', color: 'var(--color-text-muted)', zIndex: 10 }}
                            >
                                search
                            </span>
                            <style>
                                {`
                                    input[type="text"].search-input-override {
                                        padding-left: 50px !important;
                                    }
                                `}
                            </style>
                            <input
                                type="text"
                                placeholder="Buscar alumno, email, celular..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pr-4 py-3 min-h-[48px] text-base md:text-sm outline-none transition-all placeholder:text-gray-500 rounded-lg search-input-override"
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    color: 'var(--color-text-primary)',
                                    border: '1px solid transparent'
                                } as React.CSSProperties}
                                onFocus={e => { e.target.style.borderColor = 'var(--color-border-strong)'; e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                                onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                            />
                        </div>
                    </div>
                </div>

                {/* Content View */}
                {isLoading ? (
                    <div className="p-10 text-center">Cargando...</div>
                ) : filteredStudents.length === 0 ? (
                    <EmptyState title={emptyTitle} description={emptyDesc} action={<button onClick={handleCreate} className="text-primary font-bold">Crear Alumno</button>} />
                ) : (
                    <>
                        {viewMode === 'grid' && (
                            <MotionDiv variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                {filteredStudents.map((student) => (
                                    <MotionDiv key={student.id} variants={itemVariants}
                                        className="p-5 sm:p-6 flex flex-col gap-4 group hover:-translate-y-1 transition-all relative overflow-hidden"
                                        style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px' }}
                                        onClick={() => handleViewDetails(student)}>

                                        <div className="absolute top-4 right-4 px-2.5 py-1 rounded-sm text-[10px] md:text-[9px] font-bold uppercase tracking-wider"
                                            style={getStatusStyle(student.status)}>
                                            {getStatusLabel(student.status)}
                                        </div>

                                        <div className="flex gap-4 items-center mt-1">
                                            <div className="relative flex-shrink-0">
                                                <Avatar src={student.avatarUrl} name={student.name} className="size-14 sm:size-16 rounded-full text-xl font-bold" />
                                                <div className="absolute inset-0 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.05)' }}></div>
                                            </div>
                                            <div className="flex-1 min-w-0 pr-16 py-1">
                                                <h3 className="text-base sm:text-base font-bold leading-tight truncate" style={{ color: 'var(--color-text-primary)' }}>{student.name}</h3>
                                                <p className="text-xs md:text-[11px] font-semibold uppercase tracking-wider mt-1.5" style={{ color: 'var(--color-brand)' }}>{student.rank}</p>
                                            </div>
                                        </div>

                                        <div className="text-sm md:text-xs space-y-2 mt-2 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                            <p className="flex items-center gap-3" style={{ color: 'var(--color-text-secondary)' }}>
                                                <span className="material-symbols-outlined text-[16px] md:text-[14px]" style={{ color: 'var(--color-text-muted)' }}>smartphone</span>
                                                <span>{student.cellPhone}</span>
                                            </p>
                                            <p className="flex items-center gap-3 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                                <span className="material-symbols-outlined text-[16px] md:text-[14px]" style={{ color: 'var(--color-text-muted)' }}>supervisor_account</span>
                                                <span className="truncate">{student.guardian.fullName}</span>
                                            </p>
                                        </div>
                                    </MotionDiv>
                                ))}
                            </MotionDiv>
                        )}

                        {viewMode === 'table' && (
                            <div className="overflow-hidden mt-4">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left min-w-[800px]" style={{ borderCollapse: 'collapse' }}>
                                        <thead style={{ borderBottom: '1px solid var(--color-border-strong)', backgroundColor: 'transparent' }}>
                                            <tr>
                                                {['Alumno', 'Contacto', 'Responsable', 'Estado', 'Saldo', 'Acciones'].map((header, i) => (
                                                    <th key={header} className={`px-5 py-4 text-xs md:text-[10px] font-black uppercase tracking-wider ${i >= 4 ? 'text-right' : ''}`} style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <MotionTbody variants={containerVariants} initial="hidden" animate="show">
                                            {filteredStudents.map((student, idx) => (
                                                <MotionTr variants={itemVariants} key={student.id}
                                                    className="group cursor-pointer transition-colors"
                                                    onClick={() => handleViewDetails(student)}
                                                    style={{ borderBottom: idx === filteredStudents.length - 1 ? 'none' : '1px solid var(--color-border-subtle)' }}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                                                >
                                                    <td className="px-5 py-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative flex-shrink-0">
                                                                <Avatar src={student.avatarUrl} name={student.name} className="size-11 rounded-full text-sm font-bold shadow-sm" />
                                                                <div className="absolute inset-0 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.1)' }}></div>
                                                            </div>
                                                            <div>
                                                                <p className="text-base md:text-sm font-bold truncate max-w-[180px]" style={{ color: 'var(--color-text-primary)' }}>{student.name}</p>
                                                                <p className="text-xs md:text-[10px] uppercase font-semibold tracking-wider mt-1 truncate max-w-[180px]" style={{ color: 'var(--color-brand)' }}>{student.rank}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-5">
                                                        <p className="text-base md:text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{student.cellPhone}</p>
                                                        <p className="text-xs md:text-[11px] truncate max-w-[180px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{student.email}</p>
                                                    </td>
                                                    <td className="px-5 py-5">
                                                        <p className="text-base md:text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{student.guardian.fullName}</p>
                                                        <div className="flex items-center gap-1.5 text-xs md:text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                            <span className="material-symbols-outlined text-[10px]">phone</span>
                                                            {student.guardian.phones.main}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-5">
                                                        <span className="px-2.5 py-1 rounded-sm text-[10px] md:text-[9px] font-bold uppercase tracking-wider" style={getStatusStyle(student.status)}>
                                                            {getStatusLabel(student.status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-5 text-right">
                                                        <span className="font-semibold text-base md:text-sm tracking-wide" style={{ color: student.balance > 0 ? 'var(--color-brand)' : 'var(--color-text-primary)' }}>
                                                            ${student.balance.toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-5 text-right">
                                                        <div className="flex justify-end gap-2 md:gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={(e) => handleEdit(student, e)} className="p-2 md:p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center rounded-md transition-colors blur-0" style={{ color: 'var(--color-text-muted)' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}><span className="material-symbols-outlined text-[18px]">edit</span></button>
                                                            <button onClick={(e) => handleCredentialsEdit(student, e)} className="p-2 md:p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center rounded-md transition-colors blur-0" title="Actualizar Claves" style={{ color: 'var(--color-text-muted)' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#60a5fa'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}><span className="material-symbols-outlined text-[18px]">key</span></button>
                                                            <button onClick={(e) => handleDelete(student.id, e)} className="p-2 md:p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center rounded-md transition-colors blur-0" style={{ color: 'var(--color-text-muted)' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-glow)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                                        </div>
                                                    </td>
                                                </MotionTr>
                                            ))}
                                        </MotionTbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* --- CREATE / EDIT MODAL --- */}
            {showModal && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
                    <div className="rounded-2xl w-full max-w-5xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[95vh] border" style={{ backgroundColor: 'var(--color-bg-app)', borderColor: 'var(--color-border-strong)' }}>
                        <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-border-subtle)' }}>
                            <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>{editingStudent ? 'Editar Expediente' : 'Nuevo Ingreso'}</h2>
                            <button onClick={() => setShowModal(false)} className="transition-colors" style={{ color: 'var(--color-text-muted)' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* --- DATOS DEL ALUMNO --- */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] border-b pb-2 mb-4" style={{ color: 'var(--color-brand)', borderColor: 'rgba(255,255,255,0.05)' }}>Datos Personales del Alumno</h3>

                                <div className="grid grid-cols-1 gap-5">
                                    <label className="block">
                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Nombre Completo *</span>
                                        <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="Nombre y Apellidos" />
                                    </label>

                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>F. Nacimiento</span>
                                            <input type="date" value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all style-calendar-dark" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} />
                                        </label>
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Edad</span>
                                            <input type="number" value={formData.age || ''} onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="Años" />
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Peso (kg)</span>
                                            <input type="number" step="0.1" value={formData.weight || ''} onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="0.0" />
                                        </label>
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Estatura (cm)</span>
                                            <input type="number" value={formData.height || ''} onChange={e => setFormData({ ...formData, height: parseInt(e.target.value) })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="000" />
                                        </label>
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>T. Sangre</span>
                                            <select value={formData.bloodType || ''} onChange={e => setFormData({ ...formData, bloodType: e.target.value })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }}>
                                                <option value="">--</option>
                                                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </label>
                                    </div>

                                    <label className="block">
                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Email Principal *</span>
                                        <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="correo@ejemplo.com" />
                                    </label>

                                    <label className="block">
                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Celular Personal *</span>
                                        <input required type="tel" value={formData.cellPhone} onChange={e => setFormData({ ...formData, cellPhone: e.target.value })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="10 dígitos" />
                                    </label>

                                    {!editingStudent && (
                                        <label className="block relative">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Contraseña Inicial *</span>
                                            <div className="relative mt-1">
                                                <input required type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="block w-full rounded-xl p-3 pr-10 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="Mínimo 6 caracteres" />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                                                    <span className="material-symbols-outlined text-[18px] hover:text-white transition-colors">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                                </button>
                                            </div>
                                        </label>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Rango Académico</span>
                                            <select value={formData.rank} onChange={e => setFormData({ ...formData, rank: e.target.value })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }}>
                                                {academySettings.ranks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Estado Administrativo</span>
                                            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }}>
                                                <option value="active">Activo</option>
                                                <option value="debtor">Adeudo</option>
                                                <option value="exam_ready">Examen Listo</option>
                                                <option value="inactive">Inactivo</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* --- DATOS DEL TUTOR / RESPONSABLE --- */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] border-b pb-2 mb-4" style={{ color: 'var(--color-text-primary)', borderColor: 'rgba(255,255,255,0.05)' }}>Información del Responsable</h3>

                                <div className="p-6 rounded-2xl border space-y-5" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'var(--color-border-subtle)' }}>
                                    <label className="block">
                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Nombre del Tutor *</span>
                                        <input required value={formData.guardian.fullName} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, fullName: e.target.value } })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="Nombre completo" />
                                    </label>

                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Parentesco</span>
                                            <select value={formData.guardian.relationship} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, relationship: e.target.value } })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }}>
                                                {['Padre', 'Madre', 'Tutor Legal', 'Familiar', 'Otro'].map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Email Tutor</span>
                                            <input type="email" value={formData.guardian.email || ''} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, email: e.target.value } })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="ejemplo@correo.com" />
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Tel. Principal *</span>
                                            <input required type="tel" value={formData.guardian.phones.main} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, phones: { ...formData.guardian.phones, main: e.target.value } } })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="10 dígitos" />
                                        </label>
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Tel. Secundario</span>
                                            <input type="tel" value={formData.guardian.phones.secondary || ''} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, phones: { ...formData.guardian.phones, secondary: e.target.value } } })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="Opcional" />
                                        </label>
                                        <label className="block">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Tel. Extra</span>
                                            <input type="tel" value={formData.guardian.phones.tertiary || ''} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, phones: { ...formData.guardian.phones, tertiary: e.target.value } } })} className="mt-1 block w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} placeholder="Emergencias" />
                                        </label>
                                    </div>

                                    <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                        <span className="text-[10px] font-black uppercase tracking-widest mb-3 block" style={{ color: 'var(--color-text-muted)' }}>Dirección de Domicilio</span>
                                        <div className="grid grid-cols-12 gap-3">
                                            <div className="col-span-8">
                                                <input placeholder="Calle" value={formData.guardian.address.street} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, address: { ...formData.guardian.address, street: e.target.value } } })} className="w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} />
                                            </div>
                                            <div className="col-span-4">
                                                <input placeholder="No. Ext" value={formData.guardian.address.exteriorNumber} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, address: { ...formData.guardian.address, exteriorNumber: e.target.value } } })} className="w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} />
                                            </div>
                                            <div className="col-span-4">
                                                <input placeholder="Int." value={formData.guardian.address.interiorNumber || ''} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, address: { ...formData.guardian.address, interiorNumber: e.target.value } } })} className="w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} />
                                            </div>
                                            <div className="col-span-5">
                                                <input placeholder="Colonia" value={formData.guardian.address.colony} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, address: { ...formData.guardian.address, colony: e.target.value } } })} className="w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} />
                                            </div>
                                            <div className="col-span-3">
                                                <input placeholder="CP" value={formData.guardian.address.zipCode} onChange={e => setFormData({ ...formData, guardian: { ...formData.guardian, address: { ...formData.guardian.address, zipCode: e.target.value } } })} className="w-full rounded-xl p-3 text-sm focus:ring-1 outline-none transition-all" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderStyle: 'solid', borderWidth: '1px', color: 'var(--color-text-primary)' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 flex flex-col md:flex-row justify-end gap-4 pt-6 md:pt-8 border-t" style={{ borderColor: 'var(--color-border-strong)' }}>
                                <button type="button" onClick={() => setShowModal(false)} disabled={isSubmitting} className="min-h-[48px] px-8 rounded-xl border font-bold hover:bg-white/5 transition-all uppercase tracking-widest text-sm md:text-xs disabled:opacity-50 w-full md:w-auto" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>Cancelar</button>
                                <button type="submit" disabled={isSubmitting} className="min-h-[48px] px-10 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover shadow-lg transition-all active:scale-95 uppercase tracking-widest text-sm md:text-xs disabled:opacity-50 flex items-center justify-center gap-2 w-full md:w-auto" style={{ backgroundColor: 'var(--color-brand)' }}>
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Guardando...
                                        </>
                                    ) : (
                                        'Finalizar y Guardar'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* --- FULL PAGE REDESIGNED STUDENT DETAIL --- */}
            <StudentDetailModal
                isOpen={!!reactiveViewingStudent}
                student={reactiveViewingStudent}
                onClose={() => setViewingStudent(null)}
                onEdit={(s) => handleEdit(s)}
                financialRecords={studentFinancialRecords}
            />

            {/* --- CREDENTIALS UPDATE MODAL --- */}
            <UpdateCredentialsModal
                isOpen={!!credentialsStudent}
                student={credentialsStudent}
                onClose={() => setCredentialsStudent(null)}
            />
        </div>
    );
};

export default StudentsList;
