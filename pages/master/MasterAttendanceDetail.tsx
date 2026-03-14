
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { Student } from '../../types';
import { getLocalDate, formatDateDisplay } from '../../utils/dateUtils';
import DateNavigator from '../../components/ui/DateNavigator';
import Avatar from '../../components/ui/Avatar';

// ────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_ES: Record<string,string> = {
  Monday:'Lun', Tuesday:'Mar', Wednesday:'Mié',
  Thursday:'Jue', Friday:'Vie', Saturday:'Sáb', Sunday:'Dom'
};
const MONTH_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseLocal(s: string): Date {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function startOfWeek(d: Date): Date {
  const dt = new Date(d); dt.setDate(dt.getDate() - dt.getDay()); // Sunday
  return dt;
}

// Returns the list of {dateStr, label} sessions that actually occur in the week containing `weekDate`
// taking into account modifications (moves / cancels) of a given class.
function getWeekSessions(cls: { days: string[]; modifications: any[] }, weekDate: Date) {
  const sun = startOfWeek(weekDate);
  const sessions: {dateStr: string; label: string; isMoved?: boolean}[] = [];

  const mods = cls.modifications || [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(sun); d.setDate(sun.getDate() + i);
    const dateStr = toLocalStr(d);
    const dayName = DAY_NAMES[d.getDay()];

    // Check if a class is *moved to* this date from another date
    const movedHere = mods.find((m: any) => m.newDate === dateStr && m.type === 'move');
    if (movedHere) {
      sessions.push({ dateStr, label: DAY_ES[dayName] ?? dayName.slice(0,3), isMoved: true });
      continue;
    }

    if (!cls.days.includes(dayName)) continue;

    // Check mod for this original date
    const mod = mods.find((m: any) => m.date === dateStr);
    if (mod?.type === 'cancel') continue; // cancelled – skip
    if (mod?.type === 'move') continue;   // moved away – skip original slot

    sessions.push({ dateStr, label: DAY_ES[dayName] ?? dayName.slice(0,3) });
  }

  sessions.sort((a,b) => a.dateStr.localeCompare(b.dateStr));
  return sessions;
}

// ────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────
const MasterAttendanceDetail: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { classes, students, markAttendance, bulkMarkPresent, enrollStudent, unenrollStudent } = useStore();
  const { addToast } = useToast();
  const { confirm } = useConfirmation();

  const currentClass = classes.find(c => c.id === classId);

  // ── view mode: 'day' | 'week' | 'monthly'
  const [viewMode, setViewMode] = useState<'day'|'week'|'monthly'>('day');

  // ── day view state
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDate());
  const [searchQuery, setSearchQuery] = useState('');

  // ── monthly dashboard state
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // ── week navigation
  const [weekAnchor, setWeekAnchor] = useState<Date>(new Date());

  // ── modals
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [studentForReason, setStudentForReason] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonDate, setReasonDate] = useState<string>('');

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [studentForHistory, setStudentForHistory] = useState<Student | null>(null);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollSearchQuery, setEnrollSearchQuery] = useState('');

  // ── DateNavigator adapter
  const handleDateChange = (date: Date) => setSelectedDate(toLocalStr(date));
  const currentDateObj = useMemo(() => parseLocal(selectedDate), [selectedDate]);

  // ── Enrolled students
  const enrolledStudents = useMemo(() => {
    if (!currentClass) return [];
    return students
      .filter(s => currentClass.studentIds.includes(s.id) && s.status !== 'inactive')
      .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentClass, students, searchQuery]);

  const availableStudents = useMemo(() => {
    if (!currentClass) return [];
    return students
      .filter(s => !currentClass.studentIds.includes(s.id) && s.status !== 'inactive')
      .filter(s => s.name.toLowerCase().includes(enrollSearchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentClass, students, enrollSearchQuery]);

  // ── Week sessions
  const weekSessions = useMemo(() => {
    if (!currentClass) return [];
    return getWeekSessions(currentClass, weekAnchor);
  }, [currentClass, weekAnchor]);

  const navigateWeek = (dir: -1|1) => {
    setWeekAnchor(prev => {
      const d = new Date(prev); d.setDate(d.getDate() + dir * 7); return d;
    });
  };

  // ── Helpers
  const getRecord = (student: Student, date: string) =>
    student.attendanceHistory?.find(r => r.date === date && r.classId === classId);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active': return <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Activo</span>;
      case 'debtor': return <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Adeudo</span>;
      default: return null;
    }
  };

  // ── Actions
  const handleStatusChange = (studentId: string, date: string, status: 'present'|'late'|'absent'|'excused') => {
    if (!classId) return;
    if (status === 'excused') {
      setStudentForReason(studentId);
      setReasonDate(date);
      const student = students.find(s => s.id === studentId);
      const record = student?.attendanceHistory?.find(r => r.date === date && r.classId === classId);
      setReasonText(record?.reason || '');
      setShowReasonModal(true);
    } else {
      markAttendance(studentId, classId, date, status);
      addToast('Asistencia registrada', 'success');
    }
  };

  const saveReason = () => {
    if (studentForReason && classId) {
      markAttendance(studentForReason, classId, reasonDate || selectedDate, 'excused', reasonText);
      setShowReasonModal(false);
      setStudentForReason(null);
      setReasonText('');
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
      type: 'danger',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: () => { if (classId) unenrollStudent(student.id, classId); }
    });
  };

  const openHistory = (student: Student) => {
    setStudentForHistory(student);
    setShowHistoryModal(true);
  };

  // ── Monthly summary helpers
  const getMonthSummary = (month: number /* 0-11 */) => {
    const year = new Date().getFullYear();
    return enrolledStudents.map(student => {
      const records = (student.attendanceHistory || []).filter(r => {
        if (r.classId !== classId) return false;
        const d = parseLocal(r.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      const present = records.filter(r => r.status === 'present').length;
      const late = records.filter(r => r.status === 'late').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const excused = records.filter(r => r.status === 'excused').length;
      const total = records.length;
      return { student, present, late, absent, excused, total };
    });
  };

  // ── Status button render (shared between day & week)
  const StatusButtons = ({ student, date }: { student: Student; date: string }) => {
    const record = getRecord(student, date);
    const status = record?.status;
    return (
      <div className="flex items-center justify-center gap-1 bg-gray-100/50 p-1 rounded-xl w-fit mx-auto border border-gray-200/50 flex-wrap">
        {(['present','late','absent','excused'] as const).map(s => {
          const labels: Record<string,string> = { present:'Presente', late:'Tarde', absent:'Falta', excused:'Justif.' };
          const active: Record<string,string> = {
            present:'bg-green-500 text-white shadow-md',
            late:'bg-yellow-400 text-yellow-900 shadow-md',
            absent:'bg-red-500 text-white shadow-md',
            excused:'bg-blue-500 text-white shadow-md'
          };
          return (
            <button
              key={s}
              onClick={() => handleStatusChange(student.id, date, s)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${status === s ? active[s] : 'text-gray-500 hover:bg-white'}`}
            >
              {labels[s]}
            </button>
          );
        })}
      </div>
    );
  };

  if (!currentClass) return <div className="p-10 text-center">Clase no encontrada</div>;

  const weekLabel = (() => {
    const sun = startOfWeek(weekAnchor);
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
    return `${toLocalStr(sun)} – ${toLocalStr(sat)}`;
  })();

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
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['day','week','monthly'] as const).map(mode => {
              const lbl = { day:'Día', week:'Semana', monthly:'Mensual' }[mode];
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === mode ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>

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

          {viewMode === 'week' && (
            <div className="flex items-center gap-2">
              <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="text-sm font-bold text-gray-700">{weekLabel}</span>
              <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
              <button onClick={() => setWeekAnchor(new Date())} className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg ml-1">Hoy</button>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full flex-1 flex flex-col gap-6">

        {/* ────── MONTHLY DASHBOARD VIEW ────── */}
        {viewMode === 'monthly' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {selectedMonth === null ? (
              <>
                <h2 className="text-xl font-black text-gray-800 mb-6">Selecciona un mes para ver el resumen</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {MONTH_ES.map((name, idx) => {
                    const summary = getMonthSummary(idx);
                    const totalPresent = summary.reduce((acc, s) => acc + s.present + s.late, 0);
                    const totalAbsent = summary.reduce((acc, s) => acc + s.absent, 0);
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedMonth(idx)}
                        className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
                      >
                        <p className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">{new Date().getFullYear()}</p>
                        <h3 className="text-xl font-black text-gray-900 mb-3">{name}</h3>
                        <div className="flex gap-3 text-xs font-bold">
                          <span className="flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>{totalPresent} pres.</span>
                          <span className="flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>{totalAbsent} falt.</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setSelectedMonth(null)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-500">
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <h2 className="text-2xl font-black text-gray-900">{MONTH_ES[selectedMonth]} {new Date().getFullYear()}</h2>
                </div>

                <div className="bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Alumno</th>
                          <th className="px-4 py-4 text-xs font-bold text-green-600 uppercase tracking-wider text-center">Presentes</th>
                          <th className="px-4 py-4 text-xs font-bold text-yellow-600 uppercase tracking-wider text-center">Tardes</th>
                          <th className="px-4 py-4 text-xs font-bold text-red-600 uppercase tracking-wider text-center">Faltas</th>
                          <th className="px-4 py-4 text-xs font-bold text-blue-600 uppercase tracking-wider text-center">Justif.</th>
                          <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Total clases</th>
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
                          </tr>
                        ))}
                        {enrolledStudents.length === 0 && (
                          <tr><td colSpan={6} className="py-16 text-center text-gray-400">Sin alumnos inscritos</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ────── WEEKLY VIEW ────── */}
        {viewMode === 'week' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col gap-4">
            {weekSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                <span className="material-symbols-outlined text-5xl opacity-30 mb-2">event_busy</span>
                <p className="font-bold">No hay sesiones esta semana</p>
                <p className="text-sm mt-1">Todas las clases fueron canceladas o no hay clases programadas</p>
              </div>
            ) : (
              weekSessions.map(({ dateStr, label, isMoved }) => {
                const dateObj = parseLocal(dateStr);
                const dayNum = dateObj.getDate();
                const isToday = dateStr === getLocalDate();
                return (
                  <div key={dateStr} className="bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden">
                    {/* Day header */}
                    <div className={`px-6 py-3 border-b border-gray-100 flex items-center gap-3 ${isToday ? 'bg-primary/5 border-primary/20' : 'bg-gray-50'}`}>
                      <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl font-black ${isToday ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                        <span className="text-[10px] uppercase font-bold opacity-70">{label}</span>
                        <span className="text-xl leading-none">{dayNum}</span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 capitalize">{formatDateDisplay(dateStr)}</p>
                        {isMoved && <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Clase Movida</span>}
                      </div>
                    </div>
                    {/* Students for that day */}
                    <div className="divide-y divide-gray-50">
                      {enrolledStudents.length === 0 && (
                        <p className="py-8 text-center text-gray-400 text-sm">Sin alumnos inscritos</p>
                      )}
                      {enrolledStudents.map(student => (
                        <div key={student.id} className="flex items-center justify-between px-6 py-3 hover:bg-blue-50/20 transition-colors gap-4">
                          <div className="flex items-center gap-3 min-w-[160px]">
                            <Avatar src={student.avatarUrl} name={student.name} className="size-9 rounded-full border border-gray-100" />
                            <div>
                              <p className="font-bold text-text-main text-sm leading-none">{student.name}</p>
                              <p className="text-xs text-text-secondary">{student.rank}</p>
                            </div>
                          </div>
                          <StatusButtons student={student} date={dateStr} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ────── DAY VIEW ────── */}
        {viewMode === 'day' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col gap-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:w-96">
                <span className="absolute left-3 top-2.5 text-gray-400 material-symbols-outlined text-[20px]">search</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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

            {/* Table */}
            <div className="bg-white rounded-3xl shadow-card border border-gray-100 overflow-hidden flex-1">
              <div className="overflow-x-auto h-full">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Alumno</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">
                        Asistencia ({formatDateDisplay(selectedDate, {weekday: 'short', day: 'numeric'})})
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
                                <div className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white ${student.balance > 0 ? 'bg-red-500' : 'bg-green-500'}`} title={student.balance > 0 ? 'Con Adeudo' : 'Al Corriente'}></div>
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
                              <button onClick={() => handleStatusChange(student.id, selectedDate, 'present')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${status === 'present' ? 'bg-green-500 text-white shadow-md' : 'text-gray-500 hover:bg-white hover:text-green-600'}`}>Presente</button>
                              <button onClick={() => handleStatusChange(student.id, selectedDate, 'late')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${status === 'late' ? 'bg-yellow-400 text-yellow-900 shadow-md' : 'text-gray-500 hover:bg-white hover:text-yellow-600'}`}>Tarde</button>
                              <button onClick={() => handleStatusChange(student.id, selectedDate, 'absent')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${status === 'absent' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500 hover:bg-white hover:text-red-600'}`}>Falta</button>
                              <button onClick={() => handleStatusChange(student.id, selectedDate, 'excused')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${status === 'excused' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:bg-white hover:text-blue-600'}`} title={record?.reason || "Justificar"}>
                                {status === 'excused' && <span className="material-symbols-outlined text-[10px]">edit_note</span>}
                                Justif.
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openHistory(student)} className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-blue-50 transition-colors" title="Ver Historial">
                                <span className="material-symbols-outlined text-[20px]">history</span>
                              </button>
                              <button onClick={() => handleUnenroll(student)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar de Clase">
                                <span className="material-symbols-outlined text-[20px]">person_remove</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {enrolledStudents.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-20 text-center text-text-secondary">
                          <span className="material-symbols-outlined text-4xl opacity-30 mb-2">groups</span>
                          <p>No hay alumnos inscritos o que coincidan con la búsqueda.</p>
                        </td>
                      </tr>
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
            <textarea
              autoFocus
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-primary focus:border-primary min-h-[100px]"
              placeholder="Escribe el motivo (ej. Enfermedad, Trabajo...)"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowReasonModal(false)} className="px-4 py-2 rounded-lg text-gray-500 font-bold hover:bg-gray-100">Cancelar</button>
              <button onClick={saveReason} className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ENROLL ── */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex flex-col gap-4 mb-4 border-b border-gray-100 pb-4">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-text-main">Inscribir Alumno</h3>
                <button onClick={() => setShowEnrollModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400">search</span>
                <input
                  autoFocus
                  value={enrollSearchQuery}
                  onChange={(e) => setEnrollSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-primary focus:ring-primary transition-all font-medium"
                  placeholder="Buscar alumno para inscribir..."
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {availableStudents.map(student => (
                <div key={student.id} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer group" onClick={() => { enrollStudent(student.id, classId!); addToast('Alumno inscrito', 'success'); }}>
                  <div className="flex items-center gap-3">
                    <Avatar src={student.avatarUrl} name={student.name} className="size-12 rounded-full border border-gray-100" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-base text-text-main">{student.name}</p>
                        {getStatusBadge(student.status)}
                      </div>
                      <p className="text-xs text-text-secondary font-medium">{student.rank}</p>
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
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)}></div>
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
                      <div className={`absolute -left-[31px] top-0 size-4 rounded-full border-2 border-white shadow-sm ${record.status === 'present' ? 'bg-green-500' : record.status === 'late' ? 'bg-yellow-400' : record.status === 'excused' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-text-main text-sm capitalize">{formatDateDisplay(record.date)}</p>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${record.status === 'present' ? 'bg-green-50 text-green-700' : record.status === 'late' ? 'bg-yellow-50 text-yellow-700' : record.status === 'excused' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
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
