
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { Student } from '../../types';
import { getLocalDate, formatDateDisplay } from '../../utils/dateUtils';
import DateNavigator from '../../components/ui/DateNavigator';
import Avatar from '../../components/ui/Avatar';

// ─── HELPERS ─────────────────────────────────────────────────
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_ES: Record<string,string> = {
  Monday:'Lun', Tuesday:'Mar', Wednesday:'Mié',
  Thursday:'Jue', Friday:'Vie', Saturday:'Sáb', Sunday:'Dom'
};
const MONTH_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseLocal(s: string): Date {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function startOfWeek(d: Date): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - dt.getDay()); // Sunday = 0
  return dt;
}

function getWeekSessions(cls: { days: string[]; modifications: any[] }, weekDate: Date) {
  const sun = startOfWeek(weekDate);
  const sessions: { dateStr: string; label: string; dayNum: number; isMoved?: boolean }[] = [];
  const mods = cls.modifications || [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(sun); d.setDate(sun.getDate() + i);
    const dateStr = toLocalStr(d);
    const dayName = DAY_NAMES[d.getDay()];

    const movedHere = mods.find((m: any) => m.newDate === dateStr && m.type === 'move');
    if (movedHere) {
      sessions.push({ dateStr, label: DAY_ES[dayName] ?? dayName.slice(0,3), dayNum: d.getDate(), isMoved: true });
      continue;
    }
    if (!cls.days.includes(dayName)) continue;
    const mod = mods.find((m: any) => m.date === dateStr);
    if (mod?.type === 'cancel' || mod?.type === 'move') continue;
    sessions.push({ dateStr, label: DAY_ES[dayName] ?? dayName.slice(0,3), dayNum: d.getDate() });
  }
  sessions.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  return sessions;
}

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-emerald-500',
  late: 'bg-amber-400',
  absent: 'bg-rose-500',
  excused: 'bg-sky-500',
};

const STATUS_LABELS: Record<string, string> = {
  present: 'P', late: 'T', absent: 'F', excused: 'J',
};

// ─── COMPONENT ───────────────────────────────────────────────
const MasterAttendanceDetail: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { classes, students, markAttendance, bulkMarkPresent, enrollStudent, unenrollStudent } = useStore();
  const { addToast } = useToast();
  const { confirm } = useConfirmation();

  const currentClass = classes.find(c => c.id === classId);

  // ── view modes: 'day' | 'week' ; monthly is a separate overlay
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [showMonthly, setShowMonthly] = useState(false);

  // ── day state
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDate());
  const [searchQuery, setSearchQuery] = useState('');

  // ── week navigation
  const [weekAnchor, setWeekAnchor] = useState<Date>(new Date());

  // ── monthly state
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [studentDetail, setStudentDetail] = useState<{ student: Student; month: number } | null>(null);

  // ── modals
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [studentForReason, setStudentForReason] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonDate, setReasonDate] = useState<string>('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [studentForHistory, setStudentForHistory] = useState<Student | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollSearchQuery, setEnrollSearchQuery] = useState('');

  const handleDateChange = (date: Date) => setSelectedDate(toLocalStr(date));
  const currentDateObj = useMemo(() => parseLocal(selectedDate), [selectedDate]);

  const enrolledStudents = useMemo(() => {
    if (!currentClass) return [];
    return students
      .filter(s => currentClass.studentIds.includes(s.id) && s.status !== 'inactive')
      .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentClass, students, searchQuery]);

  const enrolledAll = useMemo(() => {
    if (!currentClass) return [];
    return students
      .filter(s => currentClass.studentIds.includes(s.id) && s.status !== 'inactive')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentClass, students]);

  const availableStudents = useMemo(() => {
    if (!currentClass) return [];
    return students
      .filter(s => !currentClass.studentIds.includes(s.id) && s.status !== 'inactive')
      .filter(s => s.name.toLowerCase().includes(enrollSearchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentClass, students, enrollSearchQuery]);

  const weekSessions = useMemo(() => {
    if (!currentClass) return [];
    return getWeekSessions(currentClass, weekAnchor);
  }, [currentClass, weekAnchor]);

  const navigateWeek = (dir: -1 | 1) => {
    setWeekAnchor(prev => {
      const d = new Date(prev); d.setDate(d.getDate() + dir * 7); return d;
    });
  };

  const getRecord = (student: Student, date: string) =>
    student.attendanceHistory?.find(r => r.date === date && r.classId === classId);

  const handleStatusChange = (studentId: string, date: string, status: 'present' | 'late' | 'absent' | 'excused') => {
    if (!classId) return;
    if (status === 'excused') {
      setStudentForReason(studentId);
      setReasonDate(date);
      const s = students.find(x => x.id === studentId);
      setReasonText(s?.attendanceHistory?.find(r => r.date === date && r.classId === classId)?.reason || '');
      setShowReasonModal(true);
    } else {
      markAttendance(studentId, classId, date, status);
      addToast('Asistencia registrada', 'success');
    }
  };

  const saveReason = () => {
    if (studentForReason && classId) {
      markAttendance(studentForReason, classId, reasonDate || selectedDate, 'excused', reasonText);
      setShowReasonModal(false); setStudentForReason(null); setReasonText('');
      addToast('Justificante guardado', 'success');
    }
  };

  const handleMarkAllPresent = () => {
    if (!classId) return;
    bulkMarkPresent(classId, selectedDate);
    addToast('Todos marcados como presentes', 'success');
  };

  const handleUnenroll = (student: Student) => {
    confirm({
      title: 'Eliminar Alumno de Clase',
      message: `¿Estás seguro que deseas eliminar a ${student.name} de la clase de ${currentClass?.name}?`,
      type: 'danger', confirmText: 'Eliminar', cancelText: 'Cancelar',
      onConfirm: async () => { if (classId) await unenrollStudent(student.id, classId); }
    });
  };

  const getMonthSummary = (month: number) => {
    const year = new Date().getFullYear();
    return enrolledAll.map(student => {
      const records = (student.attendanceHistory || []).filter(r => {
        if (r.classId !== classId) return false;
        const d = parseLocal(r.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      const present = records.filter(r => r.status === 'present').length;
      const late = records.filter(r => r.status === 'late').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const excused = records.filter(r => r.status === 'excused').length;
      return { student, present, late, absent, excused, total: records.length, records };
    });
  };

  const weekLabel = (() => {
    const sun = startOfWeek(weekAnchor);
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
    return `${toLocalStr(sun)} – ${toLocalStr(sat)}`;
  })();

  if (!currentClass) return <div className="p-10 text-center">Clase no encontrada</div>;

  // ─────────────────────────────────────────────────────────
  // MONTHLY OVERLAY
  // ─────────────────────────────────────────────────────────
  if (showMonthly) {
    const year = new Date().getFullYear();

    // Student detail overlay
    if (studentDetail) {
      const { student, month } = studentDetail;
      const records = (student.attendanceHistory || [])
        .filter(r => {
          if (r.classId !== classId) return false;
          const d = parseLocal(r.date);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      return (
        <div className="fixed inset-0 z-[9999] bg-[#0A0A0B] flex flex-col text-white animate-in fade-in duration-300">
          <div className="bg-[#141416] border-b border-white/10 px-8 py-4 flex items-center gap-6 shadow-xl">
            <button onClick={() => setStudentDetail(null)} className="p-2 hover:bg-white/5 rounded-lg text-white/40 transition-all">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <Avatar src={student.avatarUrl} name={student.name} className="size-10 rounded-lg border border-white/10" />
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{student.name}</h1>
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mt-1">Asistencias detalladas — {MONTH_ES[month]} {year}</p>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6 md:p-10 max-w-3xl mx-auto w-full">
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <span className="material-symbols-outlined text-5xl opacity-30 mb-2">event_busy</span>
                <p className="font-bold">Sin registros en {MONTH_ES[month]}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((rec, idx) => {
                  const colors: Record<string,string> = {
                    present: 'border-emerald-500/20 bg-emerald-500/[0.03]',
                    late: 'border-amber-400/20 bg-amber-400/[0.03]',
                    absent: 'border-rose-500/20 bg-rose-500/[0.03]',
                    excused: 'border-sky-500/20 bg-sky-500/[0.03]',
                  };
                  const dotColors: Record<string,string> = {
                    present: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]', late: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]', absent: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]', excused: 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]'
                  };
                  const labels: Record<string,string> = {
                    present: 'Presente', late: 'Tarde', absent: 'Falta', excused: 'Justificado'
                  };
                  const textColors: Record<string,string> = {
                    present: 'text-emerald-400', late: 'text-amber-400', absent: 'text-rose-400', excused: 'text-sky-400'
                  };
                  return (
                    <div key={idx} className={`rounded-xl border p-4 flex items-center justify-between gap-6 transition-all border-white/5 hover:bg-white/[0.02] ${colors[rec.status] || 'bg-white/5 border-white/5'}`}>
                      <div className="flex items-center gap-5">
                        <div className={`size-3 rounded-full flex-shrink-0 ${dotColors[rec.status]}`} />
                        <div>
                          <p className="font-semibold text-white text-md tracking-tight capitalize">{formatDateDisplay(rec.date)}</p>
                          <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mt-0.5">{currentClass.startTime} – {currentClass.endTime}</p>
                          {rec.reason && (
                            <p className="text-xs text-sky-400 mt-3 bg-sky-500/10 px-4 py-2 rounded-xl border border-sky-500/20">
                              <span className="font-black uppercase tracking-wider text-[10px] mr-2 opacity-50">Motivo:</span> {rec.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full bg-white/5 border border-white/5 ${textColors[rec.status]}`}>
                        {labels[rec.status] || rec.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Month selection or month detail
    return (
      <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[#0A0A0B] flex flex-col text-white animate-in fade-in duration-300">
        <div className="bg-[#141416] border-b border-white/10 px-8 py-4 flex items-center gap-6 shadow-xl">
          <button
            onClick={() => { setShowMonthly(false); setSelectedMonth(null); }}
            className="p-2 hover:bg-white/5 rounded-lg text-white/40 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">{currentClass.name}</h1>
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mt-1">
              {selectedMonth !== null ? `${MONTH_ES[selectedMonth]} ${year}` : 'Panel de Asistencias Mensuales'}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 md:p-10 max-w-[1400px] mx-auto w-full">
          {selectedMonth === null ? (
            <>
              <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-10 text-center">Selecciona un mes</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {MONTH_ES.map((name, mIndex) => {
                  const summary = getMonthSummary(mIndex);
                  const presentCount = summary.reduce((a, s) => a + s.present + s.late, 0);
                  const absentCount = summary.reduce((a, s) => a + s.absent, 0);
                  return (
                    <div key={mIndex} onClick={() => setSelectedMonth(mIndex)}
                  className="group bg-[#141416] rounded-xl p-6 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer shadow-lg relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">{year}</p>
                    <h3 className="text-2xl font-bold text-white tracking-tight mb-6">{MONTH_ES[mIndex]}</h3>
                    <div className="flex gap-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">Presencias</span>
                        <span className="bg-emerald-500/10 text-emerald-400 font-bold px-3 py-1 rounded-lg text-xs border border-emerald-500/20">{presentCount}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">Faltas</span>
                        <span className="bg-rose-500/10 text-rose-400 font-bold px-3 py-1 rounded-lg text-xs border border-rose-500/20">{absentCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-10">
                <button onClick={() => setSelectedMonth(null)} className="p-3 hover:bg-white/5 rounded-full text-white/40 transition-all">
                  <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </button>
                <h2 className="text-3xl font-bold text-white tracking-tight">{MONTH_ES[selectedMonth]} {year}</h2>
              </div>
              <div className="bg-[#141416] rounded-xl shadow-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-6 text-left text-[10px] font-bold text-white/20 uppercase tracking-widest">Alumno</th>
                        <th className="px-4 py-6 text-center text-[10px] font-bold text-white/20 uppercase tracking-widest">Presencias</th>
                        <th className="px-4 py-6 text-center text-[10px] font-bold text-white/20 uppercase tracking-widest">Faltas</th>
                        <th className="px-4 py-6 text-center text-[10px] font-bold text-white/20 uppercase tracking-widest">Tardes</th>
                        <th className="px-4 py-6 text-right text-[10px] font-bold text-white/20 uppercase tracking-widest">Detalles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {getMonthSummary(selectedMonth!).map(({ student, present, late, absent, excused, total }) => {
                        return (
                          <tr key={student.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-5 flex items-center gap-4">
                              <Avatar src={student.avatarUrl} name={student.name} className="size-10 rounded-lg border border-white/10" />
                              <div>
                                <p className="font-bold text-white text-md tracking-tight">{student.name}</p>
                                <p className="text-[9px] font-semibold text-white/20 uppercase tracking-widest mt-0.5">{student.rank}</p>
                              </div>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-lg font-bold text-emerald-400">{present}</span>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-lg font-bold text-rose-400">{absent}</span>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-lg font-bold text-amber-400">{late}</span>
                            </td>
                            <td className="px-4 py-5 text-right">
                              <button
                                onClick={() => setStudentDetail({ student, month: selectedMonth! })}
                                className="p-3 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all group"
                              >
                                <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {enrolledAll.length === 0 && (
                        <tr><td colSpan={5} className="py-24 text-center text-white/20 font-bold italic tracking-wider">Sin alumnos inscritos</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // MAIN PAGE (Día / Semana)
  // ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#0A0A0B] relative text-white/90">

      {/* ── HEADER ── */}
      <div className="bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-white/5 px-6 py-6 sticky top-0 z-20 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-full text-white/60 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white leading-none tracking-tight">{currentClass.name}</h1>
            <p className="text-xs font-bold text-white/40 mt-1.5 uppercase tracking-widest">{currentClass.schedule}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Día / Semana toggle */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            {['day', 'week'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`px-8 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === mode ? 'bg-white text-black shadow-lg scale-100' : 'text-white/40 hover:text-white'
                }`}
              >
                {mode === 'day' ? 'Asistencia Diaria' : 'Vista Semanal'}
              </button>
            ))}
          </div>

          {/* Monthly link button */}
          <button
            onClick={() => { setShowMonthly(true); setSelectedMonth(null); }}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 group"
          >
            <span className="material-symbols-outlined text-[18px] text-emerald-400 group-hover:scale-110 transition-transform">analytics</span>
            Panel de Métricas Mensuales
          </button>

          {/* Day-mode controls */}
          {viewMode === 'day' && (
            <>
              <DateNavigator
              currentDate={currentDateObj}
              onDateChange={handleDateChange}
              dark={true}
              className="w-48"
            />
              <button
                onClick={handleMarkAllPresent}
                className="bg-emerald-500 hover:bg-emerald-600 text-black px-8 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                <span className="tracking-tight uppercase tracking-widest text-[10px]">Asistencia Completa</span>
              </button>
            </>
          )}

          {/* Week-mode navigator */}
          {viewMode === 'week' && (
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 shadow-lg">
              <button 
                onClick={() => navigateWeek(-1)} 
                className="size-10 flex items-center justify-center hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <div className="px-6 text-[10px] font-bold text-white/90 uppercase tracking-[0.2em] min-w-[200px] text-center">
                {weekLabel}
              </div>
              <button 
                onClick={() => navigateWeek(1)} 
                className="size-10 flex items-center justify-center hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
              <button 
                onClick={() => setWeekAnchor(new Date())} 
                className="px-6 py-2 h-10 text-[9px] font-bold bg-white text-black rounded-lg ml-1 hover:bg-white/90 active:scale-95 transition-all uppercase tracking-[0.2em]"
              >
                Actual
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full flex-1 flex flex-col gap-6">

        {/* ════ WEEK VIEW — Excel-style grid ════ */}
        {viewMode === 'week' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {weekSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-white/20 bg-white/5 rounded-xl border-2 border-dashed border-white/5">
                <span className="material-symbols-outlined text-6xl opacity-20 mb-4">event_busy</span>
                <p className="font-bold text-lg">No hay sesiones esta semana</p>
                <p className="text-sm mt-1 opacity-50 text-white/40">Clases canceladas o sin clases programadas</p>
              </div>
            ) : (
              <div className="bg-[#141416] rounded-xl shadow-2xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-white/[0.03] border-b border-white/10">
                        {/* Student column header */}
                        <th className="px-6 py-4 text-left text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] w-64 sticky left-0 bg-[#141416] z-10 border-r border-white/10">
                          Panel de Alumnos
                        </th>
                        {weekSessions.map(({ dateStr, label, dayNum, isMoved }) => {
                          const isToday = dateStr === getLocalDate();
                          return (
                            <th key={dateStr} className="px-4 py-4 text-center min-w-[140px]">
                              <div className={`inline-flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${isToday ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}>
                                <span className="text-[9px] font-bold uppercase opacity-50 tracking-[0.15em]">{label}</span>
                                <span className="text-xl font-bold leading-none">{dayNum}</span>
                                {isMoved && <span className="text-[8px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-lg mt-1 border border-emerald-500/20">Moved</span>}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {enrolledAll.length === 0 && (
                        <tr>
                          <td colSpan={weekSessions.length + 1} className="py-12 text-center text-gray-400">
                            Sin alumnos inscritos
                          </td>
                        </tr>
                      )}
                      {enrolledAll.map(student => (
                        <tr key={student.id} className="hover:bg-white/[0.02] transition-colors group">
                          {/* Student name cell */}
                          <td className="px-6 py-4 sticky left-0 bg-[#141416] z-10 border-r border-white/5">
                            <div className="flex items-center gap-3">
                              <Avatar src={student.avatarUrl} name={student.name} className="size-10 rounded-full border border-white/10 flex-shrink-0 grayscale group-hover:grayscale-0 transition-all duration-500" />
                              <div className="min-w-0">
                                <p className="font-bold text-white text-sm truncate leading-none mb-1">{student.name}</p>
                                <p className="text-[11px] font-bold text-white/30 truncate uppercase tracking-wider">{student.rank}</p>
                              </div>
                            </div>
                          </td>

                          {/* Attendance cell per session day */}
                          {weekSessions.map(({ dateStr }) => {
                            const record = getRecord(student, dateStr);
                            const status = record?.status;
                            return (
                              <td key={dateStr} className="px-4 py-4 text-center">
                                <div className="flex flex-col items-center gap-2">
                                  {/* Status pill (mini) */}
                                  {status && (
                                    <span className={`inline-block text-[9px] font-bold text-white px-2.5 py-1 rounded-full shadow-lg ${STATUS_COLORS[status]}`}>
                                      {STATUS_LABELS[status]}
                                    </span>
                                  )}
                                  {/* Buttons */}
                                  <div className="flex gap-1.5">
                                    {(['present','late','absent','excused'] as const).map(s => {
                                      const btnLabels: Record<string,string> = { present:'P', late:'T', absent:'F', excused:'J' };
                                      const btnActive: Record<string,string> = {
                                        present:'bg-emerald-500 text-black',
                                        late:'bg-amber-400 text-black',
                                        absent:'bg-rose-500 text-white',
                                        excused:'bg-sky-500 text-white',
                                      };
                                      return (
                                        <button
                                          key={s}
                                          title={s === 'present' ? 'Presente' : s === 'late' ? 'Tarde' : s === 'absent' ? 'Falta' : 'Justif.'}
                                          onClick={() => handleStatusChange(student.id, dateStr, s)}
                                          className={`w-8 h-8 rounded-xl text-[11px] font-bold transition-all border ${
                                            status === s ? btnActive[s] + ' border-transparent shadow-lg scale-110' : 'bg-white/5 text-white/30 border-white/5 hover:border-white/20 hover:text-white/60 hover:bg-white/10'
                                          }`}
                                        >
                                          {btnLabels[s]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Legend */}
                <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex flex-wrap items-center gap-6 text-[10px] font-bold text-white/30 uppercase tracking-[0.1em]">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Presente</span>
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" /> Tarde</span>
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500" /> Falta</span>
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-sky-500" /> Justificado</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ DAY VIEW — Modern Grid ════ */}
        {viewMode === 'day' && (
          <div className="flex-1 flex flex-col gap-8 animate-in fade-in duration-500">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96 group">
                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-500 transition-colors pointer-events-none z-10">search</span>
                <style>
                  {`
                    input.search-input-attendance {
                      padding-left: 60px !important;
                    }
                  `}
                </style>
                <input type="text" placeholder="Buscar alumno en sesión..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full search-input-attendance pr-4 py-3.5 rounded-xl bg-[#141416] border border-white/10 hover:border-white/20 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 text-sm text-white transition-all outline-none"
                />
              </div>
              <button
                onClick={() => setShowEnrollModal(true)}
                className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 active:scale-95 transition-all shadow-xl"
              >
                <span className="material-symbols-outlined">person_add</span>
                Inscribir Alumno
              </button>
            </div>

            {/* Main Table */}
            <div className="bg-[#141416] rounded-xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/10">
                      <th className="px-8 py-4 text-left text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] w-1/3">Información del Alumno</th>
                      <th className="px-8 py-4 text-center text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">Registro de Asistencia</th>
                      <th className="px-8 py-4 text-right text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">Acciones Administrativas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {enrolledStudents.map(student => {
                      const record = student.attendanceHistory?.find(r => r.date === selectedDate && r.classId === classId);
                      const currentStatus = record?.status;
                      const hasPaid = student.balance <= 0;
                      
                      return (
                        <tr key={student.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-6">
                              <div className="relative">
                                <Avatar src={student.avatarUrl} name={student.name} className="size-14 rounded-xl border border-white/10" />
                                <div className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-[#141416] ${hasPaid ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                              </div>
                              <div>
                                <p className="font-bold text-white text-lg tracking-tight mb-1">{student.name}</p>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{student.rank}</span>
                                  {student.status === 'debtor' && (
                                    <span className="text-[8px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-lg uppercase tracking-widest">Adeudo</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center justify-center p-1 bg-black/30 rounded-xl border border-white/5 max-w-[400px] mx-auto">
                              {['present', 'late', 'absent', 'excused'].map(st => (
                                <button key={st} onClick={() => handleStatusChange(student.id, selectedDate, st as any)}
                                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                                    currentStatus === st ? `${STATUS_COLORS[st]} text-white shadow-lg` : 'text-white/20 hover:text-white/40'
                                  }`}
                                >
                                  {st === 'excused' ? 'Justif.' : st === 'late' ? 'Tarde' : st === 'absent' ? 'Falta' : 'Presente'}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex justify-end gap-3">
                              <button onClick={() => { setStudentForHistory(student); setShowHistoryModal(true); }}
                                className="size-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-emerald-500 hover:text-black transition-all text-white/40"
                                title="Historial"
                              >
                                <span className="material-symbols-outlined text-[18px]">history</span>
                              </button>
                              <button onClick={() => unenrollStudent(student.id, classId!)}
                                className="size-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-rose-500 hover:text-white transition-all text-white/20"
                                title="Desvincular"
                              >
                                <span className="material-symbols-outlined text-[18px]">person_remove</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {enrolledStudents.length === 0 && (
                      <tr><td colSpan={3} className="py-32 text-center text-white/20">
                        <span className="material-symbols-outlined text-6xl opacity-20 mb-4 block">groups</span>
                        <p className="font-bold text-lg">No hay alumnos inscritos</p>
                        <p className="text-sm mt-1 opacity-50">O no coinciden con la búsqueda</p>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: REASON ── */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#1C1C1E] rounded-xl p-8 w-full max-w-md shadow-2xl border border-white/10">
            <h3 className="text-xl font-bold text-white mb-6 tracking-tight">Motivo de Justificación</h3>
            <textarea autoFocus value={reasonText} onChange={(e) => setReasonText(e.target.value)}
              className="w-full bg-white/5 border-white/10 rounded-lg p-4 text-sm focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 min-h-[140px] text-white transition-all outline-none"
              placeholder="Escribe el motivo..."
            />
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setShowReasonModal(false)} className="px-6 py-2.5 rounded-lg text-white/30 font-bold text-[11px] uppercase tracking-widest hover:text-white transition-colors">Cancelar</button>
              <button onClick={saveReason} className="px-8 py-2.5 rounded-lg bg-emerald-500 text-black font-bold text-[11px] uppercase tracking-widest hover:bg-emerald-400 transition-all">Guardar Motivo</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ENROLL ── */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#1C1C1E] rounded-xl p-8 w-full max-w-2xl shadow-2xl border border-white/10 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-white tracking-tight">Inscribir Alumno a la Sesión</h3>
              <button onClick={() => setShowEnrollModal(false)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                <span className="material-symbols-outlined text-white/40">close</span>
              </button>
            </div>
            <div className="relative mb-6 group">
              <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-500 transition-colors pointer-events-none z-10">search</span>
              <input autoFocus value={enrollSearchQuery} onChange={(e) => setEnrollSearchQuery(e.target.value)}
                className="w-full search-input-attendance pr-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm transition-all outline-none"
                placeholder="Buscar por nombre..."
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {availableStudents.map(student => (
                <div key={student.id}
                  onClick={() => { enrollStudent(student.id, classId!); addToast('Alumno inscrito', 'success'); }}
                  className="flex justify-between items-center p-3 rounded-lg border border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.02] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <Avatar src={student.avatarUrl} name={student.name} className="size-10 rounded-lg border border-white/10" />
                    <div>
                      <p className="font-bold text-white text-md">{student.name}</p>
                      <p className="text-[9px] font-semibold text-white/20 uppercase tracking-widest">{student.rank}</p>
                    </div>
                  </div>
                  <button className="px-4 py-1.5 rounded-lg bg-white/5 text-white/40 group-hover:bg-emerald-500 group-hover:text-black transition-all text-[10px] font-bold uppercase tracking-widest">
                    Inscribir
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SLIDE-OVER: HISTORY ── */}
      {showHistoryModal && studentForHistory && (
        <div className="fixed inset-0 z-[9999] flex justify-end">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowHistoryModal(false)} />
          <div className="relative w-full max-w-sm bg-[#0A0A0B] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 border-l border-white/10">
            <div className="p-8 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-4 mb-6">
                <Avatar src={studentForHistory.avatarUrl} name={studentForHistory.name} className="size-10 rounded-lg border border-white/10" />
                <button onClick={() => setShowHistoryModal(false)} className="ml-auto p-2 hover:bg-white/5 rounded-lg transition-all text-white/40">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <h3 className="font-bold text-lg text-white">{studentForHistory.name}</h3>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">Historial de Clases</p>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <div className="space-y-6">
                {studentForHistory.attendanceHistory
                  ?.filter(r => r.classId === classId || !r.classId)
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((record, idx) => (
                    <div key={idx} className="relative pl-6 border-l border-white/10">
                      <div className={`absolute -left-[5px] top-1.5 size-2 rounded-full ${
                        record.status === 'present' ? 'bg-emerald-500' : record.status === 'late' ? 'bg-amber-400' :
                        record.status === 'excused' ? 'bg-sky-500' : 'bg-rose-500'}`} />
                      <div className="mb-1">
                        <p className="font-bold text-white text-sm capitalize">{formatDateDisplay(record.date)}</p>
                        <span className={`text-[9px] font-bold uppercase tracking-widest mt-1 inline-block ${
                          record.status === 'present' ? 'text-emerald-400' :
                          record.status === 'late' ? 'text-amber-400' :
                          record.status === 'excused' ? 'text-sky-400' : 'text-rose-400'}`}>
                          {record.status === 'excused' ? 'Justificado' : record.status}
                        </span>
                      </div>
                      {record.reason && (
                        <p className="text-[10px] text-white/40 mt-2 p-2 bg-white/5 rounded-lg border border-white/5 italic">
                          "{record.reason}"
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterAttendanceDetail;
