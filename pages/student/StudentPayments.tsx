
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { TuitionRecord } from '../../types';
import { generateReceipt } from '../../utils/pdfGenerator';
import { formatDateDisplay } from '../../utils/dateUtils';
import { motion, AnimatePresence } from 'framer-motion';
import TransactionDetailModal from '../../components/ui/TransactionDetailModal';
import StudentPaymentHistoryModal from '../../components/finance/StudentPaymentHistoryModal';

// Fix for type errors with motion components
const MotionDiv = motion.div as any;

const StatusBadge: React.FC<{ status: TuitionRecord['status'] }> = ({ status }) => {
    switch (status) {
        case 'paid':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-lg sm:text-[9px] font-bold uppercase tracking-[0.15em]" style={{backgroundColor:'rgba(52,211,153,0.06)',color:'#34D399',border:'1px solid rgba(52,211,153,0.1)'}}>
                    <span className="material-symbols-outlined text-[12px] sm:text-[18px] opacity-70">check_circle</span>
                    Pagado
                </span>
            );
        case 'in_review':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-lg sm:text-[9px] font-bold uppercase tracking-[0.15em]" style={{backgroundColor:'rgba(255,82,82,0.06)',color:'#FF5252',border:'1px solid rgba(255,82,82,0.1)'}}>
                    <span className="material-symbols-outlined text-[12px] sm:text-[18px] opacity-70">hourglass_top</span>
                    En Revisión
                </span>
            );
        case 'overdue':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-lg sm:text-[9px] font-bold uppercase tracking-[0.15em]" style={{backgroundColor:'rgba(255,82,82,0.06)',color:'#F87171',border:'1px solid rgba(255,82,82,0.1)'}}>
                    <span className="material-symbols-outlined text-[12px] sm:text-[18px] opacity-70">warning</span>
                    Vencido
                </span>
            );
        case 'partial':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-lg sm:text-[9px] font-bold uppercase tracking-[0.15em]" style={{backgroundColor:'rgba(251,191,36,0.06)',color:'#FBBF24',border:'1px solid rgba(251,191,36,0.1)'}}>
                    <span className="material-symbols-outlined text-[12px] sm:text-[18px] opacity-70">pie_chart</span>
                    Restante
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-lg sm:text-[9px] font-bold uppercase tracking-[0.15em]" style={{backgroundColor:'rgba(255,255,255,0.03)',color:'var(--color-text-muted)',border:'1px solid var(--color-border-subtle)',opacity:0.5}}>
                    <span className="material-symbols-outlined text-[12px] sm:text-[18px] opacity-70">pending</span>
                    Por Pagar
                </span>
            );
    }
};

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (
        recordIds: string[],
        file: File | null,
        method: 'Transferencia' | 'Efectivo',
        totalAmount: number,
        details: { description: string; amount: number }[]
    ) => void;
    preSelectedRecord: TuitionRecord | null;
    pendingDebts: TuitionRecord[];
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onConfirm, preSelectedRecord, pendingDebts }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    const [method, setMethod] = useState<'Transferencia' | 'Efectivo'>('Transferencia');
    const [file, setFile] = useState<File | null>(null);
    const [selectedDebts, setSelectedDebts] = useState<TuitionRecord[]>([]);
    const [isPartialEnabled, setIsPartialEnabled] = useState(false);
    const [customAmount, setCustomAmount] = useState<string>('');

    const isSinglePaymentMode = !!preSelectedRecord;

    useEffect(() => {
        if (isOpen) {
            setFile(null);
            setMethod('Transferencia');
            setIsPartialEnabled(false);
            setCustomAmount('');
            if (preSelectedRecord) {
                setSelectedDebts([preSelectedRecord]);
            } else {
                setSelectedDebts([]);
            }
        }
    }, [isOpen, preSelectedRecord]);

    const totalDebtSum = useMemo(() => {
        return selectedDebts.reduce((sum, d) => sum + (d.amount || 0) + (d.penaltyAmount || 0), 0);
    }, [selectedDebts]);

    const mandatorySum = useMemo(() => {
        return selectedDebts.reduce((sum, d) => {
            const isMensualidad = d.category === 'Mensualidad' || d.concept.toLowerCase().includes('mensualidad');
            if (!d.canBePaidInParts || isMensualidad) {
                return sum + (d.amount || 0) + (d.penaltyAmount || 0);
            }
            return sum;
        }, 0);
    }, [selectedDebts]);

    const canCustomizeAmount = useMemo(() => {
        if (selectedDebts.length === 0) return false;
        return totalDebtSum > mandatorySum;
    }, [totalDebtSum, mandatorySum, selectedDebts]);

    const finalAmount = isPartialEnabled && customAmount ? parseFloat(customAmount) : totalDebtSum;

    const isAmountValid = useMemo(() => {
        if (!isPartialEnabled) return true;
        return finalAmount >= (mandatorySum - 0.01) && finalAmount <= (totalDebtSum + 0.01);
    }, [finalAmount, mandatorySum, totalDebtSum, isPartialEnabled]);

    const availableOptions = useMemo(() => {
        return pendingDebts.filter(d => !selectedDebts.find(s => s.id === d.id));
    }, [pendingDebts, selectedDebts]);

    const handlePartialToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsPartialEnabled(checked);
        if (checked) {
            setCustomAmount(totalDebtSum.toFixed(2));
        } else {
            setCustomAmount('');
        }
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        if (!id) return;
        const debt = pendingDebts.find(d => d.id === id);
        if (debt) {
            setSelectedDebts(prev => [...prev, debt]);
            setIsPartialEnabled(false);
            setCustomAmount('');
        }
        e.target.value = "";
    };

    const handleRemoveDebt = (id: string) => {
        if (isSinglePaymentMode) return;
        setSelectedDebts(prev => prev.filter(d => d.id !== id));
        setIsPartialEnabled(false);
        setCustomAmount('');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = () => {
        if (selectedDebts.length === 0) return;
        if (method === 'Transferencia' && !file) return;
        if (!isAmountValid) {
            if (finalAmount > totalDebtSum) {
                addToast('El monto no puede ser mayor a la deuda total.', 'error');
            } else {
                addToast(`El monto mínimo obligatorio a cubrir es $${mandatorySum.toFixed(2)}`, 'error');
            }
            return;
        }
        const ids = selectedDebts.map(d => d.id);
        const details = selectedDebts.map(d => ({
            description: d.concept,
            amount: (d.amount || 0) + (d.penaltyAmount || 0)
        }));
        onConfirm(ids, file, method, finalAmount, details);
    };

    if (!isOpen) return null;
    
    const inputStyle = `
        input.amount-input-override {
            padding-left: 42px !important;
        }
    `;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" style={{backgroundColor:'rgba(0,0,0,0.6)'}}>
            <style>{inputStyle}</style>
            <div className="rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{backgroundColor:'var(--color-bg-surface)',borderColor:'var(--color-border-subtle)'}} onClick={(e) => e.stopPropagation()}>
                
                <div className="p-8 flex justify-between items-start border-b border-white/5 bg-white/[0.01]">
                    <div>
                        <h3 className="text-xl font-semibold tracking-tight" style={{color:'var(--color-text-primary)'}}>Reportar Pago</h3>
                        <p className="text-sm mt-1 opacity-50 font-medium" style={{color:'var(--color-text-muted)'}}>
                            {isSinglePaymentMode ? 'Confirma el pago de este concepto' : 'Selecciona los conceptos a pagar'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full transition-colors opacity-40 hover:opacity-100 hover:bg-white/5 min-h-[48px] min-w-[48px] flex items-center justify-center" style={{color:'var(--color-text-muted)'}}>
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex flex-col gap-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] pl-1 opacity-40" style={{color:'var(--color-text-muted)'}}>Conceptos a Pagar</label>
                        {!isSinglePaymentMode && (
                            <div className="flex flex-col gap-2 mb-3">
                                <div className="relative">
                                    <select
                                        defaultValue=""
                                        onChange={handleSelectChange}
                                        className="w-full rounded-xl py-3 pl-4 pr-10 text-sm font-medium focus:ring-2 transition-all appearance-none outline-none"
                                        style={{backgroundColor:'var(--color-bg-app)',color:'var(--color-text-primary)',border:'1px solid var(--color-border-subtle)'}}
                                    >
                                        <option value="" disabled>+ Agregar otro concepto...</option>
                                        {availableOptions.map(debt => (
                                            <option key={debt.id} value={debt.id}>
                                                {debt.concept} - ${(debt.amount || 0) + (debt.penaltyAmount || 0)}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <AnimatePresence>
                                {selectedDebts.map(debt => (
                                    <MotionDiv
                                        key={debt.id}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-center justify-between p-3.5 rounded-xl group border"
                                        style={{backgroundColor:'var(--color-bg-app)',borderColor:'var(--color-border-subtle)'}}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`size-8 rounded-lg flex items-center justify-center shrink-0`}
                                                 style={{backgroundColor: debt.category === 'Mensualidad' ? 'rgba(255,82,82,0.12)' : 'rgba(167,139,250,0.12)',
                                                         color: debt.category === 'Mensualidad' ? '#FF5252' : '#A78BFA'}}>
                                                <span className="material-symbols-outlined text-sm">
                                                    {debt.category === 'Mensualidad' ? 'payments' : 'lock'}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate" style={{color:'var(--color-text-primary)'}}>{debt.concept}</p>
                                                <p className="text-[10px] font-medium" style={{color:'var(--color-text-muted)'}}>
                                                    {debt.category === 'Mensualidad' ? 'Monto Fijo' : (debt.canBePaidInParts ? 'Permite Abonos' : 'Pago Exacto')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-sm" style={{color:'var(--color-text-primary)'}}>${((debt.amount || 0) + (debt.penaltyAmount || 0)).toFixed(2)}</span>
                                            {!isSinglePaymentMode && (
                                                <button
                                                    onClick={() => handleRemoveDebt(debt.id)}
                                                    className="p-1 transition-colors min-w-[48px] min-h-[48px] flex justify-center items-center"
                                                    style={{color:'var(--color-text-muted)'}}
                                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#F87171'}
                                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='var(--color-text-muted)'}
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            )}
                                        </div>
                                    </MotionDiv>
                                ))}
                            </AnimatePresence>

                            {selectedDebts.length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed rounded-2xl" style={{borderColor:'var(--color-border-subtle)',backgroundColor:'var(--color-bg-app)'}}>
                                    <p className="text-sm font-medium" style={{color:'var(--color-text-muted)'}}>No has seleccionado conceptos</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t" style={{borderColor:'var(--color-border-subtle)'}}>
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2.5 cursor-pointer group min-h-[48px]">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={isPartialEnabled}
                                        onChange={handlePartialToggle}
                                        disabled={!canCustomizeAmount || selectedDebts.length === 0}
                                        className="peer sr-only"
                                    />
                                    <div className="w-9 h-5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all" style={{backgroundColor: isPartialEnabled ? '#FF5252' : 'var(--color-bg-raised)'}}></div>
                                </div>
                                <span className={`text-sm font-semibold transition-colors`} style={{color: !canCustomizeAmount ? 'var(--color-text-muted)' : 'var(--color-text-secondary)'}}>
                                    ¿Abonar otra cantidad?
                                </span>
                            </label>
                        </div>

                        <div className="relative">
                            <span className={`absolute left-4 top-4 font-semibold text-lg z-10`} style={{color: !isPartialEnabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)'}}>$</span>
                            <input
                                type="number"
                                value={isPartialEnabled ? customAmount : totalDebtSum.toFixed(2)}
                                onChange={(e) => setCustomAmount(e.target.value)}
                                readOnly={!isPartialEnabled}
                                className={`w-full rounded-2xl py-4 pr-4 text-2xl font-bold transition-all outline-none border amount-input-override`}
                                style={!isPartialEnabled
                                    ? {backgroundColor:'var(--color-bg-app)',color:'var(--color-text-muted)',cursor:'not-allowed',borderColor:'var(--color-border-subtle)'}
                                    : isAmountValid
                                        ? {backgroundColor:'var(--color-bg-app)',color:'var(--color-text-primary)',borderColor:'rgba(255,82,82,0.4)'}
                                        : {backgroundColor:'rgba(255,82,82,0.06)',color:'#F87171',borderColor:'rgba(255,82,82,0.3)'}}
                                placeholder="0.00"
                            />

                            {/* HELPER ALERTS IN RED */}
                            {isPartialEnabled && !isAmountValid && (
                                <p className="text-[11px] text-red-600 font-bold mt-2 ml-1 animate-in slide-in-from-top-1 fade-in">
                                    {finalAmount < mandatorySum
                                        ? `La cantidad mínima obligatoria a cubrir es $${mandatorySum.toFixed(2)}`
                                        : `La cantidad no puede exceder el total adeudado de $${totalDebtSum.toFixed(2)}`
                                    }
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-wider pl-1" style={{color:'var(--color-text-muted)'}}>Método de Pago</label>
                        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl mb-3" style={{backgroundColor:'var(--color-bg-app)'}}>
                            <button
                                onClick={() => setMethod('Transferencia')}
                                className={`py-2.5 min-h-[48px] rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2`}
                                style={method === 'Transferencia'
                                    ? {backgroundColor:'var(--color-bg-surface)',color:'#FF5252',boxShadow:'0 1px 4px rgba(0,0,0,0.3)',border:'1px solid rgba(255,82,82,0.25)'}
                                    : {color:'var(--color-text-muted)'}}
                            >
                                <span className="material-symbols-outlined text-[18px]">account_balance</span>
                                Transferencia
                            </button>
                            <button
                                onClick={() => setMethod('Efectivo')}
                                className={`py-2.5 min-h-[48px] rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2`}
                                style={method === 'Efectivo'
                                    ? {backgroundColor:'var(--color-bg-surface)',color:'#34D399',boxShadow:'0 1px 4px rgba(0,0,0,0.3)',border:'1px solid rgba(52,211,153,0.25)'}
                                    : {color:'var(--color-text-muted)'}}
                            >
                                <span className="material-symbols-outlined text-[18px]">payments</span>
                                Efectivo
                            </button>
                        </div>

                        {method === 'Transferencia' ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all group`}
                                style={file
                                    ? {borderColor:'rgba(52,211,153,0.5)',backgroundColor:'rgba(52,211,153,0.06)'}
                                    : {borderColor:'var(--color-border-subtle)',backgroundColor:'var(--color-bg-app)'}}
                                onMouseEnter={e => { if (!file) (e.currentTarget as HTMLElement).style.borderColor='rgba(255,82,82,0.4)'; }}
                                onMouseLeave={e => { if (!file) (e.currentTarget as HTMLElement).style.borderColor='var(--color-border-subtle)'; }}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    onChange={handleFileChange}
                                />
                                {file ? (
                                    <div className="flex flex-col items-center animate-in zoom-in">
                                        <div className="size-12 rounded-full flex items-center justify-center mb-2" style={{backgroundColor:'rgba(52,211,153,0.12)',color:'#34D399'}}>
                                            <span className="material-symbols-outlined text-2xl filled">check_circle</span>
                                        </div>
                                        <p className="text-sm font-bold break-all px-4" style={{color:'var(--color-text-primary)'}}>{file.name}</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center transition-colors" style={{color:'var(--color-text-muted)'}}>
                                        <span className="material-symbols-outlined text-4xl mb-2">cloud_upload</span>
                                        <p className="text-sm font-bold" style={{color:'var(--color-text-secondary)'}}>Subir Comprobante</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-2xl p-4 flex gap-3 items-start border" style={{backgroundColor:'rgba(52,211,153,0.06)',borderColor:'rgba(52,211,153,0.2)'}}>
                                <div className="p-1.5 rounded-lg mt-0.5" style={{backgroundColor:'var(--color-bg-surface)',color:'#34D399'}}>
                                    <span className="material-symbols-outlined text-xl">storefront</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold" style={{color:'#34D399'}}>Pago en Recepción</p>
                                    <p className="text-xs mt-0.5 leading-relaxed" style={{color:'var(--color-text-muted)'}}>
                                        Notifica tu pago ahora para generar la orden y acude a recepción.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t flex gap-3 shrink-0" style={{borderColor:'var(--color-border-subtle)',backgroundColor:'var(--color-bg-app)'}}>
                    <button onClick={onClose} className="flex-1 py-3.5 min-h-[48px] rounded-xl font-bold transition-all text-sm border" style={{backgroundColor:'var(--color-bg-surface)',color:'var(--color-text-secondary)',borderColor:'var(--color-border-subtle)'}} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.backgroundColor='var(--color-bg-raised)'} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.backgroundColor='var(--color-bg-surface)'}>Cancelar</button>
                    <button
                        onClick={handleSubmit}
                        disabled={selectedDebts.length === 0 || (method === 'Transferencia' && !file) || !isAmountValid}
                        className="flex-[2] py-3.5 min-h-[48px] rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 text-sm flex items-center justify-center gap-2"
                        style={{backgroundColor:'rgba(255,82,82,0.15)',color:'#FF5252',border:'1px solid rgba(255,82,82,0.3)'}}
                        onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.backgroundColor='rgba(255,82,82,0.25)'; }}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor='rgba(255,82,82,0.15)'}
                    >
                        {method === 'Efectivo' ? 'Notificar Pago' : 'Enviar Comprobante'}
                        <span className="material-symbols-outlined text-lg">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const StudentPayments: React.FC = () => {
    const { currentUser, records, uploadProof, createRecord, academySettings, getStudentPendingDebts, registerBatchPayment } = useStore();
    const { addToast } = useToast();

    const [selectedRecord, setSelectedRecord] = useState<TuitionRecord | null>(null);
    const [selectedDetailRecord, setSelectedDetailRecord] = useState<TuitionRecord | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    const myRecords = useMemo(() => {
        return [...records]
            .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    }, [records]);

    const pendingDebts = useMemo(() => {
        return myRecords.filter(r => ['pending', 'overdue', 'partial', 'charged'].includes(r.status));
    }, [myRecords]);

    const activeRecords = myRecords.filter(r => ['pending', 'overdue', 'charged', 'partial'].includes(r.status));
    const inReviewRecords = myRecords.filter(r => r.status === 'in_review');
    const historyRecords = myRecords.filter(r => r.status === 'paid' || r.status === 'partial');

    const totalDebt = activeRecords.reduce((acc, r) => {
        const currentAmount = r.status === 'overdue' ? (r.amount || 0) + (r.penaltyAmount || 0) : (r.amount || 0);
        return acc + currentAmount;
    }, 0);

    const bankInfo = academySettings.bankDetails;

    const handleOpenPaymentModal = (record?: TuitionRecord) => {
        setSelectedRecord(record || null);
        setIsModalOpen(true);
    };

    const handleConfirmPayment = (
        recordIds: string[],
        file: File | null,
        method: 'Transferencia' | 'Efectivo',
        totalAmount: number,
        details: { description: string; amount: number }[]
    ) => {
        if (!file && method === 'Transferencia') return;
        const fileToSend = file || new File([""], "pago_efectivo.txt", { type: "text/plain" });
        registerBatchPayment(recordIds, fileToSend, method, totalAmount, details);
        setIsModalOpen(false);
        setSelectedRecord(null);
    };

    const handleDownloadReceipt = (record: TuitionRecord) => {
        generateReceipt(record, academySettings, currentUser);
    };

    return (
        <div className="max-w-[1200px] mx-auto p-3 md:p-10 w-full min-h-full flex flex-col gap-6 md:gap-8 pb-32" style={{backgroundColor:'var(--color-bg-app)'}}>

            <header className="flex flex-col md:flex-row justify-between items-stretch md:items-end gap-6 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] relative overflow-hidden border" style={{backgroundColor:'var(--color-bg-surface)',borderColor:'var(--color-border-subtle)'}}>
                <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(circle at 0% 100%, rgba(255,82,82,0.05) 0%, transparent 55%)'}}></div>
                <div className="absolute top-0 right-10 opacity-[0.03] pointer-events-none hidden md:block">
                    <span className="material-symbols-outlined text-[130px]" style={{color:'#FF5252'}}>account_balance_wallet</span>
                </div>
                <div className="relative z-10 flex-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-3 md:mb-4" style={{backgroundColor:'rgba(255,82,82,0.08)',color:'#FF5252',border:'1px solid rgba(255,82,82,0.15)'}}>
                        Finanzas
                    </div>
                    <h1 className="text-2xl md:text-5xl font-bold tracking-tight mb-2 md:mb-3" style={{color:'var(--color-text-primary)'}}>Mis Pagos</h1>
                    <p className="text-[13px] md:text-base leading-relaxed opacity-60 font-medium" style={{color:'var(--color-text-secondary)'}}>
                        Gestiona tus pagos y revisa tu historial.
                    </p>
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-end relative z-10 min-w-full md:min-w-[200px] p-5 md:p-6 rounded-2xl md:rounded-3xl border" style={{backgroundColor:'rgba(255,255,255,0.02)',borderColor:'var(--color-border-subtle)'}}>
                    <div className="text-left md:text-right">
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] mb-1 md:mb-2 opacity-50 block" style={{color:'var(--color-text-muted)'}}>Saldo Pendiente</span>
                        <div className="text-2xl md:text-4xl font-bold tracking-tight tabular-nums" style={{color: totalDebt > 0 ? '#F87171' : '#34D399'}}>
                            ${totalDebt.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    {totalDebt > 0 ? (
                        <span className="text-[8px] md:text-[9px] font-bold px-2 md:px-3 py-1 rounded-full uppercase tracking-widest whitespace-nowrap" style={{backgroundColor:'rgba(255,82,82,0.08)',color:'#F87171',border:'1px solid rgba(255,82,82,0.15)'}}>
                            Pago Requerido
                        </span>
                    ) : (
                        <span className="text-[8px] md:text-[9px] font-bold px-2 md:px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span className="material-symbols-outlined text-[12px] md:text-[14px]">check_circle</span> Al corriente
                        </span>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                <div className="lg:col-span-2 flex flex-col gap-10">
                    <div className="flex flex-col gap-5">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-[11px] font-bold flex items-center gap-2 uppercase tracking-[0.2em] opacity-40" style={{color:'var(--color-text-primary)'}}>
                                <span className="material-symbols-outlined text-base">receipt_long</span>
                                Conceptos por Pagar
                            </h3>
                        </div>

                        {activeRecords.length === 0 && inReviewRecords.length === 0 ? (
                            <div className="rounded-[2.5rem] p-16 text-center border bg-white/[0.01]" style={{borderColor:'var(--color-border-subtle)'}}>
                                <div className="size-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{backgroundColor:'rgba(52,211,153,0.06)',color:'#34D399'}}>
                                    <span className="material-symbols-outlined text-4xl opacity-40">verified_user</span>
                                </div>
                                <h4 className="font-bold text-2xl mb-2" style={{color:'var(--color-text-primary)'}}>¡Estás al día!</h4>
                                <p className="text-sm opacity-50 font-medium" style={{color:'var(--color-text-muted)'}}>No tienes pagos pendientes registrados.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <AnimatePresence>
                                    {activeRecords.map((record) => {
                                        const isOverdue = record.status === 'overdue';
                                        const amountDisplay = isOverdue ? (record.amount || 0) + (record.penaltyAmount || 0) : (record.amount || 0);

                                        return (
                                            <MotionDiv
                                                key={record.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                onClick={() => setSelectedDetailRecord(record)}
                                                className="rounded-xl md:rounded-2xl p-4 md:p-5 transition-all group relative overflow-hidden cursor-pointer border"
                                                style={{backgroundColor:'var(--color-bg-surface)',borderColor: isOverdue ? 'rgba(248,113,113,0.3)' : 'var(--color-border-subtle)'}}
                                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = isOverdue ? 'rgba(248,113,113,0.5)' : 'var(--color-border-strong)'; el.style.transform='translateY(-1px)'; }}
                                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = isOverdue ? 'rgba(248,113,113,0.3)' : 'var(--color-border-subtle)'; el.style.transform='translateY(0)'; }}
                                            >
                                                {isOverdue && <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{backgroundColor:'#F87171'}}></div>}

                                                <div className="flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center pl-2">
                                                    <div className="flex-1 w-full">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <StatusBadge status={record.status} />
                                                            <span className="text-lg sm:text-xs font-bold sm:font-medium px-2 py-1 rounded-lg" style={{color:'var(--color-text-muted)',backgroundColor:'var(--color-bg-app)',border:'1px solid var(--color-border-subtle)'}}>Vence: {formatDateDisplay(record.dueDate)}</span>
                                                        </div>
                                                        <h4 className="text-base font-semibold mb-1" style={{color:'var(--color-text-primary)'}}>{record.concept}</h4>
                                                        {isOverdue && (
                                                            <p className="text-[10px] font-bold flex items-center gap-1 w-fit px-2 py-0.5 rounded-md uppercase tracking-wider" style={{color:'#F87171',backgroundColor:'rgba(255,82,82,0.06)',border:'1px solid rgba(255,82,82,0.1)'}}>
                                                                <span className="material-symbols-outlined text-[12px]">error_outline</span>
                                                                Recargo: ${record.penaltyAmount}
                                                            </p>
                                                        )}
                                                        {record.status === 'partial' && (
                                                            <p className="text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider" style={{color:'#FBBF24'}}>
                                                                <span className="material-symbols-outlined text-[12px]">pie_chart</span>
                                                                Saldo pendiente
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0" style={{borderColor:'var(--color-border-subtle)'}}>
                                                        <div className="text-right">
                                                            <span className="block text-[9px] uppercase tracking-[0.2em] font-bold mb-1 opacity-30" style={{color:'var(--color-text-muted)'}}>Monto Total</span>
                                                            <span className="text-2xl font-bold tabular-nums tracking-tight" style={{color: isOverdue ? '#F87171' : 'var(--color-text-primary)'}}>
                                                                ${amountDisplay.toFixed(2)}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            {record.status === 'partial' && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDownloadReceipt(record); }}
                                                                    className="size-10 md:size-11 rounded-lg md:rounded-xl flex items-center justify-center transition-all bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] text-zinc-500 hover:text-white min-h-[48px] min-w-[48px]"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px] md:text-[20px]">receipt_long</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleOpenPaymentModal(record); }}
                                                                className="px-4 md:px-6 py-2.5 md:py-3 min-h-[48px] rounded-lg md:rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap text-[12px] md:text-[11px] uppercase tracking-widest shadow-lg shadow-black/20"
                                                                style={{backgroundColor:'rgba(255,82,82,0.08)',color:'#FF5252',border:'1px solid rgba(255,82,82,0.15)'}}
                                                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor='rgba(255,82,82,0.12)'}
                                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor='rgba(255,82,82,0.08)'}
                                                            >
                                                                <span className="material-symbols-outlined text-[16px] md:text-[18px]">payment</span>
                                                                Pagar ahora
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </MotionDiv>
                                        );
                                    })}
                                </AnimatePresence>

                                {inReviewRecords.map((record) => (
                                    <MotionDiv
                                        key={record.id}
                                        layout
                                        onClick={() => setSelectedDetailRecord(record)}
                                        className="rounded-2xl p-5 flex flex-col sm:flex-row gap-4 justify-between items-center cursor-pointer border"
                                        style={{backgroundColor:'var(--color-bg-surface)',borderColor:'rgba(255,82,82,0.2)',opacity:0.85}}
                                    >
                                        <div className="flex-1 w-full">
                                            <div className="flex justify-between items-start mb-2">
                                                <StatusBadge status="in_review" />
                                                <span className="text-lg sm:text-xs font-bold sm:font-medium" style={{color:'var(--color-text-muted)'}}>Enviado: {formatDateDisplay(record.paymentDate || '')}</span>
                                            </div>
                                            <h4 className="text-base font-bold" style={{color:'var(--color-text-secondary)'}}>{record.concept}</h4>
                                        </div>
                                        <div className="text-right w-full sm:w-auto flex justify-between sm:block items-center">
                                            <span className="text-lg font-bold block" style={{color:'var(--color-text-secondary)'}}>${((record.amount || 0) + (record.penaltyAmount || 0)).toFixed(2)}</span>
                                            <p className="text-[10px] font-bold uppercase tracking-wide mt-1" style={{color:'#FF5252'}}>Validando...</p>
                                        </div>
                                    </MotionDiv>
                                ))}
                            </div>
                        )}
                    </div>

                    {historyRecords.length > 0 && (
                        <div className="flex flex-col gap-5 pt-6 border-t" style={{borderColor:'var(--color-border-subtle)'}}>
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-[10px] font-bold flex items-center gap-2 uppercase tracking-[0.2em] opacity-40" style={{color:'var(--color-text-muted)'}}>
                                     <span className="material-symbols-outlined text-base">history</span>
                                     Historial Reciente
                                 </h3>
                                 <button
                                     onClick={() => setShowHistoryModal(true)}
                                     className="text-[12px] md:text-[10px] min-h-[48px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70 bg-[#FF5252]/5 px-4 py-2 rounded-lg border border-[#FF5252]/10"
                                     style={{color:'#FF5252'}}
                                 >
                                     Ver completo
                                 </button>
                             </div>
                            <div className="flex flex-col rounded-2xl overflow-hidden border" style={{borderColor:'var(--color-border-subtle)'}}>
                                {historyRecords.slice(0, 5).map((record) => (
                                    <div
                                        key={record.id}
                                        onClick={() => setSelectedDetailRecord(record)}
                                        className="p-4 flex justify-between items-center cursor-pointer transition-all border-b last:border-b-0"
                                        style={{backgroundColor:'var(--color-bg-surface)',borderColor:'var(--color-border-subtle)'}}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor='var(--color-bg-raised)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor='var(--color-bg-surface)'}
                                    >
                                        <div>
                                             <div className="flex items-center gap-3 mb-1">
                                                 <span className="text-sm font-semibold" style={{color:'var(--color-text-primary)'}}>{record.concept}</span>
                                                 <span className="text-lg sm:text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
                                                       style={record.status === 'partial'
                                                           ? {backgroundColor:'rgba(251,191,36,0.06)',color:'#FBBF24',border:'1px solid rgba(251,191,36,0.1)'}
                                                           : {backgroundColor:'rgba(52,211,153,0.06)',color:'#34D399',border:'1px solid rgba(52,211,153,0.1)'}}>
                                                     {record.status === 'partial' ? 'Parcial' : 'Pagado'}
                                                 </span>
                                             </div>
                                             <p className="text-sm sm:text-[11px] font-medium opacity-60 sm:opacity-40 mt-1 sm:mt-0" style={{color:'var(--color-text-muted)'}}>
                                                 {formatDateDisplay(record.paymentDate || '')} • {record.method}
                                             </p>
                                         </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold text-lg sm:text-sm" style={{color:'var(--color-text-primary)'}}>${(record.originalAmount || record.amount).toFixed(2)}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDownloadReceipt(record); }}
                                                className="size-8 rounded-lg flex items-center justify-center transition-colors min-h-[48px] min-w-[48px]"
                                                style={{color:'var(--color-text-muted)',backgroundColor:'var(--color-bg-app)'}}
                                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#FF5252'}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='var(--color-text-muted)'}
                                            >
                                                <span className="material-symbols-outlined text-lg">description</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-6 lg:sticky lg:top-6">

                    <button
                        onClick={() => handleOpenPaymentModal()}
                        className="w-full py-4 md:py-5 min-h-[48px] rounded-xl md:rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-3 group bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1] text-zinc-300 text-xs md:text-sm shadow-xl"
                    >
                        <span className="material-symbols-outlined text-lg md:text-xl group-hover:text-[#FF5252] transition-colors">add_card</span>
                        Pagar Varios Conceptos
                    </button>

                    <div className="rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 relative overflow-hidden border" style={{backgroundColor:'var(--color-bg-surface)',borderColor:'var(--color-border-subtle)'}}>
                        <div className="relative z-10">
                            <h3 className="text-[10px] md:text-[11px] font-bold mb-6 md:mb-8 flex items-center gap-2 uppercase tracking-[0.2em] opacity-40" style={{color:'var(--color-text-muted)'}}>
                                <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                                Datos Bancarios
                            </h3>

                            {bankInfo ? (
                                <div className="space-y-5 md:space-y-6">
                                    <div className="flex justify-between items-start md:block">
                                        <div>
                                            <p className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] font-bold mb-1 md:mb-2 opacity-40" style={{color:'var(--color-text-muted)'}}>Banco</p>
                                            <p className="text-base md:text-lg font-bold tracking-tight" style={{color:'var(--color-text-primary)'}}>{bankInfo.bankName}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] font-bold mb-1 md:mb-2 opacity-40" style={{color:'var(--color-text-muted)'}}>Beneficiario</p>
                                        <p className="text-xs md:text-sm font-semibold opacity-80 leading-tight" style={{color:'var(--color-text-secondary)'}}>{bankInfo.accountHolder}</p>
                                    </div>
                                    <div className="rounded-xl md:rounded-2xl p-3 md:p-4 bg-white/[0.02]" style={{border:'1px solid var(--color-border-subtle)'}}>
                                        <p className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] font-bold mb-2 md:mb-3 opacity-30" style={{color:'var(--color-text-muted)'}}>CLABE Interbancaria</p>
                                        <div className="flex items-center justify-between gap-2 overflow-hidden">
                                            <p className="font-mono text-sm md:text-base tracking-[0.05em] md:tracking-[0.1em] select-all font-medium truncate" style={{color:'var(--color-text-primary)'}}>{bankInfo.clabe}</p>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(bankInfo.clabe); addToast('CLABE copiada', 'success') }}
                                                className="p-1.5 bg-white/5 rounded-lg transition-colors hover:text-[#FF5252] min-h-[48px] min-w-[48px] flex items-center justify-center"
                                                style={{color:'var(--color-text-muted)'}}
                                                title="Copiar"
                                            >
                                                <span className="material-symbols-outlined text-[16px] md:text-lg">content_copy</span>
                                            </button>
                                        </div>
                                    </div>
                                    {bankInfo.instructions && (
                                        <div className="text-[11px] md:text-xs leading-relaxed p-3 rounded-xl" style={{backgroundColor:'rgba(255,82,82,0.06)',color:'var(--color-text-secondary)',border:'1px solid rgba(255,82,82,0.15)'}}>
                                            <span className="font-bold block mb-1" style={{color:'#FF5252'}}>Instrucciones:</span>
                                            {bankInfo.instructions}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="italic text-xs md:text-sm" style={{color:'var(--color-text-muted)'}}>Sin información bancaria.</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            <PaymentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmPayment}
                preSelectedRecord={selectedRecord}
                pendingDebts={pendingDebts}
            />

            <TransactionDetailModal
                isOpen={!!selectedDetailRecord}
                onClose={() => setSelectedDetailRecord(null)}
                record={selectedDetailRecord}
                role="student"
                paymentHistory={selectedDetailRecord?.paymentHistory || []}
                onPay={(r) => {
                    setSelectedDetailRecord(null);
                    handleOpenPaymentModal(r);
                }}
                onDownloadReceipt={(r) => handleDownloadReceipt(r)}
            />

            {/* NEW FULL HISTORY DASHBOARD MODAL */}
            <StudentPaymentHistoryModal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                records={myRecords}
            />
        </div>
    );
};

export default StudentPayments;
