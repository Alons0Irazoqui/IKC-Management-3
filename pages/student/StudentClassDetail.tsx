
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
        return <div className="p-10 text-center">Clase no encontrada</div>;
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

    // ─────────────────────────────────────────────────────────
    // MONTHLY DASHBOARD OVERLAY
    // ─────────────────────────────────────────────────────────
    if (showMonthly) {
        if (selectedMonth !== null) {
            const summary = getMonthSummary(selectedMonth);
            const records = [...summary.records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return (
                <div className="fixed inset-0 z-50 bg-[#F5F5F7] flex flex-col">
                    <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center gap-4 shadow-sm">
                        <button onClick={() => setSelectedMonth(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-text-main leading-none">Mi Historial Mensual</h1>
                            <p className="text-sm text-text-secondary">{MONTH_ES[selectedMonth]} {year} — {currentClass.name}</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6 md:p-10 max-w-[1200px] mx-auto w-full">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Presentes</p>
                                <p className="text-3xl font-black text-green-600">{summary.present}</p>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Retardos</p>
                                <p className="text-3xl font-black text-yellow-500">{summary.late}</p>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Faltas</p>
                                <p className="text-3xl font-black text-red-600">{summary.absent}</p>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Justificadas</p>
                                <p className="text-3xl font-black text-blue-600">{summary.excused}</p>
                            </div>
                        </div>

                        {/* Details Table */}
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-5 border-b border-gray-100">
                                <h3 className="font-bold text-text-main text-lg">Asistencias de {MONTH_ES[selectedMonth]}</h3>
                            </div>
                            {records.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                    <span className="material-symbols-outlined text-5xl opacity-30 mb-2">event_busy</span>
                                    <p className="font-bold">Sin registros en este mes</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {records.map((rec, idx) => {
                                        const colors: Record<string, string> = {
                                            present: 'bg-green-50 text-green-700 border-green-200',
                                            late: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                                            absent: 'bg-red-50 text-red-700 border-red-200',
                                            excused: 'bg-blue-50 text-blue-700 border-blue-200',
                                        };
                                        const labels: Record<string, string> = {
                                            present: 'Presente', late: 'Retardo', absent: 'Falta', excused: 'Justificado'
                                        };
                                        return (
                                            <div key={idx} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                                                <div>
                                                    <p className="font-bold text-gray-900 capitalize text-sm">{formatDateDisplay(rec.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{currentClass.schedule}</p>
                                                </div>
                                                <div className="flex items-center gap-4 justify-between sm:justify-end">
                                                    {rec.reason && rec.status === 'excused' && (
                                                        <div className="text-left bg-white border border-blue-100 rounded-lg p-2 max-w-xs shadow-sm">
                                                            <p className="text-[10px] font-bold text-blue-800 uppercase mb-0.5 flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[12px]">info</span> Motivo:
                                                            </p>
                                                            <p className="text-xs text-blue-700 leading-tight">{rec.reason}</p>
                                                        </div>
                                                    )}
                                                    <span className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-full border ${colors[rec.status]}`}>
                                                        {labels[rec.status] || rec.status}
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
            <div className="fixed inset-0 z-50 bg-[#F5F5F7] flex flex-col">
                <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center gap-4 shadow-sm">
                    <button onClick={() => setShowMonthly(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-text-main leading-none">Asistencias Mensuales</h1>
                        <p className="text-sm text-text-secondary">{currentClass.name}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 md:p-10 max-w-[1400px] mx-auto w-full">
                    <h2 className="text-2xl font-black text-gray-900 mb-6">Selecciona un mes</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {MONTH_ES.map((name, idx) => {
                            const summary = getMonthSummary(idx);
                            const tp = summary.present + summary.late;
                            const ta = summary.absent;
                            return (
                                <button key={idx} onClick={() => setSelectedMonth(idx)}
                                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <p className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">{year}</p>
                                        <span className="material-symbols-outlined text-transparent group-hover:text-primary transition-colors text-xl">calendar_month</span>
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900 mb-4">{name}</h3>
                                    <div className="flex flex-col gap-1.5 text-xs font-bold">
                                        <span className="flex items-center gap-1.5 text-green-600">
                                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Asistió: {tp}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-red-600">
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Faltó: {ta}
                                        </span>
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
        <div className="flex flex-col h-full bg-[#F5F5F7] overflow-y-auto">
            {/* Banner Header */}
            <div className="bg-gradient-to-r from-gray-900 to-slate-800 text-white p-8 md:p-12 relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <span className="material-symbols-outlined text-[200px]">sports_martial_arts</span>
                </div>
                <div className="relative z-10 max-w-[1400px] mx-auto w-full">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors text-sm font-bold uppercase tracking-wider"
                    >
                        <span className="material-symbols-outlined text-lg">arrow_back</span>
                        Volver a mis clases
                    </button>
                    
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div>
                            <h1 className="text-3xl md:text-5xl font-black mb-2 leading-tight">{currentClass.name}</h1>
                            <div className="flex flex-wrap gap-4 items-center text-white/80 font-medium">
                                <span className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                    <span className="material-symbols-outlined text-sm">schedule</span>
                                    {currentClass.schedule}
                                </span>
                                <span className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                    <span className="material-symbols-outlined text-sm">person</span>
                                    {currentClass.instructor}
                                </span>
                            </div>
                        </div>

                        {/* Monthly Link Button */}
                        <button
                            onClick={() => { setShowMonthly(true); setSelectedMonth(null); }}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all backdrop-blur-md active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                            Ver Asistencias Mensuales
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto w-full p-6 md:p-10 flex flex-col gap-8">

                {/* Stats & Classmates Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Attendance Stats Card */}
                    <div className="bg-white rounded-3xl p-6 shadow-card border border-gray-100 flex flex-col justify-between">
                        <h3 className="font-bold text-text-main mb-4">Resumen de Asistencia General</h3>
                        <div className="flex items-center gap-6">
                            <div className="relative size-24 shrink-0">
                                <svg className="size-full" viewBox="0 0 36 36">
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="#E5E7EB"
                                        strokeWidth="3"
                                    />
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke={attendanceRate > 80 ? '#10B981' : attendanceRate > 50 ? '#F59E0B' : '#EF4444'}
                                        strokeWidth="3"
                                        strokeDasharray={`${attendanceRate}, 100`}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-xl font-black text-text-main">{attendanceRate}%</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className="text-sm text-text-secondary">Asistencias: <span className="font-bold text-text-main">{presentCount}</span></p>
                                <p className="text-sm text-text-secondary">Total Clases: <span className="font-bold text-text-main">{totalClasses}</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Classmates Card */}
                    <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-card border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-text-main">Mis Compañeros</h3>
                            <span className="bg-gray-100 text-text-secondary text-xs font-bold px-2 py-1 rounded-full">{classmates.length}</span>
                        </div>

                        {classmates.length === 0 ? (
                            <p className="text-text-secondary text-sm py-4">No hay otros alumnos inscritos aún.</p>
                        ) : (
                            <div className="flex flex-wrap gap-4">
                                {classmates.map(buddy => (
                                    <div key={buddy.id} className="flex flex-col items-center gap-1 w-16">
                                        <Avatar src={buddy.avatarUrl} name={buddy.name} className="size-12 rounded-full border-2 border-white shadow-sm" />
                                        <span className="text-[10px] text-text-secondary text-center truncate w-full font-medium" title={buddy.name}>{buddy.name.split(' ')[0]}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Attendance History Table (General) */}
                <div className="bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden flex-1">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-bold text-text-main text-lg">Mi Historial Reciente en esta Clase</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Detalles</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {myHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-text-secondary">
                                            Sin registros de asistencia para esta clase.
                                        </td>
                                    </tr>
                                ) : (
                                    myHistory.slice(0, 10).map((record, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-text-main text-sm capitalize">
                                                    {formatDateDisplay(record.date, { weekday: 'long', day: 'numeric', month: 'long' })}
                                                </p>
                                                <p className="text-xs text-text-secondary font-mono mt-0.5">
                                                    {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-full border ${record.status === 'present' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    record.status === 'late' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                        record.status === 'excused' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                            'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                    {record.status === 'present' ? 'Presente' :
                                                        record.status === 'late' ? 'Retardo' :
                                                            record.status === 'excused' ? 'Justificada' : 'Falta'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {record.status === 'excused' && record.reason ? (
                                                    <div className="inline-block text-left bg-blue-50 border border-blue-100 rounded-lg p-2 max-w-xs">
                                                        <p className="text-[10px] font-bold text-blue-800 uppercase mb-0.5 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">info</span> Motivo:
                                                        </p>
                                                        <p className="text-xs text-blue-700 leading-tight">{record.reason}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {myHistory.length > 10 && (
                           <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                               <p className="text-xs text-gray-500 font-bold">Mostrando los últimos 10 registros. Ve a "Asistencias Mensuales" para mayor detalle.</p>
                           </div> 
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentClassDetail;
