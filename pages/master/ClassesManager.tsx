
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { ClassCategory, SessionModification, Event } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, dateFnsLocalizer, Views, Messages } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';

const locales = { 'es': es };
const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales,
});

const messagesEs: Messages = {
    allDay: 'Todo el día',
    previous: '<',
    next: '>',
    today: 'Hoy',
    month: 'Mensual',
    week: 'Semanal',
    day: 'Día',
    agenda: 'Anual (Agenda)',
    date: 'Fecha',
    time: 'Hora',
    event: 'Actividad',
    noEventsInRange: 'No hay actividades en este rango.',
    showMore: total => `+ Ver más (${total})`
};

const calendarStyles = `
@import url('https://cdn.jsdelivr.net/npm/react-big-calendar@1.8.5/lib/css/react-big-calendar.css');

.rbc-calendar { font-family: 'Inter', sans-serif; color: #111827; }
.rbc-header { padding: 12px 0; font-weight: 800; font-size: 11px; text-transform: uppercase; color: #6B7280; border-bottom: 1px solid #F3F4F6; }
.rbc-today { background-color: #FAFAFA; }
.rbc-event { border-radius: 6px; padding: 3px 6px; border: none; font-size: 11px; font-weight: 700; color: white; }
.rbc-toolbar { margin-bottom: 20px; }
.rbc-toolbar button { border-radius: 8px; font-weight: 600; text-transform: capitalize; border-color: #E5E7EB; color: #4B5563; }
.rbc-toolbar button.rbc-active { background-color: #111827; color: white; border-color: #111827; }
.rbc-toolbar button:hover:not(.rbc-active) { background-color: #F3F4F6; }
.rbc-time-view .rbc-event { border: 1px solid rgba(255,255,255,0.2); }
`;

const ClassesManager: React.FC = () => {
    const { classes, events, addClass, updateClass, deleteClass, modifyClassSession, addEvent } = useStore();
    const { addToast } = useToast();
    const { confirm } = useConfirmation();
    const navigate = useNavigate();

    // -- GLOBAL STATES --
    const [activeTab, setActiveTab] = useState<'classes' | 'events' | 'calendar'>('classes');

    // -- CLASS MODALS --
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingClassId, setEditingClassId] = useState<string | null>(null);

    // -- EVENT MANAGEMENT STATES --
    const [showEventModal, setShowEventModal] = useState(false);

    // Forms - Class
    const [classForm, setClassForm] = useState({
        name: '', instructor: '', selectedDays: [] as string[], startTime: '17:00', endTime: '18:15'
    });

    const [sessionForm, setSessionForm] = useState({
        newInstructor: '',
        newStartTime: '',
        newEndTime: '',
        newDate: ''
    });

    // Forms - Event
    const [eventForm, setEventForm] = useState({
        title: '',
        date: '',
        time: '',
        type: 'exam' as Event['type'],
        description: '',
        capacity: 50,
        isVisibleToStudents: true // Default to true
    });

    const daysOptions = [
        { key: 'Monday', label: 'Lun', full: 'Lunes' },
        { key: 'Tuesday', label: 'Mar', full: 'Martes' },
        { key: 'Wednesday', label: 'Mie', full: 'Miércoles' },
        { key: 'Thursday', label: 'Jue', full: 'Jueves' },
        { key: 'Friday', label: 'Vie', full: 'Viernes' },
        { key: 'Saturday', label: 'Sab', full: 'Sábado' },
        { key: 'Sunday', label: 'Dom', full: 'Domingo' },
    ];

    // --- CRUD HELPERS ---

    const resetClassForm = () => {
        setClassForm({ name: '', instructor: '', selectedDays: [], startTime: '17:00', endTime: '18:15' });
        setEditingClassId(null);
    };

    const handleOpenEditClass = (cls: ClassCategory) => {
        setClassForm({
            name: cls.name,
            instructor: cls.instructor,
            selectedDays: cls.days,
            startTime: cls.startTime,
            endTime: cls.endTime
        });
        setEditingClassId(cls.id);
        setShowCreateModal(true);
    };

    const toggleDay = (dayKey: string) => {
        if (classForm.selectedDays.includes(dayKey)) {
            setClassForm(prev => ({ ...prev, selectedDays: prev.selectedDays.filter(d => d !== dayKey) }));
        } else {
            setClassForm(prev => ({ ...prev, selectedDays: [...prev.selectedDays, dayKey] }));
        }
    };

    const handleSaveClass = (e: React.FormEvent) => {
        e.preventDefault();
        if (classForm.selectedDays.length === 0) return addToast("Selecciona al menos un día.", 'error');
        if (classForm.startTime >= classForm.endTime) return addToast("Hora inicio debe ser antes del fin.", 'error');

        const dayLabels = classForm.selectedDays.map(d => daysOptions.find(opt => opt.key === d)?.label).join('/');
        const scheduleString = `${dayLabels} ${classForm.startTime}`;

        const commonData = {
            name: classForm.name,
            schedule: scheduleString,
            days: classForm.selectedDays,
            startTime: classForm.startTime,
            endTime: classForm.endTime,
            instructor: classForm.instructor,
        };

        if (editingClassId) {
            const original = classes.find(c => c.id === editingClassId);
            if (original) {
                updateClass({ ...original, ...commonData });
            }
        } else {
            addClass({
                id: '', academyId: '', studentCount: 0, studentIds: [], modifications: [],
                ...commonData
            });
        }
        setShowCreateModal(false);
        resetClassForm();
    };

    const handleCreateEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventForm.title || !eventForm.date) return;

        const start = new Date(`${eventForm.date}T${eventForm.time}`);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration default

        let color = '#3b82f6'; // class blue
        if (eventForm.type === 'exam') color = '#8b5cf6'; // purple
        else if (eventForm.type === 'tournament') color = '#f97316'; // orange
        else if (eventForm.type === 'seminar') color = '#db2777'; // pink

        addEvent({
            id: '', // generated by store
            academyId: '',
            title: eventForm.title,
            date: eventForm.date,
            time: eventForm.time,
            type: eventForm.type,
            description: eventForm.description,
            registeredCount: 0,
            capacity: eventForm.capacity,
            isVisibleToStudents: eventForm.isVisibleToStudents, // Pass visibility
            // Missing props from Event (extends CalendarEvent)
            start,
            end,
            color,
            instructorName: 'Evento', // Optional/Default
            instructor: 'Evento',
            status: 'active'
        });

        setEventForm({ title: '', date: '', time: '', type: 'exam', description: '', capacity: 50, isVisibleToStudents: true });
        setShowEventModal(false);
    };

    const handleDeleteClass = (id: string) => {
        confirm({
            title: 'Eliminar Clase',
            message: '¿Estás seguro de eliminar esta clase? Se perderá el historial de sesiones futuras.',
            type: 'danger',
            onConfirm: () => deleteClass(id)
        });
    };

    // --- MASTER CALENDAR DATA GENERATION ---
    const masterEventsForCalendar = useMemo(() => {
        const eventsList: any[] = [];
        const today = new Date();
        const startOfCal = new Date(today.getFullYear() - 1, 0, 1); // 1 yr past
        const endOfCal = new Date(today.getFullYear() + 2, 0, 1);   // 2 yrs future

        const dayNameMap: Record<number, string> = {
            0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday'
        };

        // 1. Convert Recurrent Classes into individual events
        classes.forEach(cls => {
            let currentDate = new Date(startOfCal);
            while (currentDate <= endOfCal) {
                const dayName = dayNameMap[currentDate.getDay()];
                if (cls.days.includes(dayName)) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const mod = cls.modifications?.find(m => m.date === dateStr);

                    if (mod?.type !== 'cancel' && mod?.type !== 'move') {
                        const startH = mod?.newStartTime || cls.startTime;
                        const endH = mod?.newEndTime || cls.endTime;

                        const [sH, sM] = startH.split(':').map(Number);
                        const [eH, eM] = endH.split(':').map(Number);

                        const startDate = new Date(currentDate);
                        startDate.setHours(sH, sM, 0);

                        const endDate = new Date(currentDate);
                        endDate.setHours(eH, eM, 0);

                        eventsList.push({
                            id: `cls-${cls.id}-${dateStr}`,
                            title: cls.name + (mod ? ' (Modificada)' : ''),
                            start: startDate,
                            end: endDate,
                            color: mod ? '#10B981' : '#3B82F6', // Blue default, green if modified
                            resource: cls
                        });
                    }
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            // Handle forced move instances
            cls.modifications?.filter(m => m.type === 'move' && m.newDate).forEach(mod => {
                const [y, mth, d] = mod.newDate!.split('-').map(Number);
                const [sH, sM] = (mod.newStartTime || cls.startTime).split(':').map(Number);
                const [eH, eM] = (mod.newEndTime || cls.endTime).split(':').map(Number);

                const startDate = new Date(y, mth - 1, d, sH, sM, 0);
                const endDate = new Date(y, mth - 1, d, eH, eM, 0);

                eventsList.push({
                    id: `cls-${cls.id}-moved-${mod.newDate}`,
                    title: cls.name + ' (Movida)',
                    start: startDate,
                    end: endDate,
                    color: '#8B5CF6',
                    resource: cls
                });
            });
        });

        // 2. Add Special Events & Seminars
        events.forEach(ev => {
            const [y, mth, d] = ev.date.split('-').map(Number);
            const [h, m] = ev.time.split(':').map(Number);

            const startDate = new Date(y, mth - 1, d, h, m, 0);
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // roughly 1 hr

            // Assign color by type
            let color = '#F97316'; // orange default (tournament)
            if (ev.type === 'exam') color = '#9333EA'; // purple
            else if (ev.type === 'seminar') color = '#EC4899'; // pink

            eventsList.push({
                id: `evt-${ev.id}`,
                title: ev.title + ` (${ev.type === 'exam' ? 'Examen' : ev.type === 'seminar' ? 'Seminario' : 'Torneo'})`,
                start: startDate,
                end: endDate,
                color,
                resource: ev
            });
        });

        return eventsList;
    }, [classes, events]);

    const getEventTypeLabel = (type: string) => {
        switch (type) {
            case 'exam': return { label: 'Examen de Grado', color: 'bg-purple-100 text-purple-700', icon: 'workspace_premium' };
            case 'tournament': return { label: 'Torneo', color: 'bg-orange-100 text-orange-700', icon: 'emoji_events' };
            case 'seminar': return { label: 'Seminario', color: 'bg-blue-100 text-blue-700', icon: 'school' };
            default: return { label: 'Evento', color: 'bg-gray-100 text-gray-700', icon: 'event' };
        }
    };

    // --- RENDER ---

    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto w-full h-full flex flex-col font-sans relative">
            {/* Header with Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-text-main">Gestión de Horarios</h1>
                    <p className="text-text-secondary mt-1 text-lg">Define clases regulares y eventos especiales.</p>
                </div>

                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
                    <button
                        onClick={() => setActiveTab('classes')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'classes' ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:text-text-main hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                        Clases
                    </button>
                    <button
                        onClick={() => setActiveTab('events')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'events' ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:text-text-main hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">trophy</span>
                        Eventos y Seminarios
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:text-text-main hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">event_note</span>
                        Calendario
                    </button>
                </div>
            </div>
            <style>{calendarStyles}</style>

            {/* --- CLASSES TAB CONTENT --- */}
            {activeTab === 'classes' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => { resetClassForm(); setShowCreateModal(true); }}
                            className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/25 flex items-center gap-2 transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined">add</span>
                            Nueva Clase
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {classes.map(cls => (
                            <div key={cls.id} className="bg-white p-6 rounded-[2rem] shadow-card border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all group relative flex flex-col">
                                {/* Actions */}
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button onClick={() => handleOpenEditClass(cls)} className="size-9 bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-full flex items-center justify-center transition-colors shadow-sm">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button onClick={() => handleDeleteClass(cls.id)} className="size-9 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-full flex items-center justify-center transition-colors shadow-sm">
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>

                                <div className="mb-5 mt-2">
                                    <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 text-primary flex items-center justify-center shadow-sm mb-4">
                                        <span className="material-symbols-outlined text-4xl">sports_martial_arts</span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-text-main mb-1 truncate leading-tight">{cls.name}</h3>
                                    <p className="text-sm text-text-secondary font-medium">{cls.instructor}</p>
                                </div>

                                <div className="space-y-3 mb-8">
                                    <div className="flex items-center gap-3 text-sm text-text-secondary">
                                        <div className="size-8 rounded-full bg-gray-50 flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">schedule</span></div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-text-main">{cls.days.map(d => d.substring(0, 3)).join(', ')}</span>
                                            <span className="text-xs">{cls.startTime} - {cls.endTime}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-text-secondary">
                                        <div className="size-8 rounded-full bg-gray-50 flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">groups</span></div>
                                        <span className="font-medium">{cls.studentIds?.length || 0} Alumnos Inscritos</span>
                                    </div>
                                </div>

                                <div className="mt-auto flex flex-col gap-3">
                                    {/* BUTTON 1: ALUMNOS / ASISTENCIA */}
                                    <button
                                        onClick={() => navigate(`/master/attendance/${cls.id}`)}
                                        className="w-full py-3.5 rounded-xl border-2 border-gray-100 bg-white text-text-main font-bold hover:bg-gray-50 hover:border-gray-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                    >
                                        <span className="material-symbols-outlined text-primary">groups</span>
                                        Alumnos y Asistencia
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- EVENTS TAB CONTENT (Updated Card Design) --- */}
            {activeTab === 'events' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => setShowEventModal(true)}
                            className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/25 flex items-center gap-2 transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined">add_circle</span>
                            Publicar Nuevo Evento
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.length === 0 ? (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-text-secondary bg-white rounded-3xl border border-dashed border-gray-300">
                                <span className="material-symbols-outlined text-6xl opacity-20 mb-4">emoji_events</span>
                                <h3 className="text-xl font-bold text-text-main">No hay eventos programados</h3>
                                <p className="max-w-md text-center mt-2">Crea torneos, exámenes de grado o seminarios para que tus alumnos se inscriban.</p>
                            </div>
                        ) : (
                            events.map(event => {
                                const typeInfo = getEventTypeLabel(event.type);
                                const percentFull = Math.min(((event.registeredCount || 0) / event.capacity) * 100, 100);

                                return (
                                    <div key={event.id} className="bg-white p-6 rounded-[2rem] shadow-card border border-gray-100 flex flex-col relative group hover:shadow-xl transition-all">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex gap-4">
                                                <div className="flex flex-col items-center justify-center w-16 h-16 bg-gray-50 rounded-2xl border border-gray-200 shrink-0">
                                                    <span className="text-xs font-bold text-red-500 uppercase">{new Date(event.date).toLocaleString('es-ES', { month: 'short' })}</span>
                                                    <span className="text-2xl font-black text-text-main leading-none">{new Date(event.date).getDate()}</span>
                                                </div>
                                                <div>
                                                    <div className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1 ${typeInfo.color}`}>
                                                        <span className="material-symbols-outlined text-[12px]">{typeInfo.icon}</span>
                                                        {typeInfo.label}
                                                    </div>
                                                    <h3 className="text-xl font-bold text-text-main leading-tight line-clamp-1">{event.title}</h3>
                                                    <p className="text-sm text-text-secondary mt-0.5 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">schedule</span> {event.time}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Privacy Badge */}
                                            {event.isVisibleToStudents === false && (
                                                <div className="absolute top-6 right-6" title="Evento Privado (Solo Invitación)">
                                                    <span className="bg-gray-100 text-gray-500 p-1.5 rounded-full flex items-center justify-center border border-gray-200">
                                                        <span className="material-symbols-outlined text-sm">visibility_off</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Capacity Progress */}
                                        <div className="mb-6">
                                            <div className="flex justify-between text-xs font-bold text-text-secondary mb-1">
                                                <span>Cupo</span>
                                                <span className={`${percentFull >= 100 ? 'text-red-500' : 'text-text-main'}`}>{event.registeredCount || 0} / {event.capacity}</span>
                                            </div>
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${percentFull >= 100 ? 'bg-red-500' : 'bg-primary'}`}
                                                    style={{ width: `${percentFull}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Updated: Button Navigates to Full Page */}
                                        <button
                                            onClick={() => navigate(`/master/event/${event.id}`)}
                                            className="mt-auto w-full py-3 rounded-xl border border-gray-200 bg-white text-text-main font-bold hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                        >
                                            <span className="material-symbols-outlined">settings</span>
                                            Gestionar Evento
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* --- CALENDAR TAB CONTENT --- */}
            {activeTab === 'calendar' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:p-10 h-[800px]">
                    <Calendar
                        localizer={localizer}
                        events={masterEventsForCalendar}
                        messages={messagesEs}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: '100%' }}
                        views={['month', 'week', 'agenda']}
                        defaultView={Views.MONTH}
                        eventPropGetter={(event: any) => ({
                            style: {
                                backgroundColor: event.color,
                            }
                        })}
                    />
                </div>
            )}

            {/* --- GLOBAL EDIT CLASS MODAL --- */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 text-text-main">
                            {editingClassId ? 'Configuración General de Clase' : 'Crear Nueva Clase'}
                        </h2>
                        <form onSubmit={handleSaveClass} className="flex flex-col gap-5">
                            <input required value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" placeholder="Nombre de la Clase" />

                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase mb-2 block">Días Recurrentes</label>
                                <div className="flex flex-wrap gap-2">
                                    {daysOptions.map(day => (
                                        <button
                                            key={day.key}
                                            type="button"
                                            onClick={() => toggleDay(day.key)}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${classForm.selectedDays.includes(day.key)
                                                    ? 'bg-primary text-white border-primary shadow-md'
                                                    : 'bg-white text-text-secondary border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <input required type="time" value={classForm.startTime} onChange={e => setClassForm({ ...classForm, startTime: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" />
                                <input required type="time" value={classForm.endTime} onChange={e => setClassForm({ ...classForm, endTime: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" />
                            </div>

                            <input required value={classForm.instructor} onChange={e => setClassForm({ ...classForm, instructor: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" placeholder="Instructor por Defecto" />

                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => { setShowCreateModal(false); resetClassForm(); }} className="flex-1 py-3 rounded-xl border border-gray-300 font-bold text-text-secondary">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-lg transition-all">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- GLOBAL NEW EVENT MODAL --- */}
            {showEventModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 text-text-main">
                            Publicar Nuevo Evento
                        </h2>
                        <form onSubmit={handleCreateEvent} className="flex flex-col gap-5">
                            <input required value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" placeholder="Nombre del Evento (ej. Torneo de Invierno)" />

                            <div className="grid grid-cols-2 gap-4">
                                <select value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value as any })} className="w-full rounded-xl border-gray-300 p-3 text-sm bg-white">
                                    <option value="exam">Examen de Grado</option>
                                    <option value="tournament">Torneo</option>
                                    <option value="seminar">Seminario</option>
                                </select>
                                <input required type="number" min="1" value={eventForm.capacity} onChange={e => setEventForm({ ...eventForm, capacity: parseInt(e.target.value) })} className="w-full rounded-xl border-gray-300 p-3 text-sm" placeholder="Capacidad Max" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <input required type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" />
                                <input required type="time" value={eventForm.time} onChange={e => setEventForm({ ...eventForm, time: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" />
                            </div>

                            <textarea required value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" placeholder="Detalles del evento, requisitos, ubicación..." rows={3} />

                            {/* VISIBILITY TOGGLE */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                                <div>
                                    <span className="block text-sm font-bold text-text-main">Visible para Alumnos</span>
                                    <span className="text-xs text-gray-500">Permitir que los alumnos se inscriban desde su dashboard.</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={eventForm.isVisibleToStudents}
                                        onChange={e => setEventForm({ ...eventForm, isVisibleToStudents: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setShowEventModal(false)} className="flex-1 py-3 rounded-xl border border-gray-300 font-bold text-text-secondary">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-lg transition-all">Publicar Evento</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassesManager;
