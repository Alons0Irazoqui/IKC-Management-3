
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { TuitionRecord, ManualChargeData, ChargeCategory, Student, TuitionStatus } from '../types';
import { PulseService } from '../services/pulseService';
import { useAuth } from './AuthContext';
import { useAcademy } from './AcademyContext'; // Need academy settings for billing
import { useToast } from './ToastContext';
import { getLocalDate } from '../utils/dateUtils';

// Helper for ID generation
const generateId = (prefix: string = 'id') => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}`;
};

interface RevenueData {
    name: string;
    total: number;
}

interface FinanceStats {
    totalRevenue: number;
    pendingCollection: number;
    overdueAmount: number;
    activeStudents: number;
}

interface FinanceContextType {
    records: TuitionRecord[];
    monthlyRevenueData: RevenueData[];
    rollingRevenueData: RevenueData[];
    stats: FinanceStats;
    isFinanceLoading: boolean;

    // Actions
    refreshFinance: () => void;
    createManualCharge: (data: ManualChargeData) => void;
    createRecord: (record: TuitionRecord) => void;
    approvePayment: (recordId: string, amountPaid?: number) => void;
    rejectPayment: (recordId: string) => void;
    approveBatchPayment: (batchId: string, totalAmountPaid: number) => void;
    rejectBatchPayment: (batchId: string) => void;
    registerBatchPayment: (
        recordIds: string[],
        file: File | null,
        method: 'Transferencia' | 'Efectivo',
        totalAmount: number,
        details: { description: string; amount: number }[]
    ) => void;
    updateRecordAmount: (recordId: string, newAmount: number) => void;
    deleteRecord: (recordId: string) => void;
    generateMonthlyBilling: () => void;
    purgeStudentDebts: (studentId: string) => void;
    getStudentPendingDebts: (studentId: string) => TuitionRecord[];
    uploadProof: (recordId: string, file: File) => void;
    markAsPaidByMaster: (recordId: string, amount: number, method: 'Efectivo' | 'Transferencia' | 'Tarjeta', note?: string) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const { academySettings, students, batchUpdateStudents } = useAcademy();
    const { addToast } = useToast();

    // --- SAFETY REF TO PREVENT INFINITE LOOP ---
    const batchUpdateRef = useRef(batchUpdateStudents);
    useEffect(() => {
        batchUpdateRef.current = batchUpdateStudents;
    }, [batchUpdateStudents]);

    const [records, setRecords] = useState<TuitionRecord[]>([]);
    const [isFinanceLoading, setIsFinanceLoading] = useState(true);

    // Stats State
    const [monthlyRevenueData, setMonthlyRevenueData] = useState<RevenueData[]>([]);
    const [rollingRevenueData, setRollingRevenueData] = useState<RevenueData[]>([]);
    const [stats, setStats] = useState<FinanceStats>({
        totalRevenue: 0,
        pendingCollection: 0,
        overdueAmount: 0,
        activeStudents: 0
    });

    // --- LOAD DATA ---
    const loadFinanceData = useCallback(async () => {
        if (currentUser?.academyId) {
            setIsFinanceLoading(true);
            const dbRecords = await PulseService.getPayments(currentUser.academyId);
            setRecords(dbRecords);
            setIsFinanceLoading(false);
        } else {
            setRecords([]);
            setIsFinanceLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        loadFinanceData();
    }, [loadFinanceData]);

    // --- CORE LOGIC: BILLING GENERATION (AUTOMATED & MANUAL) ---
    const runBillingProcess = useCallback(async () => {
        if (!currentUser || currentUser.role !== 'master') return 0;
        if (!academySettings?.paymentSettings) return 0;

        const todayDate = new Date();
        const currentDay = todayDate.getDate();
        const billingDay = academySettings.paymentSettings.billingDay;

        if (currentDay >= billingDay) {
            const dateStr = getLocalDate();
            const [year, month] = dateStr.split('-');
            const monthContext = `${year}-${month}`;

            const lateFeeDay = academySettings.paymentSettings.lateFeeDay || 10;
            const dueDate = `${monthContext}-${lateFeeDay.toString().padStart(2, '0')}`;

            const activeStudents = students.filter(s => s.status === 'active');
            const newCharges: TuitionRecord[] = [];

            activeStudents.forEach(student => {
                const exists = records.some(r =>
                    r.studentId === student.id &&
                    r.month === monthContext &&
                    r.category === 'Mensualidad'
                );

                if (exists) return;

                const charge: TuitionRecord = {
                    id: generateId('bill'),
                    academyId: currentUser.academyId,
                    studentId: student.id,
                    studentName: student.name,
                    concept: `Mensualidad ${todayDate.toLocaleString('es-ES', { month: 'long' })}`,
                    month: monthContext,
                    category: 'Mensualidad',
                    amount: academySettings.paymentSettings.monthlyTuition,
                    originalAmount: academySettings.paymentSettings.monthlyTuition,
                    penaltyAmount: 0,
                    dueDate: dueDate,
                    status: 'pending',
                    type: 'charge',
                    paymentDate: null,
                    proofUrl: null,
                    canBePaidInParts: false,
                    description: 'Cuota mensual regular'
                };
                newCharges.push(charge);
            });

            if (newCharges.length > 0) {
                setRecords(prev => [...prev, ...newCharges]);
                await PulseService.savePayments(newCharges); // Sync Save
                return newCharges.length;
            }
        }
        return 0;
    }, [currentUser, academySettings, students, records]);

    // --- AUTOMATION EFFECT: MONTHLY BILLING ---
    useEffect(() => {
        if (!isFinanceLoading && students.length > 0) {
            // runBillingProcess returns promise but effect can't await. 
            // We just let it run.
            runBillingProcess().then(createdCount => {
                if (createdCount > 0) {
                    addToast(`Facturación automática: ${createdCount} cargos generados.`, 'info');
                }
            });
        }
    }, [isFinanceLoading, students.length, runBillingProcess]);

    // --- SYNC ENGINE: OVERDUE CHECK, DEBT CALCULATION ---
    useEffect(() => {
        if (isFinanceLoading || students.length === 0) return;

        const today = getLocalDate();
        let recordsUpdated = false;

        const processedRecords = records.map(r => {
            if ((r.status === 'pending' || r.status === 'charged') && r.dueDate < today) {
                recordsUpdated = true;
                const penalty = (r.customPenaltyAmount !== undefined && r.customPenaltyAmount > 0)
                    ? r.customPenaltyAmount
                    : (academySettings.paymentSettings?.lateFeeAmount || 0);

                return { ...r, status: 'overdue', penaltyAmount: penalty } as TuitionRecord;
            }
            return r;
        });

        if (recordsUpdated) {
            setRecords(processedRecords);
            PulseService.savePayments(processedRecords); // Sync Save
            // return; // Removed return to allow student updates to also run
        }

        const studentsToUpdate: Student[] = [];

        students.forEach(student => {
            // Use processed records if updated, else current records
            const currentRecordsForStudent = (recordsUpdated ? processedRecords : records).filter(r => r.studentId === student.id);
            const debt = currentRecordsForStudent.reduce((acc, r) => {
                if (['pending', 'overdue', 'partial', 'charged'].includes(r.status)) {
                    return acc + r.amount + r.penaltyAmount;
                }
                return acc;
            }, 0);

            const currentRank = academySettings.ranks?.find(r => r.id === student.rankId);
            const requiredAttendance = currentRank ? currentRank.requiredAttendance : 9999;
            const isAcademicReady = student.attendance >= requiredAttendance;
            const hasDebt = debt > 0.01;

            let newStatus = student.status;

            if (student.status !== 'inactive') {
                if (isAcademicReady) {
                    newStatus = 'exam_ready';
                } else {
                    if (hasDebt) {
                        newStatus = 'debtor';
                    } else {
                        newStatus = 'active';
                    }
                }
            }

            const currentBalance = student.balance || 0;
            if (Math.abs(currentBalance - debt) > 0.01 || student.status !== newStatus) {
                studentsToUpdate.push({ ...student, balance: debt, status: newStatus });
            }
        });

        if (studentsToUpdate.length > 0) {
            batchUpdateRef.current(studentsToUpdate);
        }

    }, [records, students, isFinanceLoading, academySettings]);

    // --- CALCULATE STATS ---
    useEffect(() => {
        if (isFinanceLoading) return;

        const pending = records.filter(r => ['pending', 'partial', 'charged', 'in_review'].includes(r.status));
        const overdue = records.filter(r => r.status === 'overdue');

        const totalPending = pending.reduce((acc, r) => acc + r.amount, 0);
        const totalOverdue = overdue.reduce((acc, r) => acc + r.amount + r.penaltyAmount, 0);

        const totalRevenue = records.reduce((acc, r) => {
            if (r.status === 'paid') return acc + (r.originalAmount ?? r.amount);
            if (r.status === 'partial') return acc + ((r.originalAmount ?? r.amount) - r.amount);
            return acc;
        }, 0);

        setStats({
            totalRevenue,
            pendingCollection: totalPending,
            overdueAmount: totalOverdue,
            activeStudents: students.filter(s => s.status === 'active').length
        });

        const generateRealChartData = () => {
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const now = new Date();
            const currentYear = now.getFullYear();

            const annualTotals = new Array(12).fill(0);

            const rollingStats: { monthIndex: number; year: number; name: string; total: number }[] = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                rollingStats.push({
                    monthIndex: d.getMonth(),
                    year: d.getFullYear(),
                    name: months[d.getMonth()],
                    total: 0
                });
            }

            records.forEach(r => {
                if ((r.status === 'paid' || r.status === 'partial') && r.paymentDate) {
                    const pDate = new Date(r.paymentDate);
                    const pYear = pDate.getFullYear();
                    const pMonth = pDate.getMonth();

                    let paidAmount = 0;
                    if (r.status === 'paid') {
                        paidAmount = (r.originalAmount ?? r.amount);
                    } else {
                        paidAmount = (r.originalAmount ?? r.amount) - r.amount;
                    }

                    if (pYear === currentYear) {
                        annualTotals[pMonth] += paidAmount;
                    }

                    const rollingMatch = rollingStats.find(
                        item => item.monthIndex === pMonth && item.year === pYear
                    );
                    if (rollingMatch) {
                        rollingMatch.total += paidAmount;
                    }
                }
            });

            setMonthlyRevenueData(months.map((m, i) => ({ name: m, total: annualTotals[i] })));
            setRollingRevenueData(rollingStats.map(r => ({ name: r.name, total: r.total })));
        };

        generateRealChartData();

    }, [records, isFinanceLoading, students]);

    // --- ACTIONS ---

    const createManualCharge = async (data: ManualChargeData) => {
        if (currentUser?.role !== 'master') return;
        const finalAmount = Number(data.amount);
        const newRecord: TuitionRecord = {
            id: generateId('chg'),
            academyId: currentUser.academyId,
            studentId: data.studentId,
            studentName: students.find(s => s.id === data.studentId)?.name || 'Estudiante',
            concept: data.title,
            description: data.description,
            amount: finalAmount,
            originalAmount: finalAmount,
            penaltyAmount: 0,
            dueDate: data.dueDate,
            paymentDate: null,
            status: 'charged',
            type: 'charge',
            category: data.category,
            method: 'System',
            proofUrl: null,
            canBePaidInParts: data.canBePaidInParts,
            relatedEventId: data.relatedEventId,
            customPenaltyAmount: data.customPenaltyAmount || 0
        };
        setRecords(prev => [...prev, newRecord]);
        await PulseService.savePayments([newRecord]);
        addToast('Cargo generado exitosamente', 'success');
    };

    const createRecord = async (record: TuitionRecord) => {
        setRecords(prev => [...prev, record]);
        await PulseService.savePayments([record]);
    };

    const registerBatchPayment = async (
        recordIds: string[],
        file: File | null,
        method: 'Transferencia' | 'Efectivo',
        totalAmount: number,
        details: { description: string; amount: number }[]
    ) => {
        const fakeUrl = file ? URL.createObjectURL(file) : null;
        const proofType = file?.type;
        const batchId = generateId('batch');
        const paymentDate = new Date().toISOString();

        let updatedRecords: TuitionRecord[] = [];

        setRecords(prev => prev.map(r => {
            if (recordIds.includes(r.id)) {
                const updated = {
                    ...r,
                    status: 'in_review' as TuitionStatus,
                    paymentDate: paymentDate,
                    proofUrl: fakeUrl,
                    proofType: proofType,
                    method: method,
                    batchPaymentId: batchId,
                    declaredAmount: totalAmount,
                    details: details
                };
                updatedRecords.push(updated);
                return updated;
            }
            return r;
        }));

        await PulseService.savePayments(updatedRecords);
        addToast('Pago registrado y enviado a revisión', 'success');
    };

    const approvePayment = async (recordId: string, amountPaid?: number) => {
        let updatedRecord: TuitionRecord | null = null;
        setRecords(prev => prev.map(r => {
            if (r.id === recordId) {
                const currentPenalty = r.penaltyAmount || 0;
                const totalDebt = r.amount + currentPenalty;
                const amountToApply = amountPaid !== undefined ? amountPaid : totalDebt;
                const remaining = Math.max(0, totalDebt - amountToApply);
                const isPaidFull = remaining < 0.01;

                const newHistoryItem = {
                    date: new Date().toISOString(),
                    amount: amountToApply,
                    method: r.method || 'System'
                };

                updatedRecord = {
                    ...r,
                    status: isPaidFull ? 'paid' : 'partial',
                    amount: isPaidFull ? 0 : remaining,
                    originalAmount: isPaidFull ? (r.originalAmount ?? r.amount) + currentPenalty : (r.originalAmount ?? r.amount),
                    // IMPORTANT: When marking as paid, penaltyAmount becomes 0 (no debt).
                    // We preserve the currentPenalty into customPenaltyAmount so we know this record HAD a penalty.
                    penaltyAmount: 0,
                    customPenaltyAmount: currentPenalty > 0 ? currentPenalty : r.customPenaltyAmount,
                    paymentHistory: [...(r.paymentHistory || []), newHistoryItem]
                };
                return updatedRecord;
            }
            return r;
        }));
        if (updatedRecord) await PulseService.savePayments([updatedRecord]);
        addToast('Pago aprobado', 'success');
    };

    const rejectPayment = async (recordId: string) => {
        let updatedRecord: TuitionRecord | null = null;
        setRecords(prev => prev.map(r => {
            if (r.id === recordId) {
                updatedRecord = {
                    ...r,
                    status: (r.dueDate < getLocalDate() ? 'overdue' : 'pending') as TuitionStatus,
                    paymentDate: null,
                    proofUrl: null,
                    batchPaymentId: undefined
                };
                return updatedRecord;
            }
            return r;
        }));
        if (updatedRecord) await PulseService.savePayments([updatedRecord]);
        addToast('Pago rechazado', 'info');
    };

    const approveBatchPayment = async (batchId: string, totalAmountPaid: number) => {
        let updatedRecords: TuitionRecord[] = [];

        setRecords(prev => {
            // Filtrar registros vinculados al lote
            const batchRecords = prev.filter(r => r.batchPaymentId === batchId);

            // --- ALGORITMO DE ORDENAMIENTO 'HEAVY DUTY' ---
            batchRecords.sort((a, b) => {
                const getPriority = (r: TuitionRecord) => {
                    const text = (r.concept + (r.category || '')).toLowerCase();
                    // Peso 0: Mensualidad / Colegiatura (Prioridad Absoluta)
                    if (text.includes('mensualidad') || text.includes('colegiatura') || r.category === 'Mensualidad') return 0;
                    // Peso 1: No permiten pagos parciales
                    if (r.canBePaidInParts === false) return 1;
                    // Peso 2: Resto (Abonables)
                    return 2;
                };

                const pA = getPriority(a);
                const pB = getPriority(b);

                if (pA !== pB) return pA - pB;
                // Si pesan lo mismo, FIFO por fecha de vencimiento
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            });

            let available = totalAmountPaid;
            const now = new Date().toISOString();

            // --- DISTRIBUCIÓN DE FONDOS (WATERFALL) ---
            updatedRecords = batchRecords.map(r => {
                const text = (r.concept + (r.category || '')).toLowerCase();
                const isMandatory = text.includes('mensualidad') || text.includes('colegiatura') || r.category === 'Mensualidad' || r.canBePaidInParts === false;

                const currentPenalty = r.penaltyAmount || 0;
                const totalDebt = r.amount + currentPenalty;
                let paid = 0;

                if (isMandatory) {
                    // Lógica para Peso 0 y Peso 1: Solo si alcanza para el 100%
                    if (available >= totalDebt - 0.01) {
                        paid = totalDebt;
                        available -= totalDebt;
                    }
                } else {
                    // Lógica para Peso 2: Toma lo que quede disponible
                    if (available > 0) {
                        paid = Math.min(available, totalDebt);
                        available -= paid;
                    }
                }

                if (paid > 0) {
                    const remaining = Math.max(0, totalDebt - paid);
                    const isPaidFull = remaining < 0.01;

                    const newHistoryItem = {
                        date: now,
                        amount: paid,
                        method: r.method || 'Batch'
                    };

                    return {
                        ...r,
                        status: isPaidFull ? 'paid' : 'partial',
                        amount: isPaidFull ? 0 : remaining,
                        originalAmount: isPaidFull ? (r.originalAmount ?? r.amount) + currentPenalty : (r.originalAmount ?? r.amount),
                        penaltyAmount: 0,
                        // Preserve penalty info
                        customPenaltyAmount: currentPenalty > 0 ? currentPenalty : r.customPenaltyAmount,
                        paymentHistory: [...(r.paymentHistory || []), newHistoryItem]
                    } as TuitionRecord;
                }

                // Si no recibió fondos (prioridad baja o fondos insuficientes para colegiatura), vuelve a su estado base
                return {
                    ...r,
                    status: (r.dueDate < getLocalDate() ? 'overdue' : 'pending') as TuitionStatus,
                    batchPaymentId: undefined // Desvincular del lote procesado
                } as TuitionRecord;
            });

            // Sincronizar cambios con la lista global de registros
            return prev.map(r => {
                const updated = updatedRecords.find(u => u.id === r.id);
                return updated || r;
            });
        });

        if (updatedRecords.length > 0) await PulseService.savePayments(updatedRecords);
        addToast('Pago global distribuido con jerarquía estricta.', 'success');
    };

    const rejectBatchPayment = async (batchId: string) => {
        let updatedRecords: TuitionRecord[] = [];

        setRecords(prev => prev.map(r => {
            if (r.batchPaymentId === batchId) {
                const updated = {
                    ...r,
                    status: (r.dueDate < getLocalDate() ? 'overdue' : 'pending') as TuitionStatus,
                    paymentDate: null,
                    proofUrl: null,
                    batchPaymentId: undefined
                };
                updatedRecords.push(updated);
                return updated;
            }
            return r;
        }));
        if (updatedRecords.length > 0) await PulseService.savePayments(updatedRecords);
        addToast('Lote de pagos rechazado', 'info');
    };

    const updateRecordAmount = async (recordId: string, newTotal: number) => {
        let updatedRecord: TuitionRecord | null = null;
        setRecords(prev => {
            const targetRecord = prev.find(r => r.id === recordId);
            if (!targetRecord) return prev;

            const currentTotal = targetRecord.amount + (targetRecord.penaltyAmount || 0);
            const delta = currentTotal - newTotal;
            const batchId = targetRecord.batchPaymentId;

            return prev.map(r => {
                const isTarget = r.id === recordId;
                const isBatchSibling = batchId && r.batchPaymentId === batchId;

                if (!isTarget && !isBatchSibling) return r;

                let updatedDeclared = r.declaredAmount;
                if (r.declaredAmount !== undefined) {
                    updatedDeclared = r.declaredAmount - delta;
                }

                if (isTarget) {
                    updatedRecord = {
                        ...r,
                        amount: newTotal,
                        penaltyAmount: 0,
                        originalAmount: newTotal,
                        declaredAmount: updatedDeclared
                    };

                    if (newTotal <= 0) {
                        updatedRecord.status = 'paid';
                        updatedRecord.paymentDate = updatedRecord.paymentDate || new Date().toISOString();
                        updatedRecord.amount = 0;
                        updatedRecord.penaltyAmount = 0;
                    }
                    return updatedRecord;
                }

                if (isBatchSibling) {
                    return {
                        ...r,
                        declaredAmount: updatedDeclared
                    };
                }
                return r;
            });
        });
        if (updatedRecord) await PulseService.savePayments([updatedRecord]);
        addToast('Monto de deuda actualizado.', 'success');
    };

    const deleteRecord = async (recordId: string) => {
        setRecords(prev => prev.filter(r => r.id !== recordId));
        await PulseService.deletePayment(recordId);
        addToast('Registro eliminado', 'info');
    };

    const generateMonthlyBilling = async () => {
        const count = await runBillingProcess();
        if (count === 0) {
            addToast('No hay cargos pendientes por generar para este mes o aún no es la fecha de corte.', 'info');
        } else {
            addToast(`Se generaron ${count} cargos de mensualidad.`, 'success');
        }
    };

    const purgeStudentDebts = (studentId: string) => {
        // This is a UI filter? Or delete?
        // Prompt says "purge" but implementation just filtered `records` state.
        // It didn't save. 
        // If we want to really purge:
        setRecords(prev => {
            const toDelete = prev.filter(r => r.studentId === studentId && r.status !== 'paid');
            toDelete.forEach(r => PulseService.deletePayment(r.id));
            return prev.filter(r => {
                if (r.studentId === studentId) {
                    return r.status === 'paid';
                }
                return true;
            });
        });
    };

    const getStudentPendingDebts = (studentId: string) => {
        return records.filter(r => r.studentId === studentId && (r.status === 'pending' || r.status === 'overdue' || r.status === 'partial' || r.status === 'charged'));
    };

    const uploadProof = async (recordId: string, file: File) => {
        registerBatchPayment([recordId], file, 'Transferencia', 0, []);
    };

    const markAsPaidByMaster = async (recordId: string, amount: number, method: 'Efectivo' | 'Transferencia' | 'Tarjeta', note?: string) => {
        if (currentUser?.role !== 'master') return;

        let updatedRecord: TuitionRecord | null = null;
        setRecords(prev => prev.map(r => {
            if (r.id === recordId) {
                const currentPenalty = r.penaltyAmount || 0;
                const totalDebt = r.amount + currentPenalty;
                const amountToApply = amount;
                const remaining = Math.max(0, totalDebt - amountToApply);
                const isPaidFull = remaining < 0.01;
                const now = new Date().toISOString();

                const newHistoryItem = {
                    date: now,
                    amount: amountToApply,
                    method: method
                };

                updatedRecord = {
                    ...r,
                    status: isPaidFull ? 'paid' : 'partial',
                    amount: isPaidFull ? 0 : remaining,
                    originalAmount: isPaidFull ? (r.originalAmount ?? r.amount) + currentPenalty : (r.originalAmount ?? r.amount),
                    // IMPORTANT: Preserve penalty info in customPenaltyAmount when wiping active penaltyAmount
                    penaltyAmount: 0,
                    customPenaltyAmount: currentPenalty > 0 ? currentPenalty : r.customPenaltyAmount,
                    paymentDate: now,
                    method: method,
                    description: note || r.description,
                    paymentHistory: [...(r.paymentHistory || []), newHistoryItem]
                } as TuitionRecord;
                return updatedRecord;
            }
            return r;
        }));
        if (updatedRecord) await PulseService.savePayments([updatedRecord]);
        addToast('Movimiento marcado como pagado exitosamente.', 'success');
    };

    return (
        <FinanceContext.Provider value={{
            records,
            monthlyRevenueData,
            rollingRevenueData,
            stats,
            isFinanceLoading,
            refreshFinance: loadFinanceData,
            createManualCharge,
            createRecord,
            approvePayment,
            rejectPayment,
            approveBatchPayment,
            rejectBatchPayment,
            registerBatchPayment,
            updateRecordAmount,
            deleteRecord,
            generateMonthlyBilling,
            purgeStudentDebts,
            getStudentPendingDebts,
            uploadProof,
            markAsPaidByMaster
        }}>
            {children}
        </FinanceContext.Provider>
    );
};

export const useFinance = () => {
    const context = useContext(FinanceContext);
    if (context === undefined) {
        throw new Error('useFinance must be used within a FinanceProvider');
    }
    return context;
};
