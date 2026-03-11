
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { ClassCategory, SessionModification, Event, CalendarEvent } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    format, startOfWeek, addDays, isSameDay,
    startOfMonth, endOfMonth, eachDayOfInterval, endOfWeek, isSameMonth,
    addMonths, addWeeks, isAfter
} from 'date-fns';
import { es } from 'date-fns/locale';
import YearView from '../../components/calendar/YearView';

// ---- Custom Calendar Helpers ----
const CAL_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CAL_DAYS_SHORT = ['Lun', 'Mar', 'MiÃƒÂ©', 'Jue', 'Vie', 'SÃƒÂ¡b', 'Dom'];
const CAL_COLORS = [
    { color: '#3B82F6', label: 'Clases' },
    { color: '#10B981', label: 'Modificadas' },
    { color: '#8B5CF6', label: 'Movidas' },
    { color: '#9333EA', label: 'ExÃƒÂ¡menes' },
    { color: '#F97316', label: 'Torneos' },
    { color: '#EC4899', label: 'Seminarios' },
];
function calSameDay(a: Date, b: Date) {
    return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}
function calDaysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate();
}
// Fix: Use local date string instead of ISO to avoid UTC offset issues
function localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ClassesManager: React.FC = () => {
    const { classes, events, addClass, updateClass, deleteClass, modifyClassSession, addEvent } = useStore();
    const { addToast } = useToast();
    const { confirm } = useConfirmation();
    const navigate = useNavigate();

    // -- GLOBAL STATES --
    const [activeTab, setActiveTab] = useState<'classes' | 'events'>('classes');

    // -- CLASS MODALS --
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingClassId, setEditingClassId] = useState<string | null>(null);

    // -- EVENT MANAGEMENT STATES --
    const [showEventModal, setShowEventModal] = useState(false);

    // -- FULL SCREEN CALENDAR STATE --
    const [showFullCalendar, setShowFullCalendar] = useState(false);

    // -- CALENDAR CONTROLLED STATE --
    const [calView, setCalView] = useState<'annual' | 'monthly' | 'weekly'>('annual');
    const [calDate, setCalDate] = useState(new Date());

    // -- SESSION MODAL STATE (Calendar click-to-edit) --
    const [sessionModal, setSessionModal] = useState<{
        open: boolean;
        view: 'menu' | 'edit' | 'confirm_cancel';
        classId: string;
        className: string;
        date: string; // YYYY-MM-DD
        currentStartTime: string;
        currentEndTime: string;
        currentInstructor: string;
        editForm: { newDate: string; newStartTime: string; newEndTime: string; newInstructor: string; };
    } | null>(null);

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

    // -- SESSION MODAL HANDLERS --
    const openSessionModal = (ev: any) => {
        if (!ev.resource?.id || ev.resource?.type) return; // Only classes, not events/seminars
        const cls = classes.find(c => c.id === ev.resource.id);
        if (!cls) return;
        // Use LOCAL date to avoid UTC timezone offset shifting the date
        const dateStr = ev.start instanceof Date ? localDateStr(ev.start) : String(ev.start).split('T')[0];
        const existingMod = cls.modifications?.find(m => m.date === dateStr);
        setSessionModal({
            open: true,
            view: 'menu',
            classId: cls.id,
            className: cls.name,
            date: dateStr,
            currentStartTime: existingMod?.newStartTime || cls.startTime,
            currentEndTime: existingMod?.newEndTime || cls.endTime,
            currentInstructor: existingMod?.newInstructor || cls.instructor,
            editForm: {
                newDate: existingMod?.newDate || dateStr,
                newStartTime: existingMod?.newStartTime || cls.startTime,
                newEndTime: existingMod?.newEndTime || cls.endTime,
                newInstructor: existingMod?.newInstructor || cls.instructor,
            }
        });
    };

    const handleSaveSessionEdit = async () => {
        if (!sessionModal) return;
        const { classId, date, editForm } = sessionModal;
        const isDateChanged = editForm.newDate && editForm.newDate !== date;
        await modifyClassSession(classId, {
            date,
            type: isDateChanged ? 'move' : 'time',
            newStartTime: editForm.newStartTime,
            newEndTime: editForm.newEndTime,
            newInstructor: editForm.newInstructor,
            newDate: isDateChanged ? editForm.newDate : undefined,
        });
        setSessionModal(null);
    };

    const handleCancelSession = async () => {
        if (!sessionModal) return;
        const { classId, date } = sessionModal;
        await modifyClassSession(classId, { date, type: 'cancel' });
        setSessionModal(null);
    };

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
        { key: 'Wednesday', label: 'Mie', full: 'MiÃƒÂ©rcoles' },
        { key: 'Thursday', label: 'Jue', full: 'Jueves' },
        { key: 'Friday', label: 'Vie', full: 'Viernes' },
        { key: 'Saturday', label: 'Sab', full: 'SÃƒÂ¡bado' },
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
        if (classForm.selectedDays.length === 0) return addToast("Selecciona al menos un dÃƒÂ­a.", 'error');
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
            message: 'Ã‚Â¿EstÃƒÂ¡s seguro de eliminar esta clase? Se perderÃƒÂ¡ el historial de sesiones futuras.',
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
                    <h1 className="text-4xl font-black tracking-tight text-text-main">GestiÃƒÂ³n de Horarios</h1>
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
                </div>
                {/* Calendar Quick Access */}
                <button
                    onClick={() => setShowFullCalendar(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                >
                    <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
                    Ver Calendario
                </button>
            </div>


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
                                    {/* BUTTON 2: GESTIONAR CALENDARIO */}
                                    <button
                                        onClick={() => setShowFullCalendar(true)}
                                        className="w-full py-3.5 rounded-xl border-2 border-indigo-100 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                    >
                                        <span className="material-symbols-outlined text-indigo-500">calendar_month</span>
                                        Gestionar Calendario
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
                                <p className="max-w-md text-center mt-2">Crea torneos, exÃƒÂ¡menes de grado o seminarios para que tus alumnos se inscriban.</p>
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
                                                <div className="absolute top-6 right-6" title="Evento Privado (Solo InvitaciÃƒÂ³n)">
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

            {/* ============================================================= */}
            {/* ========== FULL-SCREEN CALENDAR OVERLAY (StudentSchedule style) */}
            {/* ============================================================= */}
            {showFullCalendar && (() => {

                // --- Convert master events to CalendarEvent format ---
                const calEvents: CalendarEvent[] = masterEventsForCalendar.map((ev: any) => ({
                    id: ev.id,
                    title: ev.title,
                    start: ev.start instanceof Date ? ev.start : new Date(ev.start),
                    end: ev.end instanceof Date ? ev.end : new Date(ev.end),
                    type: ev.resource?.type ? ev.resource.type : 'class',
                    classId: ev.resource?.id,
                    instructor: ev.resource?.instructor || ev.resource?.instructorName || '',
                    status: 'active' as const,
                    color: ev.color,
                    description: ev.resource?.description || '',
                    instructorName: ev.resource?.instructor || '',
                    academyId: '',
                }));

                // Also add cancelled sessions
                classes.forEach(cls => {
                    cls.modifications?.forEach(mod => {
                        if (mod.type === 'cancel') {
                            const [y, mth, d] = mod.date.split('-').map(Number);
                            const [sH, sM] = cls.startTime.split(':').map(Number);
                            const [eH, eM] = cls.endTime.split(':').map(Number);
                            const startD = new Date(y, mth - 1, d, sH, sM, 0);
                            const endD = new Date(y, mth - 1, d, eH, eM, 0);
                            calEvents.push({
                                id: `cancelled-${cls.id}-${mod.date}`,
                                title: cls.name,
                                start: startD,
                                end: endD,
                                type: 'class',
                                classId: cls.id,
                                instructor: cls.instructor,
                                status: 'cancelled' as const,
                                color: '#9CA3AF',
                                description: '',
                                instructorName: cls.instructor,
                                academyId: '',
                            });
                        }
                    });
                });

                type CalViewType = 'year' | 'month' | 'week' | 'day';

                // Inner component using hooks
                const MasterCalendarInner = () => {
                    const [calView2, setCalView2] = useState<CalViewType>('month');
                    const [calDate2, setCalDate2] = useState(new Date());
                    const [selectedEvent2, setSelectedEvent2] = useState<CalendarEvent | null>(null);
                    const [isEventModal2, setIsEventModal2] = useState(false);
                    const [drawerState2, setDrawerState2] = useState<{ isOpen: boolean; date: Date | null; events: CalendarEvent[] }>({
                        isOpen: false, date: null, events: []
                    });

                    const handleEventClick2 = (evt: CalendarEvent) => {
                        if (evt.type === 'class' && evt.status !== 'cancelled') {
                            // Open session modal for editable classes
                            openSessionModal({ ...evt, resource: { id: evt.classId } });
                        } else {
                            setSelectedEvent2(evt);
                            setIsEventModal2(true);
                        }
                    };

                    const handleDayClick2 = (d: Date, dayEvts: CalendarEvent[]) => {
                        setDrawerState2({ isOpen: true, date: d, events: dayEvts });
                    };

                    const handleNavigate2 = (direction: 'PREV' | 'NEXT' | 'TODAY') => {
                        const now = new Date();
                        if (direction === 'TODAY') { setCalDate2(now); return; }
                        const amt = direction === 'NEXT' ? 1 : -1;
                        switch (calView2) {
                            case 'year': setCalDate2(prev => new Date(prev.getFullYear() + amt, prev.getMonth(), 1)); break;
                            case 'month': setCalDate2(prev => addMonths(prev, amt)); break;
                            case 'week': setCalDate2(prev => addWeeks(prev, amt)); break;
                            case 'day': setCalDate2(prev => addDays(prev, amt)); break;
                        }
                    };

                    const headerTitle2 = useMemo(() => {
                        switch (calView2) {
                            case 'year': return format(calDate2, 'yyyy');
                            case 'month': return format(calDate2, 'MMMM yyyy', { locale: es });
                            case 'week': {
                                const start = startOfWeek(calDate2, { weekStartsOn: 1 });
                                const end = endOfWeek(calDate2, { weekStartsOn: 1 });
                                if (isSameMonth(start, end)) return `${format(start, 'd')} - ${format(end, 'd')} ${format(start, 'MMMM', { locale: es })}`;
                                return `${format(start, 'd MMM')} - ${format(end, 'd MMM', { locale: es })}`;
                            }
                            case 'day': return format(calDate2, 'd MMMM', { locale: es });
                            default: return '';
                        }
                    }, [calView2, calDate2]);

                    // --- Month Grid ---
                    const MonthGrid = () => {
                        const days = useMemo(() => {
                            const monthStart = startOfMonth(calDate2);
                            const monthEnd = endOfMonth(calDate2);
                            const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
                            const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
                            return eachDayOfInterval({ start: startDate, end: endDate });
                        }, []);
                        const weekDays = ['Dom', 'Lun', 'Mar', 'MiÃ©', 'Jue', 'Vie', 'SÃ¡b'];
                        return (
                            <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
                                <div className="grid grid-cols-7 py-3 shrink-0 bg-white border-b border-gray-100 z-10 shadow-sm">
                                    {weekDays.map(day => (
                                        <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">{day}</div>
                                    ))}
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-7 auto-rows-fr bg-gray-50 gap-px border-b border-gray-100 min-h-[600px]">
                                        {days.map((day) => {
                                            const dayEvts = calEvents.filter(e => isSameDay(e.start, day)).sort((a, b) => a.start.getTime() - b.start.getTime());
                                            const isToday = isSameDay(day, new Date());
                                            const isCurrentMonth = isSameMonth(day, calDate2);
                                            return (
                                                <div key={day.toISOString()} onClick={() => handleDayClick2(day, dayEvts)}
                                                    className={`min-h-[120px] p-2 cursor-pointer transition-colors hover:bg-blue-50/30 flex flex-col items-center gap-1 ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'}`}
                                                >
                                                    <div className={`size-7 flex items-center justify-center rounded-full text-xs font-bold transition-all ${
                                                        isToday ? 'bg-red-600 text-white shadow-md' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                                                    }`}>{format(day, 'd')}</div>
                                                    <div className="w-full flex flex-col gap-1 mt-1">
                                                        {dayEvts.slice(0, 3).map(evt => (
                                                            <div key={evt.id} onClick={e => { e.stopPropagation(); handleEventClick2(evt); }}
                                                                className={`w-full px-2 py-1 rounded-md text-[9px] font-bold truncate transition-transform hover:scale-[1.02] shadow-sm border-l-2 ${
                                                                    evt.status === 'cancelled'
                                                                        ? 'bg-gray-100 text-gray-400 line-through border-gray-300'
                                                                        : 'bg-white text-gray-700 border-red-500 hover:bg-red-50'
                                                                }`}
                                                            >{evt.title}</div>
                                                        ))}
                                                        {dayEvts.length > 3 && (
                                                            <div className="text-[9px] font-bold text-gray-400 text-center bg-gray-50 rounded py-0.5">+ {dayEvts.length - 3} mÃ¡s</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    };

                    // --- Week View ---
                    const WeekView = () => {
                        const weekDays2 = useMemo(() => {
                            const start = startOfWeek(calDate2, { weekStartsOn: 1 });
                            return Array.from({ length: 7 }, (_, i) => addDays(start, i));
                        }, []);
                        return (
                            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-7 min-h-full divide-y md:divide-y-0 md:divide-x divide-gray-100">
                                    {weekDays2.map(day => {
                                        const dayEvts = calEvents.filter(e => isSameDay(e.start, day)).sort((a, b) => a.start.getTime() - b.start.getTime());
                                        const isToday = isSameDay(day, new Date());
                                        return (
                                            <div key={day.toISOString()} className="flex flex-col relative bg-white">
                                                <div className={`sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-50 py-3 text-center transition-colors ${isToday ? 'bg-red-50/30' : ''}`}>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{format(day, 'EEE', { locale: es })}</p>
                                                    <div className={`mx-auto size-8 flex items-center justify-center rounded-full mt-1 ${isToday ? 'bg-red-600 text-white shadow-md' : 'text-gray-900 font-black'}`}>
                                                        <span className="text-lg leading-none">{format(day, 'd')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-3 p-3 flex-1 min-h-[100px]">
                                                    {dayEvts.length > 0 ? dayEvts.map(evt => (
                                                        <div key={evt.id} onClick={() => handleEventClick2(evt)}
                                                            className={`p-3 rounded-lg border-l-[3px] cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group active:scale-95 ${
                                                                evt.status === 'cancelled' ? 'bg-gray-50 border-gray-300 opacity-60' : 'bg-white border-red-500 shadow-sm ring-1 ring-gray-100'
                                                            }`}
                                                        >
                                                            <p className={`text-xs font-bold leading-tight ${evt.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{evt.title}</p>
                                                            <div className="flex items-center gap-1 mt-1.5">
                                                                <span className="material-symbols-outlined text-[10px] text-gray-400">schedule</span>
                                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">{format(evt.start, 'HH:mm')}</p>
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div className="hidden md:flex flex-1 flex-col items-center justify-center opacity-10">
                                                            <div className="h-full w-px bg-gray-100 border-l border-dashed border-gray-300"></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    };

                    // --- Day View ---
                    const DayView = () => {
                        const dayEvts = useMemo(() => calEvents.filter(e => isSameDay(e.start, calDate2)).sort((a, b) => a.start.getTime() - b.start.getTime()), []);
                        return (
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                                <div className="max-w-3xl mx-auto w-full p-6 md:p-10 animate-in fade-in zoom-in-95 duration-300">
                                    <h3 className="text-3xl font-black text-gray-900 mb-8 capitalize flex items-center gap-3">
                                        <span className="w-1.5 h-8 bg-red-600 rounded-full"></span>
                                        {format(calDate2, 'EEEE d, MMMM', { locale: es })}
                                    </h3>
                                    {dayEvts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50">
                                            <div className="size-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                                                <span className="material-symbols-outlined text-4xl opacity-30 text-gray-400">self_improvement</span>
                                            </div>
                                            <p className="text-lg font-bold text-gray-500">Sin sesiones</p>
                                            <p className="text-sm opacity-60">No hay clases ni eventos este dÃ­a.</p>
                                        </div>
                                    ) : (
                                        <div className="relative border-l border-gray-100 ml-4 space-y-8 py-2">
                                            {dayEvts.map(evt => (
                                                <div key={evt.id} onClick={() => handleEventClick2(evt)} className="relative pl-8 group cursor-pointer">
                                                    <div className={`absolute -left-[5px] top-4 size-2.5 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-100 transition-colors ${evt.status === 'cancelled' ? 'bg-gray-300' : 'bg-red-600 group-hover:scale-125'}`}></div>
                                                    <div className={`flex items-center gap-6 p-6 rounded-2xl border transition-all hover:shadow-lg hover:-translate-y-1 bg-white ${
                                                        evt.status === 'cancelled' ? 'border-gray-100 opacity-60 grayscale bg-gray-50' : 'border-gray-100 hover:border-red-100'
                                                    }`}>
                                                        <div className="flex flex-col items-center min-w-[60px] text-center">
                                                            <span className="text-lg font-black text-gray-900 leading-none">{format(evt.start, 'HH:mm')}</span>
                                                            <span className="text-xs font-bold text-gray-400 mt-1">{format(evt.end, 'HH:mm')}</span>
                                                        </div>
                                                        <div className="w-px h-10 bg-gray-100"></div>
                                                        <div className="flex-1">
                                                            <h4 className={`text-xl font-bold ${evt.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-900 group-hover:text-red-700 transition-colors'}`}>{evt.title}</h4>
                                                            <div className="flex items-center gap-3 mt-1.5">
                                                                <span className="text-sm text-gray-500 font-medium flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md">
                                                                    <span className="material-symbols-outlined text-sm">person</span>
                                                                    {evt.instructor}
                                                                </span>
                                                                {evt.status === 'cancelled' && (
                                                                    <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-red-100">Cancelada</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="size-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                                                            <span className="material-symbols-outlined">chevron_right</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    };

                    // --- Day Drawer ---
                    const DayDrawer = () => (
                        <AnimatePresence>
                            {drawerState2.isOpen && drawerState2.date && (
                                <>
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        onClick={() => setDrawerState2(p => ({ ...p, isOpen: false }))}
                                        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[220]"
                                    />
                                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                                        className="fixed inset-y-0 right-0 z-[230] w-full max-w-md bg-white shadow-2xl flex flex-col"
                                    >
                                        <div className="p-8 border-b border-gray-100 flex justify-between items-start bg-white shrink-0">
                                            <div>
                                                <h2 className="text-3xl font-black text-gray-900 tracking-tight capitalize">{format(drawerState2.date, 'EEEE', { locale: es })}</h2>
                                                <p className="text-gray-500 font-medium text-lg capitalize">{format(drawerState2.date, 'd MMMM yyyy', { locale: es })}</p>
                                            </div>
                                            <button onClick={() => setDrawerState2(p => ({ ...p, isOpen: false }))} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
                                            {drawerState2.events.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                                                    <span className="material-symbols-outlined text-6xl opacity-20 mb-4">event_busy</span>
                                                    <p className="font-medium">No hay actividades programadas.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-6 relative">
                                                    <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-gray-100"></div>
                                                    {drawerState2.events.map(evt => (
                                                        <div key={evt.id} onClick={() => { setDrawerState2(p => ({ ...p, isOpen: false })); handleEventClick2(evt); }}
                                                            className="relative pl-10 group cursor-pointer"
                                                        >
                                                            <div className={`absolute left-2 top-2 size-6 rounded-full border-4 border-white shadow-sm z-10 box-content ${evt.status === 'cancelled' ? 'bg-gray-300' : 'bg-red-600'}`}></div>
                                                            <div className={`p-5 rounded-2xl border transition-all ${evt.status === 'cancelled' ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100 hover:border-red-100 hover:shadow-lg hover:shadow-red-500/5'}`}>
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <span className={`text-xs font-bold uppercase tracking-wider ${evt.status === 'cancelled' ? 'text-gray-400' : 'text-red-600'}`}>
                                                                        {format(evt.start, 'HH:mm')} - {format(evt.end, 'HH:mm')}
                                                                    </span>
                                                                </div>
                                                                <h3 className={`font-bold text-lg leading-tight mb-1 ${evt.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{evt.title}</h3>
                                                                <p className="text-sm text-gray-500">{evt.instructor}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    );

                    // --- Event Detail Modal ---
                    const EvtModal = () => {
                        if (!isEventModal2 || !selectedEvent2) return null;
                        const isCancelled = selectedEvent2.status === 'cancelled';
                        return (
                            <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200" onClick={() => setIsEventModal2(false)}>
                                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative border border-gray-100" onClick={e => e.stopPropagation()}>
                                    <div className={`h-32 ${isCancelled ? 'bg-red-500' : 'bg-gray-900'} relative overflow-hidden flex items-center justify-center`}>
                                        <div className="absolute inset-0 opacity-10">
                                            <div className="absolute -top-10 -right-10 size-40 bg-white rounded-full blur-3xl"></div>
                                            <div className="absolute bottom-0 left-0 size-32 bg-white rounded-full blur-3xl"></div>
                                        </div>
                                        <div className="relative z-10 text-center flex flex-col items-center">
                                            <span className="material-symbols-outlined text-4xl text-white mb-2">
                                                {selectedEvent2.type === 'class' ? 'sports_martial_arts' : selectedEvent2.type === 'exam' ? 'workspace_premium' : 'emoji_events'}
                                            </span>
                                            <div className="bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-widest border border-white/20">
                                                {selectedEvent2.type === 'class' ? 'Clase' : 'Evento'}
                                            </div>
                                        </div>
                                        <button onClick={() => setIsEventModal2(false)} className="absolute top-5 right-5 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full transition-colors backdrop-blur-md active:scale-95">
                                            <span className="material-symbols-outlined text-lg">close</span>
                                        </button>
                                    </div>
                                    <div className="px-8 pb-10 -mt-6 relative z-10">
                                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-50 flex flex-col gap-6 text-center">
                                            <div>
                                                <h2 className={`text-2xl font-black text-gray-900 leading-tight mb-2 ${isCancelled ? 'line-through text-gray-400' : ''}`}>{selectedEvent2.title}</h2>
                                                {isCancelled && <span className="inline-block px-3 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-wider border border-red-100">Clase Cancelada</span>}
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">Fecha</span>
                                                    <span className="font-bold text-gray-900 text-sm capitalize">{format(selectedEvent2.start, 'd MMMM, yyyy', { locale: es })}</span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">Horario</span>
                                                    <span className="font-bold text-gray-900 text-sm">{format(selectedEvent2.start, 'HH:mm')} - {format(selectedEvent2.end, 'HH:mm')}</span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">Instructor</span>
                                                    <span className="font-bold text-gray-900 text-sm">{selectedEvent2.instructor || selectedEvent2.instructorName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    };

                    return (
                        <div className="fixed inset-0 z-[200] bg-white flex flex-col font-sans overflow-hidden">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-b border-gray-100 bg-white shrink-0 gap-4 z-20">
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <button onClick={() => setShowFullCalendar(false)}
                                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors group"
                                    >
                                        <div className="size-9 rounded-xl border border-gray-200 bg-gray-50 group-hover:bg-white group-hover:shadow-sm flex items-center justify-center transition-all">
                                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                                        </div>
                                    </button>
                                    <h1 className="text-3xl font-black tracking-tight text-gray-900 capitalize min-w-[200px]">
                                        {headerTitle2}
                                    </h1>
                                </div>
                                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end overflow-x-auto no-scrollbar">
                                    <div className="flex bg-gray-100 p-1 rounded-xl">
                                        {([
                                            { id: 'year', label: 'AÃ±o' },
                                            { id: 'month', label: 'Mes' },
                                            { id: 'week', label: 'Semana' },
                                            { id: 'day', label: 'DÃ­a' },
                                        ] as { id: CalViewType; label: string }[]).map(v => (
                                            <button key={v.id} onClick={() => setCalView2(v.id)}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                                    calView2 === v.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                                                }`}
                                            >{v.label}</button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleNavigate2('PREV')} className="size-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all">
                                            <span className="material-symbols-outlined text-xl">chevron_left</span>
                                        </button>
                                        <button onClick={() => handleNavigate2('TODAY')} className="px-3 py-1.5 rounded-lg hover:bg-gray-100 text-xs font-bold text-gray-900 uppercase transition-all">Hoy</button>
                                        <button onClick={() => handleNavigate2('NEXT')} className="size-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all">
                                            <span className="material-symbols-outlined text-xl">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Calendar Body */}
                            <div className="flex-1 relative bg-white overflow-hidden flex flex-col">
                                {calView2 === 'month' && <MonthGrid />}
                                {calView2 === 'week' && <WeekView />}
                                {calView2 === 'day' && <DayView />}
                                {calView2 === 'year' && (
                                    <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                                        <YearView
                                            date={calDate2}
                                            events={calEvents}
                                            onNavigate={setCalDate2}
                                            onMonthClick={(d) => { setCalDate2(d); setCalView2('month'); }}
                                            onDayClick={(d) => {
                                                const dayEvts = calEvents.filter(e => isSameDay(e.start, d));
                                                handleDayClick2(d, dayEvts);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            <DayDrawer />
                            <EvtModal />
                        </div>
                    );
                };

                return <MasterCalendarInner />;
            })()}
            {sessionModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSessionModal(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-gray-100" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="flex items-start justify-between p-7 border-b border-gray-100">
                            <div>
                                <h3 className="text-xl font-black text-gray-900">{sessionModal.className}</h3>
                                <p className="text-sm font-semibold text-gray-400 mt-0.5">
                                    {new Date(sessionModal.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">{sessionModal.currentStartTime} {String.fromCharCode(8211)} {sessionModal.currentEndTime} {String.fromCharCode(183)} {sessionModal.currentInstructor}</p>
                            </div>
                            <button onClick={() => setSessionModal(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        {/* MENU VIEW */}
                        {sessionModal.view === 'menu' && (
                            <div className="p-7 space-y-3">
                                <button
                                    onClick={() => setSessionModal(prev => prev ? { ...prev, view: 'edit' } : null)}
                                    className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group text-left"
                                >
                                    <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                        <span className="material-symbols-outlined text-blue-600 text-[20px]">edit_calendar</span>
                                    </div>
                                    <div>
                                        <p className="font-black text-gray-800">Editar esta {String.fromCharCode(115)}esi{String.fromCharCode(243)}n</p>
                                        <p className="text-sm text-gray-400 mt-0.5">Cambiar hora, instructor o fecha</p>
                                    </div>
                                    <span className="material-symbols-outlined text-gray-300 ml-auto">chevron_right</span>
                                </button>
                                <button
                                    onClick={() => setSessionModal(prev => prev ? { ...prev, view: 'confirm_cancel' } : null)}
                                    className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-red-200 hover:bg-red-50/30 transition-all group text-left"
                                >
                                    <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                                        <span className="material-symbols-outlined text-red-500 text-[20px]">event_busy</span>
                                    </div>
                                    <div>
                                        <p className="font-black text-gray-800">Cancelar esta clase</p>
                                        <p className="text-sm text-gray-400 mt-0.5">Marcar como cancelada para los alumnos</p>
                                    </div>
                                    <span className="material-symbols-outlined text-gray-300 ml-auto">chevron_right</span>
                                </button>
                            </div>
                        )}

                        {/* EDIT VIEW */}
                        {sessionModal.view === 'edit' && (
                            <div className="p-7 space-y-5">
                                <button onClick={() => setSessionModal(prev => prev ? { ...prev, view: 'menu' } : null)} className="flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors">
                                    <span className="material-symbols-outlined text-[16px]">chevron_left</span> Volver
                                </button>

                                <div>
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2 block">Fecha de esta {String.fromCharCode(115)}esi{String.fromCharCode(243)}n</label>
                                    <input type="date" className="w-full rounded-xl border border-gray-200 p-3 font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={sessionModal.editForm.newDate}
                                        onChange={e => setSessionModal(prev => prev ? { ...prev, editForm: { ...prev.editForm, newDate: e.target.value } } : null)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2 block">Inicio</label>
                                        <input type="time" className="w-full rounded-xl border border-gray-200 p-3 font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            value={sessionModal.editForm.newStartTime}
                                            onChange={e => setSessionModal(prev => prev ? { ...prev, editForm: { ...prev.editForm, newStartTime: e.target.value } } : null)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2 block">Fin</label>
                                        <input type="time" className="w-full rounded-xl border border-gray-200 p-3 font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            value={sessionModal.editForm.newEndTime}
                                            onChange={e => setSessionModal(prev => prev ? { ...prev, editForm: { ...prev.editForm, newEndTime: e.target.value } } : null)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2 block">Instructor</label>
                                    <input type="text" className="w-full rounded-xl border border-gray-200 p-3 font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={sessionModal.editForm.newInstructor}
                                        onChange={e => setSessionModal(prev => prev ? { ...prev, editForm: { ...prev.editForm, newInstructor: e.target.value } } : null)}
                                        placeholder="Nombre del instructor"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setSessionModal(null)} className="flex-1 py-3.5 rounded-xl border-2 border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-colors">Cancelar</button>
                                    <button onClick={handleSaveSessionEdit} className="flex-1 py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">Guardar Cambios</button>
                                </div>
                            </div>
                        )}

                        {/* CONFIRM CANCEL VIEW */}
                        {sessionModal.view === 'confirm_cancel' && (
                            <div className="p-7 space-y-6">
                                <div className="flex flex-col items-center text-center gap-3 py-4">
                                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-red-500 text-3xl">event_busy</span>
                                    </div>
                                    <h4 className="text-xl font-black text-gray-900">{String.fromCharCode(191)}Cancelar esta clase?</h4>
                                    <p className="text-gray-500 text-sm max-w-xs">
                                        Los alumnos ver{String.fromCharCode(225)}n esta clase como <span className="font-bold text-red-500">cancelada</span> en su dashboard.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setSessionModal(prev => prev ? { ...prev, view: 'menu' } : null)} className="flex-1 py-3.5 rounded-xl border-2 border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-colors">Volver</button>
                                    <button onClick={handleCancelSession} className="flex-1 py-3.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-200">S{String.fromCharCode(237)}, Cancelar Clase</button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* --- GLOBAL EDIT CLASS MODAL --- */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 text-text-main">
                            {editingClassId ? 'ConfiguraciÃ³n General de Clase' : 'Crear Nueva Clase'}
                        </h2>
                        <form onSubmit={handleSaveClass} className="flex flex-col gap-5">
                            <input required value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" placeholder="Nombre de la Clase" />
                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase mb-2 block">DÃ­as Recurrentes</label>
                                <div className="flex flex-wrap gap-2">
                                    {daysOptions.map(day => (
                                        <button key={day.key} type="button" onClick={() => toggleDay(day.key)}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${classForm.selectedDays.includes(day.key) ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-text-secondary border-gray-200 hover:bg-gray-50'}`}
                                        >{day.label}</button>
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
                        <h2 className="text-2xl font-bold mb-6 text-text-main">Publicar Nuevo Evento</h2>
                        <form onSubmit={handleCreateEvent} className="flex flex-col gap-5">
                            <input required value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" placeholder="Nombre del Evento" />
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
                            <textarea required value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} className="w-full rounded-xl border-gray-300 p-3 text-sm" placeholder="Detalles del evento..." rows={3} />
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                                <div>
                                    <span className="block text-sm font-bold text-text-main">Visible para Alumnos</span>
                                    <span className="text-xs text-gray-500">Permitir inscripciones desde el dashboard.</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={eventForm.isVisibleToStudents} onChange={e => setEventForm({ ...eventForm, isVisibleToStudents: e.target.checked })} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
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
