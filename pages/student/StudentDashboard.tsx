
import React, { useMemo, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { Event, CalendarEvent, Student } from '../../types';
import { useAcademy } from '../../context/AcademyContext';
import { getLocalDate, formatDateDisplay } from '../../utils/dateUtils';
import Avatar from '../../components/ui/Avatar';

const StudentDashboard: React.FC = () => {
    const { currentUser, students, classes, academySettings, events, registerForEvent, records } = useStore();
    const { scheduleEvents } = useAcademy();
    const { addToast } = useToast();
    const navigate = useNavigate();

    // LIVE DATA: Force lookup from the fresh students list to get real-time balance/status updates
    // from FinanceContext > AcademyContext > Here.
    // Fallback to currentUser (as any) to prevent crash on initial load, though currentUser lacks 'balance'.
    const liveStudent = useMemo(() => {
        return students.find(s => s.id === currentUser?.studentId) || (currentUser as unknown as Student);
    }, [students, currentUser]);

    // -- STATE --
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    // -- 1. RANK PROGRESS LOGIC --
    // -- 1. RANK PROGRESS LOGIC --
    const defaultRank = { requiredAttendance: 100, name: 'Principiante', order: 0, id: 'default', color: 'white' };
    const ranks = academySettings?.ranks || [];
    const currentRankConfig = ranks.find(r => r.id === liveStudent?.rankId) || ranks[0] || defaultRank;
    const nextRankConfig = ranks.find(r => r.order === (currentRankConfig?.order || 0) + 1);
    const required = currentRankConfig?.requiredAttendance || 100;
    const current = liveStudent?.attendance || 0;
    // Calculate percentage but cap at 100
    const progressPercent = required > 0 ? Math.min((current / required) * 100, 100) : 100;

    // -- 2. FINANCIAL LOGIC --
    // Calculate debt directly from records to ensure it's always accurate even if students array sync is lagging
    const activeRecords = useMemo(() => {
        return records.filter(r => ['pending', 'overdue', 'charged', 'partial'].includes(r.status));
    }, [records]);

    const actualDebt = useMemo(() => {
        return activeRecords.reduce((acc, r) => {
            const currentAmount = r.status === 'overdue' ? (r.amount || 0) + (r.penaltyAmount || 0) : (r.amount || 0);
            return acc + currentAmount;
        }, 0);
    }, [activeRecords]);

    const hasDebt = actualDebt > 0;

    // -- 3. ENROLLED CLASSES LOGIC --
    const myEnrolledClasses = useMemo(() => {
        // More robust: Check if the global class list has this student registered
        return classes.filter(c => c.studentIds?.includes(liveStudent?.id || ''));
    }, [classes, liveStudent]);

    // -- 4. NEXT CLASS LOGIC --
    const nextClass = useMemo(() => {
        if (!liveStudent) return null;
        const now = new Date();

        const upcomingClasses = scheduleEvents.filter(evt => {
            if (evt.type !== 'class' || !evt.classId) return false;
            const targetClass = classes.find(c => c.id === evt.classId);
            if (!targetClass?.studentIds?.includes(liveStudent.id)) return false;
            if (evt.status === 'cancelled') return false;
            return evt.end > now;
        });

        upcomingClasses.sort((a, b) => a.start.getTime() - b.start.getTime());
        return upcomingClasses[0] || null;
    }, [scheduleEvents, liveStudent]);

    // -- 5. EVENTS LOGIC --
    const todayStr = getLocalDate();

    const nextAssignedExam = useMemo(() => {
        if (!liveStudent) return null;
        return events
            .filter(e => e.type === 'exam' && e.registrants?.includes(liveStudent.id) && e.date >= todayStr)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    }, [events, liveStudent, todayStr]);

    const marketplaceEvents = useMemo(() => {
        return events
            .filter(e => {
                if (e.date < todayStr) return false;
                if (nextAssignedExam && e.id === nextAssignedExam.id) return false;
                const isPublic = e.isVisibleToStudents !== false;
                const isRegistered = liveStudent && e.registrants?.includes(liveStudent.id);
                return isPublic || isRegistered;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 2); // Show only top 2 to save space
    }, [events, todayStr, liveStudent, nextAssignedExam]);


    // -- ACTIONS --
    const handleRegister = () => {
        if (liveStudent && selectedEvent) {
            registerForEvent(liveStudent.id, selectedEvent.id);
            addToast('¡Te has inscrito correctamente!', 'success');
            setSelectedEvent(null);
        }
    };

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'exam': return 'stars';
            case 'tournament': return 'emoji_events';
            case 'seminar': return 'menu_book';
            default: return 'event';
        }
    };

    if (!liveStudent) return <div className="p-10 text-center">Cargando perfil...</div>;

    return (
        <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto w-full flex flex-col gap-5 sm:gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">

            {/* --- HEADER: WELCOME & SUMMARY --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 sm:gap-4 mb-2">
                <div>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tighter" style={{color: 'var(--color-text-primary)'}}>
                        Hola, {liveStudent?.name.split(' ')[0]}
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm font-medium" style={{color: 'var(--color-text-muted)'}}>
                        {nextRankConfig
                            ? `Nivel actual: ${liveStudent?.rank} · ${Math.round(progressPercent)}% completado`
                            : '¡Has alcanzado el máximo nivel registrado!'}
                    </p>
                </div>
                
                <div className="hidden md:flex items-center gap-4 bg-zinc-900/50 border border-zinc-800/50 px-4 py-2 rounded-xl">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">Rango Actual</span>
                        <span className="text-sm font-bold text-white">{liveStudent?.rank}</span>
                    </div>
                    <div className="size-8 rounded-lg flex items-center justify-center bg-zinc-800">
                        <span className="material-symbols-outlined text-lg text-zinc-400">military_tech</span>
                    </div>
                </div>
            </div>

            {/* --- CRITICAL ALERT: EXAM --- */}
            {nextAssignedExam && (
                <div onClick={() => setSelectedEvent(nextAssignedExam)}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 mb-2 cursor-pointer transition-colors"
                    style={{
                        backgroundColor: 'rgba(252, 211, 77, 0.1)',
                        border: '1px solid rgba(252, 211, 77, 0.2)',
                        borderRadius: '10px'
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(252, 211, 77, 0.15)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(252, 211, 77, 0.1)'}
                >
                    <div className="flex items-center gap-4">
                        <span className="material-symbols-outlined text-3xl" style={{color: '#FCD34D'}}>stars</span>
                        <div>
                           <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-0.5" style={{color: '#FCD34D'}}>Convocatoria Oficial</div>
                           <h3 className="text-base font-bold" style={{color: '#FEF3C7'}}>{nextAssignedExam.title}</h3>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded" style={{backgroundColor: '#FCD34D', color: '#78350F'}}>
                        Ver Detalles
                    </span>
                </div>
            )}

            {/* ================================================================
                FILA 1: KPIs (Enterprise Style)
                ================================================================ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">

                {/* KPI 1 — Estado Financiero (Neutral/Status based) */}
                <div className="flex flex-col justify-between p-7 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden border group"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-subtle)',
                        borderRadius: '16px'
                    }}
                    onClick={() => navigate('/student/payments')}
                >
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-5 opacity-40"
                            style={{color: 'var(--color-text-primary)'}}>Estado de Cuenta</p>
                        <p className="text-4xl font-black tracking-tighter tabular-nums"
                            style={{color: hasDebt ? '#F87171' : 'var(--color-text-primary)'}}>
                            {hasDebt ? `$${actualDebt.toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : 'Al Día'}
                        </p>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-5 relative z-10">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{color: hasDebt ? '#F87171' : '#34D399'}}>
                            {hasDebt ? 'Vencido' : 'Suscripción Activa'}
                        </span>
                        <span className="material-symbols-outlined text-zinc-700 group-hover:text-zinc-500 transition-colors" style={{fontSize: '20px'}}>
                            {hasDebt ? 'account_balance_wallet' : 'check_circle'}
                        </span>
                    </div>
                </div>

                {/* KPI 2 — Asistencias (Clean Style) */}
                <div className="flex flex-col justify-between p-7 relative overflow-hidden border transition-all hover:scale-[1.02]"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-subtle)',
                        borderRadius: '16px'
                    }}>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-5 opacity-40"
                            style={{color: 'var(--color-text-primary)'}}>Asistencias</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-4xl font-black tracking-tighter text-white">{current}</p>
                            <span className="text-lg font-bold opacity-30">/ {required}</span>
                        </div>
                    </div>
                    <div className="mt-auto relative z-10">
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-zinc-800">
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%`, backgroundColor: '#3B82F6' }}></div>
                        </div>
                        <div className="flex justify-between mt-3">
                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-40">Progreso Kyu</span>
                            <span className="material-symbols-outlined text-zinc-700" style={{fontSize: '18px'}}>trending_up</span>
                        </div>
                    </div>
                </div>

                {/* KPI 3 — Próxima Clase (Highlight Style) */}
                <div className="col-span-1 lg:col-span-2 flex flex-col justify-between p-7 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden border group"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-subtle)',
                        borderRadius: '16px'
                    }}
                    onClick={() => navigate('/student/schedule')}
                >
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-5 opacity-40"
                            style={{color: 'var(--color-text-primary)'}}>Siguiente Sesión</p>
                        {nextClass ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-3xl font-black tracking-tighter text-white">
                                        {nextClass.title}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800">
                                            <span className="material-symbols-outlined text-[14px] text-blue-400">schedule</span>
                                            <span className="text-xs font-bold text-zinc-300">{nextClass.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800">
                                            <span className="material-symbols-outlined text-[14px] text-zinc-500">person</span>
                                            <span className="text-xs font-bold text-zinc-300">{nextClass.instructor.split(' ')[0]}</span>
                                        </div>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-zinc-800 group-hover:text-blue-500/20 transition-all font-light" style={{fontSize: '64px'}}>calendar_today</span>
                            </div>
                        ) : (
                            <div className="flex flex-col justify-center h-full gap-1">
                                <p className="text-2xl font-black tracking-tighter opacity-20">Sin clases hoy</p>
                                <p className="text-xs font-bold uppercase tracking-widest opacity-40">Consulta el calendario completo</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ================================================================
                FILA 2: MIS CLASES & EVENTOS/RANGO
                ================================================================ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">

                {/* MIS CLASES (Clean Master style) */}
                <div className="col-span-1 lg:col-span-8 flex flex-col"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: '16px',
                        overflow: 'hidden'
                    }}>
                    <div className="flex justify-between items-center px-7 py-6"
                        style={{borderBottom: '1px solid var(--color-border-subtle)'}}>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-[#FF5252]">Mi Formación</h3>
                            <p className="text-[10px] font-medium opacity-40 uppercase tracking-widest mt-0.5">Clases y Grupos Activos</p>
                        </div>
                        <button onClick={() => navigate('/student/classes')}
                            className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-zinc-800"
                            style={{color: 'var(--color-text-primary)'}}>
                            Ver Todos
                        </button>
                    </div>
                    
                    <div className="p-6 flex flex-col gap-4 flex-1">
                        {myEnrolledClasses.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {myEnrolledClasses.map(cls => (
                                    <div key={cls.id} onClick={() => navigate(`/student/classes/${cls.id}`)} 
                                         className="flex flex-col gap-5 p-5 cursor-pointer transition-all border border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 rounded-xl group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold px-2 py-1 uppercase tracking-widest bg-zinc-800 rounded"
                                                    style={{color: 'var(--color-text-muted)'}}>
                                                    {cls.studentCount} Alumnos
                                                </span>
                                            </div>
                                            <span className="material-symbols-outlined text-lg opacity-20 group-hover:opacity-100 group-hover:text-[#FF5252] transition-all">arrow_forward_ios</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg leading-tight" style={{color: 'var(--color-text-primary)'}}>{cls.name}</h4>
                                            <div className="flex items-center gap-1.5 mt-2 opacity-50">
                                                <span className="material-symbols-outlined text-[14px]">schedule</span> 
                                                <p className="text-[11px] font-bold uppercase tracking-wider">{cls.schedule}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 pt-4 mt-auto border-t border-zinc-800/50">
                                            <Avatar name={cls.instructor} className="size-6 rounded-full text-[10px] ring-1 ring-zinc-800" />
                                            <span className="text-[11px] font-bold text-zinc-400">{cls.instructor}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="col-span-full py-16 text-center flex flex-col items-center gap-3">
                                <span className="material-symbols-outlined text-zinc-800" style={{fontSize: '48px'}}>school</span>
                                <p className="text-xs font-bold uppercase tracking-widest opacity-30">Sin grupos registrados</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Mi Progreso — Clean Style integrated */}
                    {myEnrolledClasses.length < 2 && (
                        <div className="px-6 pb-6 mt-auto">
                            <div className="p-5 border border-zinc-800 bg-zinc-900/20 rounded-xl">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF5252]">Progreso de Grado</p>
                                    <span className="text-[10px] font-black tabular-nums opacity-40">
                                        {current} / {required} clases
                                    </span>
                                </div>
                                <div className="flex items-end gap-3 mb-3">
                                    <p className="text-4xl font-black tabular-nums leading-none text-white">
                                        {Math.round(progressPercent)}%
                                    </p>
                                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-40">Completado</p>
                                </div>
                                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RANGO & EVENTOS PRÓXIMOS */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-4 sm:gap-5">

                    {/* Tu Cinturón — PRIMERO */}
                    {liveStudent && (
                        <div style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-subtle)',
                            borderRadius: '16px',
                            overflow: 'hidden'
                        }}>
                            {/* Header */}
                            <div className="px-7 py-5" style={{borderBottom: '1px solid var(--color-border-subtle)'}}>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-100">Grado Actual</h3>
                                <p className="text-[9px] font-medium opacity-30 uppercase tracking-[0.2em] mt-0.5">Progreso y Nivel</p>
                            </div>

                            {/* Belt Image — Clean & Professional */}
                            {(() => {
                                const kyuImageMap: Record<string, string> = {
                                    'Blanca':       '/Grados/10%20kyu.png',
                                    'Blanca Av.':   '/Grados/9%20kyu.png',
                                    'Amarilla':     '/Grados/8%20kyu.png',
                                    'Amarilla Av.': '/Grados/7%20kyu.png',
                                    'Verde':        '/Grados/6%20kyu.png',
                                    'Verde Av.':    '/Grados/5%20kyu.png',
                                    'Azul':         '/Grados/4%20kyu.png',
                                    'Azul Av.':     '/Grados/3%20kyu.png',
                                    'Cafe':         '/Grados/2%20kyu.png',
                                    'Cafe Av.':     '/Grados/1%20kyu.png',
                                    'Shodan Ho':    '/Grados/1%20kyu.png',
                                    'Negra':        '/Grados/negra.png',
                                };
                                const beltImg = kyuImageMap[currentRankConfig?.name] || null;
                                return (
                                    <div className="relative flex flex-col items-center justify-center px-7 py-10">
                                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-gradient-to-b from-white to-transparent"></div>

                                        {/* Belt image */}
                                        {beltImg ? (
                                            <div className="relative group">
                                                <div className="absolute inset-x-0 bottom-0 h-10 bg-black/40 blur-2xl rounded-full scale-x-75 opacity-50"></div>
                                                <img
                                                    src={beltImg}
                                                    alt={`Cinturón ${currentRankConfig?.name}`}
                                                    className="relative object-contain transition-transform duration-700 group-hover:scale-105"
                                                    style={{ width: '100%', maxWidth: '180px', height: '140px' }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full h-24 rounded-xl flex items-center justify-center text-xs font-bold uppercase tracking-widest opacity-20 border border-dashed border-zinc-700">
                                                Sin imagen de grado
                                            </div>
                                        )}

                                        <h2 className="mt-8 text-2xl font-black tracking-tight text-center text-white">
                                            {liveStudent.rank}
                                        </h2>

                                        {/* Progress label only */}
                                        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">
                                            {current} Clases registradas
                                        </p>
                                    </div>
                                );
                            })()}

                            {/* Footer */}
                            <div className="px-7 py-4 flex justify-between items-center text-[10px] uppercase tracking-widest font-bold"
                                style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>
                                    {liveStudent.stripes > 0 ? `${liveStudent.stripes} ${liveStudent.stripes === 1 ? 'Grado' : 'Grados'}` : 'Sin grados'}
                                </span>
                                {nextRankConfig && (
                                    <span style={{ color: 'var(--color-brand)' }}>
                                        Próximo: {nextRankConfig.name}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Eventos Próximos — SEGUNDO */}
                    <div style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: '16px',
                        overflow: 'hidden'
                    }}>
                        <div className="px-7 py-5" style={{borderBottom: '1px solid var(--color-border-subtle)'}}>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-[#FF5252]">Agenda</h3>
                            <p className="text-[9px] font-medium opacity-30 uppercase tracking-[0.2em] mt-0.5">Eventos y Convocatorias</p>
                        </div>
                        <div className="p-0">
                            {marketplaceEvents.length > 0 ? (
                                marketplaceEvents.map((evt, i) => (
                                    <div key={evt.id} onClick={() => setSelectedEvent(evt)} 
                                        className="flex items-center justify-between px-6 py-4 cursor-pointer transition-colors"
                                        style={{borderBottom: i < marketplaceEvents.length - 1 ? '1px solid var(--color-border-subtle)' : 'none'}}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-[9px] font-bold uppercase" style={{color: 'var(--color-brand)'}}>
                                                    {formatDateDisplay(evt.date, { month: 'short' })}
                                                </span>
                                                <span className="text-lg font-black leading-none" style={{color: 'var(--color-text-primary)'}}>
                                                    {formatDateDisplay(evt.date, { day: 'numeric' })}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold" style={{color: 'var(--color-text-primary)'}}>{evt.title}</p>
                                                <p className="text-[10px] font-medium mt-0.5" style={{color: 'var(--color-text-muted)'}}>
                                                    {evt.time} · {evt.type === 'exam' ? 'Examen' : 'Evento'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-10 text-center flex flex-col items-center gap-3">
                                    <span className="material-symbols-outlined" style={{fontSize: '24px', color: 'var(--color-border-strong)'}}>event_busy</span>
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: 'var(--color-text-muted)'}}>Sin eventos programados</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* --- EVENT MODAL (Dark Enterprise Style) --- */}
            {selectedEvent && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedEvent(null)}>
                    <div className="bg-[#0f0f0f] rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden border border-zinc-800 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                        <div className="flex items-start justify-between p-6 md:p-8 border-b border-zinc-900 bg-[#0a0a0a] sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setSelectedEvent(null)}
                                    className="size-12 md:size-10 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white flex items-center justify-center transition-all border border-zinc-800/50"
                                >
                                    <span className="material-symbols-outlined text-[20px] md:text-xl">arrow_back</span>
                                </button>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${selectedEvent.type === 'exam' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : selectedEvent.type === 'tournament' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                            <span className="material-symbols-outlined text-[12px] filled">{getEventIcon(selectedEvent.type)}</span>
                                            {selectedEvent.type === 'exam' ? 'Examen de Grado' : 'Evento Oficial'}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-bold text-white/90 leading-tight">
                                        {selectedEvent.title}
                                    </h2>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#0a0a0a]">
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50 flex flex-col justify-between">
                                    <div className="flex items-center gap-2 text-zinc-500 mb-2">
                                        <span className="material-symbols-outlined text-base">calendar_month</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest">Fecha</span>
                                    </div>
                                    <p className="text-sm font-bold text-white tracking-tight">{formatDateDisplay(selectedEvent.date)}</p>
                                </div>
                                <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50 flex flex-col justify-between">
                                    <div className="flex items-center gap-2 text-zinc-500 mb-2">
                                        <span className="material-symbols-outlined text-base">schedule</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest">Horario</span>
                                    </div>
                                    <p className="text-sm font-bold text-white tracking-tight">{selectedEvent.time}</p>
                                </div>
                            </div>

                            <div className="mb-6 bg-zinc-900/20 rounded-xl p-5 border border-zinc-800/40">
                                <h4 className="text-[9px] font-bold text-zinc-500 uppercase mb-3 tracking-[0.2em] flex items-center gap-2 opacity-60">
                                    <span className="material-symbols-outlined text-[14px]">description</span>
                                    Detalles
                                </h4>
                                <div className="text-[13px] text-zinc-400 font-medium leading-relaxed whitespace-pre-wrap break-words">
                                    {selectedEvent.description}
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-zinc-900 bg-[#0a0a0a] flex flex-col justify-between items-center gap-4">
                            {selectedEvent.type === 'exam' && !selectedEvent.registrants?.includes(liveStudent?.id || '') ? (
                                <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 flex items-start gap-3 w-full">
                                    <span className="material-symbols-outlined text-amber-500">info</span>
                                    <div>
                                        <p className="text-sm font-bold text-amber-500/90">Inscripción Controlada</p>
                                        <p className="text-xs text-amber-500/60 mt-1 font-medium">
                                            Contacta a tu maestro para confirmar tu elegibilidad.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {selectedEvent.registrants?.includes(liveStudent?.id || '') ? (
                                        <div className="flex flex-col items-center justify-center gap-2 w-full text-emerald-500 font-bold bg-emerald-500/5 px-4 py-4 rounded-xl border border-emerald-500/10">
                                            <span className="material-symbols-outlined text-2xl">check_circle</span>
                                            <span className="text-xs uppercase tracking-widest">Ya estás inscrito</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleRegister}
                                            className="w-full py-4 min-h-[48px] bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 text-[14px] md:text-xs uppercase tracking-widest"
                                        >
                                            <span className="material-symbols-outlined text-xl md:text-lg">how_to_reg</span>
                                            <span>Confirmar Inscripción</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;

