import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { formatDateDisplay } from '../../utils/dateUtils';
import Avatar from '../../components/ui/Avatar';

const MONTH_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function parseLocal(s: string): Date {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}

const StudentClassDetail: React.FC = () => {
    const { classId } = useParams<{ classId: string }>();
    const navigate = useNavigate();
    const { classes, students, currentUser } = useStore();

    const currentClass = classes.find(c => c.id === classId);
    const me = students.find(s => s.id === currentUser?.studentId);

    const [showMonthly, setShowMonthly] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

    if (!currentClass || !me) {
        return (
            <div className="flex items-center justify-center p-20 min-h-screen" style={{backgroundColor: 'var(--color-bg-app)'}}>
                <div className="text-center">
                    <span className="material-symbols-outlined text-6xl mb-4" style={{color: 'var(--color-border-strong)'}}>error</span>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{color: 'var(--color-text-muted)'}}>Clase no encontrada</p>
                </div>
            </div>
        );
    }

    // Find classmates (excluding self)
    const classmates = students.filter(s => currentClass.studentIds.includes(s.id) && s.id !== me.id);

    // Filter attendance history strictly for this class
    const myHistoryRaw = me.attendanceHistory?.filter(r => r.classId === classId) || [];
    const myHistory = [...myHistoryRaw].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalClasses = myHistory.length;
    const presentCount = myHistory.filter(r => r.status === 'present' || r.status === 'late').length;
    const attendanceRate = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 100;

    // Monthly helpers
    const year = new Date().getFullYear();

    const getMonthSummary = (month: number) => {
        const records = myHistoryRaw.filter(r => {
            const d = parseLocal(r.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        const present = records.filter(r => r.status === 'present').length;
        const late = records.filter(r => r.status === 'late').length;
        const absent = records.filter(r => r.status === 'absent').length;
        const excused = records.filter(r => r.status === 'excused').length;
        return { present, late, absent, excused, total: records.length, records };
    };

    const getStatusColors = (status: string) => {
        switch (status) {
            case 'present': return { bg: 'rgba(52, 211, 153, 0.1)', text: '#34D399', border: 'rgba(52, 211, 153, 0.2)', label: 'Presente' };
            case 'late': return { bg: 'rgba(251, 191, 36, 0.1)', text: '#FBBF24', border: 'rgba(251, 191, 36, 0.2)', label: 'Retardo' };
            case 'excused': return { bg: 'rgba(96, 165, 250, 0.1)', text: '#60A5FA', border: 'rgba(96, 165, 250, 0.2)', label: 'Justificado' };
            default: return { bg: 'rgba(244, 63, 94, 0.1)', text: '#F43F5E', border: 'rgba(244, 63, 94, 0.2)', label: 'Falta' };
        }
    };

    // ─────────────────────────────────────────────────────────
    // MONTHLY DASHBOARD OVERLAY
    // ─────────────────────────────────────────────────────────
    if (showMonthly) {
        if (selectedMonth !== null) {
            const summary = getMonthSummary(selectedMonth);
            const records = [...summary.records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return (
                <div className="fixed inset-0 z-[60] flex flex-col animate-in fade-in duration-300" style={{backgroundColor: 'var(--color-bg-app)'}}>
                    <div className="px-6 py-5 flex items-center gap-4 sticky top-0 z-10 backdrop-blur-md" style={{backgroundColor: 'rgba(10, 10, 10, 0.8)', borderBottom: '1px solid var(--color-border-subtle)'}}>
                        <button onClick={() => setSelectedMonth(null)} className="p-2 rounded-full transition-colors" style={{color: 'var(--color-text-muted)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-lg font-black leading-none" style={{color: 'var(--color-text-primary)'}}>Mi Historial Mensual</h1>
                            <p className="text-[11px] font-bold uppercase tracking-widest mt-1" style={{color: 'var(--color-text-muted)'}}>{MONTH_ES[selectedMonth]} {year} — {currentClass.name}</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6 md:p-10 max-w-[1200px] mx-auto w-full">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
                            <div className="relative overflow-hidden p-6 md:p-8 rounded-[24px] border flex flex-col justify-between group transition-colors" style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'}>
                                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                    <span className="material-symbols-outlined text-[80px]" style={{color: '#34D399', transform: 'translate(10%, -10%)'}}>check_circle</span>
                                </div>
                                <div className="absolute top-0 left-0 w-full h-[3px]" style={{background: 'linear-gradient(90deg, #34D399 0%, transparent 100%)', boxShadow: '0 0 15px rgba(52, 211, 153, 0.4)'}}></div>
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-6 relative z-10" style={{color: 'var(--color-text-muted)'}}>Presentes</p>
                                <p className="text-4xl sm:text-5xl font-black relative z-10" style={{color: '#34D399', filter: 'drop-shadow(0 0 10px rgba(52, 211, 153, 0.2))'}}>{summary.present}</p>
                            </div>
                            <div className="relative overflow-hidden p-6 md:p-8 rounded-[24px] border flex flex-col justify-between group transition-colors" style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'}>
                                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                    <span className="material-symbols-outlined text-[80px]" style={{color: '#FBBF24', transform: 'translate(10%, -10%)'}}>schedule</span>
                                </div>
                                <div className="absolute top-0 left-0 w-full h-[3px]" style={{background: 'linear-gradient(90deg, #FBBF24 0%, transparent 100%)', boxShadow: '0 0 15px rgba(251, 191, 36, 0.4)'}}></div>
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-6 relative z-10" style={{color: 'var(--color-text-muted)'}}>Retardos</p>
                                <p className="text-4xl sm:text-5xl font-black relative z-10" style={{color: '#FBBF24', filter: 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.2))'}}>{summary.late}</p>
                            </div>
                            <div className="relative overflow-hidden p-6 md:p-8 rounded-[24px] border flex flex-col justify-between group transition-colors" style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'}>
                                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                    <span className="material-symbols-outlined text-[80px]" style={{color: '#F43F5E', transform: 'translate(10%, -10%)'}}>cancel</span>
                                </div>
                                <div className="absolute top-0 left-0 w-full h-[3px]" style={{background: 'linear-gradient(90deg, #F43F5E 0%, transparent 100%)', boxShadow: '0 0 15px rgba(244, 63, 94, 0.4)'}}></div>
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-6 relative z-10" style={{color: 'var(--color-text-muted)'}}>Faltas</p>
                                <p className="text-4xl sm:text-5xl font-black relative z-10" style={{color: '#F43F5E', filter: 'drop-shadow(0 0 10px rgba(244, 63, 94, 0.2))'}}>{summary.absent}</p>
                            </div>
                            <div className="relative overflow-hidden p-6 md:p-8 rounded-[24px] border flex flex-col justify-between group transition-colors" style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'}>
                                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                    <span className="material-symbols-outlined text-[80px]" style={{color: '#60A5FA', transform: 'translate(10%, -10%)'}}>info</span>
                                </div>
                                <div className="absolute top-0 left-0 w-full h-[3px]" style={{background: 'linear-gradient(90deg, #60A5FA 0%, transparent 100%)', boxShadow: '0 0 15px rgba(96, 165, 250, 0.4)'}}></div>
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-6 relative z-10" style={{color: 'var(--color-text-muted)'}}>Justificadas</p>
                                <p className="text-4xl sm:text-5xl font-black relative z-10" style={{color: '#60A5FA', filter: 'drop-shadow(0 0 10px rgba(96, 165, 250, 0.2))'}}>{summary.excused}</p>
                            </div>
                        </div>

                        {/* Details List */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3 mb-2 px-2">
                                <span className="material-symbols-outlined text-xl" style={{color: 'var(--color-border-strong)'}}>event_note</span>
                                <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em]" style={{color: 'var(--color-text-muted)'}}>Asistencias de {MONTH_ES[selectedMonth]}</h3>
                            </div>
                            {records.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-20 text-center rounded-[24px] border-2 border-dashed transition-all" style={{borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)'}}>
                                    <div className="size-20 rounded-full flex items-center justify-center mb-6" style={{backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)'}}>
                                        <span className="material-symbols-outlined text-4xl" style={{color: 'var(--color-border-strong)'}}>event_busy</span>
                                    </div>
                                    <p className="text-[11px] font-bold uppercase tracking-widest" style={{color: 'var(--color-text-muted)'}}>Sin registros en este mes.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {records.map((rec, idx) => {
                                        const c = getStatusColors(rec.status);
                                        return (
                                            <div key={idx} className="p-6 md:p-8 rounded-[24px] flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-all relative overflow-hidden group cursor-default"
                                                 style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}
                                                 onMouseEnter={e => {
                                                     const target = e.currentTarget as HTMLElement;
                                                     target.style.borderColor = 'var(--color-border-strong)';
                                                     target.style.transform = 'translateY(-2px)';
                                                     target.style.boxShadow = '0 10px 30px -15px rgba(0,0,0,0.5)';
                                                     target.style.backgroundColor = 'var(--color-bg-raised)';
                                                 }}
                                                 onMouseLeave={e => {
                                                     const target = e.currentTarget as HTMLElement;
                                                     target.style.borderColor = 'var(--color-border-subtle)';
                                                     target.style.transform = 'translateY(0)';
                                                     target.style.boxShadow = 'none';
                                                     target.style.backgroundColor = 'var(--color-bg-surface)';
                                                 }}>
                                                <div>
                                                    <p className="font-bold text-sm capitalize mb-1" style={{color: 'var(--color-text-primary)'}}>{formatDateDisplay(rec.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                                    <p className="text-[11px] font-medium" style={{color: 'var(--color-text-secondary)'}}>{currentClass.schedule}</p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-4 justify-between sm:justify-end">
                                                    {rec.reason && rec.status === 'excused' && (
                                                        <div className="text-left rounded-lg p-2.5 max-w-xs border" style={{backgroundColor: 'rgba(96, 165, 250, 0.05)', borderColor: 'rgba(96, 165, 250, 0.1)'}}>
                                                            <p className="text-[9px] font-bold uppercase mb-1 flex items-center gap-1" style={{color: '#60A5FA'}}>
                                                                <span className="material-symbols-outlined text-[10px]">info</span> Motivo:
                                                            </p>
                                                            <p className="text-[11px] font-medium leading-tight" style={{color: '#93C5FD'}}>{rec.reason}</p>
                                                        </div>
                                                    )}
                                                    <span className="text-[9px] font-bold uppercase px-3 py-1.5 rounded-full border tracking-widest whitespace-nowrap"
                                                          style={{backgroundColor: c.bg, color: c.text, borderColor: c.border}}>
                                                        {c.label}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // Selection view for months
        return (
            <div className="fixed inset-0 z-[60] flex flex-col animate-in fade-in duration-300" style={{backgroundColor: 'var(--color-bg-app)'}}>
                <div className="px-6 py-5 flex items-center gap-4 sticky top-0 z-10 backdrop-blur-md" style={{backgroundColor: 'rgba(10, 10, 10, 0.8)', borderBottom: '1px solid var(--color-border-subtle)'}}>
                    <button onClick={() => setShowMonthly(false)} className="p-2 rounded-full transition-colors" style={{color: 'var(--color-text-muted)'}} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-lg font-black leading-none" style={{color: 'var(--color-text-primary)'}}>Asistencias Mensuales</h1>
                        <p className="text-[11px] font-bold uppercase tracking-widest mt-1" style={{color: 'var(--color-text-muted)'}}>{currentClass.name}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 md:p-10 max-w-[1400px] mx-auto w-full">
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] mb-8" style={{color: 'var(--color-text-muted)'}}>Selecciona un mes</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {MONTH_ES.map((name, idx) => {
                            const summary = getMonthSummary(idx);
                            const tp = summary.present + summary.late;
                            const ta = summary.absent;
                            return (
                                <button key={idx} onClick={() => setSelectedMonth(idx)}
                                    className="rounded-[20px] p-6 border text-left group transition-all relative overflow-hidden flex flex-col h-full"
                                    style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'}
                                >
                                    <div className="absolute top-0 right-0 pointer-events-none opacity-[0.02] group-hover:opacity-[0.04] transition-opacity">
                                        <span className="material-symbols-outlined text-8xl" style={{color: 'var(--color-text-primary)', transform: 'translate(10%, -10%)'}}>event</span>
                                    </div>
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{color: 'var(--color-brand)'}}>{year}</p>
                                        <span className="material-symbols-outlined text-[18px] opacity-0 group-hover:opacity-100 transition-opacity" style={{color: 'var(--color-text-primary)'}}>arrow_forward</span>
                                    </div>
                                    <h3 className="text-2xl font-black mb-6 relative z-10 tracking-tighter" style={{color: 'var(--color-text-primary)'}}>{name}</h3>
                                    
                                    <div className="flex flex-col gap-2.5 mt-auto relative z-10 p-3 rounded-xl" style={{backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)'}}>
                                        <div className="flex items-center justify-between text-[11px] font-bold tracking-wide">
                                            <span className="flex items-center gap-1.5" style={{color: 'var(--color-text-secondary)'}}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shadow-[0_0_5px_#10B981]" /> Asistió
                                            </span>
                                            <span style={{color: 'var(--color-text-primary)'}}>{tp}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] font-bold tracking-wide">
                                            <span className="flex items-center gap-1.5" style={{color: 'var(--color-text-secondary)'}}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block shadow-[0_0_5px_#F43F5E]" /> Faltó
                                            </span>
                                            <span style={{color: 'var(--color-text-primary)'}}>{ta}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────
    // MAIN PAGE
    // ─────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full overflow-y-auto animate-in fade-in duration-500" style={{backgroundColor: 'var(--color-bg-app)'}}>
            
            {/* --- BANNER HEADER --- */}
            <div className="px-6 py-8 md:px-10 md:py-12 relative overflow-hidden shrink-0 border-b" 
                 style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}>
                
                {/* Background Glow & Watermark */}
                <div className="absolute inset-0 pointer-events-none" style={{background: 'radial-gradient(circle at 80% 0%, rgba(252, 111, 111, 0.05) 0%, transparent 50%)'}}></div>
                <div className="absolute top-0 right-10 p-8 opacity-[0.03]">
                    <span className="material-symbols-outlined text-[150px]" style={{color: '#FC6F6F', filter: 'drop-shadow(0 0 20px rgba(56, 189, 248, 0.5))'}}>sports_martial_arts</span>
                </div>
                
                <div className="relative z-10 max-w-[1400px] mx-auto w-full">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 mb-6 transition-colors text-[9px] font-bold uppercase tracking-[0.2em]"
                        style={{color: 'var(--color-text-muted)'}}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'}
                    >
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                        Volver a mis clases
                    </button>
                    
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-3xl md:text-5xl font-black mb-3 leading-tight tracking-tighter" style={{color: 'var(--color-text-primary)'}}>
                                {currentClass.name}
                            </h1>
                            <div className="flex flex-wrap gap-3 items-center">
                                <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold tracking-wider" 
                                      style={{backgroundColor: 'rgba(252, 111, 111, 0.05)', border: '1px solid rgba(56, 189, 248, 0.1)', color: '#FC6F6F', boxShadow: '0 0 10px rgba(56,189,248,0.02)'}}>
                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                    {currentClass.schedule}
                                </span>
                                <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold tracking-wider" 
                                      style={{backgroundColor: 'rgba(252, 111, 111, 0.05)', border: '1px solid rgba(56, 189, 248, 0.1)', color: '#FC6F6F', boxShadow: '0 0 10px rgba(56,189,248,0.02)'}}>
                                    <span className="material-symbols-outlined text-[14px]">account_circle</span>
                                    {currentClass.instructor}
                                </span>
                            </div>
                        </div>

                        {/* Monthly Link Button */}
                        <button
                            onClick={() => { setShowMonthly(true); setSelectedMonth(null); }}
                            className="flex items-center gap-2 px-5 py-3.5 text-[10px] font-bold transition-all active:scale-95 uppercase tracking-widest rounded-xl shadow-[0_4px_20px_rgba(56,189,248,0.1)] leading-none"
                            style={{background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(56, 189, 248, 0.02) 100%)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#FC6F6F'}}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(252, 111, 111, 0.15) 0%, rgba(252, 111, 111, 0.05) 100%)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(56, 189, 248, 0.02) 100%)'}
                        >
                            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                            Ver Asistencias Mensuales
                        </button>
                    </div>
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="max-w-[1400px] mx-auto w-full p-6 md:p-10 flex flex-col gap-6 lg:gap-8">

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                    {/* Attendance Stats Card */}
                    <div className="rounded-[20px] p-8 flex flex-col justify-between" style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-6" style={{color: 'var(--color-text-muted)'}}>Resumen de Asistencia</h3>
                        <div className="flex items-center gap-6">
                            <div className="relative size-24 shrink-0">
                                <svg className="size-full" viewBox="0 0 36 36">
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="var(--color-border-strong)"
                                        strokeWidth="2.5"
                                    />
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke={attendanceRate > 80 ? '#34D399' : attendanceRate > 50 ? '#FBBF24' : '#F43F5E'}
                                        strokeWidth="2.5"
                                        strokeDasharray={`${attendanceRate}, 100`}
                                        strokeLinecap="round"
                                        className="transition-all duration-1000 ease-out"
                                        style={{ filter: `drop-shadow(0 0 6px ${attendanceRate > 80 ? 'rgba(52, 211, 153, 0.4)' : attendanceRate > 50 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(244, 63, 94, 0.4)'})` }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-xl font-black" style={{color: 'var(--color-text-primary)'}}>{attendanceRate}%</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 w-full">
                                <div className="flex justify-between items-center text-[11px] font-bold p-2.5 rounded-lg" style={{backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)'}}>
                                    <span style={{color: 'var(--color-text-muted)'}}>Asistencias</span>
                                    <span style={{color: 'var(--color-text-primary)'}}>{presentCount}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] font-bold p-2.5 rounded-lg" style={{backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)'}}>
                                    <span style={{color: 'var(--color-text-muted)'}}>Total Clases</span>
                                    <span style={{color: 'var(--color-text-primary)'}}>{totalClasses}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Classmates Card */}
                    <div className="lg:col-span-2 rounded-[20px] p-8 flex flex-col" style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{color: 'var(--color-text-muted)'}}>Compañeros de Clase</h3>
                            <span className="text-[10px] font-bold px-3 py-1 rounded-full" style={{backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)'}}>
                                {classmates.length}
                            </span>
                        </div>

                        {classmates.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center border border-dashed rounded-xl p-6" style={{borderColor: 'var(--color-border-strong)'}}>
                                <p className="text-[11px] font-bold uppercase tracking-widest text-center" style={{color: 'var(--color-text-muted)'}}>
                                    No hay otros alumnos en este grupo.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-5 overflow-y-auto pb-2 pr-2" style={{maxHeight: '140px'}}>
                                {classmates.map(buddy => (
                                    <div key={buddy.id} className="flex flex-col items-center gap-2 w-16 group">
                                        <div className="relative" style={{borderColor: 'var(--color-bg-surface)'}}>
                                            <div className="rounded-full border-2" style={{borderColor: 'var(--color-bg-surface)'}}>
                                                <Avatar src={buddy.avatarUrl} name={buddy.name} className="size-14 rounded-full shadow-sm transition-transform group-hover:scale-105" />
                                            </div>
                                            <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-center truncate w-full" style={{color: 'var(--color-text-secondary)'}} title={buddy.name}>
                                            {buddy.name.split(' ')[0]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- ATTENDANCE HISTORY LIST --- */}
                <div className="rounded-[20px] overflow-hidden flex-1 flex flex-col" style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}>
                    <div className="p-6 md:p-8 shrink-0 flex items-center justify-between" style={{borderBottom: '1px solid var(--color-border-subtle)'}}>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{color: 'var(--color-text-muted)'}}>Historial Reciente</h3>
                        <span className="material-symbols-outlined text-[16px]" style={{color: 'var(--color-text-muted)'}}>history</span>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-[10px] font-bold uppercase tracking-[0.15em] sticky top-0" style={{backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)'}}>
                                <tr>
                                    <th className="px-6 md:px-8 py-5" style={{borderBottom: '1px solid var(--color-border-subtle)'}}>Fecha</th>
                                    <th className="px-6 md:px-8 py-5" style={{borderBottom: '1px solid var(--color-border-subtle)'}}>Estado</th>
                                    <th className="px-6 md:px-8 py-5 text-right w-[30%]" style={{borderBottom: '1px solid var(--color-border-subtle)'}}>Detalles / Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-16 text-center">
                                            <p className="text-[11px] font-bold uppercase tracking-widest" style={{color: 'var(--color-text-muted)'}}>Sin registros de asistencia.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    myHistory.slice(0, 10).map((record, idx) => {
                                        const c = getStatusColors(record.status);
                                        return (
                                            <tr key={idx} className="transition-colors group" 
                                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                                                <td className="px-6 md:px-8 py-5 align-middle">
                                                    <p className="font-bold text-[13px] capitalize mb-1" style={{color: 'var(--color-text-primary)'}}>
                                                        {formatDateDisplay(record.date, { weekday: 'long', day: 'numeric', month: 'long' })}
                                                    </p>
                                                    <p className="text-[11px] font-medium flex items-center gap-1.5" style={{color: 'var(--color-text-secondary)'}}>
                                                        <span className="material-symbols-outlined text-[12px] opacity-70">schedule</span>
                                                        {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </td>
                                                <td className="px-6 md:px-8 py-5 align-middle">
                                                    <span className="text-[9px] font-bold uppercase px-3 py-1.5 rounded-full border tracking-widest whitespace-nowrap"
                                                          style={{backgroundColor: c.bg, color: c.text, borderColor: c.border}}>
                                                        {c.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 md:px-8 py-5 align-middle text-right">
                                                    {record.status === 'excused' && record.reason ? (
                                                        <div className="inline-block text-left rounded-lg p-3 max-w-xs border w-full lg:w-auto" style={{backgroundColor: 'rgba(96, 165, 250, 0.05)', borderColor: 'rgba(96, 165, 250, 0.1)'}}>
                                                            <p className="text-[9px] font-bold uppercase mb-1.5 flex items-center gap-1" style={{color: '#60A5FA'}}>
                                                                <span className="material-symbols-outlined text-[12px]">info</span> Motivo Justificado
                                                            </p>
                                                            <p className="text-[11px] font-medium leading-relaxed" style={{color: '#93C5FD'}}>{record.reason}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[20px] leading-none opacity-20" style={{color: 'var(--color-text-muted)'}}>-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        {myHistory.length > 10 && (
                           <div className="p-5 text-center" style={{backgroundColor: 'var(--color-bg-app)', borderTop: '1px solid var(--color-border-subtle)'}}>
                               <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: 'var(--color-text-muted)'}}>
                                   Mostrando los últimos 10 registros. Consulta "Asistencias Mensuales" para mayor alcance.
                               </p>
                           </div> 
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentClassDetail;
