import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getLocalDate, formatDateDisplay } from '../../utils/dateUtils';
import { Event } from '../../types';
import { useToast } from '../../context/ToastContext';
import Avatar from '../../components/ui/Avatar'; 

// --- SUB-COMPONENT: EVENT MODAL (Dark Enterprise Style) ---
const EventDetailModal: React.FC<{
    event: Event | null;
    onClose: () => void;
    isRegistered: boolean;
    onRegister: () => void;
}> = ({ event, onClose, isRegistered, onRegister }) => {
    if (!event) return null;

    const getIcon = (type: string) => {
        switch(type) {
            case 'exam': return 'stars';
            case 'tournament': return 'emoji_events';
            default: return 'event';
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-[#0f0f0f] rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden border border-zinc-800 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-start justify-between p-6 md:p-8 border-b border-zinc-900 bg-[#0a0a0a] sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="size-10 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white flex items-center justify-center transition-all border border-zinc-800/50"
                        >
                            <span className="material-symbols-outlined text-xl">arrow_back</span>
                        </button>
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border
                                    ${event.type === 'exam' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 
                                      event.type === 'tournament' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                                      'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                    <span className="material-symbols-outlined text-[12px] filled">{getIcon(event.type)}</span>
                                    {event.type === 'exam' ? 'Examen de Grado' : event.type === 'tournament' ? 'Torneo Oficial' : 'Evento'}
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-white/90 leading-tight">
                                {event.title}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#0a0a0a]">
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50 flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-zinc-500 mb-2">
                                <span className="material-symbols-outlined text-base">calendar_month</span>
                                <span className="text-[9px] font-bold uppercase tracking-widest">Fecha</span>
                            </div>
                            <p className="text-sm font-bold text-white tracking-tight capitalize">
                                {new Date(event.date + 'T12:00:00').toLocaleDateString('es-ES', {weekday: 'short', day: 'numeric', month: 'long'})}
                            </p>
                        </div>
                        <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50 flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-zinc-500 mb-2">
                                <span className="material-symbols-outlined text-base">schedule</span>
                                <span className="text-[9px] font-bold uppercase tracking-widest">Horario</span>
                            </div>
                            <p className="text-sm font-bold text-white tracking-tight">{event.time}</p>
                        </div>
                    </div>

                    <div className="mb-6 bg-zinc-900/20 rounded-xl p-5 border border-zinc-800/40">
                        <h4 className="text-[9px] font-bold text-zinc-500 uppercase mb-3 tracking-[0.2em] flex items-center gap-2 opacity-60">
                            <span className="material-symbols-outlined text-[14px]">description</span>
                            Detalles
                        </h4>
                        <div className="text-[13px] text-zinc-400 font-medium leading-relaxed whitespace-pre-wrap break-words">
                            {event.description}
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-5 border-t border-zinc-900 bg-[#0a0a0a] flex flex-col justify-between items-center gap-4 shrink-0">
                    {!isRegistered ? (
                        <button
                            onClick={onRegister}
                            className="w-full py-4 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest"
                        >
                            <span className="material-symbols-outlined text-lg">how_to_reg</span>
                            <span>Confirmar Asistencia</span>
                        </button>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2 w-full text-emerald-500 font-bold bg-emerald-500/5 px-4 py-4 rounded-xl border border-emerald-500/10">
                            <span className="material-symbols-outlined text-2xl">check_circle</span>
                            <span className="text-xs uppercase tracking-widest">Ya estás inscrito</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN PAGE ---
const StudentClasses: React.FC = () => {
  const { classes, students, currentUser, events, registerForEvent } = useStore();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState<'classes' | 'events'>('classes');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Data
  const student = students.find(s => s.id === currentUser?.studentId);
  const myClasses = classes.filter(c => student && c.studentIds?.includes(student.id));

  // Logic: Filter Events
  const visibleEvents = useMemo(() => {
      if (!student) return [];
      const today = getLocalDate();
      
      return events.filter(e => {
          const isRegistered = e.registrants?.includes(student.id);
          const isFuturePublic = e.date >= today && e.isVisibleToStudents !== false;
          return isRegistered || isFuturePublic;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, student]);

  // Actions
  const handleRegister = () => {
      if (selectedEvent && student) {
          registerForEvent(student.id, selectedEvent.id);
          addToast('¡Inscripción exitosa!', 'success');
          setSelectedEvent(null);
      }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1400px] mx-auto w-full min-h-screen flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter" style={{color: 'var(--color-text-primary)'}}>Mis <span style={{color: 'var(--color-brand)'}}>Clases y Eventos</span></h1>
                <p className="mt-1.5 text-xs sm:text-sm font-medium" style={{color: 'var(--color-text-muted)'}}>Gestiona tu entrenamiento académico y actividades especiales.</p>
            </div>

            {/* --- TABS UI (Dark Enterprise Style) --- */}
            <div className="p-1.5 rounded-xl flex gap-1 relative w-full md:w-auto overflow-hidden" style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-strong)'}}>
                <button
                    onClick={() => setActiveTab('classes')}
                    className="relative z-10 flex-1 md:w-48 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors duration-200"
                    style={{color: activeTab === 'classes' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}}
                >
                    Clases Regulares
                    {activeTab === 'classes' && (
                        <motion.div layoutId="tab-bg-classes" className="absolute inset-0 rounded-lg shadow-sm -z-10" style={{backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)'}} transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('events')}
                    className="relative z-10 flex-1 md:w-56 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors duration-200"
                    style={{color: activeTab === 'events' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}}
                >
                    Eventos y Seminarios
                    {activeTab === 'events' && (
                        <motion.div layoutId="tab-bg-classes" className="absolute inset-0 rounded-lg shadow-sm -z-10" style={{backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)'}} transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                    )}
                </button>
            </div>
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="flex-1 mt-2">
            <AnimatePresence mode='wait'>
                
                {/* VIEW 1: CLASSES */}
                {activeTab === 'classes' && (
                    <motion.div 
                        key="classes"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        {myClasses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 rounded-[16px] text-center min-h-[300px]"
                                 style={{border: '1px dashed var(--color-border-strong)', backgroundColor: 'var(--color-bg-surface)'}}>
                                <div className="size-20 rounded-full flex items-center justify-center mb-5" style={{backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)'}}>
                                    <span className="material-symbols-outlined text-4xl" style={{color: 'var(--color-border-strong)'}}>class</span>
                                </div>
                                <h3 className="text-lg font-bold mb-1" style={{color: 'var(--color-text-primary)'}}>Sin clases asignadas</h3>
                                <p className="text-xs font-medium max-w-sm mx-auto" style={{color: 'var(--color-text-muted)'}}>
                                    Actualmente no estás inscrito en ningún grupo regular. Contacta a tu instructor para asignarte un horario.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {myClasses.map((cls, index) => (
                                    <div 
                                        key={cls.id} 
                                        onClick={() => navigate(`/student/classes/${cls.id}`)}
                                        className="p-7 rounded-[16px] group cursor-pointer transition-all relative overflow-hidden flex flex-col h-full"
                                        style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'}
                                    >
                                        {/* Subtle top color line */}
                                        <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: index % 2 === 0 ? '#FC6F6F' : 'var(--color-brand)'}}></div>
                                        
                                        {/* Background watermark icon for life */}
                                        <div className="absolute top-0 right-0 pointer-events-none opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                            <span className="material-symbols-outlined text-9xl" style={{color: index % 2 === 0 ? '#FC6F6F' : 'var(--color-brand)', transform: 'translate(15%, -15%)'}}>sports_martial_arts</span>
                                        </div>

                                        <div className="relative z-10 flex flex-col h-full">
                                            <div className="flex justify-between items-start mb-6">
                                                {/* Icon */}
                                                <div className="size-12 rounded-[12px] flex items-center justify-center shadow-sm" style={{backgroundColor: index % 2 === 0 ? 'rgba(56, 189, 248, 0.1)' : 'rgba(244, 63, 94, 0.1)', color: index % 2 === 0 ? '#FC6F6F' : 'var(--color-brand)'}}>
                                                    <span className="material-symbols-outlined text-2xl">sports_martial_arts</span>
                                                </div>
                                                {/* Minimal Badge */}
                                                <span className="px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider" style={{border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)'}}>
                                                    Grupo Regular
                                                </span>
                                            </div>
                                            
                                            <h3 className="text-[28px] leading-tight font-black mb-2 tracking-tighter" style={{color: 'var(--color-text-primary)'}}>{cls.name}</h3>
                                            
                                            <div className="flex items-center gap-2 mb-8" style={{color: 'var(--color-text-secondary)'}}>
                                                <Avatar name={cls.instructor} className="size-6 rounded-full text-[10px]" /> 
                                                <span className="text-xs font-semibold">{cls.instructor}</span>
                                            </div>

                                            <div className="flex items-center gap-3 text-[12px] font-semibold p-4 rounded-[12px] mt-auto" style={{backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)'}}>
                                                <span className="material-symbols-outlined text-[20px]" style={{color: 'var(--color-text-muted)'}}>schedule</span>
                                                <span className="tracking-wide">{cls.schedule}</span>
                                            </div>

                                            <div className="mt-5 w-full py-3.5 rounded-[12px] font-bold text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer" 
                                                 style={{border: '1px solid var(--color-border-strong)', color: 'var(--color-text-primary)'}}
                                                 onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                                                 onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                                            >
                                                Ver Detalles
                                                <span className="material-symbols-outlined text-sm" style={{color: 'var(--color-text-muted)'}}>arrow_forward</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* VIEW 2: EVENTS */}
                {activeTab === 'events' && (
                    <motion.div 
                        key="events"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        {visibleEvents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 rounded-[16px] text-center min-h-[300px]"
                                 style={{border: '1px dashed var(--color-border-strong)', backgroundColor: 'var(--color-bg-surface)'}}>
                                <div className="size-20 rounded-full flex items-center justify-center mb-5" style={{backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)'}}>
                                    <span className="material-symbols-outlined text-4xl" style={{color: 'var(--color-border-strong)'}}>event_busy</span>
                                </div>
                                <h3 className="text-lg font-bold mb-1" style={{color: 'var(--color-text-primary)'}}>No hay eventos próximos</h3>
                                <p className="text-xs font-medium max-w-sm mx-auto" style={{color: 'var(--color-text-muted)'}}>
                                    Mantente atento a nuevas convocatorias de torneos, exámenes y seminarios.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {visibleEvents.map(evt => {
                                    const isRegistered = student && evt.registrants?.includes(student.id);
                                    const dateObj = new Date(evt.date + 'T12:00:00');
                                    const day = dateObj.getDate();
                                    const month = dateObj.toLocaleDateString('es-ES', { month: 'short' });

                                    // Event accent color
                                    const accentColor = evt.type === 'tournament' ? '#FB923C' : evt.type === 'exam' ? '#FC6F6F' : '#FC6F6F';
                                    const bgAccent = evt.type === 'tournament' ? 'rgba(251, 146, 60, 0.1)' : evt.type === 'exam' ? 'rgba(167, 139, 250, 0.1)' : 'rgba(56, 189, 248, 0.1)';

                                    return (
                                        <div 
                                            key={evt.id}
                                            onClick={() => setSelectedEvent(evt)}
                                            className="p-7 rounded-[16px] group cursor-pointer transition-colors relative overflow-hidden flex flex-col h-full"
                                            style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'}
                                        >
                                            {/* Top accent line */}
                                            <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: accentColor}}></div>
                                            
                                            {/* Background watermark icon */}
                                            <div className="absolute top-0 right-0 pointer-events-none opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                                <span className="material-symbols-outlined text-9xl" style={{color: accentColor, transform: 'translate(10%, -10%)'}}>
                                                    {evt.type === 'exam' ? 'stars' : evt.type === 'tournament' ? 'emoji_events' : 'event'}
                                                </span>
                                            </div>

                                            <div className="flex gap-4 md:gap-5 mb-6 mt-2 relative z-10">
                                                {/* Minimal Date Badge */}
                                                <div className="flex flex-col items-center justify-center w-[60px] h-[60px] rounded-[14px] shrink-0"
                                                     style={{backgroundColor: bgAccent}}>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{color: accentColor}}>{month}</span>
                                                    <span className="text-2xl font-black leading-none" style={{color: 'var(--color-text-primary)'}}>{day}</span>
                                                </div>
                                                
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {isRegistered ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.15em] border" style={{backgroundColor: 'rgba(52, 211, 153, 0.05)', color: '#34D399', borderColor: 'rgba(52, 211, 153, 0.2)'}}>
                                                                <span className="material-symbols-outlined text-[10px] filled">check_circle</span> Inscrito
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-0 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.15em] border" style={{borderColor: 'var(--color-border-strong)', color: 'var(--color-text-muted)'}}>
                                                                Disponible
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-xl font-black leading-tight line-clamp-2 tracking-tighter" style={{color: 'var(--color-text-primary)'}}>
                                                        {evt.title}
                                                    </h3>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 text-[12px] font-semibold p-4 rounded-[12px] mt-auto relative z-10" style={{backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)'}}>
                                                <div className="flex items-center gap-2 flex-1">
                                                    <span className="material-symbols-outlined text-[20px]" style={{color: 'var(--color-text-muted)'}}>schedule</span>
                                                    <span className="tracking-wide">{evt.time}</span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 capitalize">
                                                    <span className="material-symbols-outlined text-[20px] opacity-80" style={{color: accentColor}}>
                                                        {evt.type === 'exam' ? 'stars' : evt.type === 'tournament' ? 'emoji_events' : 'event'}
                                                    </span>
                                                    <span className="text-[11px] font-bold tracking-wide uppercase">{evt.type === 'exam' ? 'Examen' : evt.type}</span>
                                                </div>
                                            </div>

                                            <div className="mt-5 w-full py-3.5 rounded-[12px] font-bold text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 relative z-10 cursor-pointer" 
                                                 style={{border: '1px solid var(--color-border-strong)', color: 'var(--color-text-primary)'}}
                                                 onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                                                 onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                                            >
                                                Ver Evento
                                                <span className="material-symbols-outlined text-sm" style={{color: 'var(--color-text-muted)'}}>arrow_forward</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Modal */}
        <EventDetailModal 
            event={selectedEvent} 
            onClose={() => setSelectedEvent(null)}
            isRegistered={!!(selectedEvent && student && selectedEvent.registrants?.includes(student.id))}
            onRegister={handleRegister}
        />
    </div>
  );
};

export default StudentClasses;
