
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
  present: 'bg-green-500',
  late: 'bg-yellow-400',
  absent: 'bg-red-500',
  excused: 'bg-blue-500',
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
        <div className="fixed inset-0 z-50 bg-[#F5F5F7] flex flex-col">
          <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center gap-4 shadow-sm">
            <button onClick={() => setStudentDetail(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <Avatar src={student.avatarUrl} name={student.name} className="size-10 rounded-full border border-gray-100" />
            <div>
              <h1 className="text-xl font-black text-text-main leading-none">{student.name}</h1>
              <p className="text-sm text-text-secondary">Asistencias detalladas — {MONTH_ES[month]} {year}</p>
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
                    present: 'border-green-200 bg-green-50',
                    late: 'border-yellow-200 bg-yellow-50',
                    absent: 'border-red-200 bg-red-50',
                    excused: 'border-blue-200 bg-blue-50',
                  };
                  const dotColors: Record<string,string> = {
                    present: 'bg-green-500', late: 'bg-yellow-400', absent: 'bg-red-500', excused: 'bg-blue-500'
                  };
                  const labels: Record<string,string> = {
                    present: 'Presente', late: 'Tarde', absent: 'Falta', excused: 'Justificado'
                  };
                  const textColors: Record<string,string> = {
                    present: 'text-green-700', late: 'text-yellow-700', absent: 'text-red-700', excused: 'text-blue-700'
                  };
                  return (
                    <div key={idx} className={`rounded-2xl border p-5 flex items-start justify-between gap-4 ${colors[rec.status] || 'bg-white border-gray-100'}`}>
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 size-3 rounded-full flex-shrink-0 ${dotColors[rec.status]}`} />
                        <div>
                          <p className="font-bold text-gray-900 capitalize text-sm">{formatDateDisplay(rec.date)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{currentClass.startTime} – {currentClass.endTime}</p>
                          {rec.reason && (
                            <p className="text-xs text-blue-700 mt-2 bg-white/70 px-3 py-1.5 rounded-lg border border-blue-100">
                              <span className="font-bold">Motivo:</span> {rec.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full bg-white/60 ${textColors[rec.status]}`}>
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
      <div className="fixed inset-0 z-50 bg-[#F5F5F7] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center gap-4 shadow-sm">
          <button
            onClick={() => { setShowMonthly(false); setSelectedMonth(null); }}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-text-main leading-none">{currentClass.name}</h1>
            <p className="text-sm text-text-secondary">
              {selectedMonth !== null ? `${MONTH_ES[selectedMonth]} ${year}` : 'Asistencias Mensuales'}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 md:p-10 max-w-[1400px] mx-auto w-full">
          {selectedMonth === null ? (
            <>
              <h2 className="text-2xl font-black text-gray-900 mb-6">Selecciona un mes</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {MONTH_ES.map((name, idx) => {
                  const summary = getMonthSummary(idx);
                  const tp = summary.reduce((a, s) => a + s.present + s.late, 0);
                  const ta = summary.reduce((a, s) => a + s.absent, 0);
                  return (
                    <button key={idx} onClick={() => setSelectedMonth(idx)}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
                    >
                      <p className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">{year}</p>
                      <h3 className="text-xl font-black text-gray-900 mb-3">{name}</h3>
                      <div className="flex gap-3 text-xs font-bold">
                        <span className="flex items-center gap-1 text-green-600">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{tp} pres.
                        </span>
                        <span className="flex items-center gap-1 text-red-600">
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{ta} falt.
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setSelectedMonth(null)} className="p-2 hover:bg-white rounded-full text-gray-500">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-2xl font-black text-gray-900">{MONTH_ES[selectedMonth]} {year}</h2>
              </div>
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Alumno</th>
                        <th className="px-4 py-4 text-xs font-bold text-green-600 uppercase text-center">Presentes</th>
                        <th className="px-4 py-4 text-xs font-bold text-yellow-600 uppercase text-center">Tardes</th>
                        <th className="px-4 py-4 text-xs font-bold text-red-600 uppercase text-center">Faltas</th>
                        <th className="px-4 py-4 text-xs font-bold text-blue-600 uppercase text-center">Justif.</th>
                        <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase text-center">Total</th>
                        <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase text-right">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {getMonthSummary(selectedMonth).map(({ student, present, late, absent, excused, total }) => (
                        <tr key={student.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar src={student.avatarUrl} name={student.name} className="size-10 rounded-full border border-gray-100" />
                              <div>
                                <p className="font-bold text-text-main text-sm">{student.name}</p>
                                <p className="text-xs text-text-secondary">{student.rank}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-green-700 font-black text-sm">{present}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-50 text-yellow-700 font-black text-sm">{late}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-700 font-black text-sm">{absent}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-black text-sm">{excused}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-gray-500 font-bold text-sm">{total}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setStudentDetail({ student, month: selectedMonth })}
                              className="px-3 py-1.5 text-xs font-bold text-primary bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                            >
                              <span className="material-symbols-outlined text-[14px]">open_in_full</span>
                              Ver asistencias
                            </button>
                          </td>
                        </tr>
                      ))}
                      {enrolledAll.length === 0 && (
                        <tr><td colSpan={7} className="py-16 text-center text-gray-400">Sin alumnos inscritos</td></tr>
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
    <div className="flex flex-col h-full bg-[#F5F5F7] relative">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 sticky top-0 z-20 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-black text-text-main leading-none">{currentClass.name}</h1>
            <p className="text-sm text-text-secondary mt-1">{currentClass.schedule}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Día / Semana toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['day','week'] as const).map(mode => (
              <button key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === mode ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {mode === 'day' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>

          {/* Monthly link button */}
          <button
            onClick={() => { setShowMonthly(true); setSelectedMonth(null); }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors border border-purple-100"
          >
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            Ver Asistencias Mensuales
          </button>

          {/* Day-mode controls */}
          {viewMode === 'day' && (
            <>
              <DateNavigator currentDate={currentDateObj} onDateChange={handleDateChange} className="w-full md:w-64" />
              <button
                onClick={handleMarkAllPresent}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-green-600/20 transition-all flex items-center gap-2 active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                <span className="hidden sm:inline">Poner Presente a Todos</span>
              </button>
            </>
          )}

          {/* Week-mode navigator */}
          {viewMode === 'week' && (
            <div className="flex items-center gap-2">
              <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="text-sm font-bold text-gray-700">{weekLabel}</span>
              <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
              <button onClick={() => setWeekAnchor(new Date())} className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg ml-1">
                Hoy
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
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-300">
                <span className="material-symbols-outlined text-5xl opacity-30 mb-2">event_busy</span>
                <p className="font-bold">No hay sesiones esta semana</p>
                <p className="text-sm mt-1">Clases canceladas o sin clases programadas</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {/* Student column header */}
                        <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-52 sticky left-0 bg-gray-50 z-10">
                          Alumno
                        </th>
                        {weekSessions.map(({ dateStr, label, dayNum, isMoved }) => {
                          const isToday = dateStr === getLocalDate();
                          return (
                            <th key={dateStr} className="px-2 py-4 text-center min-w-[140px]">
                              <div className={`inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl ${isToday ? 'bg-primary text-white' : 'text-gray-600'}`}>
                                <span className="text-[10px] font-bold uppercase opacity-80">{label}</span>
                                <span className="text-xl font-black leading-none">{dayNum}</span>
                                {isMoved && <span className="text-[9px] font-bold bg-purple-200 text-purple-700 px-1.5 rounded mt-0.5">Movida</span>}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {enrolledAll.length === 0 && (
                        <tr>
                          <td colSpan={weekSessions.length + 1} className="py-12 text-center text-gray-400">
                            Sin alumnos inscritos
                          </td>
                        </tr>
                      )}
                      {enrolledAll.map(student => (
                        <tr key={student.id} className="hover:bg-blue-50/20 transition-colors">
                          {/* Student name cell */}
                          <td className="px-5 py-3 sticky left-0 bg-white z-10 border-r border-gray-50">
                            <div className="flex items-center gap-2.5">
                              <Avatar src={student.avatarUrl} name={student.name} className="size-8 rounded-full border border-gray-100 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="font-bold text-text-main text-sm truncate leading-none">{student.name}</p>
                                <p className="text-[11px] text-text-secondary truncate">{student.rank}</p>
                              </div>
                            </div>
                          </td>

                          {/* Attendance cell per session day */}
                          {weekSessions.map(({ dateStr }) => {
                            const record = getRecord(student, dateStr);
                            const status = record?.status;
                            return (
                              <td key={dateStr} className="px-2 py-3 text-center">
                                <div className="flex flex-col items-center gap-1.5">
                                  {/* Status pill (mini) */}
                                  {status && (
                                    <span className={`inline-block text-[10px] font-black text-white px-2.5 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                                      {STATUS_LABELS[status]}
                                    </span>
                                  )}
                                  {/* Buttons */}
                                  <div className="flex gap-1">
                                    {(['present','late','absent','excused'] as const).map(s => {
                                      const btnLabels: Record<string,string> = { present:'P', late:'T', absent:'F', excused:'J' };
                                      const btnActive: Record<string,string> = {
                                        present:'bg-green-500 text-white',
                                        late:'bg-yellow-400 text-yellow-900',
                                        absent:'bg-red-500 text-white',
                                        excused:'bg-blue-500 text-white',
                                      };
                                      return (
                                        <button
                                          key={s}
                                          title={s === 'present' ? 'Presente' : s === 'late' ? 'Tarde' : s === 'absent' ? 'Falta' : 'Justif.'}
                                          onClick={() => handleStatusChange(student.id, dateStr, s)}
                                          className={`w-7 h-7 rounded-lg text-[11px] font-black transition-all border ${
                                            status === s ? btnActive[s] + ' border-transparent shadow' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
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
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4 text-[11px] font-bold text-gray-400">
                  <span>P = Presente</span>
                  <span>T = Tarde</span>
                  <span>F = Falta</span>
                  <span>J = Justificado</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ DAY VIEW ════ */}
        {viewMode === 'day' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:w-96">
                <span className="absolute left-3 top-2.5 text-gray-400 material-symbols-outlined text-[20px]">search</span>
                <input
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar alumno..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-none bg-white shadow-sm focus:ring-2 focus:ring-primary/20 text-sm transition-all"
                />
              </div>
              <button
                onClick={() => { setShowEnrollModal(true); setEnrollSearchQuery(''); }}
                className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-200 text-text-main font-bold rounded-xl hover:bg-gray-50 shadow-sm flex items-center justify-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-primary">person_add</span>
                Inscribir Alumno
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden flex-1">
              <div className="overflow-x-auto h-full">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Alumno</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">
                        Asistencia ({formatDateDisplay(selectedDate, {weekday:'short', day:'numeric'})})
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {enrolledStudents.map(student => {
                      const record = getRecord(student, selectedDate);
                      const status = record?.status;
                      const isDebtor = student.status === 'debtor';
                      return (
                        <tr key={student.id} className={`group transition-colors ${isDebtor ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-blue-50/30'}`}>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <Avatar src={student.avatarUrl} name={student.name} className="size-12 rounded-full border border-gray-100 shadow-sm" />
                                <div className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white ${student.balance > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-text-main">{student.name}</p>
                                  {isDebtor && <span className="text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded border border-red-100">ADEUDO</span>}
                                </div>
                                <p className="text-xs text-text-secondary font-medium">{student.rank}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-center gap-2 bg-gray-100/50 p-1.5 rounded-xl w-fit mx-auto border border-gray-200/50">
                              {(['present','late','absent','excused'] as const).map(s => {
                                const lbl = { present:'Presente', late:'Tarde', absent:'Falta', excused:'Justif.' }[s];
                                const act: Record<string,string> = {
                                  present:'bg-green-500 text-white shadow-md',
                                  late:'bg-yellow-400 text-yellow-900 shadow-md',
                                  absent:'bg-red-500 text-white shadow-md',
                                  excused:'bg-blue-500 text-white shadow-md',
                                };
                                return (
                                  <button key={s}
                                    onClick={() => handleStatusChange(student.id, selectedDate, s)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${status === s ? act[s] : 'text-gray-500 hover:bg-white'}`}
                                  >{lbl}</button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => { setStudentForHistory(student); setShowHistoryModal(true); }} className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-blue-50 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">history</span>
                              </button>
                              <button onClick={() => handleUnenroll(student)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">person_remove</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {enrolledStudents.length === 0 && (
                      <tr><td colSpan={3} className="py-20 text-center text-text-secondary">
                        <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">groups</span>
                        No hay alumnos inscritos o que coincidan con la búsqueda.
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-text-main mb-4">Motivo de Justificación</h3>
            <textarea autoFocus value={reasonText} onChange={(e) => setReasonText(e.target.value)}
              className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-primary focus:border-primary min-h-[100px]"
              placeholder="Escribe el motivo (ej. Enfermedad, Trabajo...)"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowReasonModal(false)} className="px-4 py-2 rounded-lg text-gray-500 font-bold hover:bg-gray-100">Cancelar</button>
              <button onClick={saveReason} className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ENROLL ── */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
              <h3 className="text-2xl font-bold text-text-main">Inscribir Alumno</h3>
              <button onClick={() => setShowEnrollModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="relative mb-4">
              <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400">search</span>
              <input autoFocus value={enrollSearchQuery} onChange={(e) => setEnrollSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-primary focus:ring-primary font-medium"
                placeholder="Buscar alumno para inscribir..."
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {availableStudents.map(student => (
                <div key={student.id}
                  onClick={() => { enrollStudent(student.id, classId!); addToast('Alumno inscrito', 'success'); }}
                  className="flex justify-between items-center p-3 rounded-xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={student.avatarUrl} name={student.name} className="size-12 rounded-full border border-gray-100" />
                    <div>
                      <p className="font-bold text-base text-text-main">{student.name}</p>
                      <p className="text-xs text-text-secondary">{student.rank}</p>
                    </div>
                  </div>
                  <button className="size-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-xl">add</span>
                  </button>
                </div>
              ))}
              {availableStudents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">person_off</span>
                  <p>No se encontraron alumnos disponibles.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SLIDE-OVER: HISTORY ── */}
      {showHistoryModal && studentForHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-gray-100 flex items-center gap-4 bg-gray-50">
              <button onClick={() => setShowHistoryModal(false)}><span className="material-symbols-outlined">close</span></button>
              <div>
                <h3 className="font-bold text-lg text-text-main">{studentForHistory.name}</h3>
                <p className="text-xs text-text-secondary">Historial de Asistencia</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="border-l-2 border-gray-100 pl-6 space-y-8 relative">
                {studentForHistory.attendanceHistory
                  ?.filter(r => r.classId === classId || !r.classId)
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((record, idx) => (
                    <div key={idx} className="relative">
                      <div className={`absolute -left-[31px] top-0 size-4 rounded-full border-2 border-white shadow-sm ${
                        record.status === 'present' ? 'bg-green-500' : record.status === 'late' ? 'bg-yellow-400' :
                        record.status === 'excused' ? 'bg-blue-500' : 'bg-red-500'}`} />
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-text-main text-sm capitalize">{formatDateDisplay(record.date)}</p>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          record.status === 'present' ? 'bg-green-50 text-green-700' :
                          record.status === 'late' ? 'bg-yellow-50 text-yellow-700' :
                          record.status === 'excused' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                          {record.status === 'excused' ? 'Justificado' : record.status}
                        </span>
                      </div>
                      {record.reason && (
                        <div className="mt-2 bg-blue-50 p-3 rounded-lg text-xs text-blue-800 border border-blue-100">
                          <span className="font-bold block mb-1">Motivo:</span>{record.reason}
                        </div>
                      )}
                    </div>
                  ))}
                {(!studentForHistory.attendanceHistory || studentForHistory.attendanceHistory.length === 0) && (
                  <p className="text-gray-400 text-sm italic">Sin historial registrado.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterAttendanceDetail;
