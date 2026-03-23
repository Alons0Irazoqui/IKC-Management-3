
import React, { useMemo, useState } from 'react';
import { TuitionRecord, PaymentHistoryItem } from '../../types';
import { formatDateDisplay } from '../../utils/dateUtils';
import { useFinance } from '../../context/FinanceContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useToast } from '../../context/ToastContext';

interface TransactionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: TuitionRecord | null;
    role: 'master' | 'student';
    paymentHistory?: PaymentHistoryItem[];
    onPay?: (record: TuitionRecord) => void;
    onDownloadReceipt?: (record: TuitionRecord) => void;
    onApprove?: (record: TuitionRecord) => void;
    onReject?: (record: TuitionRecord) => void;
    onReview?: (record: TuitionRecord) => void;
    onDelete?: () => void;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
    isOpen,
    onClose,
    record,
    role,
    paymentHistory = [],
    onPay,
    onDownloadReceipt,
    onApprove,
    onReject,
    onReview,
    onDelete
}) => {
    const { markAsPaidByMaster, updateRecordAmount } = useFinance();
    const { confirm } = useConfirmation();
    const { addToast } = useToast();

    const [isPayingManual, setIsPayingManual] = useState(false);
    const [manualAmount, setManualAmount] = useState<string>('');
    const [manualMethod, setManualMethod] = useState<'Efectivo' | 'Transferencia' | 'Tarjeta'>('Efectivo');
    const [manualNote, setManualNote] = useState('');

    const [isAdjustingTotal, setIsAdjustingTotal] = useState(false);
    const [adjustedTotal, setAdjustedTotal] = useState<string>('');

    const remainingDebt = useMemo(() => {
        if (!record) return 0;
        return (record.amount || 0) + (record.penaltyAmount || 0);
    }, [record]);

    React.useEffect(() => {
        if (isOpen && record) {
            setIsPayingManual(false);
            setIsAdjustingTotal(false);
            setManualAmount(remainingDebt.toString());
            setAdjustedTotal(remainingDebt.toString());
            setManualNote('');
            setManualMethod('Efectivo');
        }
    }, [isOpen, record, remainingDebt]);

    if (!isOpen || !record) return null;

    // --- LOGIC IMPLEMENTATION (RECONSTRUCTION METHOD) ---

    // 1. Total Paid History
    const totalPaid = (paymentHistory || []).reduce((acc, curr) => acc + curr.amount, 0);

    // 2. Current Debt
    const currentDebt = (record.amount || 0) + (record.penaltyAmount || 0);

    // 3. Grand Total (Reconstructed Total Value of Transaction)
    const grandTotal = totalPaid + currentDebt;

    // 4. Base Amount (Use originalAmount if available, else assume current Grand Total is base)
    let baseAmount = record.originalAmount;
    if (baseAmount === undefined || baseAmount === null || baseAmount === 0) {
        baseAmount = grandTotal - (record.penaltyAmount || 0);
    }

    // 5. Implied Penalty (Difference between what it costs now vs original base)
    let impliedPenalty = grandTotal - baseAmount;
    if (impliedPenalty < 0.01) {
        impliedPenalty = 0;
        baseAmount = grandTotal;
    }

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'paid': return { label: 'Pagado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'check_circle' };
            case 'overdue': return { label: 'Vencido', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'warning' };
            case 'partial': return { label: 'Parcial', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'pie_chart' };
            case 'in_review': return { label: 'Revisión', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'hourglass_top' };
            default: return { label: 'Pendiente', color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700', icon: 'pending' };
        }
    };

    const statusConfig = getStatusConfig(record.status);

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    const handleApplyAdjustment = () => {
        const newTotalNum = parseFloat(adjustedTotal);
        if (isNaN(newTotalNum) || newTotalNum < 0) return;

        confirm({
            title: 'Ajustar Deuda Total',
            message: `¿Deseas cambiar el monto total de este movimiento a ${formatMoney(newTotalNum)}? Útil para aplicar becas o descuentos especiales.`,
            type: 'info',
            confirmText: 'Aplicar Cambio',
            onConfirm: () => {
                updateRecordAmount(record.id, newTotalNum);
                setIsAdjustingTotal(false);
                setManualAmount(newTotalNum.toString());
                addToast('Monto total ajustado correctamente', 'success');
            }
        });
    };

    const handleConfirmManualPayment = () => {
        const amountNum = parseFloat(manualAmount);
        if (isNaN(amountNum) || amountNum <= 0) return;

        confirm({
            title: 'Confirmar Pago Manual',
            message: `¿Estás seguro de registrar un pago de ${formatMoney(amountNum)} para este movimiento? Esta acción actualizará el saldo del alumno automáticamente.`,
            type: 'success',
            confirmText: 'Registrar Pago',
            onConfirm: () => {
                markAsPaidByMaster(record.id, amountNum, manualMethod, manualNote);
                setIsPayingManual(false);
                onClose();
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <style>
                {`
                    input[type="number"].amount-input-override {
                        padding-left: 45px !important;
                    }
                `}
            </style>
            <div
                className="bg-[#0f0f0f] rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative border border-zinc-800 animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between p-6 md:p-8 border-b border-zinc-900 bg-[#0a0a0a] sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="size-10 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white flex items-center justify-center transition-all border border-zinc-800/50"
                        >
                            <span className="material-symbols-outlined text-xl">arrow_back</span>
                        </button>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${statusConfig.border} ${statusConfig.bg} ${statusConfig.color}`}>
                                    <span className="material-symbols-outlined text-[12px] filled">{statusConfig.icon}</span>
                                    {statusConfig.label}
                                </span>
                                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                                    {record.category || 'General'}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-xl font-bold text-white/90 leading-tight">
                                    {record.concept}
                                </h2>
                                {impliedPenalty > 0 && (
                                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest hidden md:inline-block">
                                        (Base + Mora)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="hidden md:block text-right">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 opacity-70">Importe Total</p>
                        <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{formatMoney(grandTotal)}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#0a0a0a] scrollbar-visible">
                    {isPayingManual ? (
                        <div className="animate-in slide-in-from-bottom-4 duration-300 flex flex-col gap-6">
                            {/* Becado / Scholarship Section */}
                            {role === 'master' && (
                                <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-5">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2 italic">
                                                <span className="material-symbols-outlined text-lg">workspace_premium</span>
                                                Ajuste por Beca o Descuento
                                            </h4>
                                            <p className="text-[11px] text-zinc-500 font-medium">Cambia el monto total que el alumno debe pagar (Becas, descuentos).</p>
                                        </div>
                                        <button
                                            onClick={() => setIsAdjustingTotal(!isAdjustingTotal)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${isAdjustingTotal ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white'}`}
                                        >
                                            {isAdjustingTotal ? 'Cancelar' : 'Ajustar'}
                                        </button>
                                    </div>

                                    {isAdjustingTotal && (
                                        <div className="flex items-end gap-3 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-2 tracking-widest ml-1">Nuevo Monto Total</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        value={adjustedTotal}
                                                        onChange={e => setAdjustedTotal(e.target.value)}
                                                        className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-8 py-3 text-lg font-bold text-white focus:border-blue-500/50 transition-all outline-none amount-input-override"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleApplyAdjustment}
                                                className="h-[50px] px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-600/10"
                                            >
                                                <span className="material-symbols-outlined text-lg">sync_alt</span>
                                                Aplicar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="bg-zinc-900/40 rounded-2xl p-8 border border-zinc-800/50">
                                <h3 className="text-xl font-bold text-white italic mb-6 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-emerald-500">point_of_sale</span>
                                    Registrar Pago Manual
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-widest ml-1">Monto del Pago</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    value={manualAmount}
                                                    onChange={e => setManualAmount(e.target.value)}
                                                    className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-8 py-4 text-2xl font-bold text-white focus:border-emerald-500/50 transition-all outline-none tabular-nums amount-input-override"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-widest ml-1">Método de Pago</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['Efectivo', 'Transferencia', 'Tarjeta'].map((m) => (
                                                    <button
                                                        key={m}
                                                        onClick={() => setManualMethod(m as any)}
                                                        className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${manualMethod === m
                                                                ? 'bg-zinc-100 text-zinc-950 border-white shadow-lg'
                                                                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                                                            }`}
                                                    >
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-widest ml-1">Motivo o Nota del Maestro</label>
                                        <textarea
                                            value={manualNote}
                                            onChange={e => setManualNote(e.target.value)}
                                            className="w-full bg-[#050505] border border-zinc-800 rounded-xl p-4 text-[13px] font-normal text-white focus:border-zinc-700 transition-all outline-none resize-none h-44 placeholder:text-zinc-800"
                                            placeholder="Ej: Pago recibido en el dojo, alumno entregó efectivo..."
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-10 pt-8 border-t border-zinc-900">
                                    <button
                                        onClick={() => setIsPayingManual(false)}
                                        className="flex-1 py-4 bg-zinc-900 border border-zinc-800 rounded-xl font-bold text-zinc-500 hover:bg-zinc-800 hover:text-white transition-all uppercase tracking-widest text-[10px]"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleConfirmManualPayment}
                                        className="flex-[2] py-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl font-bold transition-all shadow-lg uppercase tracking-widest text-xs active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                        Confirmar Liquidación
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                                {/* Costo Global - Card Version with Breakdown */}
                                <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50 flex flex-col justify-between min-h-[6rem]">
                                    <div className="flex items-center gap-2 text-zinc-500 mb-1">
                                        <span className="material-symbols-outlined text-base">receipt_long</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest">Costo Global</span>
                                    </div>

                                    {impliedPenalty > 0 ? (
                                        <div className="flex flex-col gap-0.5 mt-1.5">
                                            <div className="flex justify-between text-[9px] text-zinc-500 font-medium">
                                                <span className="uppercase tracking-tighter opacity-60">Base:</span>
                                                <span className="tabular-nums">{formatMoney(baseAmount)}</span>
                                            </div>
                                            <div className="flex justify-between text-[9px] text-red-400/80 font-bold uppercase tracking-tighter">
                                                <span>+ Mora:</span>
                                                <span className="tabular-nums">{formatMoney(impliedPenalty)}</span>
                                            </div>
                                            <div className="border-t border-zinc-800/50 my-1"></div>
                                            <span className="text-lg font-bold text-white tabular-nums tracking-tight">{formatMoney(grandTotal)}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xl font-bold text-white tabular-nums tracking-tight mt-auto">{formatMoney(grandTotal)}</span>
                                    )}
                                </div>

                                <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 flex flex-col justify-between min-h-[6rem]">
                                    <div className="flex items-center gap-2 text-emerald-500/80 mb-1">
                                        <span className="material-symbols-outlined text-base">payments</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest">Abonado</span>
                                    </div>
                                    <span className="text-xl font-bold text-emerald-400/90 tabular-nums tracking-tight mt-auto">{formatMoney(totalPaid)}</span>
                                </div>

                                <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50 flex flex-col justify-between min-h-[6rem]">
                                    <div className="flex items-center gap-2 text-zinc-500 mb-1">
                                        <span className="material-symbols-outlined text-base">pie_chart</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest">Restante</span>
                                    </div>
                                    <span className="text-xl font-bold text-white/90 tabular-nums tracking-tight mt-auto">{formatMoney(remainingDebt)}</span>
                                </div>

                                <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50 flex flex-col justify-between min-h-[6rem]">
                                    <div className="flex items-center gap-2 text-zinc-500 mb-1">
                                        <span className="material-symbols-outlined text-base">event</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest">Vence</span>
                                    </div>
                                    <span className="text-lg font-bold text-white/90 tabular-nums tracking-tight mt-auto">{formatDateDisplay(record.dueDate)}</span>
                                </div>
                            </div>

                            {/* Descripción del movimiento con scroll */}
                            {record.description && (
                                <div className="mb-6 bg-zinc-900/20 rounded-xl p-5 border border-zinc-800/40">
                                    <h4 className="text-[9px] font-bold text-zinc-500 uppercase mb-3 tracking-[0.2em] flex items-center gap-2 opacity-60">
                                        <span className="material-symbols-outlined text-[14px]">description</span>
                                        Descripción
                                    </h4>
                                    <div className="max-h-56 overflow-y-auto pr-3 text-[13px] text-zinc-400 font-medium leading-relaxed custom-scrollbar scroller-description selection:bg-red-600/30 whitespace-pre-wrap break-words scrollbar-visible">
                                        {record.description}
                                    </div>
                                </div>
                            )}

                            <div className="bg-zinc-900/20 rounded-2xl p-8 border border-zinc-800/50">
                                <h3 className="text-lg font-bold text-white italic mb-6 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-zinc-500">history</span>
                                    Historial de Movimientos
                                </h3>

                                {paymentHistory.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-zinc-700 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/5">
                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-30">savings</span>
                                        <p className="text-xs font-bold uppercase tracking-widest opacity-30">Sin pagos registrados</p>
                                    </div>
                                ) : (
                                    <div className="space-y-0 relative">
                                        <div className="absolute top-2 bottom-2 left-[19px] w-[1px] bg-zinc-800/50"></div>
                                        {paymentHistory.map((item, idx) => (
                                            <div key={idx} className="relative pl-12 pb-8 last:pb-0 group">
                                                <div className="absolute left-0 top-1 size-10 rounded-full bg-[#0a0a0a] border border-zinc-800 flex items-center justify-center z-10 shadow-sm">
                                                    <div className="size-2 bg-zinc-600 rounded-full shadow-sm shadow-zinc-600/50"></div>
                                                </div>
                                                <div className="flex justify-between items-start bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/40 hover:border-zinc-700 transition-colors shadow-sm">
                                                    <div>
                                                        <p className="text-sm font-bold text-zinc-100 capitalize">
                                                            {formatDateDisplay(item.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <span className="text-[9px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700/50 uppercase tracking-widest">
                                                                {item.method || 'Sistema'}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-600 font-bold tabular-nums">
                                                                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-lg font-bold text-white tabular-nums tracking-tighter">{formatMoney(item.amount)}</span>
                                                        <p className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-widest mt-0.5 italic">Abonado</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {!isPayingManual && (
                    <div className="p-5 border-t border-zinc-900 bg-[#0a0a0a] flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="size-9 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-300 font-bold border border-zinc-800 italic text-xs">
                                {(record.studentName || '?').charAt(0)}
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-zinc-100">{record.studentName || 'Estudiante'}</p>
                                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Alumno</p>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto items-center">
                            {role === 'master' && onDelete && (
                                <button
                                    onClick={onDelete}
                                    className="mr-2 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-red-500 hover:bg-red-500/5 transition-all active:scale-95"
                                    title="Eliminar Registro"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            )}

                            {role === 'student' && (
                                <>
                                    {remainingDebt > 0 && onPay && (
                                        <button
                                            onClick={() => record.status !== 'in_review' && onPay(record)}
                                            disabled={record.status === 'in_review'}
                                            className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-[11px] ${record.status === 'in_review'
                                                    ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800 opacity-50'
                                                    : 'bg-zinc-100 text-zinc-950 shadow-sm active:scale-95 hover:bg-white'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-base">
                                                {record.status === 'in_review' ? 'hourglass_top' : 'credit_card'}
                                            </span>
                                            {record.status === 'in_review' ? 'En Revisión' : 'Pagar'}
                                        </button>
                                    )}
                                    {(record.status === 'paid' || record.status === 'partial') && onDownloadReceipt && (
                                        <button
                                            onClick={() => onDownloadReceipt(record)}
                                            className="flex-1 md:flex-none px-5 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider"
                                        >
                                            <span className="material-symbols-outlined text-base">download</span>
                                            Recibo
                                        </button>
                                    )}
                                </>
                            )}

                            {role === 'master' && (
                                <>
                                    {remainingDebt > 0 && (
                                        <button
                                            onClick={() => setIsPayingManual(true)}
                                            className="flex-1 md:flex-none px-6 py-2.5 rounded-lg bg-emerald-600/90 text-white font-bold transition-all flex items-center justify-center gap-2 active:scale-95 text-[11px] uppercase tracking-wider shadow-sm hover:bg-emerald-600"
                                        >
                                            <span className="material-symbols-outlined text-base">payments</span>
                                            Marcar Pagado
                                        </button>
                                    )}

                                    {record.status === 'in_review' ? (
                                        <button
                                            onClick={() => {
                                                if (onReview) {
                                                    onReview(record);
                                                    onClose();
                                                }
                                            }}
                                            className="flex-1 md:flex-none px-6 py-2.5 rounded-lg bg-zinc-100 text-zinc-950 font-bold transition-all flex items-center justify-center gap-2 active:scale-95 text-[11px] uppercase tracking-wider shadow-sm hover:bg-white"
                                        >
                                            <span className="material-symbols-outlined text-base">fact_check</span>
                                            Revisar
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => onDownloadReceipt && onDownloadReceipt(record)}
                                            className="flex-1 md:flex-none px-5 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider"
                                        >
                                            <span className="material-symbols-outlined text-base">print</span>
                                            Imprimir
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default TransactionDetailModal;
