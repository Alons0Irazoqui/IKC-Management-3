
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { TuitionRecord, TuitionStatus } from '../../types';
import { exportToCSV } from '../../utils/csvExport';
import { generateReceipt } from '../../utils/pdfGenerator';
import { formatDateDisplay } from '../../utils/dateUtils';
import EmptyState from '../../components/ui/EmptyState';
import CreateChargeModal from '../../components/finance/CreateChargeModal';
import TransactionDetailModal from '../../components/ui/TransactionDetailModal';

// --- HELPER COMPONENTS ---

const StatusBadge: React.FC<{ status: TuitionStatus; amount: number; penalty: number }> = ({ status, amount, penalty }) => {
    switch (status) {
        case 'paid':
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-semibold bg-emerald-500/10 text-emerald-400/90 uppercase tracking-wider border border-emerald-500/10">
                    <span className="material-symbols-outlined text-[11px] filled">check_circle</span>
                    Pagado
                </span>
            );
        case 'in_review':
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-semibold bg-blue-500/10 text-blue-400/90 uppercase tracking-wider border border-blue-500/10">
                    <span className="material-symbols-outlined text-[11px] filled">hourglass_top</span>
                    Revisión
                </span>
            );
        case 'overdue':
            return (
                <div className="flex flex-col items-start gap-1">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-semibold bg-red-500/10 text-red-500/90 uppercase tracking-wider border border-red-500/10">
                        <span className="material-symbols-outlined text-[11px] filled">warning</span>
                        Vencido
                    </span>
                    {penalty > 0 && <span className="text-[9px] text-red-400/80 font-semibold ml-1 tabular-nums">+${penalty} Mora</span>}
                </div>
            );
        case 'partial':
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-semibold bg-amber-500/10 text-amber-400/90 uppercase tracking-wider border border-amber-500/10">
                    <span className="material-symbols-outlined text-[11px] filled">pie_chart</span>
                    Parcial
                </span>
            );
        default: // pending
            return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-semibold bg-zinc-800/50 text-zinc-400 uppercase tracking-wider border border-zinc-700/30">
                    <span className="material-symbols-outlined text-[11px]">pending</span>
                    Pendiente
                </span>
            );
    }
};

const DebtAmountEditor = ({ item, onUpdate }: { item: TuitionRecord, onUpdate: (id: string, val: number) => void }) => {
    const totalDebt = item.amount + (item.penaltyAmount || 0);
    const [val, setVal] = useState(totalDebt.toString());
    const { addToast } = useToast();
    
    useEffect(() => {
        const currentTotal = item.amount + (item.penaltyAmount || 0);
        setVal(currentTotal.toString());
    }, [item.amount, item.penaltyAmount]);

    const handleSave = () => {
        const num = parseFloat(val);
        if (!isNaN(num) && num >= 0) {
            onUpdate(item.id, num);
            addToast("Monto actualizado", 'success');
        }
    };

    const currentTotal = item.amount + (item.penaltyAmount || 0);
    const hasChanged = parseFloat(val) !== currentTotal;

    return (
        <div className="flex flex-col items-end gap-2" onClick={e => e.stopPropagation()}>
            <div className="flex items-center">
                <div className="relative group">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-500 font-bold pointer-events-none text-xs">$</span>
                    <input 
                        type="number"
                        className="w-20 pl-3 pr-0 py-1 bg-transparent border-none text-xs font-mono font-bold text-zinc-100 outline-none focus:bg-zinc-800/50 transition-all text-right rounded-md placeholder-zinc-700"
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && hasChanged && handleSave()}
                        placeholder="0.00"
                    />
                </div>
            </div>
            
            {hasChanged && (
                <button 
                    onClick={handleSave}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20"
                >
                    Guardar
                </button>
            )}
        </div>
    );
};

interface GroupedTransaction {
    id: string; 
    isBatch: boolean;
    records: TuitionRecord[];
    mainRecord: TuitionRecord; 
    totalOriginalAmount: number; 
    totalRemainingDebt: number;  
    declaredAmount?: number;     
    itemCount: number;
}

const Finance: React.FC = () => {
  const { 
      records, 
      approvePayment, 
      rejectPayment, 
      generateMonthlyBilling, 
      academySettings, 
      currentUser,
      approveBatchPayment,
      rejectBatchPayment,
      updateRecordAmount,
      deleteRecord
  } = useStore();
  
  const { addToast } = useToast();
  const { confirm } = useConfirmation();
  
  const [activeTab, setActiveTab] = useState<'review' | 'pending' | 'overdue' | 'paid' | 'all'>('review');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedGroup, setSelectedGroup] = useState<GroupedTransaction | null>(null);
  const [viewDetailRecord, setViewDetailRecord] = useState<TuitionRecord | null>(null);
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);

  // --- ALL MOVEMENTS MODAL STATES ---
  const [showAllMovementsModal, setShowAllMovementsModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalMonthFilter, setModalMonthFilter] = useState('');

  const modalMovements = useMemo(() => {
        let filtered = records;
        
        if (modalSearch) {
            const q = modalSearch.toLowerCase();
            filtered = filtered.filter(r => 
                (r.studentName || '').toLowerCase().includes(q) || 
                (r.concept || '').toLowerCase().includes(q) || 
                r.amount.toString().includes(q) ||
                (r.description || '').toLowerCase().includes(q)
            );
        }

        if (modalMonthFilter) {
            filtered = filtered.filter(r => (r.paymentDate || r.dueDate).startsWith(modalMonthFilter));
        }

        return filtered.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
  }, [records, modalSearch, modalMonthFilter]);

  const uniqueModalMonths = useMemo(() => {
        const set = new Set<string>();
        records.forEach(r => set.add((r.paymentDate || r.dueDate).substring(0, 7))); // "YYYY-MM"
        return Array.from(set).sort().reverse();
  }, [records]);

  // -- DATA PROCESSING --
  const rawFilteredRecords = useMemo(() => {
      let filtered = records;
      if (activeTab === 'review') filtered = filtered.filter(r => r.status === 'in_review');
      else if (activeTab === 'pending') filtered = filtered.filter(r => r.status === 'pending' || r.status === 'charged' || r.status === 'partial');
      else if (activeTab === 'overdue') filtered = filtered.filter(r => r.status === 'overdue');
      else if (activeTab === 'paid') filtered = filtered.filter(r => r.status === 'paid');

      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(r => r.studentName?.toLowerCase().includes(q) || r.concept.toLowerCase().includes(q) || r.amount.toString().includes(q));
      }
      return filtered;
  }, [records, activeTab, searchQuery]);

  const groupedTransactions: GroupedTransaction[] = useMemo(() => {
      const groups: Record<string, TuitionRecord[]> = {};
      const result: GroupedTransaction[] = [];
      const processedIds = new Set<string>();

      rawFilteredRecords.forEach(r => {
          if (r.batchPaymentId && activeTab === 'review') { 
              if (!groups[r.batchPaymentId]) groups[r.batchPaymentId] = [];
              groups[r.batchPaymentId].push(r);
          }
      });

      rawFilteredRecords.forEach(r => {
          if (processedIds.has(r.id)) return;
          if (r.batchPaymentId && groups[r.batchPaymentId] && activeTab === 'review') {
              const batchItems = groups[r.batchPaymentId];
              batchItems.forEach(i => processedIds.add(i.id));
              const declared = batchItems.find(i => i.declaredAmount !== undefined)?.declaredAmount;
              
              // RECONSTRUCTION LOGIC FOR BATCH
              const totalRemaining = batchItems.reduce((acc, item) => acc + item.amount + (item.penaltyAmount || 0), 0);
              const totalPaidHistory = batchItems.reduce((acc, item) => acc + (item.paymentHistory || []).reduce((h, p) => h + p.amount, 0), 0);
              
              result.push({
                  id: r.batchPaymentId,
                  isBatch: true,
                  records: batchItems,
                  mainRecord: r,
                  // Total Value = What is left + What was paid. This is infallible.
                  totalOriginalAmount: totalRemaining + totalPaidHistory,
                  totalRemainingDebt: totalRemaining,
                  declaredAmount: declared,
                  itemCount: batchItems.length
              });
          } else {
              processedIds.add(r.id);
              
              // RECONSTRUCTION LOGIC FOR SINGLE RECORD
              const totalRemaining = r.amount + (r.penaltyAmount || 0);
              const totalPaidHistory = (r.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);

              result.push({
                  id: r.id,
                  isBatch: false,
                  records: [r],
                  mainRecord: r,
                  // Total Value = What is left + What was paid.
                  totalOriginalAmount: totalRemaining + totalPaidHistory,
                  totalRemainingDebt: totalRemaining,
                  declaredAmount: r.declaredAmount,
                  itemCount: 1
              });
          }
      });
      return result.sort((a, b) => new Date(b.mainRecord.dueDate).getTime() - new Date(a.mainRecord.dueDate).getTime());
  }, [rawFilteredRecords, activeTab]);

  const activeGroup = useMemo(() => {
      if (!selectedGroup) return null;
      const freshRecords = records.filter(r => selectedGroup.records.some(old => old.id === r.id));
      if (freshRecords.length === 0) return null;
      const mainRecord = freshRecords.find(r => r.id === selectedGroup.mainRecord.id) || freshRecords[0];
      
      // RECONSTRUCTION LOGIC FOR MODAL
      const totalRemaining = freshRecords.reduce((acc, item) => acc + item.amount + (item.penaltyAmount || 0), 0);
      const totalPaidHistory = freshRecords.reduce((acc, item) => acc + (item.paymentHistory || []).reduce((h, p) => h + p.amount, 0), 0);

      return {
          ...selectedGroup,
          records: freshRecords,
          mainRecord,
          totalOriginalAmount: totalRemaining + totalPaidHistory,
          totalRemainingDebt: totalRemaining,
          declaredAmount: freshRecords.find(i => i.declaredAmount !== undefined)?.declaredAmount
      };
  }, [selectedGroup, records]);

  const stats = useMemo(() => {
      return {
          review: records.filter(r => r.status === 'in_review').length,
          overdue: records.filter(r => r.status === 'overdue').length,
          pending: records.filter(r => r.status === 'pending' || r.status === 'charged' || r.status === 'partial').length,
      };
  }, [records]);

  // Derived values for review modal
  const amountToApprove = useMemo(() => {
      if (!activeGroup) return 0;
      return activeGroup.declaredAmount !== undefined ? activeGroup.declaredAmount : activeGroup.totalRemainingDebt;
  }, [activeGroup]);

  const previewDistribution = useMemo(() => {
      if (!activeGroup) return [];
      
      let available = amountToApprove;
      
      // --- REGLA DE NEGOCIO: ORDENAMIENTO POR PRIORIDAD EN LA UI ---
      const sortedRecords = [...activeGroup.records].sort((a, b) => {
          const getPriority = (r: TuitionRecord) => {
              const text = (r.concept + (r.category || '')).toLowerCase();
              // Prioridad 0: Mensualidades
              if (text.includes('mensualidad') || text.includes('colegiatura') || r.category === 'Mensualidad') return 0;
              // Prioridad 1: No permiten pagos parciales
              if (r.canBePaidInParts === false) return 1;
              // Prioridad 2: Abonables
              return 2;
          };
          const pA = getPriority(a);
          const pB = getPriority(b);
          if (pA !== pB) return pA - pB;
          // FIFO por fecha a igualdad de peso
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      return sortedRecords.map(r => {
          const text = (r.concept + (r.category || '')).toLowerCase();
          const isMandatory = text.includes('mensualidad') || text.includes('colegiatura') || r.category === 'Mensualidad' || r.canBePaidInParts === false;
          
          const currentPenalty = r.penaltyAmount || 0;
          const totalDebt = r.amount + currentPenalty;
          let paid = 0;
          
          if (isMandatory) {
              // Lógica de "Todo o nada" visual para prioridades altas
              if (available >= totalDebt - 0.01) {
                  paid = totalDebt;
                  available -= totalDebt;
              }
          } else {
              // Lógica de abono para prioridades bajas
              if (available > 0) {
                  paid = Math.min(available, totalDebt);
                  available -= paid;
              }
          }

          const remaining = Math.max(0, totalDebt - paid);
          const isPaidFull = remaining < 0.01;
          
          return {
              ...r,
              _paid: paid,
              _status: isPaidFull ? 'paid' : (paid > 0 ? 'partial' : 'pending')
          };
      });
  }, [activeGroup, amountToApprove]);

  const handleApprove = () => {
      if (!activeGroup) return;
      const targetAmount = amountToApprove > 0 ? amountToApprove : activeGroup.totalRemainingDebt;
      
      if (activeGroup.isBatch) {
          approveBatchPayment(activeGroup.id, targetAmount);
      } else {
          approvePayment(activeGroup.id, targetAmount);
      }
      setSelectedGroup(null);
  };

  const handleReject = () => {
      if (!activeGroup) return;
      confirm({
          title: activeGroup.isBatch ? 'Rechazar Lote' : 'Rechazar Pago',
          message: 'El estatus volverá a Pendiente.',
          type: 'danger',
          confirmText: 'Rechazar',
          onConfirm: () => {
              if (activeGroup.isBatch) rejectBatchPayment(activeGroup.id);
              else rejectPayment(activeGroup.id);
              setSelectedGroup(null);
          }
      });
  };

  const handleDeleteRecord = (record: TuitionRecord) => {
      setViewDetailRecord(null);
      confirm({
          title: 'Eliminar Movimiento',
          message: 'Esta acción no se puede deshacer.',
          type: 'danger',
          confirmText: 'Eliminar',
          onConfirm: () => deleteRecord(record.id)
      });
  };

  const handleGenerateBilling = () => {
      confirm({
          title: 'Generar Mensualidades',
          message: `¿Generar el cargo de mensualidad para todos los alumnos activos?`,
          type: 'info',
          confirmText: 'Generar',
          onConfirm: () => generateMonthlyBilling()
      });
  };

  const handleExport = () => {
      const data = groupedTransactions.map(g => ({
          Fecha: g.mainRecord.dueDate,
          Alumno: g.mainRecord.studentName,
          Concepto: g.isBatch ? `Lote (${g.itemCount})` : g.mainRecord.concept,
          Monto: g.totalOriginalAmount,
          Estado: g.mainRecord.status,
          Metodo: g.mainRecord.method || '-'
      }));
      exportToCSV(data, `Finanzas_${activeTab}`);
      addToast('Reporte generado', 'success');
  };

  return (
    <div className="flex flex-col min-h-screen bg-transparent animate-in fade-in duration-700 ease-out relative z-10">
        {/* --- HEADER --- */}
        <div className="px-6 py-8 md:px-10 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
                <div>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{color: 'var(--color-brand)'}}>IKC Management</p>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter" style={{color: 'var(--color-text-primary)'}}>Tesorería</h1>
                    <p className="mt-1 text-xs sm:text-sm" style={{color: 'var(--color-text-muted)'}}>Control de flujos, conciliación y auditoría de pagos.</p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                    <button onClick={handleExport} className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold rounded-xl hover:bg-zinc-800 hover:text-zinc-200 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">download</span> Exportar
                    </button>
                    <button onClick={handleGenerateBilling} className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold rounded-xl hover:bg-zinc-800 hover:text-zinc-200 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">payments</span> Facturar Mes
                    </button>
                    <button onClick={() => setIsChargeModalOpen(true)} className="px-5 py-2 bg-red-600 text-white font-black rounded-xl hover:bg-red-500 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 active:scale-95 shadow-lg shadow-red-600/10">
                        <span className="material-symbols-outlined text-base">add_circle</span> Nuevo Cargo
                    </button>
                </div>
            </div>

            {/* KPI Cards — Matching Dashboard Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-10"
                style={{
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--color-border-subtle)'
                }}>
                
                {/* Review */}
                <div onClick={() => setActiveTab('review')} className={`flex flex-col justify-between p-6 cursor-pointer transition-all ${activeTab === 'review' ? 'bg-zinc-900/50' : 'bg-[#0a0a0d] hover:bg-zinc-900/30'}`}>
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-3" style={{color: 'var(--color-text-muted)'}}>Por Revisar</p>
                        <p className="text-3xl font-black tracking-tighter" style={{color: activeTab === 'review' ? 'var(--color-brand)' : 'var(--color-text-primary)'}}>{stats.review}</p>
                    </div>
                    <div className="flex items-center justify-between mt-5 pt-4" style={{borderTop: '1px solid var(--color-border-subtle)'}}>
                        <span className="text-[10px] font-medium" style={{color: 'var(--color-text-muted)'}}>Validaciones pendientes</span>
                        <span className="material-symbols-outlined" style={{fontSize: '16px', color: stats.review > 0 ? 'var(--color-brand)' : 'var(--color-text-muted)'}}>{stats.review > 0 ? 'mark_email_unread' : 'check_circle'}</span>
                    </div>
                </div>

                {/* Pending */}
                <div onClick={() => setActiveTab('pending')} className={`flex flex-col justify-between p-6 cursor-pointer transition-all ${activeTab === 'pending' ? 'bg-zinc-900/50' : 'bg-[#0a0a0d] hover:bg-zinc-900/30'}`}>
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-3" style={{color: 'var(--color-text-muted)'}}>Pendientes / Parciales</p>
                        <p className="text-3xl font-black tracking-tighter" style={{color: activeTab === 'pending' ? 'var(--color-brand)' : 'var(--color-text-primary)'}}>{stats.pending}</p>
                    </div>
                    <div className="flex items-center justify-between mt-5 pt-4" style={{borderTop: '1px solid var(--color-border-subtle)'}}>
                        <span className="text-[10px] font-medium" style={{color: 'var(--color-text-muted)'}}>Cuentas abiertas</span>
                        <span className="material-symbols-outlined" style={{fontSize: '16px', color: 'var(--color-text-muted)'}}>pending_actions</span>
                    </div>
                </div>

                {/* Overdue */}
                <div onClick={() => setActiveTab('overdue')} className={`flex flex-col justify-between p-6 cursor-pointer transition-all ${activeTab === 'overdue' ? 'bg-zinc-900/50' : 'bg-[#0a0a0d] hover:bg-zinc-900/30'}`}>
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-3" style={{color: 'var(--color-text-muted)'}}>Vencidos</p>
                        <p className="text-3xl font-black tracking-tighter" style={{color: activeTab === 'overdue' ? 'var(--color-brand)' : 'var(--color-text-primary)'}}>{stats.overdue}</p>
                    </div>
                    <div className="flex items-center justify-between mt-5 pt-4" style={{borderTop: '1px solid var(--color-border-subtle)'}}>
                        <span className="text-[10px] font-medium" style={{color: 'var(--color-text-muted)'}}>Tickets en mora</span>
                        <span className="material-symbols-outlined" style={{fontSize: '16px', color: stats.overdue > 0 ? 'var(--color-brand)' : 'var(--color-text-muted)'}}>warning</span>
                    </div>
                </div>

                {/* All History */}
                <div onClick={() => setShowAllMovementsModal(true)} className="flex flex-col justify-between p-6 cursor-pointer bg-[#0a0a0d] hover:bg-zinc-900/50 transition-all">
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-3" style={{color: 'var(--color-text-muted)'}}>Historial Completo</p>
                        <p className="text-3xl font-black tracking-tighter" style={{color: 'var(--color-text-primary)'}}>{records.length}</p>
                    </div>
                    <div className="flex items-center justify-between mt-5 pt-4" style={{borderTop: '1px solid var(--color-border-subtle)'}}>
                        <span className="text-[10px] font-medium" style={{color: 'var(--color-text-muted)'}}>Ver todos los registros</span>
                        <span className="material-symbols-outlined" style={{fontSize: '16px', color: 'var(--color-text-muted)'}}>history</span>
                    </div>
                </div>
            </div>

            {/* Filter & Search Area */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-6">
                <div className="flex items-center gap-0 border-b-2" style={{borderColor: 'var(--color-border-subtle)'}}>
                    <button onClick={() => setActiveTab('paid')} className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'paid' ? 'text-white' : 'text-zinc-500'}`}>
                        Pagados
                        {activeTab === 'paid' && <div className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-red-600 animate-in fade-in duration-300"></div>}
                    </button>
                    <button onClick={() => setActiveTab('all')} className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'all' ? 'text-white' : 'text-zinc-500'}`}>
                        Todos
                        {activeTab === 'all' && <div className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-red-600 animate-in fade-in duration-300"></div>}
                    </button>
                </div>

                <div className="relative group w-full md:w-80">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-700 material-symbols-outlined text-[20px] group-focus-within:text-red-500 transition-colors pointer-events-none">search</span>
                    <style>
                        {`
                            input.search-finance-override {
                                padding-left: 58px !important;
                            }
                        `}
                    </style>
                    <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        placeholder="Buscar alumno o concepto..." 
                        className="w-full pr-5 py-3 !bg-[#0a0a0d] !border-zinc-800 rounded-2xl text-xs font-semibold text-white focus:!border-red-600/50 transition-all placeholder:text-zinc-800 outline-none search-finance-override" 
                    />
                </div>
            </div>
        </div>

        {/* --- LIST CONTENT (Structured Minimalism) --- */}
        <div className="px-6 md:px-10 pb-10">
            <div className="max-w-[1600px] mx-auto bg-[#0a0a0d] rounded-3xl overflow-hidden min-h-[500px]" style={{border: '1px solid var(--color-border-subtle)'}}>
                {groupedTransactions.length === 0 ? (
                    <EmptyState 
                        title="Sin movimientos financieros" 
                        description={activeTab === 'review' ? "Todas las transacciones han sido conciliadas." : "No se encontraron registros bajo este criterio."}
                        icon="account_balance"
                    />
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10" style={{backgroundColor: 'var(--color-bg-raised)', borderBottom: '1px solid var(--color-border-subtle)'}}>
                            <tr>
                                <th className="px-8 py-5 text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Fecha</th>
                                <th className="px-6 py-5 text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Alumno</th>
                                <th className="px-6 py-5 text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Concepto</th>
                                <th className="px-6 py-5 text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Estado</th>
                                <th className="px-6 py-5 text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] text-right">Importe</th>
                                <th className="px-8 py-5 text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em] text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/30">
                            {groupedTransactions.map(group => {
                                const { mainRecord, isBatch, totalOriginalAmount, totalRemainingDebt, declaredAmount } = group;
                                const isPaid = mainRecord.status === 'paid';
                                const isPartial = mainRecord.status === 'partial' || (declaredAmount !== undefined && declaredAmount < totalOriginalAmount);
                                const paidSoFar = totalOriginalAmount - totalRemainingDebt;
                                const isMensualidad = mainRecord.category === 'Mensualidad' || mainRecord.concept.toLowerCase().includes('mensualidad');
                                const breakdownTooltip = `Total: $${totalOriginalAmount} \nPagado: $${paidSoFar} \nRestante: $${totalRemainingDebt}`;

                                return (
                                        <tr 
                                            key={group.id} 
                                            className="transition-colors group cursor-pointer border-b last:border-0"
                                            style={{borderColor: 'var(--color-border-subtle)'}}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-hover)'}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
                                            onClick={() => setViewDetailRecord(group.mainRecord)}
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-[13px] tabular-nums" style={{color: 'var(--color-text-primary)'}}>{formatDateDisplay(mainRecord.dueDate)}</span>
                                                    {mainRecord.paymentDate && (
                                                        <span className="text-[10px] font-bold mt-1 uppercase tracking-wider" style={{color: 'var(--color-brand)'}}>
                                                            Pagado: {formatDateDisplay(mainRecord.paymentDate)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 font-bold text-[13px]" style={{color: 'var(--color-text-primary)'}}>
                                                {mainRecord.studentName}
                                            </td>
                                            <td className="px-6 py-6 text-[13px] font-medium" style={{color: 'var(--color-text-secondary)'}}>
                                                {isBatch ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{color: 'var(--color-text-primary)'}}>
                                                            <span className="material-symbols-outlined text-[14px]">layers</span>
                                                            Lote ({group.itemCount})
                                                        </span>
                                                        <span className="text-[11px] truncate max-w-[200px]" style={{color: 'var(--color-text-muted)'}}>
                                                            {group.records.map(r => r.concept).join(', ')}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span>{mainRecord.concept}</span>
                                                )}
                                                {mainRecord.method && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-black" style={{backgroundColor: 'var(--color-bg-raised)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-strong)'}}>{mainRecord.method}</span>}
                                            </td>
                                            <td className="px-6 py-6">
                                                <StatusBadge status={mainRecord.status} amount={mainRecord.amount} penalty={mainRecord.penaltyAmount} />
                                            </td>
                                            
                                            <td className="px-6 py-6 text-right" title={breakdownTooltip}>
                                                {mainRecord.status === 'in_review' && !isBatch && isMensualidad ? (
                                                    <div className="flex justify-end">
                                                        <DebtAmountEditor 
                                                            item={mainRecord} 
                                                            onUpdate={(id, val) => updateRecordAmount(id, val)} 
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-sm tabular-nums tracking-tight" style={{color: isPaid ? 'var(--color-success)' : 'var(--color-text-primary)'}}>
                                                            ${totalOriginalAmount.toFixed(2)}
                                                        </span>
                                                        {isPartial && !isPaid && (
                                                            <div className="mt-2 flex flex-col items-end gap-1.5">
                                                                <div className="h-1 w-16 bg-zinc-900 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full rounded-full shadow-sm" 
                                                                        style={{ backgroundColor: 'var(--color-success)', width: `${(paidSoFar / totalOriginalAmount) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-[9px] font-black tabular-nums uppercase tracking-tighter" style={{color: 'var(--color-success)'}}>
                                                                    Abonado: ${paidSoFar.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            
                                            <td className="px-8 py-6 text-right">
                                                {mainRecord.status === 'in_review' ? (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setSelectedGroup(group); }}
                                                        className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[9px] font-bold px-4 py-2 rounded-lg transition-all active:scale-95 flex items-center gap-2 ml-auto uppercase tracking-wider hover:bg-zinc-800 hover:text-white"
                                                    >
                                                        <span className="material-symbols-outlined text-xs">visibility</span>
                                                        Validar
                                                    </button>
                                                ) : (mainRecord.status === 'paid' || mainRecord.status === 'partial') ? (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (group.isBatch) {
                                                                group.records.forEach(r => generateReceipt(r, academySettings, currentUser));
                                                            } else {
                                                                generateReceipt(mainRecord, academySettings, currentUser);
                                                            }
                                                        }}
                                                        className="size-8 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg flex items-center justify-center ml-auto transition-all"
                                                    >
                                                        <span className="material-symbols-outlined text-base">
                                                            {group.isBatch ? 'folder_open' : 'receipt_long'}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <span className="text-zinc-800 text-xs">-</span>
                                                )}
                                            </td>
                                        </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            
            {/* Spacer */}
            <div className="h-10" />
        </div>

        {/* --- REVIEW MODAL --- */}
        {activeGroup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                <div className="bg-[#0f0f0f] rounded-3xl w-full max-w-5xl h-[85vh] border border-zinc-800 flex overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
                    {/* Left: Proof */}
                    <div className="w-1/2 bg-[#050505] flex items-center justify-center relative p-10">
                        {activeGroup.mainRecord.proofUrl ? (
                            activeGroup.mainRecord.proofType?.includes('pdf') ? (
                                <iframe src={activeGroup.mainRecord.proofUrl} className="w-full h-full rounded-2xl border" style={{borderColor: 'var(--color-border-subtle)'}} />
                            ) : (
                                <img src={activeGroup.mainRecord.proofUrl} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/5" />
                            )
                        ) : (
                            <div className="flex flex-col items-center" style={{color: 'var(--color-text-muted)'}}>
                                <span className="material-symbols-outlined text-7xl mb-6 opacity-20">broken_image</span>
                                <p className="font-bold text-[10px] uppercase tracking-[0.3em] opacity-30">Sin comprobante digital</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Details & Action */}
                    <div className="w-1/2 flex flex-col bg-[#0a0a0d] border-l" style={{borderColor: 'var(--color-border-subtle)'}}>
                        <div className="p-8 border-b flex justify-between items-start" style={{borderColor: 'var(--color-border-subtle)'}}>
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1" style={{color: 'var(--color-brand)'}}>Conciliación</p>
                                <h2 className="text-xl font-black text-white tracking-tight">Vincular Pago</h2>
                                <p className="text-zinc-500 text-xs mt-1">Verifica el depósito y distribuye el saldo.</p>
                            </div>
                            <button onClick={() => setSelectedGroup(null)} className="p-2 hover:bg-zinc-800/50 rounded-full text-zinc-500 hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
                            <div className="p-7 rounded-2xl border" style={{backgroundColor: 'var(--color-bg-raised)', borderColor: 'var(--color-border-subtle)'}}>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{color: 'var(--color-text-muted)'}}>Importe Declarado</p>
                                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest" style={{backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-strong)'}}>
                                        {activeGroup.mainRecord.method}
                                    </span>
                                </div>
                                <p className="text-4xl font-black tracking-tighter" style={{color: 'var(--color-text-primary)'}}>
                                    ${amountToApprove.toFixed(2)}
                                </p>
                            </div>

                            <div>
                                <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-5" style={{color: 'var(--color-text-muted)'}}>Distribución Automática</h4>
                                <div className="space-y-4">
                                    {previewDistribution.map((item: any) => {
                                        const isMensualidadModal = item.category === 'Mensualidad' || item.concept.toLowerCase().includes('mensualidad');
                                        return (
                                            <div key={item.id} className="flex flex-col p-5 rounded-2xl relative overflow-hidden group transition-all" style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}>
                                                <div className="absolute left-0 top-0 bottom-0 w-1" style={{backgroundColor: item._status === 'paid' ? 'var(--color-success)' : item._status === 'partial' ? 'var(--color-warning)' : 'rgba(255,255,255,0.05)'}}></div>
                                                
                                                <div className="flex justify-between items-start pl-4">
                                                    <div className="flex-1 pr-4">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-bold text-white block">{item.concept}</span>
                                                            {isMensualidadModal && <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter" style={{backgroundColor: 'var(--color-brand-glow-strong)', color: 'var(--color-brand)', border: '1px solid var(--color-brand-glow-strong)'}}>Prioridad Alta</span>}
                                                        </div>
                                                        <div className="mt-2">
                                                            {isMensualidadModal ? (
                                                                <DebtAmountEditor 
                                                                    item={item} 
                                                                    onUpdate={(id, val) => updateRecordAmount(id, val)}
                                                                />
                                                            ) : (
                                                                <span className="text-[11px] font-bold" style={{color: 'var(--color-text-muted)'}}>Total Deuda: ${item.amount + (item.penaltyAmount || 0)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-black text-xl tabular-nums block" style={{color: item._status === 'paid' ? 'var(--color-success)' : item._paid > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)'}}>
                                                            ${item._paid.toFixed(2)}
                                                        </span>
                                                        <div className="text-[9px] font-black uppercase mt-1 tracking-[0.15em]" style={{color: item._status === 'paid' ? 'var(--color-success)' : item._paid > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)'}}>
                                                            {item._status === 'paid' ? 'Cubierto' : item._status === 'partial' ? 'Abono' : 'Sin Saldo'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t flex gap-4" style={{backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)'}}>
                            <button onClick={handleReject} className="px-6 py-4 rounded-xl text-zinc-500 font-bold hover:text-zinc-200 hover:bg-zinc-800 transition-all text-[10px] uppercase tracking-widest">
                                Rechazar
                            </button>
                            <button onClick={handleApprove} className="flex-1 py-4 rounded-xl bg-white text-black font-black hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-xs uppercase tracking-widest shadow-xl">
                                <span className="material-symbols-outlined text-xl">verified</span>
                                Aprobar Movimiento
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- MODAL PANTALLA COMPLETA: TODOS LOS MOVIMIENTOS --- */}
        {showAllMovementsModal && (
            <div className="fixed inset-0 z-[60] bg-[#050505] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300">
                <div className="bg-[#0a0a0d] border-b px-6 py-6 md:px-10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shrink-0" style={{borderColor: 'var(--color-border-subtle)'}}>
                    <div className="flex items-center gap-6">
                        <button onClick={() => setShowAllMovementsModal(false)} className="size-10 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all hover:scale-110 active:scale-90">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1" style={{color: 'var(--color-brand)'}}>IKC Management</p>
                            <h1 className="text-2xl font-black text-white tracking-tighter leading-none">Todos los Movimientos</h1>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 material-symbols-outlined text-[18px] group-focus-within:text-red-500 transition-colors pointer-events-none">search</span>
                            {/* Technical Override: Ensuring icon doesn't overlap text */}
                            <style>
                                {`
                                    input.search-modal-finance-override {
                                        padding-left: 54px !important;
                                    }
                                `}
                            </style>
                            <input
                                type="text"
                                placeholder="Buscar alumno o concepto..."
                                value={modalSearch}
                                onChange={(e) => setModalSearch(e.target.value)}
                                className="w-full md:w-80 pr-4 py-3 bg-[#050505] !border-zinc-800 rounded-2xl text-sm text-white outline-none focus:!border-red-600/50 transition-all font-semibold placeholder:font-normal placeholder:text-zinc-800 search-modal-finance-override"
                            />
                            {modalSearch && (
                                <button onClick={() => setModalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-white">
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            )}
                        </div>
                        <select
                            value={modalMonthFilter}
                            onChange={(e) => setModalMonthFilter(e.target.value)}
                            className="w-full md:w-56 px-5 py-3 bg-[#050505] !border-zinc-800 rounded-2xl text-[11px] font-black text-zinc-400 outline-none focus:!border-red-600 transition-all cursor-pointer appearance-none uppercase tracking-widest"
                        >
                            <option value="">Todos los Meses</option>
                            {uniqueModalMonths.map(m => {
                                const [y, mm] = m.split('-');
                                const dateObj = new Date(parseInt(y), parseInt(mm) - 1, 1);
                                return (
                                    <option key={m} value={m}>
                                        {formatDateDisplay(dateObj.toISOString(), { month: 'long', year: 'numeric' })}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 md:p-10 max-w-[1500px] w-full mx-auto flex flex-col gap-8 no-scrollbar scroll-smooth">
                    <div className="bg-[#0a0a0d] rounded-[32px] overflow-hidden flex-1 flex flex-col min-h-[400px] shadow-2xl" style={{border: '1px solid var(--color-border-subtle)'}}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#0c0c0e] text-[9px] font-bold text-zinc-500 uppercase tracking-widest sticky top-0 z-10 border-b border-zinc-800/50">
                                    <tr>
                                        <th className="px-6 py-3.5 w-32">Fecha</th>
                                        <th className="px-6 py-3.5">Concepto & Alumno</th>
                                        <th className="px-6 py-3.5 w-32 text-center">Estado</th>
                                        <th className="px-6 py-3.5 w-32 text-right">Total</th>
                                        <th className="px-6 py-3.5 w-16 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/30">
                                    {modalMovements.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center text-zinc-600 font-bold">
                                                <div className="mx-auto size-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                                                    <span className="material-symbols-outlined text-zinc-700 text-2xl">search_off</span>
                                                </div>
                                                Sin movimientos encontrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        modalMovements.map(rec => {
                                            const totalDebt = rec.amount + (rec.penaltyAmount || 0);
                                            const historyPaid = (rec.paymentHistory || []).reduce((acc, h) => acc + h.amount, 0);
                                            const totalOriginal = totalDebt + historyPaid;

                                            return (
                                                <tr key={rec.id} onClick={() => setViewDetailRecord(rec)} className="hover:bg-zinc-800/20 transition-colors cursor-pointer group">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <p className="font-bold text-zinc-100 text-sm">
                                                            {formatDateDisplay(rec.paymentDate || rec.dueDate, { day: '2-digit', month: 'short', year: '2-digit' })}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-zinc-100 leading-tight">{rec.concept}</p>
                                                        <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1 capitalize">
                                                            <span className="material-symbols-outlined text-[14px]">person</span> {rec.studentName}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <StatusBadge status={rec.status} amount={rec.amount} penalty={rec.penaltyAmount} />
                                                    </td>
                                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                                        <span className="font-bold text-zinc-200 text-[13px] tabular-nums tracking-tight">
                                                            ${totalOriginal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center mx-auto justify-center size-8 bg-zinc-800/50 text-zinc-500 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-all border border-zinc-700/50">
                                                            <span className="material-symbols-outlined text-sm">open_in_new</span>
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
        )}

        <CreateChargeModal isOpen={isChargeModalOpen} onClose={() => setIsChargeModalOpen(false)} />

        <TransactionDetailModal
            isOpen={!!viewDetailRecord}
            onClose={() => setViewDetailRecord(null)}
            record={viewDetailRecord}
            role="master"
            paymentHistory={viewDetailRecord?.paymentHistory || []}
            onApprove={(r) => { approvePayment(r.id); setViewDetailRecord(null); }}
            onReject={(r) => { rejectPayment(r.id); setViewDetailRecord(null); }}
            onDownloadReceipt={(r) => generateReceipt(r, academySettings, currentUser)}
            onReview={(r) => {
                const isBatch = !!r.batchPaymentId;
                let groupRecords = [r];
                if (isBatch) {
                     groupRecords = records.filter(item => item.batchPaymentId === r.batchPaymentId);
                }
                
                const totalRemaining = groupRecords.reduce((acc, item) => acc + item.amount + (item.penaltyAmount || 0), 0);
                const totalPaidHistory = groupRecords.reduce((acc, item) => acc + (item.paymentHistory || []).reduce((h, p) => h + p.amount, 0), 0);

                const group: GroupedTransaction = {
                    id: isBatch ? r.batchPaymentId! : r.id,
                    isBatch: isBatch,
                    records: groupRecords,
                    mainRecord: r,
                    totalOriginalAmount: totalRemaining + totalPaidHistory,
                    totalRemainingDebt: totalRemaining,
                    declaredAmount: groupRecords.find(i => i.declaredAmount !== undefined)?.declaredAmount,
                    itemCount: groupRecords.length
                };
                setViewDetailRecord(null);
                setSelectedGroup(group);
            }}
            onDelete={() => {
                if (viewDetailRecord) handleDeleteRecord(viewDetailRecord);
            }}
        />
    </div>
  );
};

export default Finance;
