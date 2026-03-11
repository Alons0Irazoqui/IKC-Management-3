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
        <div className="w-full min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] p-10">
            <span className="material-symbols-outlined text-4xl text-gray-300 mb-4 tracking-wider">error</span>
            <p className="text-gray-500 font-medium">Evento no encontrado</p>
        </div>
    );

    return (
        <div className="w-full bg-[#FAFAFA] font-sans min-h-screen">
            {/* Enterprise Header Section */}
            <header className="bg-white border-b border-gray-200 px-6 py-8 md:px-10 lg:px-12 w-full">
                <div className="max-w-[1240px] mx-auto w-full">
                    {/* Back Breadcrumb */}
                    <button
                        onClick={() => navigate('/master/schedule')}
                        className="group flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors mb-6 w-fit"
                    >
                        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
                        Volver al Calendario
                    </button>

                    <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-8 relative">
                        {/* Event Info */}
                        <div className="flex-1 min-w-0 z-10">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                                <span className={`px-2.5 py-1 rounded text-[11px] font-bold tracking-wide uppercase border ${event.type === 'exam' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    event.type === 'tournament' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                        'bg-sky-50 text-sky-700 border-sky-200'
                                    }`}>
                                    <span className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${event.type === 'exam' ? 'bg-amber-500' : event.type === 'tournament' ? 'bg-indigo-600' : 'bg-sky-500'}`}></span>
                                        {event.type === 'exam' ? 'Exámenes' : event.type === 'tournament' ? 'Torneo Oficial' : 'Evento'}
                                    </span>
                                </span>
                                {event.isVisibleToStudents === false && (
                                    <span className="bg-gray-100 px-2.5 py-1 rounded text-[11px] font-medium tracking-wide border border-gray-200 flex items-center gap-1 text-gray-600">
                                        <span className="material-symbols-outlined text-[14px]">lock</span> Privado
                                    </span>
                                )}
                            </div>

                            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 tracking-tight mb-4 leading-tight break-words">
                                {event.title}
                            </h1>

                            <div className="flex flex-wrap gap-5 text-sm text-gray-500 font-medium">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-red-600/80 text-[18px]">calendar_today</span>
                                    <span>{new Date(event.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-red-600/80 text-[18px]">schedule</span>
                                    <span>{event.time}</span>
                                </div>
                            </div>
                        </div>

                        {/* Event Stats Row */}
                        <div className="flex flex-wrap sm:flex-nowrap gap-4 shrink-0 mt-2 lg:mt-0 z-10 w-full sm:w-auto">
                            <div className="bg-white border text-left border-gray-200 rounded-xl p-5 flex-1 sm:min-w-[140px] relative overflow-hidden">
                                <p className="text-[12px] text-gray-500 font-semibold mb-1">Capacidad</p>
                                <p className="text-2xl font-semibold text-gray-900">{event.capacity}</p>
                            </div>
                            <div className="bg-white border text-left border-gray-200 rounded-xl p-5 flex-1 sm:min-w-[140px] relative overflow-hidden">
                                <p className="text-[12px] text-gray-500 font-semibold mb-1">Inscritos</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-2xl font-semibold text-emerald-600">{event.registrants?.length || 0}</p>
                                    <span className="text-sm font-medium text-gray-400">({stats.fill}%)</span>
                                </div>
                            </div>
                            <div className="bg-white border text-left border-gray-200 rounded-xl p-5 flex-1 sm:min-w-[140px] relative overflow-hidden">
                                <p className="text-[12px] text-gray-500 font-semibold mb-1">Disponibles</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.spots}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Sub-Header Tabs */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20 w-full pt-2 px-6 md:px-10 lg:px-12">
                <div className="max-w-[1240px] mx-auto flex gap-8">
                    <button
                        onClick={() => setActiveTab('attendees')}
                        className={`pb-4 text-[14px] font-medium border-b-[2px] transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'attendees'
                            ? 'border-red-600 text-red-600'
                            : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[18px] opacity-80">groups</span>
                        Padrón de Atletas
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`pb-4 text-[14px] font-medium border-b-[2px] transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'settings'
                            ? 'border-red-600 text-red-600'
                            : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[18px] opacity-80">settings</span>
                        Configuración
                    </button>
                </div>
            </div>

            {/* Main Content Area (Unconstrained Height) */}
            <main className="max-w-[1240px] mx-auto w-full px-4 md:px-10 lg:px-12 mt-8 pb-20">
                <div className="bg-white border border-gray-200 rounded-2xl">

                    {/* Attendees Tab */}
                    {activeTab === 'attendees' && (
                        <div className="w-full">
                            {/* Toolbar */}
                            <div className="p-5 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="relative w-full sm:max-w-md group">
                                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[20px] transition-colors">search</span>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-gray-900 placeholder:text-gray-500"
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
                                        className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors active:scale-95"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">payments</span>
                                        Generar Cargos
                                    </button>
                                    <button
                                        onClick={() => { setShowEnrollModal(true); setStudentToEnroll(''); }}
                                        className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors active:scale-95"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                                        Inscribir Alumno
                                    </button>
                                </div>
                            </div>

                            {/* Table Container (Horizontal Scroll for Responsive Only) */}
                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead className="bg-[#FAFAFA] border-b border-gray-200">
                                        <tr>
                                            <th className="px-8 py-4 text-[12px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">Perfil del Atleta</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">Grado Actual</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">Estatus Financiero</th>
                                            <th className="px-8 py-4 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">Opciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredRegistrants.map(student => (
                                            <tr key={student.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-8 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <Avatar src={student.avatarUrl} name={student.name} className="w-10 h-10 text-[14px] rounded-full border border-gray-200 bg-white" />
                                                        <div>
                                                            <p className="font-medium text-gray-900 text-[14px]">{student.name}</p>
                                                            <p className="text-[13px] text-gray-500">{student.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex px-2.5 py-1 bg-white text-gray-700 text-[13px] font-medium rounded border border-gray-200">
                                                        {student.rank}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {student.balance > 0 ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-red-700 bg-red-50/50 px-2.5 py-1 rounded border border-red-100">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                            Adeudo ${student.balance.toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 bg-emerald-50/50 px-2.5 py-1 rounded border border-emerald-100">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                            Al corriente
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-4 text-right">
                                                    <button
                                                        onClick={() => handleRemoveStudent(student.id)}
                                                        className="w-9 h-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center ml-auto transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 cursor-pointer"
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
                                                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                                        <span className="material-symbols-outlined text-3xl text-gray-300">group_off</span>
                                                    </div>
                                                    <p className="font-medium text-gray-900 text-[15px]">Sin atletas inscritos</p>
                                                    <p className="text-[14px] text-gray-500 mt-1 mb-4">No hay participantes registrados para este evento en este momento.</p>
                                                    <button
                                                        onClick={() => { setShowEnrollModal(true); setStudentToEnroll(''); }}
                                                        className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors inline-block"
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
                                <div className="border-b border-gray-100 pb-5 mb-6">
                                    <h3 className="text-xl font-semibold text-gray-900 tracking-tight">
                                        Configuración del Evento
                                    </h3>
                                    <p className="text-[14px] text-gray-500 mt-1">Modifica los detalles públicos y privados de este evento en el sistema.</p>
                                </div>

                                <div>
                                    <label className="block text-[12px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Nombre Oficial del Evento</label>
                                    <input
                                        value={editForm.title}
                                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 font-medium text-gray-900 transition-all outline-none"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-[12px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Fecha Programada</label>
                                        <input
                                            type="date"
                                            value={editForm.date}
                                            onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 text-gray-900 transition-all outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[12px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Horario Inicial</label>
                                        <input
                                            type="time"
                                            value={editForm.time}
                                            onChange={e => setEditForm({ ...editForm, time: e.target.value })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 text-gray-900 transition-all outline-none"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[12px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Descripción / Indicaciones Adicionales</label>
                                    <textarea
                                        rows={4}
                                        value={editForm.description}
                                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 text-gray-900 resize-none transition-all outline-none"
                                        placeholder="Reglamentación especial, sede, u otros requisitos..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                    <div>
                                        <label className="block text-[12px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Límite de Cupos</label>
                                        <input
                                            type="number"
                                            value={editForm.capacity}
                                            onChange={e => setEditForm({ ...editForm, capacity: parseInt(e.target.value) })}
                                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-[15px] focus:border-red-500 focus:ring-1 focus:ring-red-500 text-gray-900 transition-all outline-none"
                                            min="1"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="group flex items-center justify-between cursor-pointer p-3.5 bg-white border border-gray-300 rounded-lg w-full hover:border-red-400 transition-colors h-[50px]">
                                            <span className="block text-[14px] font-medium text-gray-900">Mostrar en portal de alumnos</span>
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.isVisibleToStudents !== false}
                                                    onChange={e => setEditForm({ ...editForm, isVisibleToStudents: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-red-600 transition-colors duration-300 ease-in-out"></div>
                                                <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 peer-checked:translate-x-[16px]"></div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="pt-6 mt-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={handleDeleteEvent}
                                        className="w-full sm:w-auto text-red-600 font-medium text-[14px] hover:text-red-700 hover:bg-red-50 px-5 py-2.5 rounded-lg transition-colors text-center"
                                    >
                                        Eliminar Evento
                                    </button>
                                    <button
                                        type="submit"
                                        className="w-full sm:w-auto bg-gray-900 text-white px-8 py-2.5 rounded-lg text-[14px] font-medium hover:bg-gray-800 transition-colors active:scale-95 text-center"
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
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-md p-7 shadow-xl relative">
                        <button
                            onClick={() => setShowEnrollModal(false)}
                            className="absolute top-5 right-5 text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 hover:bg-gray-100 p-1.5 rounded-full cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                                <span className="material-symbols-outlined text-[20px]">person_add</span>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900">Inscribir Alumno</h3>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[13px] font-medium text-gray-700 mb-2">Buscar Atleta en Padrón</label>
                                <div className="border border-gray-200 rounded-lg bg-gray-50/50 p-1">
                                    <StudentSearch
                                        students={students}
                                        value={studentToEnroll}
                                        onChange={setStudentToEnroll}
                                        placeholder="Escribe un nombre..."
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={handleEnrollStudent}
                                    className="w-full py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors active:scale-95 text-[15px] cursor-pointer"
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
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-md p-7 shadow-xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowChargeModal(false)}
                            className="absolute top-5 right-5 text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 hover:bg-gray-100 p-1.5 rounded-full cursor-pointer z-10"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>

                        <div className="flex items-center gap-3 mb-6 pr-8">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-800 shrink-0">
                                <span className="material-symbols-outlined text-[20px]">payments</span>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900">Generar Cargos</h3>
                        </div>

                        <div className="space-y-5">
                            <p className="text-[14px] text-gray-600 leading-relaxed">
                                Se generará un cargo manual por la cantidad especificada a todos los <strong>{registeredStudents.length} inscritos</strong> en el evento de forma automática.
                            </p>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <label className="block text-[12px] font-semibold text-gray-600 uppercase tracking-widest ml-1">Concepto del Cargo</label>
                                    <input
                                        type="text"
                                        value={chargeTitle}
                                        onChange={e => setChargeTitle(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:bg-white focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all font-semibold outline-none text-gray-900"
                                        placeholder="Ej. Torneo de Mazatlán"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[12px] font-semibold text-gray-600 uppercase tracking-widest ml-1">Descripción</label>
                                    <textarea
                                        rows={2}
                                        value={chargeDescription}
                                        onChange={e => setChargeDescription(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[14px] focus:bg-white focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all outline-none text-gray-900 resize-none"
                                        placeholder="Detalles sobre este cargo..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[12px] font-semibold text-gray-600 uppercase tracking-widest ml-1">Costo del Evento ($)</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={chargeAmount}
                                        onChange={e => setChargeAmount(e.target.value)}
                                        className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[15px] focus:bg-white focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all font-semibold outline-none text-gray-900"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[12px] font-semibold text-gray-600 uppercase tracking-widest ml-1">Recargo por Vencimiento ($) <span className="font-normal lowercase text-[10px] text-gray-400">Opcional</span></label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={chargePenalty}
                                        onChange={e => setChargePenalty(e.target.value)}
                                        className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[15px] focus:bg-white focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all font-semibold outline-none text-gray-900"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[12px] font-semibold text-gray-600 uppercase tracking-widest ml-1">Fecha Límite</label>
                                <input
                                    type="date"
                                    value={chargeDueDate}
                                    onChange={e => setChargeDueDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-[15px] focus:bg-white focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all font-medium outline-none text-gray-900"
                                />
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <span className="text-[14px] text-gray-700 font-medium group-hover:text-gray-900 transition-colors">Permitir pagos parciales</span>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={chargeCanBePaidInParts}
                                            onChange={e => setChargeCanBePaidInParts(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-gray-800 transition-colors duration-300 ease-in-out"></div>
                                        <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 peer-checked:translate-x-[16px]"></div>
                                    </div>
                                </label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={handleGenerateBulkCharges}
                                    disabled={registeredStudents.length === 0}
                                    className="flex-1 py-3 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors active:scale-95 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
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
