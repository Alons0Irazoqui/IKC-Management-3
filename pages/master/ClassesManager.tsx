
import React, { useState, useMemo, useEffect } from 'react';
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
    { color: '#9333EA', label: 'Exámenes' },
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
    const { classes, events, addClass, updateClass, deleteClass, modifyClassSession, addEvent, scheduleEvents } = useStore();
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
        // Lookup using originalDate if available, so chained edits modify the same root instance correctly
        const computedDate = ev.start instanceof Date ? localDateStr(ev.start) : String(ev.start).split('T')[0];
        const dateStr = ev.originalDate || computedDate;
        
        const existingMod = cls.modifications?.find(m => m.date === dateStr);
        
        setSessionModal({
            open: true,
            view: 'menu',
            classId: cls.id,
            className: cls.name,
            date: dateStr, // the original reference date
            currentStartTime: existingMod?.newStartTime || cls.startTime,
            currentEndTime: existingMod?.newEndTime || cls.endTime,
            currentInstructor: existingMod?.newInstructor || cls.instructor,
            editForm: {
                newDate: existingMod?.newDate || (existingMod?.type === 'move' ? computedDate : dateStr),
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

    // --- MASTER CALENDAR DATA GENERATION DELETED IN FAVOR OF scheduleEvents ---

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
                    <h1 className="text-4xl font-black tracking-tight" style={{ color: '#dde1e7' }}>Gestión de Horarios</h1>
                    <p className="mt-1 text-lg" style={{ color: '#6b7280' }}>Define clases regulares y eventos especiales.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex p-1.5 rounded-xl w-full md:w-auto overflow-x-auto scrollbar-hide" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <button
                            onClick={() => setActiveTab('classes')}
                            className="px-5 py-3 md:py-2 min-h-[48px] md:min-h-0 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 flex-1 md:flex-none whitespace-nowrap"
                            style={activeTab === 'classes' ? { background: '#e11d48', color: '#fff', boxShadow: '0 4px 12px rgba(225,29,72,0.35)' } : { color: '#9ca3af' }}
                        >
                            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                            Clases
                        </button>
                        <button
                            onClick={() => setActiveTab('events')}
                            className="px-5 py-3 md:py-2 min-h-[48px] md:min-h-0 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 flex-1 md:flex-none whitespace-nowrap"
                            style={activeTab === 'events' ? { background: '#e11d48', color: '#fff', boxShadow: '0 4px 12px rgba(225,29,72,0.35)' } : { color: '#9ca3af' }}
                        >
                            <span className="material-symbols-outlined text-[18px]">trophy</span>
                            Eventos
                        </button>
                    </div>
                    {activeTab === 'classes' ? (
                        <button
                            onClick={() => { resetClassForm(); setShowCreateModal(true); }}
                            className="text-white px-5 py-3 md:py-2.5 min-h-[48px] md:min-h-0 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap w-full md:w-auto"
                            style={{ background: '#e11d48', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Nueva Clase
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowEventModal(true)}
                            className="text-white px-5 py-3 md:py-2.5 min-h-[48px] md:min-h-0 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap w-full md:w-auto"
                            style={{ background: '#e11d48', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}
                        >
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Nuevo Evento
                        </button>
                    )}
                </div>

            </div>


            {/* --- CLASSES TAB CONTENT --- */}
            {activeTab === 'classes' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {classes.map(cls => (
                            <div key={cls.id} className="p-6 rounded-2xl hover:-translate-y-1 transition-all group relative flex flex-col" style={{ background: '#101014', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                                {/* Actions */}
                                <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button onClick={() => handleOpenEditClass(cls)} className="size-11 md:size-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                                        <span className="material-symbols-outlined text-[20px] md:text-[18px]">edit</span>
                                    </button>
                                    <button onClick={() => handleDeleteClass(cls.id)} className="size-11 md:size-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>
                                        <span className="material-symbols-outlined text-[20px] md:text-[18px]">delete</span>
                                    </button>
                                </div>

                                <div className="mb-5 mt-2">
                                    <div className="size-14 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.2)' }}>
                                        <span className="material-symbols-outlined text-3xl" style={{ color: '#e11d48' }}>sports_martial_arts</span>
                                    </div>
                                    <h3 className="text-xl font-bold mb-1 truncate leading-tight" style={{ color: '#dde1e7' }}>{cls.name}</h3>
                                    <p className="text-sm font-medium" style={{ color: '#6b7280' }}>{cls.instructor}</p>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}><span className="material-symbols-outlined text-[16px]" style={{ color: '#6b7280' }}>schedule</span></div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm" style={{ color: '#dde1e7' }}>{cls.days.map(d => d.substring(0, 3)).join(', ')}</span>
                                            <span className="text-xs" style={{ color: '#6b7280' }}>{cls.startTime} - {cls.endTime}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}><span className="material-symbols-outlined text-[16px]" style={{ color: '#6b7280' }}>groups</span></div>
                                        <span className="font-medium" style={{ color: '#9ca3af' }}>{cls.studentIds?.length || 0} Alumnos Inscritos</span>
                                    </div>
                                </div>

                                <div className="mt-auto flex flex-col gap-2 md:gap-2.5">
                                    <button
                                        onClick={() => navigate(`/master/attendance/${cls.id}`)}
                                        className="w-full py-3 min-h-[48px] rounded-xl font-bold text-base md:text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
                                    >
                                        <span className="material-symbols-outlined text-[20px] md:text-[18px]" style={{ color: '#e11d48' }}>groups</span>
                                        Alumnos y Asistencia
                                    </button>
                                    <button
                                        onClick={() => setShowFullCalendar(true)}
                                        className="w-full py-3 min-h-[48px] rounded-xl font-bold text-base md:text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}
                                    >
                                        <span className="material-symbols-outlined text-[20px] md:text-[18px]">calendar_month</span>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {events.length === 0 ? (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                                <span className="material-symbols-outlined text-6xl mb-4" style={{ color: 'rgba(255,255,255,0.1)' }}>emoji_events</span>
                                <h3 className="text-xl font-bold" style={{ color: '#dde1e7' }}>No hay eventos programados</h3>
                                <p className="max-w-md text-center mt-2" style={{ color: '#6b7280' }}>Crea torneos, exámenes de grado o seminarios para que tus alumnos se inscriban.</p>
                            </div>
                        ) : (
                            events.map(event => {
                                const typeInfo = getEventTypeLabel(event.type);
                                const percentFull = Math.min(((event.registeredCount || 0) / event.capacity) * 100, 100);

                                return (
                                    <div key={event.id} className="p-6 rounded-2xl flex flex-col relative group hover:-translate-y-1 transition-all" style={{ background: '#101014', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex gap-4">
                                                <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                    <span className="text-[10px] font-bold uppercase" style={{ color: '#e11d48' }}>{new Date(event.date).toLocaleString('es-ES', { month: 'short' })}</span>
                                                    <span className="text-2xl font-black leading-none" style={{ color: '#dde1e7' }}>{new Date(event.date).getDate()}</span>
                                                </div>
                                                <div>
                                                    <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1" style={{ background: 'rgba(255,255,255,0.07)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                        <span className="material-symbols-outlined text-[12px]">{typeInfo.icon}</span>
                                                        {typeInfo.label}
                                                    </div>
                                                    <h3 className="text-lg font-bold leading-tight line-clamp-1" style={{ color: '#dde1e7' }}>{event.title}</h3>
                                                    <p className="text-sm mt-0.5 flex items-center gap-1" style={{ color: '#6b7280' }}>
                                                        <span className="material-symbols-outlined text-[14px]">schedule</span> {event.time}
                                                    </p>
                                                </div>
                                            </div>

                                            {event.isVisibleToStudents === false && (
                                                <div className="absolute top-6 right-6" title="Evento Privado (Solo Invitación)">
                                                    <span className="p-1.5 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                                                        <span className="material-symbols-outlined text-sm">visibility_off</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mb-5">
                                            <div className="flex justify-between text-xs font-bold mb-2" style={{ color: '#6b7280' }}>
                                                <span>Cupo</span>
                                                <span style={{ color: percentFull >= 100 ? '#e11d48' : '#dde1e7' }}>{event.registeredCount || 0} / {event.capacity}</span>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${percentFull}%`, background: percentFull >= 100 ? '#e11d48' : '#e11d48' }}
                                                ></div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => navigate(`/master/event/${event.id}`)}
                                            className="mt-auto w-full py-3 min-h-[48px] rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
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

                // Use the exact same engine as Student (scheduleEvents)
                const calEvents: CalendarEvent[] = scheduleEvents;

                type CalViewType = 'year' | 'month' | 'week' | 'day';

                // Inner component using hooks
                const MasterCalendarInner = () => {
                    const [calView2, setCalView2] = useState<CalViewType>('week');
                    const [calDate2, setCalDate2] = useState(new Date());
                    const [selectedEvent2, setSelectedEvent2] = useState<CalendarEvent | null>(null);
                    const [isEventModal2, setIsEventModal2] = useState(false);
                    const [drawerState2, setDrawerState2] = useState<{ isOpen: boolean; date: Date | null; events: CalendarEvent[] }>({
                        isOpen: false, date: null, events: []
                    });
                    const [yearReady, setYearReady] = useState(false);

                    // Defer YearView rendering so React can paint the spinner first
                    useEffect(() => {
                        if (calView2 === 'year') {
                            setYearReady(false);
                            const t = setTimeout(() => setYearReady(true), 50);
                            return () => clearTimeout(t);
                        }
                    }, [calView2]);

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
                        const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                        return (
                            <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
                                <div className="grid grid-cols-7 py-3 shrink-0 z-10" style={{ background: '#101014', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {weekDays.map(day => (
                                        <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4b5563' }}>{day}</div>
                                    ))}
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-7 auto-rows-fr gap-[1px] min-h-[600px] bg-white/[0.02]">
                                        {days.map((day) => {
                                            const dayEvts = calEvents.filter(e => isSameDay(e.start, day)).sort((a, b) => a.start.getTime() - b.start.getTime());
                                            const isToday = isSameDay(day, new Date());
                                            const isCurrentMonth = isSameMonth(day, calDate2);
                                            return (
                                                <div key={day.toISOString()} onClick={() => handleDayClick2(day, dayEvts)}
                                                    className="min-h-[120px] p-2 cursor-pointer transition-colors flex flex-col items-center gap-1"
                                                    style={{ background: isCurrentMonth ? '#0e0e11' : 'rgba(0,0,0,0.3)' }}
                                                >
                                                    <div className="size-7 flex items-center justify-center rounded-full text-xs font-bold transition-all"
                                                        style={isToday ? { background: '#e11d48', color: '#fff', boxShadow: '0 2px 8px rgba(225,29,72,0.5)' } : { color: isCurrentMonth ? '#dde1e7' : '#374151' }}
                                                    >{format(day, 'd')}</div>
                                                    <div className="w-full flex flex-col gap-1 mt-1">
                                                        {dayEvts.slice(0, 3).map(evt => {
                                                            const isCancelled = evt.status === 'cancelled';
                                                            const colors = isCancelled ? { bg: 'rgba(255,255,255,0.04)', text: '#4b5563', border: '#374151' } :
                                                                           evt.type === 'exam' ? { bg: 'rgba(217,119,6,0.1)', text: '#fbbf24', border: '#d97706' } :
                                                                           evt.type === 'tournament' ? { bg: 'rgba(37,99,235,0.1)', text: '#60a5fa', border: '#2563eb' } :
                                                                           evt.type === 'seminar' ? { bg: 'rgba(124,58,237,0.1)', text: '#a78bfa', border: '#7c3aed' } :
                                                                           { bg: 'rgba(225,29,72,0.1)', text: '#f87171', border: '#e11d48' };
                                                            
                                                            return (
                                                                <div key={evt.id} onClick={e => { e.stopPropagation(); handleEventClick2(evt); }}
                                                                    className="w-full px-2 py-1 rounded-md text-[10px] font-bold truncate transition-transform hover:scale-[1.02] border-l-2"
                                                                    style={{ 
                                                                        background: colors.bg, 
                                                                        color: colors.text, 
                                                                        borderColor: colors.border,
                                                                        textDecoration: isCancelled ? 'line-through' : 'none'
                                                                    }}
                                                                >{evt.title}</div>
                                                            );
                                                        })}
                                                        {dayEvts.length > 3 && (
                                                            <div className="text-[10px] font-bold text-center py-0.5" style={{ color: '#4b5563', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>+ {dayEvts.length - 3} más</div>
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
                            <div className="flex-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ background: 'transparent' }}>
                                <div className="grid grid-cols-1 md:grid-cols-7 min-h-full divide-y md:divide-y-0 md:divide-x divide-white/[0.04]">
                                    {weekDays2.map(day => {
                                        const dayEvts = calEvents.filter(e => isSameDay(e.start, day)).sort((a, b) => a.start.getTime() - b.start.getTime());
                                        const isToday = isSameDay(day, new Date());
                                        return (
                                            <div key={day.toISOString()} className="flex flex-col relative" style={{ background: 'transparent' }}>
                                                <div className="sticky top-0 z-10 py-3 text-center transition-colors" style={{ background: isToday ? 'rgba(225,29,72,0.08)' : 'rgba(16,16,20,0.95)', borderBottom: '1px solid rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4b5563' }}>{format(day, 'EEE', { locale: es })}</p>
                                                    <div className="mx-auto size-8 flex items-center justify-center rounded-full mt-1" style={isToday ? { background: '#e11d48', boxShadow: '0 2px 8px rgba(225,29,72,0.5)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <span className="text-lg leading-none font-black" style={{ color: isToday ? '#fff' : '#dde1e7' }}>{format(day, 'd')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2.5 p-3 flex-1 min-h-[100px]">
                                                    {dayEvts.length > 0 ? dayEvts.map(evt => (
                                                        <div key={evt.id} onClick={() => handleEventClick2(evt)}
                                                            className={`p-3 rounded-xl border-l-[3px] cursor-pointer transition-all hover:-translate-y-0.5 active:scale-95 shadow-lg`}
                                                            style={evt.status === 'cancelled'
                                                                ? { background: 'rgba(255,255,255,0.03)', borderColor: '#374151', opacity: 0.6 }
                                                                : { 
                                                                    background: evt.type === 'class' ? 'rgba(225,29,72,0.08)' : 
                                                                                evt.type === 'exam' ? 'rgba(217,119,6,0.08)' : 
                                                                                evt.type === 'tournament' ? 'rgba(37,99,235,0.08)' : 
                                                                                'rgba(124,58,237,0.08)', 
                                                                    borderColor: evt.type === 'class' ? '#e11d48' : 
                                                                                 evt.type === 'exam' ? '#d97706' : 
                                                                                 evt.type === 'tournament' ? '#2563eb' : 
                                                                                 '#7c3aed',
                                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)' 
                                                                }
                                                            }
                                                        >
                                                            <p className="text-sm font-bold leading-tight" style={{ color: evt.status === 'cancelled' ? '#4b5563' : '#dde1e7', textDecoration: evt.status === 'cancelled' ? 'line-through' : 'none' }}>{evt.title}</p>
                                                            <div className="flex items-center gap-1 mt-1.5">
                                                                <span className="material-symbols-outlined text-[12px]" style={{ color: '#6b7280' }}>schedule</span>
                                                                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>{format(evt.start, 'HH:mm')}</p>
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div className="hidden md:flex flex-1 flex-col items-center justify-center opacity-10">
                                                            <div className="h-full w-px" style={{ borderLeft: '1px dashed rgba(255,255,255,0.1)' }}></div>
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
                            <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ background: '#0e0e11' }}>
                                <div className="max-w-3xl mx-auto w-full p-6 md:p-10 animate-in fade-in zoom-in-95 duration-300">
                                    <h3 className="text-3xl font-black mb-8 capitalize flex items-center gap-3" style={{ color: '#dde1e7' }}>
                                        <span className="w-1.5 h-8 bg-red-600 rounded-full shadow-[0_0_12px_rgba(225,29,72,0.4)]"></span>
                                        {format(calDate2, 'EEEE d, MMMM', { locale: es })}
                                    </h3>
                                    {dayEvts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 rounded-3xl" style={{ border: '2px dashed rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                                            <div className="size-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <span className="material-symbols-outlined text-4xl opacity-30" style={{ color: '#6b7280' }}>self_improvement</span>
                                            </div>
                                            <p className="text-lg font-bold" style={{ color: '#9ca3af' }}>Sin sesiones</p>
                                            <p className="text-sm opacity-60" style={{ color: '#6b7280' }}>No hay clases ni eventos este día.</p>
                                        </div>
                                    ) : (
                                        <div className="relative border-l ml-4 space-y-8 py-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                            {dayEvts.map(evt => {
                                                const isCancelled = evt.status === 'cancelled';
                                                const accentColor = isCancelled ? '#374151' :
                                                                    evt.type === 'exam' ? '#d97706' :
                                                                    evt.type === 'tournament' ? '#2563eb' :
                                                                    evt.type === 'seminar' ? '#7c3aed' :
                                                                    '#e11d48';

                                                return (
                                                    <div key={evt.id} onClick={() => handleEventClick2(evt)} className="relative pl-8 group cursor-pointer">
                                                        <div className={`absolute -left-[5px] top-4 size-2.5 rounded-full border-2 border-[#0e0e11] shadow-sm transition-all duration-300 ${isCancelled ? '' : 'group-hover:scale-125'}`} 
                                                            style={{ 
                                                                background: accentColor,
                                                                boxShadow: isCancelled ? 'none' : `0 0 10px ${accentColor}66`
                                                            }}
                                                        ></div>
                                                        <div className={`flex items-center gap-6 p-6 rounded-2xl border transition-all hover:-translate-y-1 ${
                                                            isCancelled 
                                                                ? 'bg-transparent opacity-60 grayscale' 
                                                                : 'hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]'
                                                        }`} style={{ 
                                                            background: 'rgba(255,255,255,0.02)', 
                                                            borderColor: isCancelled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'
                                                        }}>
                                                            <div className="flex flex-col items-center min-w-[60px] text-center">
                                                                <span className="text-lg font-black leading-none" style={{ color: '#dde1e7' }}>{format(evt.start, 'HH:mm')}</span>
                                                                <span className="text-xs font-bold mt-1" style={{ color: '#6b7280' }}>{format(evt.end, 'HH:mm')}</span>
                                                            </div>
                                                            <div className="w-px h-10" style={{ background: 'rgba(255,255,255,0.05)' }}></div>
                                                            <div className="flex-1">
                                                                <h4 className={`text-xl font-bold transition-colors ${isCancelled ? 'line-through' : ''}`} 
                                                                    style={{ 
                                                                        color: isCancelled ? '#6b7280' : '#dde1e7'
                                                                    }}
                                                                    onMouseEnter={(e) => !isCancelled && (e.currentTarget.style.color = accentColor)}
                                                                    onMouseLeave={(e) => !isCancelled && (e.currentTarget.style.color = '#dde1e7')}
                                                                >{evt.title}</h4>
                                                                <div className="flex items-center gap-3 mt-1.5">
                                                                    <span className="text-sm font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', color: '#9ca3af' }}>
                                                                        <span className="material-symbols-outlined text-sm">person</span>
                                                                        {evt.instructor}
                                                                    </span>
                                                                    {isCancelled && (
                                                                        <span className="bg-red-900/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-red-500/20">Cancelada</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="size-10 rounded-full flex items-center justify-center transition-colors" style={{ background: 'rgba(255,255,255,0.03)', color: '#6b7280' }}>
                                                                <span className="material-symbols-outlined">chevron_right</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
                                        className="fixed inset-y-0 right-0 z-[230] w-full max-w-md shadow-2xl flex flex-col"
                                        style={{ background: '#101014', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
                                    >
                                        <div className="p-8 flex justify-between items-start shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div>
                                                <h2 className="text-3xl font-black tracking-tight capitalize" style={{ color: '#dde1e7' }}>{format(drawerState2.date, 'EEEE', { locale: es })}</h2>
                                                <p className="font-medium text-lg capitalize" style={{ color: '#9ca3af' }}>{format(drawerState2.date, 'd MMMM yyyy', { locale: es })}</p>
                                            </div>
                                            <button onClick={() => setDrawerState2(p => ({ ...p, isOpen: false }))} className="p-2.5 rounded-xl transition-all active:scale-90" style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                            {drawerState2.events.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-center">
                                                    <span className="material-symbols-outlined text-6xl opacity-10 mb-4" style={{ color: '#dde1e7' }}>event_busy</span>
                                                    <p className="font-medium" style={{ color: '#6b7280' }}>No hay actividades programadas.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-6 relative">
                                                    <div className="absolute left-[19px] top-4 bottom-4 w-[2px]" style={{ background: 'rgba(255,255,255,0.05)' }}></div>
                                                    {drawerState2.events.map(evt => (
                                                        <div key={evt.id} onClick={() => { setDrawerState2(p => ({ ...p, isOpen: false })); handleEventClick2(evt); }}
                                                            className="relative pl-12 group cursor-pointer"
                                                        >
                                                            <div className={`absolute left-2 top-2 size-6 rounded-full border-4 border-[#101014] shadow-sm z-10 box-content ${evt.status === 'cancelled' ? 'bg-[#374151]' : 'bg-red-600'}`}></div>
                                                            <div className={`p-5 rounded-2xl border transition-all ${evt.status === 'cancelled' ? 'bg-transparent opacity-60' : 'hover:border-red-500/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]'}`} style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <span className={`text-[11px] font-black uppercase tracking-wider ${evt.status === 'cancelled' ? 'text-gray-500' : 'text-red-500'}`}>
                                                                        {format(evt.start, 'HH:mm')} - {format(evt.end, 'HH:mm')}
                                                                    </span>
                                                                </div>
                                                                <h3 className={`font-bold text-lg leading-tight mb-2 ${evt.status === 'cancelled' ? 'text-gray-500 line-through' : ''}`} style={{ color: evt.status === 'cancelled' ? '#6b7280' : '#dde1e7' }}>{evt.title}</h3>
                                                                <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>{evt.instructor}</p>
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
                            <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setIsEventModal2(false)}>
                                <div className="rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative" style={{ background: '#101014', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
                                    <div className={`h-32 ${isCancelled ? 'bg-red-900/40' : 'bg-red-600'} relative overflow-hidden flex items-center justify-center`}>
                                        <div className="absolute inset-0 opacity-20">
                                            <div className="absolute -top-10 -right-10 size-40 bg-white rounded-full blur-3xl"></div>
                                            <div className="absolute bottom-0 left-0 size-32 bg-white rounded-full blur-3xl"></div>
                                        </div>
                                        <div className="relative z-10 text-center flex flex-col items-center">
                                            <span className="material-symbols-outlined text-4xl text-white mb-2 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
                                                {selectedEvent2.type === 'class' ? 'sports_martial_arts' : selectedEvent2.type === 'exam' ? 'workspace_premium' : 'emoji_events'}
                                            </span>
                                            <div className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest border border-white/20">
                                                {selectedEvent2.type === 'class' ? 'Clase' : 'Evento'}
                                            </div>
                                        </div>
                                        <button onClick={() => setIsEventModal2(false)} className="absolute top-5 right-5 bg-black/20 hover:bg-black/40 text-white p-2.5 rounded-full transition-all backdrop-blur-md active:scale-90">
                                            <span className="material-symbols-outlined text-lg leading-none">close</span>
                                        </button>
                                    </div>
                                    <div className="px-8 pb-10 -mt-6 relative z-10">
                                        <div className="p-7 rounded-[2rem] shadow-2xl flex flex-col gap-6 text-center" style={{ background: '#121217', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div>
                                                <h2 className={`text-2xl font-black leading-tight mb-2 ${isCancelled ? 'line-through' : ''}`} style={{ color: isCancelled ? '#6b7280' : '#dde1e7' }}>{selectedEvent2.title}</h2>
                                                {isCancelled && <span className="inline-block px-3 py-1 rounded-lg bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-wider border border-red-500/20">Clase Cancelada</span>}
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Fecha</span>
                                                    <span className="font-bold text-sm capitalize" style={{ color: '#dde1e7' }}>{format(selectedEvent2.start, 'd MMMM, yyyy', { locale: es })}</span>
                                                </div>
                                                <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Horario</span>
                                                    <span className="font-bold text-sm" style={{ color: '#dde1e7' }}>{format(selectedEvent2.start, 'HH:mm')} - {format(selectedEvent2.end, 'HH:mm')}</span>
                                                </div>
                                                <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Instructor</span>
                                                    <span className="font-bold text-sm" style={{ color: '#dde1e7' }}>{selectedEvent2.instructor || selectedEvent2.instructorName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    };

                    return (
                        <div className="fixed inset-0 z-[200] flex flex-col font-sans overflow-hidden" style={{ background: '#08080a' }}>
                            {/* Header */}
                            <div className="flex flex-col md:flex-row justify-between items-center px-6 py-4 shrink-0 gap-4 z-20" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#101014' }}>
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <button onClick={() => setShowFullCalendar(false)}
                                        className="flex items-center gap-2 transition-colors group"
                                        style={{ color: '#6b7280' }}
                                    >
                                        <div className="size-9 rounded-xl flex items-center justify-center transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)' }}>
                                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                                        </div>
                                    </button>
                                    <h1 className="text-2xl font-black tracking-tight capitalize min-w-[200px]" style={{ color: '#dde1e7' }}>
                                        {headerTitle2}
                                    </h1>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end overflow-x-auto no-scrollbar">
                                    <div className="flex p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                        {([
                                            { id: 'year', label: 'Año' },
                                            { id: 'month', label: 'Mes' },
                                            { id: 'week', label: 'Semana' },
                                            { id: 'day', label: 'Día' },
                                        ] as { id: CalViewType; label: string }[]).map(v => (
                                            <button key={v.id} onClick={() => setCalView2(v.id)}
                                                className="px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap"
                                                style={calView2 === v.id
                                                    ? { background: 'rgba(255,255,255,0.1)', color: '#dde1e7', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }
                                                    : { color: '#6b7280' }
                                                }
                                            >{v.label}</button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleNavigate2('PREV')} className="size-9 flex items-center justify-center rounded-full transition-all" style={{ color: '#9ca3af' }}>
                                            <span className="material-symbols-outlined text-xl">chevron_left</span>
                                        </button>
                                        <button onClick={() => handleNavigate2('TODAY')} className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all" style={{ color: '#9ca3af' }}>Hoy</button>
                                        <button onClick={() => handleNavigate2('NEXT')} className="size-9 flex items-center justify-center rounded-full transition-all" style={{ color: '#9ca3af' }}>
                                            <span className="material-symbols-outlined text-xl">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Calendar Body */}
                            <div className="flex-1 relative overflow-hidden flex flex-col" style={{ background: '#08080a' }}>
                                {calView2 === 'month' && <MonthGrid />}
                                {calView2 === 'week' && <WeekView />}
                                {calView2 === 'day' && <DayView />}
                                {calView2 === 'year' && (
                                    <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                                        {!yearReady ? (
                                            <div className="flex flex-col items-center justify-center h-full gap-4 text-[#6b7280]">
                                                <div className="size-10 border-[3px] rounded-full animate-spin" style={{ borderColor: 'rgba(211, 215, 224, 0.1)', borderTopColor: '#e11d48' }}></div>
                                                <p className="text-sm font-bold uppercase tracking-widest opacity-60">Cargando calendario anual...</p>
                                            </div>
                                        ) : (
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
                                        )}
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
                <div className="fixed inset-0 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setSessionModal(null)}>
                    <div className="rounded-2xl w-full max-w-md" style={{ background: '#101014', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="flex items-start justify-between p-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <div>
                                <h3 className="text-xl font-black" style={{ color: '#dde1e7' }}>{sessionModal.className}</h3>
                                <p className="text-sm font-semibold mt-0.5" style={{ color: '#6b7280' }}>
                                    {new Date(sessionModal.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                                <p className="text-sm mt-1" style={{ color: '#6b7280' }}>{sessionModal.currentStartTime} {String.fromCharCode(8211)} {sessionModal.currentEndTime} {String.fromCharCode(183)} {sessionModal.currentInstructor}</p>
                            </div>
                            <button onClick={() => setSessionModal(null)} className="p-2 rounded-xl transition-colors" style={{ color: '#6b7280', background: 'rgba(255,255,255,0.05)' }}>
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        {/* MENU VIEW */}
                        {sessionModal.view === 'menu' && (
                            <div className="p-7 space-y-3">
                                <button
                                    onClick={() => setSessionModal(prev => prev ? { ...prev, view: 'edit' } : null)}
                                    className="w-full flex items-center gap-4 p-5 rounded-2xl transition-all text-left"
                                    style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
                                >
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors" style={{ background: 'rgba(59,130,246,0.12)' }}>
                                        <span className="material-symbols-outlined text-[20px]" style={{ color: '#60a5fa' }}>edit_calendar</span>
                                    </div>
                                    <div>
                                        <p className="font-black" style={{ color: '#dde1e7' }}>Editar esta {String.fromCharCode(115)}esi{String.fromCharCode(243)}n</p>
                                        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Cambiar hora, instructor o fecha</p>
                                    </div>
                                    <span className="material-symbols-outlined ml-auto" style={{ color: '#4b5563' }}>chevron_right</span>
                                </button>
                                <button
                                    onClick={() => setSessionModal(prev => prev ? { ...prev, view: 'confirm_cancel' } : null)}
                                    className="w-full flex items-center gap-4 p-5 rounded-2xl transition-all text-left"
                                    style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
                                >
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors" style={{ background: 'rgba(225,29,72,0.1)' }}>
                                        <span className="material-symbols-outlined text-[20px]" style={{ color: '#e11d48' }}>event_busy</span>
                                    </div>
                                    <div>
                                        <p className="font-black" style={{ color: '#dde1e7' }}>Cancelar esta clase</p>
                                        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Marcar como cancelada para los alumnos</p>
                                    </div>
                                    <span className="material-symbols-outlined ml-auto" style={{ color: '#4b5563' }}>chevron_right</span>
                                </button>
                            </div>
                        )}

                        {/* EDIT VIEW */}
                        {sessionModal.view === 'edit' && (
                            <div className="p-7 space-y-5">
                                <button onClick={() => setSessionModal(prev => prev ? { ...prev, view: 'menu' } : null)} className="flex items-center gap-1 text-sm font-semibold transition-colors" style={{ color: '#6b7280' }}>
                                    <span className="material-symbols-outlined text-[16px]">chevron_left</span> Volver
                                </button>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: '#6b7280' }}>Fecha de esta {String.fromCharCode(115)}esi{String.fromCharCode(243)}n</label>
                                    <input type="date" className="w-full rounded-xl p-3 font-semibold outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }}
                                        value={sessionModal.editForm.newDate}
                                        onChange={e => setSessionModal(prev => prev ? { ...prev, editForm: { ...prev.editForm, newDate: e.target.value } } : null)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: '#6b7280' }}>Inicio</label>
                                        <input type="time" className="w-full rounded-xl p-3 font-semibold outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }}
                                            value={sessionModal.editForm.newStartTime}
                                            onChange={e => setSessionModal(prev => prev ? { ...prev, editForm: { ...prev.editForm, newStartTime: e.target.value } } : null)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: '#6b7280' }}>Fin</label>
                                        <input type="time" className="w-full rounded-xl p-3 font-semibold outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }}
                                            value={sessionModal.editForm.newEndTime}
                                            onChange={e => setSessionModal(prev => prev ? { ...prev, editForm: { ...prev.editForm, newEndTime: e.target.value } } : null)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: '#6b7280' }}>Instructor</label>
                                    <input type="text" className="w-full rounded-xl p-3 font-semibold outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }}
                                        value={sessionModal.editForm.newInstructor}
                                        onChange={e => setSessionModal(prev => prev ? { ...prev, editForm: { ...prev.editForm, newInstructor: e.target.value } } : null)}
                                        placeholder="Nombre del instructor"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setSessionModal(null)} className="flex-1 py-3.5 rounded-xl font-bold text-sm transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>Cancelar</button>
                                    <button onClick={handleSaveSessionEdit} className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white transition-all" style={{ background: '#3b82f6', boxShadow: '0 4px 16px rgba(59,130,246,0.3)' }}>Guardar Cambios</button>
                                </div>
                            </div>
                        )}

                        {/* CONFIRM CANCEL VIEW */}
                        {sessionModal.view === 'confirm_cancel' && (
                            <div className="p-7 space-y-6">
                                <div className="flex flex-col items-center text-center gap-3 py-4">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(225,29,72,0.1)' }}>
                                        <span className="material-symbols-outlined text-3xl" style={{ color: '#e11d48' }}>event_busy</span>
                                    </div>
                                    <h4 className="text-xl font-black" style={{ color: '#dde1e7' }}>{String.fromCharCode(191)}Cancelar esta clase?</h4>
                                    <p className="text-sm max-w-xs" style={{ color: '#6b7280' }}>
                                        Los alumnos ver{String.fromCharCode(225)}n esta clase como <span className="font-bold" style={{ color: '#e11d48' }}>cancelada</span> en su dashboard.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setSessionModal(prev => prev ? { ...prev, view: 'menu' } : null)} className="flex-1 py-3.5 rounded-xl font-bold text-sm transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>Volver</button>
                                    <button onClick={handleCancelSession} className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white transition-all" style={{ background: '#e11d48', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}>S{String.fromCharCode(237)}, Cancelar Clase</button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* --- GLOBAL EDIT CLASS MODAL --- */}
            {showCreateModal && (
                <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95" style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div className="rounded-2xl p-8 w-full max-w-lg" style={{ background: '#101014', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
                        <h2 className="text-2xl font-bold mb-6" style={{ color: '#dde1e7' }}>
                            {editingClassId ? 'Configuración General de Clase' : 'Crear Nueva Clase'}
                        </h2>
                        <form onSubmit={handleSaveClass} className="flex flex-col gap-5">
                            <input required value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} className="w-full rounded-xl p-3 text-sm outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} placeholder="Nombre de la Clase" />
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: '#6b7280' }}>Días Recurrentes</label>
                                <div className="flex flex-wrap gap-2">
                                    {daysOptions.map(day => (
                                        <button key={day.key} type="button" onClick={() => toggleDay(day.key)}
                                            className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                                            style={classForm.selectedDays.includes(day.key)
                                                ? { background: '#e11d48', color: '#fff', boxShadow: '0 2px 8px rgba(225,29,72,0.3)' }
                                                : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }
                                            }
                                        >{day.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input required type="time" value={classForm.startTime} onChange={e => setClassForm({ ...classForm, startTime: e.target.value })} className="w-full rounded-xl p-3 text-sm outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} />
                                <input required type="time" value={classForm.endTime} onChange={e => setClassForm({ ...classForm, endTime: e.target.value })} className="w-full rounded-xl p-3 text-sm outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} />
                            </div>
                            <input required value={classForm.instructor} onChange={e => setClassForm({ ...classForm, instructor: e.target.value })} className="w-full rounded-xl p-3 text-sm outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} placeholder="Instructor por Defecto" />
                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={() => { setShowCreateModal(false); resetClassForm(); }} className="flex-1 py-3 rounded-xl font-bold text-sm transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>Cancelar</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all" style={{ background: '#e11d48', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}>Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- GLOBAL NEW EVENT MODAL --- */}
            {showEventModal && (
                <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95" style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div className="rounded-2xl p-8 w-full max-w-lg" style={{ background: '#101014', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
                        <h2 className="text-2xl font-bold mb-6" style={{ color: '#dde1e7' }}>Publicar Nuevo Evento</h2>
                        <form onSubmit={handleCreateEvent} className="flex flex-col gap-5">
                            <input required value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className="w-full rounded-xl p-3 text-sm outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} placeholder="Nombre del Evento" />
                            <div className="grid grid-cols-2 gap-4">
                                <select value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value as any })} className="w-full rounded-xl p-3 text-sm outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }}>
                                    <option value="exam">Examen de Grado</option>
                                    <option value="tournament">Torneo</option>
                                    <option value="seminar">Seminario</option>
                                </select>
                                <input required type="number" min="1" value={eventForm.capacity} onChange={e => setEventForm({ ...eventForm, capacity: parseInt(e.target.value) })} className="w-full rounded-xl p-3 text-sm outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} placeholder="Capacidad Max" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input required type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} className="w-full rounded-xl p-3 text-sm outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} />
                                <input required type="time" value={eventForm.time} onChange={e => setEventForm({ ...eventForm, time: e.target.value })} className="w-full rounded-xl p-3 text-sm outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} />
                            </div>
                            <textarea required value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} className="w-full rounded-xl p-3 text-sm outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} placeholder="Detalles del evento..." rows={3} />
                            <div className="p-4 rounded-xl flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                <div>
                                    <span className="block text-sm font-bold" style={{ color: '#dde1e7' }}>Visible para Alumnos</span>
                                    <span className="text-xs" style={{ color: '#6b7280' }}>Permitir inscripciones desde el dashboard.</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={eventForm.isVisibleToStudents} onChange={e => setEventForm({ ...eventForm, isVisibleToStudents: e.target.checked })} />
                                    <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" style={{ background: 'rgba(255,255,255,0.1)' }}></div>
                                </label>
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={() => setShowEventModal(false)} className="flex-1 py-3 rounded-xl font-bold text-sm transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>Cancelar</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all" style={{ background: '#e11d48', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}>Publicar Evento</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ClassesManager;
