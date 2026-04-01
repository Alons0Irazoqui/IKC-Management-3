import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFinance } from '../../context/FinanceContext';
import { getLocalDate } from '../../utils/dateUtils';
import StudentSearch from '../../components/ui/StudentSearch';
import Avatar from '../../components/ui/Avatar';

const MasterEventDetail: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const { events, students, updateEvent, deleteEvent, updateEventRegistrants, registerForEvent } = useStore();
    const { addToast } = useToast();

    const event = events.find(e => e.id === eventId);

    // --- LOCAL STATE ---
    const [activeTab, setActiveTab] = useState<'attendees' | 'settings'>('attendees');
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Edit Form State
    const [editForm, setEditForm] = useState(event ? {
        title: event.title,
        date: event.date,
        time: event.time,
        description: event.description,
        capacity: event.capacity,
        isVisibleToStudents: event.isVisibleToStudents
    } : null);

    // Enroll Modal
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [studentToEnroll, setStudentToEnroll] = useState('');

    // Bulk Charge Modal
    const { createManualCharge } = useFinance();
    const [showChargeModal, setShowChargeModal] = useState(false);
    const [chargeAmount, setChargeAmount] = useState('');
    const [chargePenalty, setChargePenalty] = useState('');
    const [chargeDueDate, setChargeDueDate] = useState<string>(getLocalDate());
    const [chargeCanBePaidInParts, setChargeCanBePaidInParts] = useState(false);
    const [chargeTitle, setChargeTitle] = useState('');
    const [chargeDescription, setChargeDescription] = useState('');

    // --- DERIVED DATA ---
    const registeredStudents = useMemo(() => {
        if (!event) return [];
        return students.filter(s => event.registrants?.includes(s.id));
    }, [event, students]);

    const filteredRegistrants = useMemo(() => {
        return registeredStudents.filter(s =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.email.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [registeredStudents, searchQuery]);

    const stats = useMemo(() => {
        if (!event) return { fill: 0, spots: 0 };
        const count = event.registrants?.length || 0;
        return {
            fill: Math.round((count / event.capacity) * 100),
            spots: Math.max(0, event.capacity - count)
        };
    }, [event]);

    // --- ACTIONS ---

    const handleUpdateEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!event || !editForm) return;
        updateEvent({ ...event, ...editForm });
        setIsEditing(false);
        addToast('Evento actualizado correctamente', 'success');
    };

    const handleEnrollStudent = () => {
        if (!event || !studentToEnroll) return;
        if (event.registrants?.includes(studentToEnroll)) {
            addToast('El alumno ya está inscrito', 'error');
            return;
        }
        registerForEvent(studentToEnroll, event.id);
        setStudentToEnroll('');
        setShowEnrollModal(false);
        addToast('Alumno inscrito', 'success');
    };

    const handleRemoveStudent = (studentId: string) => {
        if (!event) return;
        const newRegistrants = event.registrants?.filter(id => id !== studentId) || [];
        updateEventRegistrants(event.id, newRegistrants);
        addToast('Alumno removido del evento', 'info');
    };

    const handleGenerateBulkCharges = () => {
        if (!event || registeredStudents.length === 0) {
            addToast('No hay alumnos inscritos', 'error');
            return;
        }
        if (!chargeAmount || parseFloat(chargeAmount) <= 0) {
            addToast('Ingresa un monto válido', 'error');
            return;
        }

        registeredStudents.forEach(student => {
            createManualCharge({
                studentId: student.id,
                category: event.type === 'tournament' ? 'Torneo' : event.type === 'exam' ? 'Examen/Promoción' : 'Otro',
                title: chargeTitle || event.title,
                description: chargeDescription,
                amount: parseFloat(chargeAmount),
                dueDate: chargeDueDate,
                canBePaidInParts: chargeCanBePaidInParts,
                relatedEventId: event.id,
                customPenaltyAmount: chargePenalty ? parseFloat(chargePenalty) : 0
            });
        });

        setShowChargeModal(false);
        addToast(`Se generaron ${registeredStudents.length} cargos exitosamente`, 'success');
    };

    const handleDeleteEvent = () => {
        if (!event) return;
        if (window.confirm('¿Estás seguro de eliminar este evento? Esta acción no se puede deshacer.')) {
            deleteEvent(event.id);
            navigate('/master/schedule');
        }
    };

    if (!event) return (
        <div className="w-full min-h-screen flex flex-col items-center justify-center bg-[#08080a] p-10">
            <span className="material-symbols-outlined text-4xl text-gray-700 mb-4 tracking-wider">error</span>
            <p className="text-gray-400 font-medium">Evento no encontrado</p>
        </div>
    );

    return (
        <div className="w-full bg-[#08080a] font-sans min-h-screen text-[#dde1e7]">
            {/* Enterprise Header Section */}
            <header className="bg-[#101014] border-b border-white/[0.06] px-6 py-8 md:px-10 lg:px-12 w-full">
                <div className="max-w-[1240px] mx-auto w-full">
                    {/* Back Breadcrumb */}
                    <button
                        onClick={() => navigate('/master/schedule')}
                        className="group flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-red-500 transition-colors mb-6 w-fit"
                    >
                        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
                        Volver al Calendario
                    </button>

                    <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-8 relative">
                        {/* Event Info */}
                        <div className="flex-1 min-w-0 z-10">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                                <span className={`px-2.5 py-1 rounded text-[11px] font-bold tracking-wide uppercase border ${event.type === 'exam' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                    event.type === 'tournament' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                        'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                    }`}>
                                    <span className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${event.type === 'exam' ? 'bg-amber-500' : event.type === 'tournament' ? 'bg-indigo-500' : 'bg-sky-500'}`}></span>
                                        {event.type === 'exam' ? 'Exámenes' : event.type === 'tournament' ? 'Torneo Oficial' : 'Evento'}
                                    </span>
                                </span>
                                {event.isVisibleToStudents === false && (
                                    <span className="bg-white/5 px-2.5 py-1 rounded text-[11px] font-medium tracking-wide border border-white/10 flex items-center gap-1 text-gray-400">
                                        <span className="material-symbols-outlined text-[14px]">lock</span> Privado
                                    </span>
                                )}
                            </div>

                            <h1 className="text-3xl md:text-4xl font-black text-[#dde1e7] tracking-tight mb-4 leading-tight break-words">
                                {event.title}
                            </h1>

                            <div className="flex flex-wrap gap-5 text-sm text-gray-400 font-medium">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-red-500/80 text-[18px]">calendar_today</span>
                                    <span>{new Date(event.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-red-500/80 text-[18px]">schedule</span>
                                    <span>{event.time}</span>
                                </div>
                            </div>
                        </div>

                        {/* Event Stats Row */}
                        <div className="flex flex-wrap sm:flex-nowrap gap-4 shrink-0 mt-2 lg:mt-0 z-10 w-full sm:w-auto">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex-1 sm:min-w-[140px] relative overflow-hidden backdrop-blur-sm">
                                <p className="text-[12px] text-gray-400 font-semibold mb-1">Capacidad</p>
                                <p className="text-2xl font-black text-[#dde1e7]">{event.capacity}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex-1 sm:min-w-[140px] relative overflow-hidden backdrop-blur-sm">
                                <p className="text-[12px] text-gray-400 font-semibold mb-1">Inscritos</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-2xl font-black text-emerald-400">{event.registrants?.length || 0}</p>
                                    <span className="text-sm font-medium text-gray-500">({stats.fill}%)</span>
                                </div>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex-1 sm:min-w-[140px] relative overflow-hidden backdrop-blur-sm">
                                <p className="text-[12px] text-gray-400 font-semibold mb-1">Disponibles</p>
                                <p className="text-2xl font-black text-[#dde1e7]">{stats.spots}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Sub-Header Tabs */}
            <div className="bg-[#101014] border-b border-white/[0.06] sticky top-0 z-20 w-full pt-2 px-6 md:px-10 lg:px-12 backdrop-blur-md bg-opacity-95">
                <div className="max-w-[1240px] mx-auto flex gap-8">
                    <button
                        onClick={() => setActiveTab('attendees')}
                        className={`pb-4 text-[14px] font-bold border-b-[2px] transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'attendees'
                            ? 'border-red-600 text-red-500'
                            : 'border-transparent text-gray-400 hover:text-[#dde1e7]'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[18px] opacity-80">groups</span>
                        Padrón de Atletas
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`pb-4 text-[14px] font-bold border-b-[2px] transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'settings'
                            ? 'border-red-600 text-red-500'
                            : 'border-transparent text-gray-400 hover:text-[#dde1e7]'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[18px] opacity-80">settings</span>
                        Configuración
                    </button>
                </div>
            </div>

            {/* Main Content Area (Unconstrained Height) */}
            <main className="max-w-[1240px] mx-auto w-full px-4 md:px-10 lg:px-12 mt-8 pb-20">
                <div className="bg-[#101014] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl shadow-black/40">

                    {/* Attendees Tab */}
                    {activeTab === 'attendees' && (
                        <div className="w-full">
                            {/* Toolbar */}
                            <div className="p-5 md:p-6 border-b border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="relative w-full sm:max-w-md group">
                                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-[20px] transition-colors">search</span>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:bg-white/10 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all text-[#dde1e7] placeholder:text-gray-500 outline-none"
                                        placeholder="Buscar atleta por nombre o correo..."
                                    />
                                </div>
                                <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={() => {
                                            if (event) {
                                                setChargeTitle(event.title);
                                                setChargeDescription(event.description || '');
                                            }
                                            setShowChargeModal(true);
                                        }}
                                        className="w-full sm:w-auto bg-[#dde1e7] hover:bg-white text-black px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors active:scale-95"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">payments</span>
                                        Generar Cargos
                                    </button>
                                    <button
                                        onClick={() => { setShowEnrollModal(true); setStudentToEnroll(''); }}
                                        className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-[0_4px_16px_rgba(225,29,72,0.3)]"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                                        Inscribir Alumno
                                    </button>
                                </div>
                            </div>

                            {/* Table Container (Horizontal Scroll for Responsive Only) */}
                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead className="bg-white/[0.02] border-b border-white/[0.06]">
                                        <tr>
                                            <th className="px-8 py-4 text-[11px] font-black text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">Perfil del Atleta</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">Grado Actual</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">Estatus Financiero</th>
                                            <th className="px-8 py-4 text-right text-[11px] font-black text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">Opciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {filteredRegistrants.map(student => (
                                            <tr key={student.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-8 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <Avatar src={student.avatarUrl} name={student.name} className="w-10 h-10 text-[14px] rounded-full border border-white/10 bg-[#121217]" />
                                                        <div>
                                                            <p className="font-bold text-[#dde1e7] text-[14px]">{student.name}</p>
                                                            <p className="text-[13px] text-gray-500">{student.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex px-2.5 py-1 bg-white/5 text-gray-300 text-[13px] font-bold rounded border border-white/10">
                                                        {student.rank}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {student.balance > 0 ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                                            Adeudo ${student.balance.toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                            Al corriente
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-4 text-right">
                                                    <button
                                                        onClick={() => handleRemoveStudent(student.id)}
                                                        className="w-9 h-9 rounded-lg text-gray-600 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center ml-auto transition-all focus:outline-none focus:ring-1 focus:ring-red-500/50 opacity-0 group-hover:opacity-100 cursor-pointer"
                                                        title="Revocar Inscripción"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">person_remove</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredRegistrants.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="py-20 text-center">
                                                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                                        <span className="material-symbols-outlined text-3xl" style={{ color: '#4b5563' }}>group_off</span>
                                                    </div>
                                                    <p className="font-bold text-[#dde1e7] text-[15px]">Sin atletas inscritos</p>
                                                    <p className="text-[14px] text-gray-500 mt-1 mb-4">No hay participantes registrados para este evento en este momento.</p>
                                                    <button
                                                        onClick={() => { setShowEnrollModal(true); setStudentToEnroll(''); }}
                                                        className="text-sm font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg transition-colors inline-block"
                                                    >
                                                        + Inscribir Nuevo Atleta
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Settings Tab */}
                    {activeTab === 'settings' && editForm && (
                        <div className="w-full">
                            <form onSubmit={handleUpdateEvent} className="p-6 md:p-10 lg:p-12 max-w-4xl mx-auto space-y-8">
                                <div className="border-b border-white/[0.04] pb-5 mb-6">
                                    <h3 className="text-xl font-black text-[#dde1e7] tracking-tight">
                                        Configuración del Evento
                                    </h3>
                                    <p className="text-[14px] text-gray-500 mt-1">Modifica los detalles públicos y privados de este evento en el sistema.</p>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Nombre Oficial del Evento</label>
                                    <input
                                        value={editForm.title}
                                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-[#18181d] px-4 py-3 text-[15px] focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 font-bold text-[#dde1e7] transition-all outline-none"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Fecha Programada</label>
                                        <input
                                            type="date"
                                            value={editForm.date}
                                            onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                            className="w-full rounded-xl border border-white/10 bg-[#18181d] px-4 py-3 text-[15px] focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-[#dde1e7] font-bold transition-all outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Horario Inicial</label>
                                        <input
                                            type="time"
                                            value={editForm.time}
                                            onChange={e => setEditForm({ ...editForm, time: e.target.value })}
                                            className="w-full rounded-xl border border-white/10 bg-[#18181d] px-4 py-3 text-[15px] focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-[#dde1e7] font-bold transition-all outline-none"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Descripción / Indicaciones Adicionales</label>
                                    <textarea
                                        rows={4}
                                        value={editForm.description}
                                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                        className="w-full rounded-xl border border-white/10 bg-[#18181d] px-4 py-3 text-[15px] focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-[#dde1e7] font-bold resize-none transition-all outline-none"
                                        placeholder="Reglamentación especial, sede, u otros requisitos..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                    <div>
                                        <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Límite de Cupos</label>
                                        <input
                                            type="number"
                                            value={editForm.capacity}
                                            onChange={e => setEditForm({ ...editForm, capacity: parseInt(e.target.value) })}
                                            className="w-full rounded-xl border border-white/10 bg-[#18181d] px-4 py-3 text-[15px] focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-[#dde1e7] font-bold transition-all outline-none"
                                            min="1"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="group flex items-center justify-between cursor-pointer p-3.5 bg-white/5 border border-white/10 rounded-xl w-full hover:border-red-500/30 transition-colors h-[52px]">
                                            <span className="block text-[14px] font-bold text-[#dde1e7]">Mostrar en portal de alumnos</span>
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.isVisibleToStudents !== false}
                                                    onChange={e => setEditForm({ ...editForm, isVisibleToStudents: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-10 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:bg-red-600 transition-colors duration-300 ease-in-out"></div>
                                                <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 peer-checked:translate-x-[16px]"></div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="pt-6 mt-4 border-t border-white/[0.04] flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={handleDeleteEvent}
                                        className="w-full sm:w-auto text-red-500 font-bold text-[14px] hover:text-red-400 hover:bg-red-500/10 px-5 py-2.5 rounded-xl transition-colors text-center"
                                    >
                                        Eliminar Evento
                                    </button>
                                    <button
                                        type="submit"
                                        className="w-full sm:w-auto bg-red-600 text-white px-8 py-2.5 rounded-xl text-[14px] font-bold hover:bg-red-700 transition-colors active:scale-95 text-center shadow-[0_4px_16px_rgba(225,29,72,0.3)]"
                                    >
                                        Guardar Configuraciones
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </main>

            {/* --- ENROLL MODAL --- */}
            {showEnrollModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#121217] rounded-3xl w-full max-w-md p-8 shadow-2xl relative border border-white/10">
                        <button
                            onClick={() => setShowEnrollModal(false)}
                            className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-full cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>

                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
                                <span className="material-symbols-outlined text-[24px]">person_add</span>
                            </div>
                            <h3 className="text-2xl font-black text-[#dde1e7]">Inscribir Alumno</h3>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2.5">Buscar Atleta en Padrón</label>
                                <div className="border border-white/10 rounded-xl bg-white/5 p-1">
                                    <StudentSearch
                                        students={students}
                                        value={studentToEnroll}
                                        onChange={setStudentToEnroll}
                                        placeholder="Escribe un nombre..."
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleEnrollStudent}
                                    className="w-full py-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all active:scale-95 text-[15px] cursor-pointer shadow-[0_4px_16px_rgba(225,29,72,0.3)]"
                                >
                                    Confirmar Inscripción
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- BULK CHARGE MODAL --- */}
            {showChargeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#121217] rounded-3xl w-full max-w-md p-8 shadow-2xl relative border border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button
                            onClick={() => setShowChargeModal(false)}
                            className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-full cursor-pointer z-10"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>

                        <div className="flex items-center gap-3 mb-8 pr-12">
                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-[#dde1e7] shrink-0">
                                <span className="material-symbols-outlined text-[24px]">payments</span>
                            </div>
                            <h3 className="text-2xl font-black text-[#dde1e7]">Generar Cargos</h3>
                        </div>

                        <div className="space-y-6">
                            <p className="text-[14px] text-gray-400 leading-relaxed font-medium">
                                Se generará un cargo manual por la cantidad especificada a todos los <strong className="text-red-500">{registeredStudents.length} inscritos</strong> en el evento de forma automática.
                            </p>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Concepto del Cargo</label>
                                    <input
                                        type="text"
                                        value={chargeTitle}
                                        onChange={e => setChargeTitle(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#18181d] border border-white/10 rounded-xl text-[14px] focus:bg-[#18181d] focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all font-bold outline-none text-[#dde1e7]"
                                        placeholder="Ej. Torneo de Mazatlán"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Descripción</label>
                                    <textarea
                                        rows={2}
                                        value={chargeDescription}
                                        onChange={e => setChargeDescription(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#18181d] border border-white/10 rounded-xl text-[14px] focus:bg-[#18181d] focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all outline-none text-[#dde1e7] font-bold resize-none"
                                        placeholder="Detalles sobre este cargo..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Costo del Evento ($)</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 font-black">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={chargeAmount}
                                        onChange={e => setChargeAmount(e.target.value)}
                                        className="w-full pl-8 pr-4 py-3 bg-[#18181d] border border-white/10 rounded-xl text-[15px] focus:bg-[#18181d] focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all font-black outline-none text-[#dde1e7]"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Recargo por Vencimiento ($) <span className="font-normal lowercase text-[10px] text-gray-600">Opcional</span></label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 font-black">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={chargePenalty}
                                        onChange={e => setChargePenalty(e.target.value)}
                                        className="w-full pl-8 pr-4 py-3 bg-[#18181d] border border-white/10 rounded-xl text-[15px] focus:bg-[#18181d] focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all font-black outline-none text-[#dde1e7]"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Fecha Límite</label>
                                <input
                                    type="date"
                                    value={chargeDueDate}
                                    onChange={e => setChargeDueDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#18181d] border border-white/10 rounded-xl text-[15px] focus:bg-[#18181d] focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all font-bold outline-none text-[#dde1e7]"
                                />
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center justify-between cursor-pointer group p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                                    <span className="text-[14px] text-gray-300 font-bold group-hover:text-[#dde1e7] transition-colors">Permitir pagos parciales</span>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={chargeCanBePaidInParts}
                                            onChange={e => setChargeCanBePaidInParts(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-10 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:bg-red-600 transition-colors duration-300 ease-in-out"></div>
                                        <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 peer-checked:translate-x-[16px]"></div>
                                    </div>
                                </label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={handleGenerateBulkCharges}
                                    disabled={registeredStudents.length === 0}
                                    className="flex-1 py-4 rounded-xl bg-red-600 text-white font-black hover:bg-red-700 transition-all active:scale-95 text-[14px] shadow-[0_4px_16px_rgba(225,29,72,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    Generar {registeredStudents.length} Cargos
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MasterEventDetail;
