
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Student, ClassCategory, Event, LibraryResource, AcademySettings, Message, AttendanceRecord, SessionModification, ClassException, PromotionHistoryItem, CalendarEvent, Rank } from '../types';
import { PulseService } from '../services/pulseService';
import { mockMessages, defaultAcademySettings } from '../mockData';
import { getLocalDate, formatDateDisplay } from '../utils/dateUtils';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { format } from 'date-fns';

// Helper for ID generation
const generateId = (prefix?: string) => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface AcademyContextType {
    students: Student[];
    classes: ClassCategory[];
    events: Event[];
    scheduleEvents: CalendarEvent[]; // REAL CALENDAR STATE (Derived)
    libraryResources: LibraryResource[];
    academySettings: AcademySettings;
    messages: Message[];
    isLoading: boolean;

    // Actions
    refreshData: () => void;
    addStudent: (student: Student) => Promise<void>;
    updateStudent: (student: Student) => void;
    updateStudentProfile: (studentId: string, updates: Partial<Student>) => void; // NEW: Self-update
    deleteStudent: (id: string) => Promise<void>;
    updateStudentStatus: (id: string, status: Student['status']) => void;

    batchUpdateStudents: (updatedStudents: Student[]) => void;

    markAttendance: (studentId: string, classId: string, date: string, status: 'present' | 'late' | 'excused' | 'absent' | undefined, reason?: string) => void;
    bulkMarkPresent: (classId: string, date: string) => void;
    promoteStudent: (studentId: string) => void;

    addClass: (newClass: ClassCategory) => void;
    updateClass: (updatedClass: ClassCategory) => void;
    modifyClassSession: (classId: string, modification: ClassException) => void;
    deleteClass: (id: string) => void;
    enrollStudent: (studentId: string, classId: string) => void;
    unenrollStudent: (studentId: string, classId: string) => void;

    // Marketplace Events (Legacy)
    addEvent: (event: Event) => void;
    updateEvent: (event: Event) => void;
    deleteEvent: (id: string) => void;

    // --- REAL CALENDAR ACTIONS ---
    addCalendarEvent: (event: CalendarEvent) => void;
    updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => void;
    deleteCalendarEvent: (id: string) => void;

    registerForEvent: (studentId: string, eventId: string) => void;
    updateEventRegistrants: (eventId: string, studentIds: string[]) => void;
    getStudentEnrolledEvents: (studentId: string) => Event[]; // New Helper

    addLibraryResource: (resource: LibraryResource) => void;
    deleteLibraryResource: (id: string) => void;
    toggleResourceCompletion: (resourceId: string, studentId: string) => void;

    updateAcademySettings: (settings: AcademySettings) => void;
    updatePaymentDates: (billingDay: number, lateFeeDay: number) => void;
    addRank: (rank: Rank) => void;
    deleteRank: (id: string) => void;

    sendMessage: (msg: Omit<Message, 'id' | 'read' | 'date'>) => void;
    markMessageRead: (id: string) => void;
}

const AcademyContext = createContext<AcademyContextType | undefined>(undefined);

export const AcademyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const academyId = currentUser?.academyId;

    // --- ARCHITECTURE FIX: Race Condition Prevention ---
    const isPollingRef = useRef(false);

    const [isLoading, setIsLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<ClassCategory[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [scheduleEvents, setScheduleEvents] = useState<CalendarEvent[]>([]);
    const [libraryResources, setLibraryResources] = useState<LibraryResource[]>([]);
    const [academySettings, setAcademySettings] = useState<AcademySettings>(defaultAcademySettings);
    // Actually we should start with default and load.

    const [messages, setMessages] = useState<Message[]>([]);

    // Since PulseService is async, we can't initialize state with it directly.
    // We rely on useEffect to load data.

    // --- LOGIC: PROMOTION TRIGGER ---
    const checkPromotionEligibility = useCallback((student: Student): Student => {
        // Must guard against academySettings not being loaded yet
        if (!academySettings?.ranks) return student;

        const currentRank = academySettings.ranks.find(r => r.id === student.rankId);

        if (!currentRank) return student;

        if (student.attendance >= currentRank.requiredAttendance) {
            if (student.status === 'active' || student.status === 'debtor') {
                return { ...student, status: 'exam_ready' };
            }
        }
        return student;
    }, [academySettings]);

    // --- CALENDAR ENGINE ---
    const calculateCalendarEvents = useCallback((currentClasses: ClassCategory[], currentEvents: Event[]) => {
        const generatedEvents: CalendarEvent[] = [];

        // 1. Process One-time Events
        currentEvents.forEach(evt => {
            generatedEvents.push({
                ...evt,
                start: new Date(`${evt.date}T${evt.time}`),
                end: new Date(new Date(`${evt.date}T${evt.time}`).getTime() + 60 * 60 * 1000),
                color: evt.type === 'exam' ? '#db2777' : evt.type === 'tournament' ? '#f97316' : '#3b82f6',
                isRecurring: false
            });
        });

        // 2. Generate Recurring Class Instances
        const today = new Date();
        const startWindow = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        const endWindow = new Date(today.getFullYear(), today.getMonth() + 10, 0);

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        currentClasses.forEach(cls => {
            const loopDate = new Date(startWindow);

            while (loopDate <= endWindow) {
                const dayName = dayNames[loopDate.getDay()];
                const dateStr = format(loopDate, 'yyyy-MM-dd');

                const modification = cls.modifications.find(m => m.date === dateStr);
                const movedHere = cls.modifications.find(m => m.newDate === dateStr && m.type === 'move');

                let shouldRender = false;
                let currentMod: SessionModification | undefined = undefined;

                if (movedHere) {
                    shouldRender = true;
                    currentMod = movedHere;
                } else if (cls.days.includes(dayName)) {
                    if (modification?.type === 'move') {
                        shouldRender = false;
                    } else {
                        shouldRender = true;
                        currentMod = modification;
                    }
                }

                if (shouldRender) {
                    const startTime = currentMod?.newStartTime || cls.startTime;
                    const endTime = currentMod?.newEndTime || cls.endTime;
                    const instructor = currentMod?.newInstructor || cls.instructor;
                    const status = currentMod?.type === 'cancel' ? 'cancelled' : (currentMod?.type === 'rescheduled' ? 'rescheduled' : 'active');

                    if (startTime && endTime) {
                        const [sh, sm] = startTime.split(':').map(Number);
                        const [eh, em] = endTime.split(':').map(Number);

                        const start = new Date(loopDate);
                        start.setHours(sh, sm, 0);

                        const end = new Date(loopDate);
                        end.setHours(eh, em, 0);

                        let titleSuffix = '';
                        if (status === 'cancelled') {
                            titleSuffix = ' (Cancelada)';
                        } else if (movedHere || currentMod?.type === 'move') {
                            titleSuffix = ' (Movida)';
                        } else if (currentMod && currentMod.type !== 'cancel') {
                            titleSuffix = ' (Modificada)';
                        }

                        generatedEvents.push({
                            id: `${cls.id}-${dateStr}`,
                            academyId: cls.academyId,
                            classId: cls.id,
                            title: cls.name + titleSuffix,
                            start,
                            end,
                            instructor,
                            instructorName: instructor,
                            status: status,
                            type: 'class',
                            color: status === 'cancelled' ? '#ef4444' : (titleSuffix ? '#8B5CF6' : '#3b82f6'),
                            isRecurring: true,
                            description: status === 'cancelled' ? 'Clase Cancelada' : `Instructor: ${instructor}`,
                            originalDate: dateStr // <--- NEW: injected to allow correct lookup/modification
                        });
                    }
                }
                loopDate.setDate(loopDate.getDate() + 1);
            }
        });

        return generatedEvents;
    }, []);

    // Update calendar when dependencies change
    useEffect(() => {
        const newEvents = calculateCalendarEvents(classes, events);
        setScheduleEvents(newEvents);
    }, [classes, events, calculateCalendarEvents]);


    // --- DATA LOADING & POLLING ---

    const loadData = useCallback(async (silent = false) => {
        if (currentUser?.academyId) {
            if (!silent) setIsLoading(true);

            isPollingRef.current = true;

            try {
                const isStudent = currentUser.role === 'student';
                const isMaster = currentUser.role === 'master';

                // 1. Determine Students Fetch
                let studentsPromise: Promise<Student[]> = Promise.resolve([]);
                if (currentUser.academyId) {
                    // Both masters and students now fetch the academy's students.
                    // RLS has been relaxed safely, allowing students to see their classmates
                    // so that the 'Mis Compañeros' list in Class Details works correctly.
                    studentsPromise = PulseService.getStudents(currentUser.academyId);
                }

                // 2. Execute parallel fetches (Classes/Events/Library are generally accessible to academy members)
                const [dbStudents, dbClasses, dbEvents, dbSettings, dbLibrary] = await Promise.all([
                    studentsPromise,
                    PulseService.getClasses(currentUser.academyId),
                    PulseService.getEvents(currentUser.academyId),
                    PulseService.getAcademySettings(currentUser.academyId),
                    PulseService.getLibrary(currentUser.academyId)
                ]);

                setStudents(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(dbStudents)) return dbStudents;
                    return prev;
                });

                setClasses(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(dbClasses)) return dbClasses;
                    return prev;
                });

                setEvents(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(dbEvents)) return dbEvents;
                    return prev;
                });

                setAcademySettings(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(dbSettings)) return dbSettings;
                    return dbSettings;
                });

                setLibraryResources(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(dbLibrary)) return dbLibrary;
                    return prev;
                });

                const storedMsgs = localStorage.getItem('pulse_messages');
                if (storedMsgs) {
                    setMessages(JSON.parse(storedMsgs));
                } else {
                    if (messages.length === 0) {
                        setMessages(mockMessages.map(m => ({ ...m, academyId: currentUser.academyId, recipientId: 'all', recipientName: 'Todos' })));
                    }
                }

            } catch (err) {
                console.error("Error loading data", err);
            } finally {
                if (!silent) setIsLoading(false);
                setTimeout(() => {
                    isPollingRef.current = false;
                }, 500);
            }
        } else {
            setStudents([]);
            setClasses([]);
            setEvents([]);
            setIsLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        loadData(false);
    }, [loadData]);

    useEffect(() => {
        if (!currentUser) return;
        const intervalId = setInterval(() => {
            // Polling disabled for now to avoid excessive reads during dev, or enable if needed
            // loadData(true);
        }, 30000); // 30s polling
        return () => clearInterval(intervalId);
    }, [loadData, currentUser]);


    // --- MANUAL PERSISTENCE ---
    // Keep Message persistence as it's local only for now
    useEffect(() => {
        if (currentUser && !isLoading && !isPollingRef.current) localStorage.setItem('pulse_messages', JSON.stringify(messages));
    }, [messages, currentUser, isLoading]);


    // --- ACTIONS (Explicit Saves) ---

    const addStudent = async (student: Student) => {
        if (currentUser?.role !== 'master') return;

        const finalStudent = {
            ...student,
            academyId: currentUser.academyId,
        };

        try {
            setIsLoading(true);
            const initialFee = academySettings.paymentSettings?.monthlyTuition || 500;
            await PulseService.createStudentAccountFromMaster(finalStudent, (student as any).password, initialFee);

            // Re-fetch students from DB now that the trigger has added the real row
            if (currentUser.academyId) {
                const refreshedStudents = await PulseService.getStudents(currentUser.academyId);
                setStudents(refreshedStudents);
            }

            addToast('Alumno creado e invitación enviada exitosamente', 'success');
        } catch (e) {
            console.error("Failed to register student", e);
            addToast('Error al crear perfil y cuenta del alumno', 'error');
            throw e;
        } finally {
            setIsLoading(false);
        }
    };

    const updateStudent = async (updatedStudent: Student) => {
        if (currentUser?.role !== 'master') return;

        const studentWithEligibility = checkPromotionEligibility(updatedStudent);
        const newStudents = students.map(s => s.id === studentWithEligibility.id ? { ...studentWithEligibility, balance: s.balance } : s);

        try {
            setIsLoading(true);
            await PulseService.saveStudents([studentWithEligibility]);
            setStudents(newStudents);
            addToast('Datos del alumno actualizados', 'success');
        } catch (e) {
            console.error(e);
            addToast('Error al actualizar datos del alumno', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const updateStudentProfile = async (studentId: string, updates: Partial<Student>) => {
        const isOwner = currentUser?.studentId === studentId;
        const isMaster = currentUser?.role === 'master';

        if (!isOwner && !isMaster) {
            addToast('No tienes permiso para editar este perfil.', 'error');
            return;
        }

        const targetStudent = students.find(s => s.id === studentId);
        if (!targetStudent) return;

        const updatedStudent = { ...targetStudent, ...updates };

        const newStudents = students.map(s => s.id === studentId ? updatedStudent : s);
        try {
            await PulseService.saveStudents([updatedStudent]);
            setStudents(newStudents);
            addToast('Información actualizada correctamente', 'success');
        } catch (e) {
            console.error(e);
            addToast('Error al actualizar perfil', 'error');
        }
    };

    const batchUpdateStudents = async (updatedStudents: Student[]) => {
        // ALWAYS update locally first to ensure UI consistency (especially for student balance calculations)
        setStudents(prev => {
            const updatedMap = new Map<string, Student>(prev.map(s => [s.id, s]));
            updatedStudents.forEach(s => updatedMap.set(s.id, s));
            return Array.from(updatedMap.values());
        });

        // Only master role can bulk update students to DB
        if (currentUser?.role === 'master') {
            try {
                await PulseService.saveStudents(updatedStudents);
            } catch (e) {
                console.error("Error applying bulk changes to students in DB:", e);
                // addToast('Error al aplicar cambios múltiples en la base de datos', 'error');
            }
        }
    };

    const deleteStudent = async (id: string) => {
        if (currentUser?.role !== 'master') return;

        try {
            setIsLoading(true);
            await PulseService.deleteFullStudentData(id);

            const newStudents = students.filter(s => s.id !== id);

            const newClasses = classes.map(c => {
                if (c.studentIds.includes(id)) {
                    return {
                        ...c,
                        studentIds: c.studentIds.filter(sid => sid !== id),
                        studentCount: Math.max(0, c.studentCount - 1)
                    };
                }
                return c;
            });
            await PulseService.saveClasses(newClasses);

            const newEvents = events.map(e => {
                if (e.registrants?.includes(id)) {
                    return {
                        ...e,
                        registrants: e.registrants.filter(rid => rid !== id),
                        registeredCount: Math.max(0, (e.registeredCount || 0) - 1)
                    };
                }
                return e;
            });
            await PulseService.saveEvents(newEvents);

            setStudents(newStudents);
            setClasses(newClasses);
            setEvents(newEvents);
            addToast('Alumno eliminado totalmente del sistema', 'success');
        } catch (e) {
            console.error(e);
            addToast('Error al eliminar alumno', 'error');
            throw e; // Lanza el error para que StudentDetailModal no siga purgando deudas
        } finally {
            setIsLoading(false);
        }
    };

    const updateStudentStatus = async (id: string, status: Student['status']) => {
        if (currentUser?.role !== 'master') return;
        const target = students.find(s => s.id === id);
        if (!target) return;
        const updated = { ...target, status };

        const newStudents = students.map(s => s.id === id ? updated : s);
        try {
            await PulseService.saveStudents([updated]);
            setStudents(newStudents);
            addToast('Estado del alumno actualizado', 'success');
        } catch (e) {
            console.error(e);
            addToast('Error al procesar actualización de estado', 'error');
        }
    };

    const markAttendance = async (studentId: string, classId: string, date: string, status: 'present' | 'late' | 'excused' | 'absent' | undefined, reason?: string) => {
        const recordDate = date || getLocalDate();
        let updatedStudent: Student | null = null;

        const newStudents = students.map(s => {
            if (s.id === studentId) {
                let history = [...(s.attendanceHistory || [])];
                const existingIndex = history.findIndex(r => r.date === recordDate && r.classId === classId);

                if (status === undefined) {
                    if (existingIndex >= 0) history.splice(existingIndex, 1);
                } else {
                    const newRecord: AttendanceRecord = {
                        date: recordDate,
                        classId,
                        status,
                        timestamp: new Date().toISOString(),
                        reason
                    };

                    if (existingIndex >= 0) {
                        history[existingIndex] = { ...history[existingIndex], ...newRecord };
                    } else {
                        history.push(newRecord);
                    }
                }

                history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                const newAttendanceCount = history.filter(r => r.status === 'present' || r.status === 'late').length;
                const lastPresentRecord = history.find(r => r.status === 'present' || r.status === 'late');
                const lastAttendanceDate = lastPresentRecord ? lastPresentRecord.date : s.lastAttendance;

                const draftStudent = {
                    ...s,
                    attendance: newAttendanceCount,
                    attendanceHistory: history,
                    lastAttendance: lastAttendanceDate
                };

                updatedStudent = checkPromotionEligibility(draftStudent);
                return updatedStudent;
            }
            return s;
        });

        // Optimistic update – set state immediately so UI reflects changes instantly
        setStudents(newStudents);
        // Persist to DB in background
        if (updatedStudent) {
            PulseService.saveStudents([updatedStudent]).catch(e => {
                console.error('saveStudents error:', e);
                addToast('Error al guardar asistencia en servidor', 'error');
            });
        }
    };

    const bulkMarkPresent = async (classId: string, date: string) => {
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;
        const recordDate = date || getLocalDate();
        const studentsToUpdate: Student[] = [];

        const newStudents = students.map(s => {
            if (cls.studentIds.includes(s.id)) {
                const history = [...(s.attendanceHistory || [])];
                const exists = history.some(r => r.date === recordDate && r.classId === classId);

                if (!exists) {
                    const newRecord: AttendanceRecord = {
                        date: recordDate,
                        classId,
                        status: 'present',
                        timestamp: new Date().toISOString()
                    };
                    history.push(newRecord);
                    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    const newAttendanceCount = history.filter(r => r.status === 'present' || r.status === 'late').length;

                    const updatedStudent = {
                        ...s,
                        attendance: newAttendanceCount,
                        attendanceHistory: history,
                        lastAttendance: recordDate
                    };

                    const checked = checkPromotionEligibility(updatedStudent);
                    studentsToUpdate.push(checked);
                    return checked;
                }
            }
            return s;
        });

        // Optimistic update first
        setStudents(newStudents);
        addToast('Asistencia global aplicada', 'success');
        // Persist in background
        if (studentsToUpdate.length > 0) {
            PulseService.saveStudents(studentsToUpdate).catch(e => {
                console.error('bulkMarkPresent save error:', e);
                addToast('Error al guardar en servidor', 'error');
            });
        }
    };

    const promoteStudent = async (studentId: string) => {
        if (currentUser?.role !== 'master') return;
        let updatedStudent: Student | null = null;

        const newStudents = students.map(s => {
            if (s.id !== studentId) return s;
            const currentRankIndex = academySettings.ranks.findIndex(r => r.id === s.rankId);
            const nextRank = academySettings.ranks[currentRankIndex + 1];
            if (!nextRank) return s;
            const historyItem: PromotionHistoryItem = { rank: s.rank, date: getLocalDate(), notes: `Promovido a ${nextRank.name}` };

            updatedStudent = {
                ...s,
                rank: nextRank.name,
                rankId: nextRank.id,
                rankColor: nextRank.color,
                attendance: 0,
                attendanceHistory: [],
                status: 'active' as const,
                promotionHistory: [historyItem, ...(s.promotionHistory || [])]
            };
            return updatedStudent;
        });
        setStudents(newStudents);
        if (updatedStudent) await PulseService.saveStudents([updatedStudent]);
        addToast('Alumno promovido exitosamente', 'success');
    };

    const addClass = async (newClass: ClassCategory) => {
        if (currentUser?.role !== 'master') return;
        const cls = { ...newClass, id: generateId(), academyId: currentUser.academyId };
        const newClasses = [...classes, cls];
        // Optimistic update first
        setClasses(newClasses);
        addToast('Clase creada correctamente', 'success');
        try {
            await PulseService.saveClasses([cls]);
        } catch (e) {
            console.error('Error saving new class to DB:', e);
            addToast('Error al guardar clase en servidor', 'error');
        }
    };

    const updateClass = async (updatedClass: ClassCategory) => {
        if (currentUser?.role !== 'master') return;
        const newClasses = classes.map(c => c.id === updatedClass.id ? updatedClass : c);
        setClasses(newClasses);
        await PulseService.saveClasses([updatedClass]);
        addToast('Clase actualizada', 'success');
    };

    const modifyClassSession = async (classId: string, modification: SessionModification) => {
        if (currentUser?.role !== 'master') return;
        const target = classes.find(c => c.id === classId);
        if (!target) return;

        let finalMod = { ...modification };
        const currentMods = target.modifications || [];

        // Identificar si la fecha que se quiere editar/cancelar es en realidad una clase previamente movida
        const existingMove = currentMods.find(m => m.newDate === modification.date && m.type === 'move');
        
        if (existingMove) {
            finalMod.date = existingMove.date; // Re-enrutar a la fecha original
            
            if (modification.type === 'cancel') {
                finalMod.type = 'cancel';
                finalMod.newDate = undefined;
            } else if (modification.type === 'move') {
                finalMod.type = 'move';
                finalMod.newDate = modification.newDate;
            } else {
                finalMod.type = 'move';
                finalMod.newDate = existingMove.newDate;
            }
        }

        const newModifications = currentMods.filter(m => m.date !== finalMod.date);
        newModifications.push(finalMod);
        const updatedClass = { ...target, modifications: newModifications };

        try {
            setIsLoading(true);
            const newClasses = classes.map(c => c.id === classId ? updatedClass : c);
            setClasses(newClasses);
            await PulseService.saveClasses([updatedClass]);
            addToast('Sesión modificada', 'success');
        } catch (e) {
            console.error("Error modifying class session", e);
            addToast('Error al modificar sesión', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const deleteClass = async (id: string) => {
        if (currentUser?.role !== 'master') return;

        try {
            // 1. Delete from database using the new service method
            await PulseService.deleteClass(id);

            // 2. Update local classes state
            const newClasses = classes.filter(c => c.id !== id);
            setClasses(newClasses);

            // 3. Clean up students data (remove class enrollment & attendance)
            const newStudents = students.map(s => {
                const hadClass = s.classesId.includes(id);
                const hadAttendanceForClass = s.attendanceHistory?.some(a => a.classId === id);

                if (!hadClass && !hadAttendanceForClass) return s;

                return {
                    ...s,
                    classesId: s.classesId.filter(cid => cid !== id),
                    attendanceHistory: s.attendanceHistory?.filter(a => a.classId !== id) || [],
                    attendance: s.attendanceHistory?.filter(a => a.classId !== id).length || 0
                };
            });

            // 4. Update local state and save students
            setStudents(newStudents);
            await PulseService.saveStudents(newStudents);

            addToast('Clase eliminada exitosamente', 'success');
        } catch (err: any) {
            console.error("Error al eliminar la clase:", err);
            addToast(err.message || 'Error al eliminar la clase', 'error');
        }
    };

    const enrollStudent = async (studentId: string, classId: string) => {
        if (currentUser?.role !== 'master') return;

        // Use helper logic from Service if we want, or keeping it here is fine.
        // Keeping logic here to maintain state update.
        let updatedClass: ClassCategory | null = null;
        let updatedStudent: Student | null = null;

        const newClasses = classes.map(c => {
            if (c.id === classId && !c.studentIds.includes(studentId)) {
                updatedClass = { ...c, studentIds: [...c.studentIds, studentId], studentCount: c.studentCount + 1 };
                return updatedClass;
            }
            return c;
        });
        setClasses(newClasses);
        if (updatedClass) await PulseService.saveClasses([updatedClass]);

        const newStudents = students.map(s => {
            if (s.id === studentId && !s.classesId.includes(classId)) {
                updatedStudent = { ...s, classesId: [...s.classesId, classId] };
                return updatedStudent;
            }
            return s;
        });
        setStudents(newStudents);
        if (updatedStudent) await PulseService.saveStudents([updatedStudent]);

        addToast('Alumno inscrito en la clase', 'success');
    };

    const unenrollStudent = async (studentId: string, classId: string) => {
        if (currentUser?.role !== 'master') return;

        let updatedClass: ClassCategory | null = null;
        let updatedStudent: Student | null = null;

        const newClasses = classes.map(c => {
            if (c.id === classId) {
                updatedClass = { ...c, studentIds: c.studentIds.filter(id => id !== studentId), studentCount: Math.max(0, c.studentCount - 1) };
                return updatedClass;
            }
            return c;
        });
        setClasses(newClasses);
        if (updatedClass) await PulseService.saveClasses([updatedClass]);

        const newStudents = students.map(s => {
            if (s.id === studentId) {
                updatedStudent = { ...s, classesId: s.classesId.filter(id => id !== classId) };
                return updatedStudent;
            }
            return s;
        });
        setStudents(newStudents);
        if (updatedStudent) await PulseService.saveStudents([updatedStudent]);

        addToast('Alumno dado de baja de la clase', 'info');
    };

    // --- CALENDAR CRUD OPERATIONS (Wrapper) ---

    const addCalendarEvent = (event: CalendarEvent) => {
        if (event.type !== 'class') {
            addEvent(event as Event);
        }
    };

    const updateCalendarEvent = async (id: string, updates: Partial<CalendarEvent>) => {
        if (currentUser?.role !== 'master') return;

        if (updates.classId && updates.start) {
            const dateStr = format(updates.start, 'yyyy-MM-dd');

            const modification: SessionModification = {
                date: dateStr,
                type: updates.status === 'cancelled' ? 'cancel' : 'instructor',
                newInstructor: updates.instructor,
                newStartTime: updates.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                newEndTime: updates.end?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            };
            if (updates.status === 'rescheduled') modification.type = 'rescheduled';

            await modifyClassSession(updates.classId, modification);
        }
        else {
            const target = events.find(e => e.id === id);
            if (target) {
                const updated = { ...target, ...updates };
                const newEvents = events.map(e => e.id === id ? updated : e);
                setEvents(newEvents);
                await PulseService.saveEvents([updated]);
            }
        }
    };

    const deleteCalendarEvent = async (id: string) => {
        const evt = events.find(e => e.id === id);
        if (evt) {
            deleteEvent(id);
        } else {
            const [classId, dateStr] = id.split(/-(?=\d{4}-\d{2}-\d{2})/);
            if (classId && dateStr) {
                await modifyClassSession(classId, { date: dateStr, type: 'cancel' });
            }
        }
    };

    // --- MARKETPLACE EVENTS ---

    const addEvent = async (event: Event) => {
        if (currentUser?.role !== 'master') return;

        let initialRegistrants = event.registrants || [];
        if (event.type === 'exam') {
            const readyStudents = students.filter(s => s.status === 'exam_ready').map(s => s.id);
            initialRegistrants = Array.from(new Set([...initialRegistrants, ...readyStudents]));
        }

        const newEvent = {
            ...event,
            id: event.id || generateId('evt'),
            academyId: currentUser.academyId,
            registrants: initialRegistrants,
            registeredCount: initialRegistrants.length
        };

        const newEvents = [...events, newEvent];
        setEvents(newEvents);
        await PulseService.saveEvents([newEvent]);
        addToast('Evento creado', 'success');
    };

    const updateEvent = async (updatedEvent: Event) => {
        if (currentUser?.role !== 'master') return;
        const newEvents = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
        setEvents(newEvents);
        await PulseService.saveEvents([updatedEvent]);
        addToast('Evento actualizado', 'success');
    };

    const deleteEvent = async (id: string) => {
        if (currentUser?.role !== 'master') return;
        const newEvents = events.filter(e => e.id !== id);
        setEvents(newEvents);
        try {
            await PulseService.deleteEvent(id);
            addToast('Evento eliminado permanentemente', 'success');
        } catch (e) {
            console.error("Error deleting event from DB:", e);
            addToast('Error al eliminar el evento de la base de datos', 'error');
            // Optionally, we could rollback local state if DB delete fails
            // setEvents(events); 
        }
    };

    const registerForEvent = async (studentId: string, eventId: string) => {
        const event = events.find(e => e.id === eventId);

        if (event && event.type === 'exam') {
            if (currentUser?.role !== 'master') {
                addToast('La inscripción a exámenes es gestionada exclusivamente por el maestro.', 'error');
                return;
            }
        }

        const updated = { ...event, registrants: [...(event?.registrants || []), studentId], registeredCount: (event?.registeredCount || 0) + 1 } as Event;

        const newEvents = events.map(e => e.id === eventId ? updated : e);
        setEvents(newEvents);
        await PulseService.saveEvents([updated]);
    };

    const updateEventRegistrants = async (eventId: string, studentIds: string[]) => {
        if (currentUser?.role !== 'master') return;
        const target = events.find(e => e.id === eventId);
        if (!target) return;

        const updated = { ...target, registrants: studentIds, registeredCount: studentIds.length };
        const newEvents = events.map(e => e.id === eventId ? updated : e);
        setEvents(newEvents);

        await PulseService.saveEvents([updated]);
        addToast('Lista de asistentes actualizada', 'success');
    };

    const getStudentEnrolledEvents = (studentId: string) => {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - 30);

        return events.filter(e =>
            e.registrants?.includes(studentId) &&
            new Date(e.date) >= threshold
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const addLibraryResource = async (resource: LibraryResource) => {
        if (currentUser?.role !== 'master') return;
        const newResource = { ...resource, id: resource.id || generateId('lib'), academyId: currentUser.academyId };
        const newResources = [...libraryResources, newResource];
        setLibraryResources(newResources);
        await PulseService.saveLibrary([newResource]);
        addToast('Recurso añadido a la biblioteca', 'success');
    };

    const deleteLibraryResource = async (id: string) => {
        if (currentUser?.role !== 'master') return;
        const newResources = libraryResources.filter(r => r.id !== id);
        setLibraryResources(newResources);
        // Skip delete for now
        addToast('Recurso eliminado', 'success');
    };

    const toggleResourceCompletion = async (resourceId: string, studentId: string) => {
        const target = libraryResources.find(r => r.id === resourceId);
        if (!target) return;

        const completedBy = target.completedBy || [];
        let updated: LibraryResource;

        if (completedBy.includes(studentId)) {
            updated = { ...target, completedBy: completedBy.filter(id => id !== studentId) };
        } else {
            updated = { ...target, completedBy: [...completedBy, studentId] };
        }

        const newResources = libraryResources.map(r => r.id === resourceId ? updated : r);
        setLibraryResources(newResources);
        await PulseService.saveLibrary([updated]);
    };

    const updateAcademySettings = async (settings: AcademySettings) => {
        if (currentUser?.role !== 'master') return;
        setAcademySettings(settings);
        await PulseService.saveAcademySettings(settings);
        addToast('Configuración guardada', 'success');
    };

    const updatePaymentDates = async (billingDay: number, lateFeeDay: number) => {
        if (currentUser?.role !== 'master') return;
        if (lateFeeDay <= billingDay) {
            addToast("El día de recargo debe ser posterior al día de corte.", 'error');
            throw new Error("El día de recargo debe ser posterior al día de corte.");
        }
        const newSettings = {
            ...academySettings,
            paymentSettings: { ...academySettings.paymentSettings, billingDay, lateFeeDay }
        };
        setAcademySettings(newSettings);
        await PulseService.saveAcademySettings(newSettings);
        addToast('Fechas de facturación actualizadas', 'success');
    };

    const addRank = async (rank: Rank) => {
        if (currentUser?.role !== 'master') return;
        const newSettings = {
            ...academySettings,
            ranks: [...academySettings.ranks, rank]
        };
        setAcademySettings(newSettings);
        await PulseService.saveAcademySettings(newSettings);
        addToast('Rango añadido', 'success');
    };

    const deleteRank = async (id: string) => {
        if (currentUser?.role !== 'master') return;
        const newSettings = {
            ...academySettings,
            ranks: academySettings.ranks.filter(r => r.id !== id)
        };
        setAcademySettings(newSettings);
        await PulseService.saveAcademySettings(newSettings);
        addToast('Rango eliminado', 'success');
    };

    const sendMessage = (msg: Omit<Message, 'id' | 'read' | 'date'>) => {
        const newMessage = { ...msg, id: generateId('msg'), read: false, date: new Date().toISOString() };
        setMessages(prev => [newMessage, ...prev]);
        // Local storage persistence is handled by effect
    };

    const markMessageRead = (id: string) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
    };

    // --- Strict Rank Mapping based on Academy Settings ---
    const mappedStudents = useMemo(() => {
        if (!academySettings?.ranks || academySettings.ranks.length === 0) return students;
        return students.map(s => {
            // 1. Prioritize strict ID match
            let activeRank = academySettings.ranks.find(r => r.id === s.rankId);
            
            // 2. Fallback to name match (legacy logic bridging)
            if (!activeRank) {
                activeRank = academySettings.ranks.find(r => r.name.toLowerCase() === s.rank.toLowerCase());
            }

            // 3. Absolute fallback: the beginner belt
            if (!activeRank) {
                activeRank = academySettings.ranks[0];
            }

            // Return student with strictly coerced rank presentation
            return {
                ...s,
                rank: activeRank.name,
                rankColor: activeRank.color,
                rankId: activeRank.id,
            };
        });
    }, [students, academySettings?.ranks]);

    return (
        <AcademyContext.Provider value={{
            students: mappedStudents,
            classes,
            events,
            scheduleEvents,
            libraryResources,
            academySettings,
            messages,
            isLoading,
            refreshData: () => loadData(false),
            addStudent,
            updateStudent,
            updateStudentProfile,
            deleteStudent,
            updateStudentStatus,
            batchUpdateStudents,
            markAttendance,
            bulkMarkPresent,
            promoteStudent,
            addClass,
            updateClass,
            modifyClassSession,
            deleteClass,
            enrollStudent,
            unenrollStudent,
            addEvent,
            updateEvent,
            deleteEvent,
            addCalendarEvent,
            updateCalendarEvent,
            deleteCalendarEvent,
            registerForEvent,
            updateEventRegistrants,
            getStudentEnrolledEvents,
            addLibraryResource,
            deleteLibraryResource,
            toggleResourceCompletion,
            updateAcademySettings,
            updatePaymentDates,
            addRank,
            deleteRank,
            sendMessage,
            markMessageRead
        }}>
            {children}
        </AcademyContext.Provider>
    );
};

export const useAcademy = () => {
    const context = useContext(AcademyContext);
    if (context === undefined) {
        throw new Error('useAcademy must be used within an AcademyProvider');
    }
    return context;
};
