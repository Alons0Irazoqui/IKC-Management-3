
import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { ClassException } from '../../types';

const CalendarManager: React.FC = () => {
  const { classes, modifyClassSession } = useStore();
  const { addToast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Modal State
  const [selectedSession, setSelectedSession] = useState<{
      classId: string, 
      date: string, 
      currentInfo: any,
      exception?: ClassException 
  } | null>(null);
  
  const [editForm, setEditForm] = useState({ instructor: '', startTime: '', endTime: '' });

  // --- CALENDAR LOGIC REWRITE ---

  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const days = [];
      
      // Pad with empty days for start of week (Sunday start)
      for (let i = 0; i < firstDay.getDay(); i++) {
          days.push(null);
      }
      
      // Fill actual days
      for (let i = 1; i <= lastDay.getDate(); i++) {
          days.push(new Date(year, month, i));
      }
      
      return days;
  };

  const getDayNameEnglish = (date: Date) => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[date.getDay()];
  };

  const generateEventsForDay = (day: Date) => {
      if (!day) return [];
      const dateStr = day.toISOString().split('T')[0];
      const dayName = getDayNameEnglish(day);
      const events: any[] = [];

      classes.forEach(cls => {
          // 1. Is it a regular schedule day?
          const isScheduled = cls.days.includes(dayName);
          
          // 2. Check exceptions
          const exception = cls.modifications.find(m => m.date === dateStr);
          const movedHere = cls.modifications.find(m => m.newDate === dateStr && m.type === 'move');

          if (movedHere) {
               events.push({
                  id: `move-${cls.id}-${dateStr}`,
                  classId: cls.id,
                  name: cls.name,
                  date: dateStr,
                  startTime: movedHere.newStartTime || cls.startTime,
                  endTime: movedHere.newEndTime || cls.endTime,
                  instructor: movedHere.newInstructor || cls.instructor,
                  type: 'moved_here'
               });
          } else if (isScheduled) {
              if (exception?.type === 'cancel') {
                   events.push({
                      id: `cancel-${cls.id}-${dateStr}`,
                      classId: cls.id,
                      name: cls.name,
                      startTime: cls.startTime,
                      type: 'cancelled'
                   });
              } else if (exception?.type === 'move') {
                   // Ghost event (moved away)
                   events.push({
                      id: `ghost-${cls.id}-${dateStr}`,
                      name: cls.name,
                      type: 'ghost'
                   });
              } else {
                   // Regular or Modified time/instructor
                   events.push({
                      id: `reg-${cls.id}-${dateStr}`,
                      classId: cls.id,
                      name: cls.name,
                      date: dateStr,
                      startTime: exception?.newStartTime || cls.startTime,
                      endTime: exception?.newEndTime || cls.endTime,
                      instructor: exception?.newInstructor || cls.instructor,
                      type: exception ? 'modified' : 'regular',
                      exception
                   });
              }
          }
      });
      
      return events.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  };

  // --- ACTIONS ---

  const handleSessionClick = (event: any) => {
      if (event.type === 'ghost' || event.type === 'cancelled') return;
      setSelectedSession({
          classId: event.classId,
          date: event.date,
          currentInfo: event,
          exception: event.exception
      });
      setEditForm({
          instructor: event.instructor,
          startTime: event.startTime,
          endTime: event.endTime
      });
  };

  const handleSaveChanges = () => {
      if (!selectedSession) return;
      const exception: ClassException = {
          date: selectedSession.date,
          type: 'time', 
          newInstructor: editForm.instructor,
          newStartTime: editForm.startTime,
          newEndTime: editForm.endTime
      };
      modifyClassSession(selectedSession.classId, exception);
      addToast('Sesión actualizada', 'success');
      setSelectedSession(null);
  };

  const handleCancelSession = () => {
      if (!selectedSession) return;
      if (confirm('¿Cancelar esta clase para esta fecha?')) {
          modifyClassSession(selectedSession.classId, {
              date: selectedSession.date,
              type: 'cancel'
          });
          addToast('Clase cancelada', 'info');
          setSelectedSession(null);
      }
  };

  const calendarDays = getDaysInMonth(currentMonth);

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight" style={{ color: '#dde1e7' }}>Calendario Maestro</h1>
                <p className="mt-1" style={{ color: '#9ca3af' }}>Vista global de todas las clases.</p>
            </div>
            
            <div className="flex items-center p-1 rounded-xl w-full md:w-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-lg transition-colors" style={{ color: '#9ca3af' }}>
                    <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <span className="flex-1 md:w-44 text-center text-sm font-bold capitalize" style={{ color: '#dde1e7' }}>
                    {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-lg transition-colors" style={{ color: '#9ca3af' }}>
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
            </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-hidden flex flex-col rounded-2xl" style={{ background: '#0e0e11', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Week Header */}
            <div className="grid grid-cols-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                    <div key={day} className="py-4 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4b5563' }}>
                        {day}
                    </div>
                ))}
            </div>
            
            {/* Days Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                {calendarDays.map((day, idx) => {
                    if (!day) {
                        return <div key={`empty-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.1)' }}></div>;
                    }

                    const dateStr = day.toISOString().split('T')[0];
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    const events = generateEventsForDay(day);

                    return (
                        <div
                            key={dateStr}
                            className="p-2 min-h-[100px] flex flex-col gap-1 transition-colors"
                            style={{
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                borderRight: '1px solid rgba(255,255,255,0.04)',
                                background: isToday ? 'rgba(225,29,72,0.05)' : 'transparent',
                            }}
                        >
                            <span
                                className="text-[11px] font-bold mb-0.5 ml-1 w-6 h-6 flex items-center justify-center rounded-full"
                                style={isToday
                                    ? { background: '#e11d48', color: '#fff' }
                                    : { color: '#4b5563' }
                                }
                            >
                                {day.getDate()}
                            </span>
                            
                            <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[120px] no-scrollbar">
                                {events.map(evt => (
                                    <div
                                        key={evt.id}
                                        onClick={() => handleSessionClick(evt)}
                                        className="px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer truncate transition-all"
                                        style={{
                                            ...(evt.type === 'cancelled'
                                                ? { background: 'rgba(225,29,72,0.1)', color: '#e11d48', opacity: 0.7, textDecoration: 'line-through', border: '1px solid rgba(225,29,72,0.15)' }
                                                : evt.type === 'ghost'
                                                ? { background: 'rgba(255,255,255,0.03)', color: '#4b5563', opacity: 0.5, border: '1px dashed rgba(255,255,255,0.08)' }
                                                : evt.type === 'moved_here'
                                                ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }
                                                : evt.type === 'modified'
                                                ? { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }
                                                : { background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.18)' }
                                            ),
                                        }}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span>{evt.startTime}</span>
                                            {evt.type === 'modified' && <span className="size-1.5 rounded-full" style={{ background: '#f59e0b' }}></span>}
                                        </div>
                                        <div className="truncate">{evt.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Edit Modal */}
        {selectedSession && (
            <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
                <div className="rounded-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200" style={{ background: '#101014', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-bold" style={{ color: '#dde1e7' }}>Editar Sesión</h3>
                            <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>{selectedSession.date}</p>
                        </div>
                        <button onClick={() => setSelectedSession(null)} className="p-2 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl transition-colors" style={{ color: '#6b7280', background: 'rgba(255,255,255,0.05)' }}><span className="material-symbols-outlined">close</span></button>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>Instructor</label>
                            <input className="w-full rounded-xl p-3 text-sm font-medium outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} value={editForm.instructor} onChange={e => setEditForm({...editForm, instructor: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>Inicio</label>
                                <input type="time" className="w-full rounded-xl p-3 text-sm font-medium outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} value={editForm.startTime} onChange={e => setEditForm({...editForm, startTime: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>Fin</label>
                                <input type="time" className="w-full rounded-xl p-3 text-sm font-medium outline-none" style={{ background: '#18181d', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }} value={editForm.endTime} onChange={e => setEditForm({...editForm, endTime: e.target.value})} />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 mt-2">
                            <button onClick={handleCancelSession} className="flex-1 py-3 min-h-[48px] md:min-h-0 rounded-xl font-bold text-sm transition-all" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.2)' }}>Cancelar Clase</button>
                            <button onClick={handleSaveChanges} className="flex-1 py-3 min-h-[48px] md:min-h-0 rounded-xl font-bold text-sm text-white transition-all" style={{ background: '#e11d48', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}>Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CalendarManager;
