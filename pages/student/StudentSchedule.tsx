
import React, { useState, useMemo } from 'react';
import { 
    format, startOfWeek, addDays, isSameDay, 
    startOfMonth, endOfMonth, eachDayOfInterval, endOfWeek, isSameMonth,
    addMonths, addWeeks, isAfter, isBefore
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useAcademy } from '../../context/AcademyContext';
import { useStore } from '../../context/StoreContext';
import { CalendarEvent } from '../../types';
import YearView from '../../components/calendar/YearView';
import { AnimatePresence, motion } from 'framer-motion';

// --- TYPES ---
type ViewType = 'year' | 'month' | 'week' | 'day' | 'agenda';

// --- COMPONENT: INFINITE MONTH GRID (Full Width Scroll) ---
const InfiniteMonthGrid: React.FC<{ 
    date: Date; 
    events: CalendarEvent[]; 
    onDayClick: (d: Date, events: CalendarEvent[]) => void;
}> = ({ date, events, onDayClick }) => {
    
    const days = useMemo(() => {
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [date]);

    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
            {/* Day Headers */}
            <div className="grid grid-cols-7 py-3 shrink-0 z-10" style={{backgroundColor: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)'}}>
                {weekDays.map(day => (
                    <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest" style={{color: 'var(--color-text-muted)'}}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Scrollable Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-7 auto-rows-fr gap-px min-h-[600px]" style={{backgroundColor: 'var(--color-border-subtle)'}}>
                    {days.map((day) => {
                        const dayEvents = events
                            .filter(e => isSameDay(e.start, day))
                            .sort((a, b) => a.start.getTime() - b.start.getTime());
                        const isToday = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, date);

                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => onDayClick(day, dayEvents)}
                                className="min-h-[120px] p-2 cursor-pointer flex flex-col items-center gap-1 transition-colors"
                                style={{backgroundColor: isCurrentMonth ? 'var(--color-bg-surface)' : 'var(--color-bg-app)'}}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = isCurrentMonth ? 'var(--color-bg-surface)' : 'var(--color-bg-app)'}
                            >
                                <div className="size-7 flex items-center justify-center rounded-full text-xs font-bold transition-all"
                                     style={isToday
                                         ? {backgroundColor: '#FC6F6F', color: '#000', boxShadow: '0 0 10px rgba(252,111,111,0.4)'}
                                         : {color: isCurrentMonth ? 'var(--color-text-primary)' : 'var(--color-border-strong)'}}>
                                    {format(day, 'd')}
                                </div>

                                <div className="w-full flex flex-col gap-1 mt-1">
                                    {dayEvents.slice(0, 3).map(evt => (
                                        <div key={evt.id}
                                            className="w-full px-2 py-1 rounded-md text-[9px] font-bold truncate border-l-2"
                                            style={evt.status === 'cancelled'
                                                ? {backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-muted)', borderLeftColor: 'var(--color-border-strong)', textDecoration: 'line-through'}
                                                : {backgroundColor: 'rgba(252,111,111,0.08)', color: '#FC6F6F', borderLeftColor: '#FC6F6F', border: '1px solid rgba(252,111,111,0.15)', borderLeft: '2px solid #FC6F6F'}}
                                        >
                                            {evt.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div className="text-[9px] font-bold text-center rounded py-0.5" style={{color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-app)'}}>
                                            +{dayEvents.length - 3} más
                                        </div>
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

// --- COMPONENT: CLEAN WEEK VIEW (Sticky Headers) ---
const CleanWeekView: React.FC<{
    date: Date;
    events: CalendarEvent[];
    onEventClick: (event: CalendarEvent) => void;
}> = ({ date, events, onEventClick }) => {
    
    const weekDays = useMemo(() => {
        const start = startOfWeek(date, { weekStartsOn: 1 }); // Lunes
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            days.push(addDays(start, i));
        }
        return days;
    }, [date]);

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-500" style={{backgroundColor: 'var(--color-bg-app)'}}>
            <div className="grid grid-cols-1 md:grid-cols-7 min-h-full gap-px" style={{backgroundColor: 'var(--color-border-subtle)'}}>
                {weekDays.map((day) => {
                    const dayEvents = events
                        .filter(e => isSameDay(e.start, day))
                        .sort((a, b) => a.start.getTime() - b.start.getTime());
                    
                    const isToday = isSameDay(day, new Date());

                    return (
                        <div key={day.toISOString()} className="flex flex-col relative" style={{backgroundColor: 'var(--color-bg-surface)'}}>
                            <div className={`sticky top-0 z-10 backdrop-blur-sm border-b py-3 text-center transition-colors`} style={{backgroundColor: isToday ? 'rgba(239,68,68,0.05)' : 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}>
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: 'var(--color-text-muted)'}}>{format(day, 'EEE', { locale: es })}</p>
                                <div className={`mx-auto size-8 flex items-center justify-center rounded-full mt-1`} style={isToday ? {backgroundColor: '#EF4444', color: '#fff'} : {color: 'var(--color-text-primary)', fontWeight: 900}}>
                                    <span className="text-lg leading-none">{format(day, 'd')}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 p-3 flex-1 min-h-[100px]">
                                {dayEvents.length > 0 ? (
                                    dayEvents.map(evt => (
                                        <div key={evt.id} onClick={() => onEventClick(evt)}
                                            className="p-3 rounded-lg border-l-[3px] cursor-pointer transition-all group active:scale-95"
                                            style={evt.status === 'cancelled'
                                                ? {backgroundColor: 'var(--color-bg-app)', borderLeftColor: 'var(--color-border-strong)', opacity: 0.5}
                                                : {backgroundColor: 'var(--color-bg-raised)', borderLeftColor: '#FC6F6F', border: '1px solid var(--color-border-subtle)', borderLeft: '3px solid #FC6F6F'}}
                                            onMouseEnter={e => { if (evt.status !== 'cancelled') (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.3)'; }}
                                            onMouseLeave={e => { if (evt.status !== 'cancelled') (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-subtle)'; }}
                                        >
                                            <p className={`text-xs font-bold leading-tight`} style={{color: evt.status === 'cancelled' ? 'var(--color-text-muted)' : 'var(--color-text-primary)', textDecoration: evt.status === 'cancelled' ? 'line-through' : 'none'}}>
                                                {evt.title}
                                            </p>
                                            <div className="flex items-center gap-1 mt-1.5">
                                                <span className="material-symbols-outlined text-[10px]" style={{color: 'var(--color-text-muted)'}}>schedule</span>
                                                <p className="text-[10px] font-bold uppercase tracking-wide" style={{color: 'var(--color-text-muted)'}}>{format(evt.start, 'HH:mm')}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="hidden md:flex flex-1 flex-col items-center justify-center opacity-10">
                                        <div className="h-full w-px border-l border-dashed" style={{borderColor: 'var(--color-border-subtle)'}}></div>
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

// --- COMPONENT: CLEAN DAY VIEW (Full Width) ---
const CleanDayView: React.FC<{
    date: Date;
    events: CalendarEvent[];
    onEventClick: (event: CalendarEvent) => void;
}> = ({ date, events, onEventClick }) => {
    
    const dayEvents = useMemo(() => {
        return events
            .filter(e => isSameDay(e.start, date))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [date, events]);

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{backgroundColor: 'var(--color-bg-app)'}}>
            <div className="max-w-3xl mx-auto w-full p-6 md:p-10 animate-in fade-in zoom-in-95 duration-300">
                <h3 className="text-3xl font-black mb-8 capitalize flex items-center gap-3" style={{color: 'var(--color-text-primary)'}}>
                    <span className="w-1.5 h-8 rounded-full" style={{backgroundColor: '#FC6F6F'}}></span>
                    {format(date, 'EEEE d, MMMM', { locale: es })}
                </h3>

                {dayEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 rounded-3xl border-2 border-dashed"
                         style={{borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)'}}>
                        <div className="size-20 rounded-full flex items-center justify-center mb-4"
                             style={{backgroundColor: 'var(--color-bg-raised)'}}>
                            <span className="material-symbols-outlined text-4xl opacity-30" style={{color: 'var(--color-text-secondary)'}}>self_improvement</span>
                        </div>
                        <p className="text-lg font-bold" style={{color: 'var(--color-text-secondary)'}}>Día libre</p>
                        <p className="text-sm mt-1" style={{color: 'var(--color-text-muted)'}}>No hay sesiones programadas.</p>
                    </div>
                ) : (
                    <div className="relative border-l ml-4 space-y-8 py-2" style={{borderColor: 'var(--color-border-subtle)'}}>
                        {dayEvents.map(evt => (
                            <div key={evt.id} onClick={() => onEventClick(evt)} className="relative pl-8 group cursor-pointer">
                                <div className={`absolute -left-[5px] top-4 size-2.5 rounded-full border-2 shadow-sm ring-1 transition-colors`}
                                     style={{borderColor: 'var(--color-bg-app)', backgroundColor: evt.status === 'cancelled' ? 'var(--color-border-strong)' : '#FC6F6F', '--tw-ring-color': 'var(--color-border-subtle)'} as React.CSSProperties}></div>
                                <div className={`flex items-center gap-6 p-6 rounded-2xl border transition-all group-hover:shadow-lg group-hover:-translate-y-1`}
                                     style={evt.status === 'cancelled'
                                        ? {borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)', opacity: 0.5}
                                        : {borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)'}}
                                     onMouseEnter={e => { if (evt.status !== 'cancelled') (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.3)'; }}
                                     onMouseLeave={e => { if (evt.status !== 'cancelled') (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-subtle)'; }}
                                >
                                    <div className="flex flex-col items-center min-w-[60px] text-center">
                                        <span className="text-lg font-black leading-none" style={{color: 'var(--color-text-primary)'}}>{format(evt.start, 'HH:mm')}</span>
                                        <span className="text-xs font-bold mt-1" style={{color: 'var(--color-text-muted)'}}>{format(evt.end, 'HH:mm')}</span>
                                    </div>
                                    <div className="w-px h-10" style={{backgroundColor: 'var(--color-border-subtle)'}}></div>
                                    <div className="flex-1">
                                        <h4 className="text-xl font-bold transition-colors" style={{color: evt.status === 'cancelled' ? 'var(--color-text-muted)' : 'var(--color-text-primary)', textDecoration: evt.status === 'cancelled' ? 'line-through' : 'none'}}>
                                            {evt.title}
                                        </h4>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-sm font-medium flex items-center gap-1 px-2 py-0.5 rounded-md" style={{color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)'}}>
                                                <span className="material-symbols-outlined text-sm">person</span>
                                                {evt.instructor}
                                            </span>
                                            {evt.status === 'cancelled' && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase" style={{backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)'}}>Cancelada</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="size-10 rounded-full flex items-center justify-center transition-colors" style={{backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-muted)'}}>
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

// --- COMPONENT: AGENDA VIEW (Edge-to-Edge Scroll) ---
const AgendaView: React.FC<{
    events: CalendarEvent[];
    onEventClick: (event: CalendarEvent) => void;
}> = ({ events, onEventClick }) => {
    
    const agendaItems = useMemo<CalendarEvent[]>(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        return events
            .filter(e => isAfter(e.start, today) || isSameDay(e.start, today))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [events]);

    const grouped = useMemo<Record<string, CalendarEvent[]>>(() => {
        const groups: Record<string, CalendarEvent[]> = {};
        agendaItems.forEach(evt => {
            const key = format(evt.start, 'yyyy-MM-dd');
            if (!groups[key]) groups[key] = [];
            groups[key].push(evt);
        });
        return groups;
    }, [agendaItems]);

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{backgroundColor: 'var(--color-bg-app)'}}>
            <div className="p-6 md:p-10 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xs font-black mb-8 uppercase tracking-[0.2em] flex items-center gap-2" style={{color: 'var(--color-text-muted)'}}>
                    <span className="material-symbols-outlined text-lg">upcoming</span>
                    Agenda Próxima
                </h3>

                {Object.keys(grouped).length === 0 ? (
                    <div className="text-center py-20 rounded-3xl border border-dashed"
                         style={{borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)'}}>
                        <span className="material-symbols-outlined text-5xl mb-4 block opacity-20" style={{color: 'var(--color-text-muted)'}}>event_upcoming</span>
                        <p className="font-medium" style={{color: 'var(--color-text-muted)'}}>No tienes eventos próximos en tu agenda.</p>
                    </div>
                ) : (
                    <div className="relative border-l-2 ml-3 md:ml-6 space-y-10 pb-20" style={{borderColor: 'var(--color-border-subtle)'}}>
                        {Object.entries(grouped).map(([dateStr, items]: [string, CalendarEvent[]]) => {
                            const dateObj = new Date(dateStr + 'T00:00:00');
                            const isToday = isSameDay(dateObj, new Date());
                            return (
                                <div key={dateStr} className="relative pl-6 md:pl-10">
                                    <div className={`absolute -left-[9px] top-1 size-4 rounded-full border-4 z-10 ${isToday ? 'bg-red-500' : ''}`}
                                         style={{borderColor: 'var(--color-bg-app)', backgroundColor: isToday ? '#EF4444' : 'var(--color-border-strong)'}}></div>
                                    <h4 className={`text-lg font-bold mb-4 capitalize flex items-center gap-2`}
                                        style={{color: isToday ? '#F87171' : 'var(--color-text-primary)'}}>
                                        {isToday && <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider" style={{backgroundColor: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)'}}>Hoy</span>}
                                        {format(dateObj, 'EEEE d MMMM', { locale: es })}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {items.map(evt => (
                                            <div key={evt.id} onClick={() => onEventClick(evt)}
                                                className="p-5 rounded-2xl border transition-all cursor-pointer group active:scale-[0.98]"
                                                style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}
                                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border-strong)'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 24px -8px rgba(0,0,0,0.5)'; }}
                                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border-subtle)'; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none'; }}
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg"
                                                          style={{backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)'}}>
                                                        {format(evt.start, 'HH:mm')}
                                                    </span>
                                                    {evt.type === 'exam' && <span className="material-symbols-outlined text-yellow-500 text-lg">stars</span>}
                                                </div>
                                                <h5 className="font-bold text-lg mb-1 leading-tight transition-colors" style={{color: 'var(--color-text-primary)'}}>
                                                    {evt.title}
                                                </h5>
                                                <p className="text-xs font-medium flex items-center gap-1 mt-2" style={{color: 'var(--color-text-secondary)'}}>
                                                    <span className="material-symbols-outlined text-[14px]">person</span>
                                                    {evt.instructor}
                                                </p>
                                            </div>
                                        ))}
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

// --- COMPONENT: DAY AGENDA DRAWER (Slide Panel) ---
const DayAgendaDrawer: React.FC<{
    isOpen: boolean;
    date: Date | null;
    events: CalendarEvent[];
    onClose: () => void;
    onEventClick: (e: CalendarEvent) => void;
}> = ({ isOpen, date, events, onClose, onEventClick }) => {
    return (
        <AnimatePresence>
            {isOpen && date && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[50]"
                    />
                    
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed inset-y-0 right-0 z-[60] w-full max-w-md shadow-2xl flex flex-col"
                        style={{backgroundColor: 'var(--color-bg-surface)', borderLeft: '1px solid var(--color-border-subtle)'}}
                    >
                        <div className="p-8 flex justify-between items-start shrink-0 border-b" style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}>
                            <div>
                                <h2 className="text-3xl font-black tracking-tight capitalize" style={{color: 'var(--color-text-primary)'}}>
                                    {format(date, 'EEEE', { locale: es })}
                                </h2>
                                <p className="font-medium text-lg capitalize" style={{color: 'var(--color-text-secondary)'}}>
                                    {format(date, 'd MMMM yyyy', { locale: es })}
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-full transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center" style={{color: 'var(--color-text-muted)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar" style={{backgroundColor: 'var(--color-bg-surface)'}}>
                            {events.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <span className="material-symbols-outlined text-6xl opacity-20 mb-4" style={{color: 'var(--color-text-muted)'}}>event_busy</span>
                                    <p className="font-medium" style={{color: 'var(--color-text-muted)'}}>No hay actividades programadas.</p>
                                </div>
                            ) : (
                                <div className="space-y-6 relative">
                                    <div className="absolute left-[19px] top-4 bottom-4 w-[2px]" style={{backgroundColor: 'var(--color-border-subtle)'}}></div>
                                    {events.map((evt) => (
                                        <div key={evt.id} onClick={() => onEventClick(evt)} className="relative pl-10 group cursor-pointer">
                                            <div className={`absolute left-2 top-2 size-6 rounded-full border-4 z-10 box-content`}
                                                 style={{borderColor: 'var(--color-bg-surface)', backgroundColor: evt.status === 'cancelled' ? 'var(--color-border-strong)' : '#FC6F6F'}}></div>
                                            <div className={`p-5 rounded-2xl border transition-all`}
                                                 style={evt.status === 'cancelled'
                                                     ? {backgroundColor: 'var(--color-bg-app)', borderColor: 'var(--color-border-subtle)', opacity: 0.6}
                                                     : {backgroundColor: 'var(--color-bg-raised)', borderColor: 'var(--color-border-subtle)'}}
                                                 onMouseEnter={e => { if (evt.status !== 'cancelled') (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.3)'; }}
                                                 onMouseLeave={e => { if (evt.status !== 'cancelled') (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-subtle)'; }}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold uppercase tracking-wider" style={{color: evt.status === 'cancelled' ? 'var(--color-text-muted)' : '#FC6F6F'}}>
                                                        {format(evt.start, 'HH:mm')} - {format(evt.end, 'HH:mm')}
                                                    </span>
                                                </div>
                                                <h3 className={`font-bold text-lg leading-tight mb-1`} style={{color: evt.status === 'cancelled' ? 'var(--color-text-muted)' : 'var(--color-text-primary)', textDecoration: evt.status === 'cancelled' ? 'line-through' : 'none'}}>
                                                    {evt.title}
                                                </h3>
                                                <p className="text-sm" style={{color: 'var(--color-text-secondary)'}}>{evt.instructor}</p>
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
};

// --- COMPONENT: EVENT DETAIL MODAL ---
const EventDetailModal: React.FC<{
    isOpen: boolean;
    event: CalendarEvent | null;
    onClose: () => void;
}> = ({ isOpen, event, onClose }) => {
    if (!isOpen || !event) return null;

    const isCancelled = event.status === 'cancelled';

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200" style={{backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)'}} onClick={onClose}>
            <div className="rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative border" style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}} onClick={e => e.stopPropagation()}>
                <div className={`h-32 relative overflow-hidden flex items-center justify-center`} style={{backgroundColor: isCancelled ? 'rgba(239,68,68,0.1)' : 'var(--color-bg-app)', borderBottom: '1px solid var(--color-border-subtle)'}}>
                    <div className="absolute inset-0" style={{background: 'radial-gradient(circle at 50% 0%, rgba(252,111,111,0.06) 0%, transparent 60%)'}}></div>
                    <div className="relative z-10 text-center flex flex-col items-center">
                        <span className="material-symbols-outlined text-4xl mb-2" style={{color: isCancelled ? '#F87171' : '#FC6F6F'}}>
                            {event.type === 'class' ? 'sports_martial_arts' : event.type === 'exam' ? 'workspace_premium' : 'emoji_events'}
                        </span>
                        <div className="px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border" style={{backgroundColor: 'var(--color-bg-raised)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-subtle)'}}>
                            {event.type === 'class' ? 'Clase' : 'Evento'}
                        </div>
                    </div>
                    <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full transition-all min-h-[48px] min-w-[48px] flex flex-col items-center justify-center" style={{backgroundColor: 'var(--color-bg-raised)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}>
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <div className="px-8 pb-10 -mt-6 relative z-10">
                    <div className="p-6 rounded-3xl shadow-lg flex flex-col gap-6 text-center border" style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}>
                        <div>
                            <h2 className={`text-2xl font-black leading-tight mb-2`} style={{color: isCancelled ? 'var(--color-text-muted)' : 'var(--color-text-primary)', textDecoration: isCancelled ? 'line-through' : 'none'}}>
                                {event.title}
                            </h2>
                            {isCancelled && (
                                <span className="inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border" style={{backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', borderColor: 'rgba(239,68,68,0.2)'}}>
                                    Clase Cancelada
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between p-3 rounded-2xl" style={{backgroundColor: 'var(--color-bg-app)'}}>
                                <span className="text-xs font-bold uppercase" style={{color: 'var(--color-text-muted)'}}>Fecha</span>
                                <span className="font-bold text-sm capitalize" style={{color: 'var(--color-text-primary)'}}>{format(event.start, 'd MMMM, yyyy', { locale: es })}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-2xl" style={{backgroundColor: 'var(--color-bg-app)'}}>
                                <span className="text-xs font-bold uppercase" style={{color: 'var(--color-text-muted)'}}>Horario</span>
                                <span className="font-bold text-sm" style={{color: 'var(--color-text-primary)'}}>{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-2xl" style={{backgroundColor: 'var(--color-bg-app)'}}>
                                <span className="text-xs font-bold uppercase" style={{color: 'var(--color-text-muted)'}}>Instructor</span>
                                <span className="font-bold text-sm" style={{color: 'var(--color-text-primary)'}}>{event.instructor || event.instructorName}</span>
                            </div>
                        </div>
                        {event.description && (
                            <div className="text-sm leading-relaxed text-left border-t pt-4" style={{color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-subtle)'}}>
                                {event.description}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const StudentSchedule: React.FC = () => {
    const { scheduleEvents } = useAcademy();
    const { currentUser, students, events, classes } = useStore();
    
    const [view, setView] = useState<ViewType>('agenda'); // Default to Agenda
    const [date, setDate] = useState(new Date());
    
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    
    const [drawerState, setDrawerState] = useState<{ isOpen: boolean; date: Date | null; events: CalendarEvent[] }>({
        isOpen: false,
        date: null,
        events: []
    });

    const student = useMemo(() => students.find(s => s.id === currentUser?.studentId), [students, currentUser]);

    const myEvents: CalendarEvent[] = useMemo(() => {
        if (!student) return [];
        return scheduleEvents.filter(evt => {
            if (evt.type === 'class' && evt.classId) {
                const targetClass = classes.find(c => c.id === evt.classId);
                return targetClass?.studentIds?.includes(student.id) || false;
            }
            
            const sourceEvent = events.find(e => e.id === evt.id);
            if (sourceEvent && sourceEvent.registrants?.includes(student.id)) {
                return true;
            }
            return false;
        });
    }, [scheduleEvents, student, events, classes]);

    const handleEventClick = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setIsEventModalOpen(true);
    };

    const handleDayClick = (d: Date, dayEvents: CalendarEvent[]) => {
        setDrawerState({ isOpen: true, date: d, events: dayEvents });
    };

    const handleNavigate = (direction: 'PREV' | 'NEXT' | 'TODAY') => {
        const now = new Date();
        if (direction === 'TODAY') {
            setDate(now);
            return;
        }
        const amount = direction === 'NEXT' ? 1 : -1;
        switch (view) {
            case 'year': setDate(prev => new Date(prev.getFullYear() + amount, prev.getMonth(), 1)); break;
            case 'month': setDate(prev => addMonths(prev, amount)); break;
            case 'week': setDate(prev => addWeeks(prev, amount)); break;
            case 'day': setDate(prev => addDays(prev, amount)); break;
            case 'agenda': break; // Agenda is infinite/list
        }
    };

    const headerTitle = useMemo(() => {
        switch (view) {
            case 'year': return format(date, 'yyyy');
            case 'month': return format(date, 'MMMM yyyy', { locale: es });
            case 'week': {
                const start = startOfWeek(date, { weekStartsOn: 1 });
                const end = endOfWeek(date, { weekStartsOn: 1 });
                if (isSameMonth(start, end)) return `${format(start, 'd')} - ${format(end, 'd')} ${format(start, 'MMMM', { locale: es })}`;
                return `${format(start, 'd MMM')} - ${format(end, 'd MMM', { locale: es })}`;
            }
            case 'day': return format(date, 'd MMMM', { locale: es });
            case 'agenda': return 'Mi Agenda';
            default: return '';
        }
    }, [view, date]);

    return (
        <div className="w-full min-h-full flex flex-col font-sans overflow-y-auto custom-scrollbar" style={{backgroundColor: 'var(--color-bg-app)'}}>  
            
            {/* --- IMMERSIVE HEADER (Relative now) --- */}
            <div className="flex flex-col md:flex-row justify-between items-center px-6 py-4 shrink-0 gap-4 z-20 border-b" style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}>
                <div className="flex items-center gap-6 w-full md:w-auto">
                    <h1 className="text-3xl font-black tracking-tight capitalize min-w-[200px]" style={{color: 'var(--color-text-primary)'}}>
                        {headerTitle}
                    </h1>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end overflow-x-auto no-scrollbar">
                    <div className="flex p-1 rounded-xl" style={{backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)'}}>
                        {[
                            { id: 'agenda', label: 'Agenda' },
                            { id: 'year', label: 'Año' },
                            { id: 'month', label: 'Mes' },
                            { id: 'week', label: 'Semana' },
                            { id: 'day', label: 'Día' },
                        ].map(v => (
                            <button
                                key={v.id}
                                onClick={() => setView(v.id as ViewType)}
                                className="px-4 py-2 min-h-[48px] rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                                style={view === v.id
                                    ? {backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)'}
                                    : {color: 'var(--color-text-muted)'}}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>

                    {view !== 'agenda' && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => handleNavigate('PREV')} className="size-9 flex items-center justify-center rounded-full transition-all min-h-[48px] min-w-[48px]" style={{color: 'var(--color-text-muted)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                                <span className="material-symbols-outlined text-xl">chevron_left</span>
                            </button>
                            <button onClick={() => handleNavigate('TODAY')} className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all min-h-[48px]" style={{color: 'var(--color-text-secondary)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                                Hoy
                            </button>
                            <button onClick={() => handleNavigate('NEXT')} className="size-9 flex items-center justify-center rounded-full transition-all min-h-[48px] min-w-[48px]" style={{color: 'var(--color-text-muted)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                                <span className="material-symbols-outlined text-xl">chevron_right</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MAIN CANVAS CONTENT --- */}
            <div className="flex-1 relative flex flex-col" style={{backgroundColor: 'var(--color-bg-app)'}}>
                
                {/* 1. VIEW: AGENDA (Scrolls Internally) */}
                {view === 'agenda' && (
                    <AgendaView events={myEvents} onEventClick={handleEventClick} />
                )}

                {/* 2. VIEW: WEEK (Scrolls Internally) */}
                {view === 'week' && (
                    <CleanWeekView date={date} events={myEvents} onEventClick={handleEventClick} />
                )}

                {/* 3. VIEW: DAY (Scrolls Internally) */}
                {view === 'day' && (
                    <CleanDayView date={date} events={myEvents} onEventClick={handleEventClick} />
                )}

                {/* 4. VIEW: MONTH (Scrolls Internally) */}
                {view === 'month' && (
                    <InfiniteMonthGrid 
                        date={date} 
                        events={myEvents} 
                        onDayClick={handleDayClick}
                    />
                )}

                {/* 5. VIEW: YEAR (Scrolls Internally) */}
                {view === 'year' && (
                    <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                        <YearView 
                            date={date} 
                            events={myEvents} 
                            onNavigate={setDate}
                            onMonthClick={(d) => { setDate(d); setView('month'); }}
                            onDayClick={(d) => { 
                                const dayEvents = myEvents.filter(e => isSameDay(e.start, d));
                                handleDayClick(d, dayEvents);
                            }}
                        />
                    </div>
                )}
            </div>

            <DayAgendaDrawer 
                isOpen={drawerState.isOpen}
                date={drawerState.date}
                events={drawerState.events}
                onClose={() => setDrawerState(prev => ({ ...prev, isOpen: false }))}
                onEventClick={(evt) => {
                    setDrawerState(prev => ({ ...prev, isOpen: false })); 
                    handleEventClick(evt); 
                }}
            />

            <EventDetailModal 
                isOpen={isEventModalOpen}
                event={selectedEvent}
                onClose={() => setIsEventModalOpen(false)}
            />
        </div>
    );
};

export default StudentSchedule;
