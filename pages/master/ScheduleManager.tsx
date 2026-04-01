
import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views, Navigate } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAcademy } from '../../context/AcademyContext';
import { CalendarEvent } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useConfirmation } from '../../context/ConfirmationContext';

// --- MODERN STYLES FOR RBC (Clean Productivity Tool) ---
/* === PREMIUM GOOGLE MATERIAL 3 DARK THEME === */
const calendarStyles = `
@import url('https://cdn.jsdelivr.net/npm/react-big-calendar@1.8.5/lib/css/react-big-calendar.css');

.rbc-calendar {
    font-family: 'Outfit', 'Inter', sans-serif;
    color: #e2e8f0;
    background-color: transparent;
}

/* Global Border Reset */
.rbc-calendar, .rbc-month-view, .rbc-time-view, .rbc-header, .rbc-month-row, .rbc-day-bg, .rbc-time-content, .rbc-time-header, .rbc-timeslot-group, .rbc-time-gutter {
    border-color: rgba(255, 255, 255, 0.08) !important;
}

/* Hide default toolbar */
.rbc-toolbar { display: none; }

/* === HEADERS (Day Names) === */
.rbc-header {
    background: transparent;
    padding: 24px 0;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #94a3b8;
    border-bottom: 2px solid rgba(255, 255, 255, 0.04);
}
.rbc-header + .rbc-header { border-left: none; }
.rbc-header.rbc-today { background: rgba(255, 255, 255, 0.02); color: #fff; }

/* === TIME VIEW (Week/Day) === */
.rbc-time-view {
    border: none !important;
    background: transparent;
}
.rbc-time-header-content {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
}
.rbc-time-content {
    border-top: none;
    border-left: none;
}
.rbc-time-gutter .rbc-timeslot-group { border-right: none; }
.rbc-timeslot-group {
    min-height: 80px;
    background: transparent;
}
.rbc-time-slot {
    border-top: none;
    color: #475569;
    font-size: 11px;
    font-weight: 500;
}
.rbc-day-slot { background: transparent; }
.rbc-day-slot .rbc-events-container { margin-right: 4px; }

/* Today Column in Time View */
.rbc-day-slot.rbc-today {
    background: rgba(255, 255, 255, 0.015);
}

/* === MONTH VIEW === */
.rbc-month-view { border: none !important; }
.rbc-month-row { border-top: 1px solid rgba(255, 255, 255, 0.06); }
.rbc-day-bg { background: transparent; }
.rbc-off-range-bg { background: rgba(0, 0, 0, 0.2); }
.rbc-date-cell {
    padding: 12px;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
}
.rbc-date-cell.rbc-now { color: #f43f5e; font-size: 13px; font-weight: 800; }

/* === EVENTS === */
.rbc-event {
    background: transparent !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
}
.rbc-event:focus, .rbc-event.rbc-selected { outline: none !important; }

/* Event Label (small time string) */
.rbc-event-label { display: none; }

/* Slot Selection (Drag to create) */
.rbc-slot-selection {
    background: rgba(244, 63, 94, 0.1) !important;
    border: 1px solid rgba(244, 63, 94, 0.4) !important;
    border-radius: 8px;
}

/* === INDICATORS === */
.rbc-current-time-indicator {
    background-color: #f43f5e;
    height: 2px;
}
.rbc-current-time-indicator::before {
    content: '';
    position: absolute;
    left: -4px;
    top: -3px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #f43f5e;
    box-shadow: 0 0 10px #f43f5e;
}

/* === SCROLLBARS === */
.rbc-time-content::-webkit-scrollbar { width: 6px; }
.rbc-time-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
.rbc-time-content::-webkit-scrollbar-track { background: transparent; }

/* === AGENDA VIEW (Ensures Day view detail remains dark) === */
.rbc-agenda-view { color: #e2e8f0; border: none; }
.rbc-agenda-table {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #141416;
    border-radius: 12px;
    overflow: hidden;
}
.rbc-agenda-table thead tr th { border-bottom: 2px solid rgba(255, 255, 255, 0.05); color: #94a3b8; }
`;

// --- LOCALIZER ---
const locales = { 'es': es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// --- CONSTANTS ---
const EVENT_COLORS = [
    { label: 'Clase Regular', value: '#3b82f6', bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50' },
    { label: 'Avanzada', value: '#8b5cf6', bg: 'bg-violet-500', text: 'text-violet-700', light: 'bg-violet-50' },
    { label: 'Open Mat', value: '#10b981', bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50' },
    { label: 'Torneo', value: '#f97316', bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50' },
    { label: 'Privada', value: '#64748b', bg: 'bg-slate-500', text: 'text-slate-700', light: 'bg-slate-50' },
];

// --- COMPONENTS ---

// 1. Event Card (The Floating Block)
const EventCard = ({ event }: { event: CalendarEvent }) => {
    const isCancelled = event.status === 'cancelled';
    
    return (
        <div 
            className={`
                h-full w-full rounded-lg border-l-[4px] transition-all px-3 py-2 flex flex-col justify-center overflow-hidden cursor-pointer group
                ${isCancelled ? 'opacity-40 grayscale-[0.5]' : 'hover:brightness-125 shadow-lg'}
            `}
            style={{
                borderLeftColor: isCancelled ? '#e11d48' : event.color,
                backgroundColor: isCancelled
                    ? 'rgba(225,29,72,0.12)'
                    : `${event.color}0D`, // 5% opacity
                border: isCancelled ? '1px solid rgba(225,29,72,0.15)' : `1px solid ${event.color}20`
            }}
        >
            <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${
                        isCancelled ? 'text-red-400' : 'text-slate-500'
                    }`}>
                        {format(event.start, 'HH:mm')}
                    </span>
                    {isCancelled && <span className="material-symbols-outlined text-red-500 text-[11px]">cancel</span>}
                </div>
                
                <h4 className={`text-[12px] font-bold leading-tight truncate ${
                    isCancelled ? 'text-slate-600 line-through' : 'text-white'
                }`}>
                    {event.title}
                </h4>

                <div className="flex items-center gap-1.5 mt-1 opacity-70">
                    <div className="size-1.5 rounded-full" style={{ backgroundColor: event.color }}></div>
                    <span className="text-[10px] font-medium text-slate-400 truncate">
                        {event.instructor || event.instructorName || 'Academy'}
                    </span>
                </div>
            </div>
        </div>
    );
};

// 2. Quick Edit Modal (Borderless)
const QuickEditModal: React.FC<{
    isOpen: boolean;
    event: Partial<CalendarEvent> | null;
    onClose: () => void;
    onSave: (evt: Partial<CalendarEvent>) => void;
    onDelete: (id: string) => void;
}> = ({ isOpen, event, onClose, onSave, onDelete }) => {
    if (!isOpen || !event) return null;

    const [formData, setFormData] = useState({
        title: '',
        instructor: '',
        date: '',
        startTime: '',
        endTime: '',
        status: 'active' as 'active' | 'cancelled',
        color: '#3b82f6',
    });

    React.useEffect(() => {
        if (event) {
            const start = event.start ? new Date(event.start) : new Date();
            const end = event.end ? new Date(event.end) : addMinutes(start, 60);
            
            setFormData({
                title: event.title || '',
                instructor: event.instructor || event.instructorName || '',
                date: format(start, 'yyyy-MM-dd'),
                startTime: format(start, 'HH:mm'),
                endTime: format(end, 'HH:mm'),
                status: event.status === 'cancelled' ? 'cancelled' : 'active',
                color: event.color || '#3b82f6',
            });
        }
    }, [event]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const [y, m, d] = formData.date.split('-').map(Number);
        const [sh, sm] = formData.startTime.split(':').map(Number);
        const [eh, em] = formData.endTime.split(':').map(Number);

        const newStart = new Date(y, m - 1, d, sh, sm);
        const newEnd = new Date(y, m - 1, d, eh, em);

        onSave({ ...event, ...formData, start: newStart, end: newEnd });
    };

    const inputClass = "w-full bg-[#18181d] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm font-bold text-[#dde1e7] focus:ring-2 focus:ring-red-500/20 focus:border-[#e11d48] focus:bg-[#1e1e25] transition-all placeholder:text-[#4b5563] outline-none";
    const labelClass = "block text-[10px] font-black text-[#6b7280] uppercase tracking-widest mb-1.5 ml-1";

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="rounded-[1.5rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200" 
                style={{ background: '#101014', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header Actions */}
                <div className="absolute top-4 right-4 flex gap-2 z-10">
                    {event.id && (
                            <button 
                                type="button" 
                                onClick={() => onDelete(event.id!)}
                                className="size-12 md:size-10 flex items-center justify-center rounded-full text-red-400 hover:text-red-300 transition-colors"
                                style={{ background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.2)' }}
                                title="Eliminar sesión"
                        >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                    )}
                    <button 
                        onClick={onClose}
                        className="size-12 md:size-10 flex items-center justify-center rounded-full text-[#6b7280] hover:text-[#dde1e7] transition-colors"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="p-8 pb-0">
                    <h2 className="text-2xl font-black tracking-tight leading-none mb-1" style={{ color: '#dde1e7' }}>
                        {event.id ? 'Editar Sesión' : 'Nueva Clase'}
                    </h2>
                    <p className="text-xs font-medium" style={{ color: '#6b7280' }}>Detalles del bloque horario</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5">
                    
                    {/* Title Input */}
                    <div>
                        <label className={labelClass}>Actividad</label>
                        <input 
                            required
                            autoFocus={!event.id}
                            value={formData.title} 
                            onChange={e => setFormData({...formData, title: e.target.value})}
                            className={inputClass} 
                            placeholder="Ej. Jiu-Jitsu Kids"
                        />
                    </div>

                    {/* Time & Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Fecha</label>
                            <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className={inputClass} />
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className={labelClass}>Inicio</label>
                                <input type="time" required value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className={`${inputClass} px-2 text-center`} />
                            </div>
                            <div className="flex-1">
                                <label className={labelClass}>Fin</label>
                                <input type="time" required value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} className={`${inputClass} px-2 text-center`} />
                            </div>
                        </div>
                    </div>

                    {/* Instructor & Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Instructor</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-400 material-symbols-outlined text-[18px]">person</span>
                                <input 
                                    value={formData.instructor} 
                                    onChange={e => setFormData({...formData, instructor: e.target.value})}
                                    className={`${inputClass} pl-10`} 
                                    placeholder="Nombre"
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Estado</label>
                                <select 
                                    value={formData.status}
                                    onChange={e => setFormData({...formData, status: e.target.value as any})}
                                    className={`${inputClass} ${formData.status === 'cancelled' ? '!text-red-400 !bg-[rgba(225,29,72,0.1)]' : '!text-emerald-400 !bg-[rgba(16,185,129,0.08)]'}`}
                                >                              <option value="active">Activa</option>
                                <option value="cancelled">Cancelada</option>
                            </select>
                        </div>
                    </div>

                    {/* Color Picker */}
                    <div>
                        <label className={labelClass}>Etiqueta</label>
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {EVENT_COLORS.map(c => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => setFormData({...formData, color: c.value})}
                                    className={`size-11 md:size-8 shrink-0 rounded-full flex items-center justify-center transition-all ${c.bg} ${formData.color === c.value ? 'ring-2 ring-offset-2 ring-offset-[#101014] ring-white scale-110' : 'opacity-30 hover:opacity-80'}`}
                                    title={c.label}
                                >
                                    {formData.color === c.value && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button type="submit" className="mt-4 w-full py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-95 flex items-center justify-center gap-2" style={{ background: '#e11d48', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}>
                        <span className="material-symbols-outlined text-[20px]">save</span>
                        Guardar Cambios
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- MAIN PAGE ---
const ScheduleManager: React.FC = () => {
    const { scheduleEvents, updateCalendarEvent, addCalendarEvent, deleteCalendarEvent } = useAcademy();
    const { addToast } = useToast();
    const { confirm } = useConfirmation();

    // State
    const [date, setDate] = useState(new Date());
    const [view, setView] = useState<any>(Views.WEEK);
    const [selectedEvent, setSelectedEvent] = useState<Partial<CalendarEvent> | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- HANDLERS ---

    const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
        setSelectedEvent({
            start,
            end,
            title: '',
            instructor: '',
            status: 'active',
            color: '#3b82f6'
        });
        setIsModalOpen(true);
    }, []);

    const handleSelectEvent = useCallback((event: CalendarEvent) => {
        setSelectedEvent(event);
        setIsModalOpen(true);
    }, []);

    const handleSaveEvent = (evt: Partial<CalendarEvent>) => {
        if (evt.id) {
            updateCalendarEvent(evt.id, evt);
            addToast('Sesión actualizada', 'success');
        } else {
            addCalendarEvent({
                ...evt,
                id: '', // Generated by Context
                academyId: '', // Assigned by Context
                type: 'class'
            } as CalendarEvent);
            addToast('Clase creada', 'success');
        }
        setIsModalOpen(false);
    };

    const handleDeleteEvent = (id: string) => {
        const evt = scheduleEvents.find(e => e.id === id);
        const message = evt?.classId 
            ? 'Esta es una sesión de una clase recurrente. Se cancelará solo para esta fecha.'
            : '¿Eliminar este evento permanentemente?';

        confirm({
            title: 'Eliminar Sesión',
            message,
            type: 'danger',
            confirmText: 'Sí, Eliminar',
            onConfirm: () => {
                deleteCalendarEvent(id);
                setIsModalOpen(false);
                addToast('Sesión eliminada', 'info');
            }
        });
    };

    // Custom Toolbar Logic
    const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
        let newDate = new Date(date);
        if (action === 'TODAY') newDate = new Date();
        else {
            const move = action === 'NEXT' ? 1 : -1;
            if (view === Views.MONTH) newDate.setMonth(newDate.getMonth() + move);
            else if (view === Views.WEEK) newDate.setDate(newDate.getDate() + (move * 7));
            else newDate.setDate(newDate.getDate() + move);
        }
        setDate(newDate);
    };

    const { components } = useMemo(() => ({
        components: {
            event: EventCard
        }
    }), []);

    return (
        <div className="flex flex-col h-full relative font-sans" style={{ background: 'transparent' }}>
            <style>{calendarStyles}</style>
            
            {/* --- CUSTOM TOOLBAR --- */}
            <div className="px-10 py-6 flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 z-20 backdrop-blur-md bg-[#0A0A0B]/80" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
                    <button onClick={() => setDate(new Date())} className="text-[11px] font-black uppercase tracking-[0.2em] px-4 py-3 md:py-2 min-h-[48px] md:min-h-0 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/50 hover:text-white">
                        Hoy
                    </button>
                    
                    <div className="flex items-center gap-3 ml-auto md:ml-0">
                        <button onClick={() => handleNavigate('PREV')} className="size-12 md:size-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-all text-white/40 hover:text-white">
                            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                        </button>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-white capitalize min-w-[140px] text-center">
                            {format(date, view === Views.MONTH ? 'MMMM yyyy' : 'd MMMM', { locale: es })}
                        </h1>
                        <button onClick={() => handleNavigate('NEXT')} className="size-12 md:size-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-all text-white/40 hover:text-white">
                            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex p-1 rounded-xl bg-white/[0.03] border border-white/10">
                        {[
                            { id: Views.MONTH, label: 'Mes' },
                            { id: Views.WEEK, label: 'Semana' },
                            { id: Views.DAY, label: 'Día' },
                        ].map(v => (
                            <button
                                key={v.id}
                                onClick={() => setView(v.id)}
                                className={`flex-1 flex items-center justify-center px-3 md:px-5 py-3 md:py-2 min-h-[48px] md:min-h-[32px] rounded-lg text-[10px] font-black uppercase tracking-widest transition-all`}
                                style={view === v.id
                                    ? { background: 'rgba(255,255,255,0.08)', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }
                                    : { color: 'rgba(255,255,255,0.4)' }
                                }
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={() => {
                            const now = new Date();
                            now.setMinutes(0,0,0);
                            handleSelectSlot({ start: now, end: addMinutes(now, 60) });
                        }}
                        className="w-full md:w-auto px-6 py-3 min-h-[48px] rounded-xl font-black text-[10px] justify-center md:justify-start uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        <span>Nueva Clase</span>
                    </button>
                </div>
            </div>

            {/* --- CALENDAR --- */}
            <div className="flex-1 p-4 overflow-hidden">
                <Calendar
                    localizer={localizer}
                    events={scheduleEvents}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    date={date}
                    view={view}
                    onNavigate={setDate}
                    onView={setView}
                    selectable
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    components={components}
                    min={new Date(0, 0, 0, 6, 0, 0)}
                    max={new Date(0, 0, 0, 23, 0, 0)}
                    step={30}
                    timeslots={2}
                    toolbar={false} // Custom toolbar used
                    formats={{
                        dayHeaderFormat: (date) => format(date, 'EEEE d', { locale: es }),
                    }}
                />
            </div>

            {/* --- MODAL --- */}
            <QuickEditModal 
                isOpen={isModalOpen}
                event={selectedEvent}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
            />
        </div>
    );
};

export default ScheduleManager;
