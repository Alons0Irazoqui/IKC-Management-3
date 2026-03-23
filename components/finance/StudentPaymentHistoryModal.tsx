
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TuitionRecord } from '../../types';
import { formatDateDisplay } from '../../utils/dateUtils';
import { generateReceipt } from '../../utils/pdfGenerator';
import { useStore } from '../../context/StoreContext'; // For accessing academy settings context if needed

interface StudentPaymentHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: TuitionRecord[];
}

const StudentPaymentHistoryModal: React.FC<StudentPaymentHistoryModalProps> = ({ isOpen, onClose, records }) => {
    const { academySettings, currentUser } = useStore();

    // --- FILTERS STATE ---
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'overdue' | 'in_review'>('all');
    const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

    // --- DATA PROCESSING ---
    const filteredRecords = useMemo(() => {
        let data = [...records];

        // 1. Search (Concept, Description, Amount)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(r =>
                r.concept.toLowerCase().includes(query) ||
                (r.description && r.description.toLowerCase().includes(query)) ||
                (r.amount + (r.penaltyAmount || 0)).toString().includes(query)
            );
        }

        // 2. Status Filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'pending') {
                data = data.filter(r => ['pending', 'partial', 'charged'].includes(r.status));
            } else {
                data = data.filter(r => r.status === statusFilter);
            }
        }

        // 3. Sorting
        data.sort((a, b) => {
            const dateA = new Date(a.dueDate).getTime();
            const dateB = new Date(b.dueDate).getTime();
            const amountA = a.amount + (a.penaltyAmount || 0);
            const amountB = b.amount + (b.penaltyAmount || 0);

            switch (sortOrder) {
                case 'date_asc': return dateA - dateB;
                case 'date_desc': return dateB - dateA;
                case 'amount_asc': return amountA - amountB;
                case 'amount_desc': return amountB - amountA;
                default: return 0;
            }
        });

        return data;
    }, [records, searchQuery, statusFilter, sortOrder]);

    // --- SUMMARY STATS ---
    const stats = useMemo(() => {
        const totalPaid = records.filter(r => r.status === 'paid').reduce((acc, r) => acc + (r.originalAmount || r.amount), 0);
        const totalPending = records.filter(r => ['pending', 'overdue', 'partial', 'charged'].includes(r.status)).reduce((acc, r) => acc + r.amount + (r.penaltyAmount || 0), 0);
        return { totalPaid, totalPending, count: filteredRecords.length };
    }, [records, filteredRecords]);

    if (!isOpen) return null;

    const inputStyle = `
        input.history-search-input-override {
            padding-left: 48px !important;
        }
    `;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid': return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <span className="material-symbols-outlined text-[14px] filled">check_circle</span>
                    Pagado
                </span>
            );
            case 'overdue': return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'rgba(255,82,82,0.1)', color: '#FF5252', border: '1px solid rgba(255,82,82,0.2)' }}>
                    <span className="material-symbols-outlined text-[14px] filled">warning</span>
                    Vencido
                </span>
            );
            case 'in_review': return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'rgba(96,165,250,0.1)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.2)' }}>
                    <span className="material-symbols-outlined text-[14px]">hourglass_top</span>
                    En Revisión
                </span>
            );
            case 'partial': return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.2)' }}>
                    <span className="material-symbols-outlined text-[14px]">pie_chart</span>
                    Parcial
                </span>
            );
            default: return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined text-[14px]">pending</span>
                    Pendiente
                </span>
            );
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-[#0a0a0b] flex flex-col animate-in slide-in-from-bottom-4 duration-300 font-sans">

            {/* --- TOP BAR --- */}
            <div className="px-4 md:px-8 py-4 md:py-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0a0a0b]/80 backdrop-blur-xl sticky top-0 z-20">
                <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                    <button
                        onClick={onClose}
                        className="p-2.5 md:p-3 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all text-zinc-400 hover:text-white border border-white/5"
                    >
                        <span className="material-symbols-outlined text-xl md:text-2xl">arrow_back</span>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight leading-tight">
                            Historial Completado
                        </h1>
                        <p className="text-[10px] text-zinc-500 font-bold mt-0.5 uppercase tracking-wider line-clamp-1">Visualiza todos tus movimientos.</p>
                    </div>
                </div>
                <div className="flex gap-6 md:gap-10 text-left md:text-right w-full md:w-auto p-4 md:p-0 rounded-2xl md:rounded-none bg-white/[0.02] md:bg-transparent border border-white/5 md:border-0">
                    <div className="space-y-0.5 md:space-y-1">
                        <p className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Deuda Actual</p>
                        <p className={`text-xl md:text-2xl font-black tabular-nums transition-all ${stats.totalPending > 0 ? 'text-[#FF5252]' : 'text-zinc-600'}`}>${stats.totalPending.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* --- FILTERS TOOLBAR --- */}
            <div className="px-4 md:px-8 py-4 md:py-5 bg-[#0a0a0b] border-b border-white/[0.03] flex flex-col lg:flex-row gap-4 lg:gap-6 items-center lg:justify-between">
                <style>{inputStyle}</style>
                <div className="relative w-full lg:w-[450px] group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#e11d48] transition-all duration-300 text-xl">search</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar movimiento..."
                        className="w-full pr-10 py-3 bg-[#111114] border border-white/[0.05] rounded-xl text-[13px] font-bold text-zinc-300 placeholder:text-zinc-700 focus:border-[#e11d48]/30 focus:bg-[#141418] transition-all outline-none history-search-input-override"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    {/* Status Filter */}
                    <div className="relative group w-full sm:w-auto">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="w-full appearance-none bg-[#111114] border border-white/[0.05] px-6 py-3 rounded-xl text-[10px] font-normal tracking-normal text-zinc-500 hover:text-zinc-300 hover:border-white/[0.1] transition-all outline-none cursor-pointer sm:min-w-[200px]"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="paid">Pagados</option>
                            <option value="pending">Pendientes / Parciales</option>
                            <option value="overdue">Vencidos</option>
                            <option value="in_review">En revisión</option>
                        </select>
                    </div>

                    {/* Sort Filter */}
                    <div className="relative group w-full sm:w-auto">
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as any)}
                            className="w-full appearance-none bg-[#111114] border border-white/[0.05] px-6 py-3 rounded-xl text-[10px] font-normal tracking-normal text-zinc-500 hover:text-zinc-300 hover:border-white/[0.1] transition-all outline-none cursor-pointer sm:min-w-[180px]"
                        >
                            <option value="date_desc">Más recientes</option>
                            <option value="date_asc">Más antiguos</option>
                            <option value="amount_desc">Mayor monto</option>
                            <option value="amount_asc">Menor monto</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* --- DATA GRID --- */}
            <div className="flex-1 overflow-y-auto bg-[#0a0a0b] p-4 md:p-8">
                <div className="max-w-[1600px] mx-auto bg-[#0e0e11] rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto overflow-y-hidden">
                        <table className="w-full text-left border-collapse min-w-[800px] md:min-w-full">
                        <thead className="bg-white/[0.02] border-b border-white/5">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em]">Fecha Vencimiento</th>
                                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em]">Concepto</th>
                                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em]">Método</th>
                                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em] text-center">Estado</th>
                                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em] text-right">Total</th>
                                <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em] text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-32 text-center text-zinc-500">
                                        <div className="flex flex-col items-center gap-4">
                                            <span className="material-symbols-outlined text-6xl opacity-20">search_off</span>
                                            <p className="text-sm font-bold uppercase tracking-widest opacity-40">No se encontraron movimientos.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => {
                                    const totalAmount = record.amount + (record.penaltyAmount || 0);
                                    const isPaid = record.status === 'paid';

                                    return (
                                        <tr key={record.id} className="hover:bg-white/[0.015] transition-all group">
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-white tracking-tight">{formatDateDisplay(record.dueDate)}</span>
                                                    {isPaid && record.paymentDate && (
                                                        <span className="text-[10px] text-[#34D399] font-black mt-1 uppercase tracking-wider">
                                                            PAGADO EL: {new Date(record.paymentDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-white tracking-tight">{record.concept}</span>
                                                    {record.description && (
                                                        <span className="text-xs text-zinc-500 font-medium truncate max-w-[300px] mt-1 pr-4">{record.description}</span>
                                                    )}
                                                    <span className="text-[9px] text-zinc-600 mt-2 uppercase tracking-[0.2em] font-black">{record.category}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="text-[10px] font-black text-zinc-400 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 uppercase tracking-widest">
                                                    {record.method || '---'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                {getStatusBadge(record.status)}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-base font-black tabular-nums tracking-tight ${isPaid ? 'text-[#34D399]' : totalAmount > 0 ? 'text-white' : 'text-zinc-500'}`}>
                                                        ${(record.originalAmount || totalAmount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    {!isPaid && totalAmount > 0 && (
                                                        <span className="text-[9px] font-black text-[#FF5252] bg-[#FF5252]/10 px-2 py-0.5 rounded-md mt-1.5 uppercase tracking-widest border border-[#FF5252]/20">
                                                            PND: ${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                    {(isPaid || record.status === 'partial') && (
                                                        <button
                                                            onClick={() => generateReceipt(record, academySettings, currentUser)}
                                                            className="text-zinc-500 hover:text-white p-2.5 rounded-xl hover:bg-white/5 transition-all outline-none"
                                                            title="Descargar Recibo"
                                                        >
                                                            <span className="material-symbols-outlined text-xl">receipt_long</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
);
};

export default StudentPaymentHistoryModal;
