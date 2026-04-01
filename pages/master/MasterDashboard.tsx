
import React, { useMemo, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../components/ui/Avatar';
import { formatDateDisplay } from '../../utils/dateUtils';

const MasterDashboard: React.FC = () => {
    // 1. Arquitectura de Datos (Local)
    const { students, monthlyRevenueData, rollingRevenueData, stats, records } = useStore();
    const navigate = useNavigate();
    
    // Selector de Tiempo
    const [timeRange, setTimeRange] = useState<'month' | 'year'>('month');

    // --- INGRESOS (FULLSCREEN MODAL) ---
    const [showAllIncomes, setShowAllIncomes] = useState(false);
    const [incomeSearch, setIncomeSearch] = useState('');
    const [incomeMonthFilter, setIncomeMonthFilter] = useState('');
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

    const allIncomes = useMemo(() => {
        const arr: any[] = [];
        records.forEach(r => {
            if (r.paymentHistory && r.paymentHistory.length > 0) {
                r.paymentHistory.forEach((h, i) => {
                    arr.push({
                        id: `${r.id}-hist-${i}`,
                        date: h.date,
                        studentName: r.studentName || 'Estudiante',
                        concept: r.concept,
                        amount: h.amount,
                        method: h.method || 'Sistema',
                        description: r.description || ''
                    });
                });
            } else if (r.status === 'paid') {
                const amount = (r.originalAmount !== undefined ? r.originalAmount : (r.amount || 0)) + (r.customPenaltyAmount || 0);
                arr.push({
                    id: r.id,
                    date: r.paymentDate || r.dueDate,
                    studentName: r.studentName || 'Estudiante',
                    concept: r.concept,
                    amount: amount,
                    method: r.method || 'Sistema',
                    description: r.description || ''
                });
            } else if (r.status === 'partial') {
                const paid = (r.originalAmount !== undefined ? r.originalAmount : (r.amount || 0)) - (r.amount || 0);
                if (paid > 0) {
                    arr.push({
                        id: r.id,
                        date: r.paymentDate || r.dueDate,
                        studentName: r.studentName || 'Estudiante',
                        concept: r.concept + ' (Pago Parcial)',
                        amount: paid,
                        method: r.method || 'Sistema',
                        description: r.description || ''
                    });
                }
            }
        });
        return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [records]);

    const filteredIncomes = useMemo(() => {
        return allIncomes.filter(inc => {
            const searchLower = incomeSearch.toLowerCase();
            const matchesSearch = inc.concept.toLowerCase().includes(searchLower) ||
                inc.studentName.toLowerCase().includes(searchLower) ||
                inc.description.toLowerCase().includes(searchLower);
            
            const matchesMonth = incomeMonthFilter 
                ? inc.date.startsWith(incomeMonthFilter)
                : true;

            return matchesSearch && matchesMonth;
        });
    }, [allIncomes, incomeSearch, incomeMonthFilter]);

    const uniqueMonths = useMemo(() => {
        const set = new Set<string>();
        allIncomes.forEach(i => set.add(i.date.substring(0, 7))); // "YYYY-MM"
        return Array.from(set).sort().reverse();
    }, [allIncomes]);

    const [sumFilteredIncomes, cntFilteredIncomes] = useMemo(() => {
        const sum = filteredIncomes.reduce((acc, curr) => acc + curr.amount, 0);
        return [sum, filteredIncomes.length];
    }, [filteredIncomes]);

    // --- LÓGICA DE NEGOCIO ---

    // 2. Lógica "Ingresos" (KPI Dinámico)
    const displayRevenue = useMemo(() => {
        if (timeRange === 'year') return stats.totalRevenue;
        // Si es mes, tomamos el último valor disponible en los datos rodantes (asumiendo mes actual)
        if (rollingRevenueData.length > 0) {
            return rollingRevenueData[rollingRevenueData.length - 1].total;
        }
        return 0;
    }, [timeRange, stats, rollingRevenueData]);

    // 3. Lógica "Alumnos Nuevos" (KPI Dinámico)
    const newStudentsCount = useMemo(() => {
        const now = new Date();
        const startOfPeriod = timeRange === 'month'
            ? new Date(now.getFullYear(), now.getMonth(), 1)
            : new Date(now.getFullYear(), 0, 1);
        
        // Normalizar inicio del periodo a las 00:00:00 para comparación estricta
        startOfPeriod.setHours(0, 0, 0, 0);

        return students.filter(s => {
            if (!s.joinDate) return false;

            let joinDate = new Date(s.joinDate);

            // Corrección Robustez: Si el formato es DD/MM/YYYY (común en español) y falla el parser estándar
            // o da una fecha incorrecta (ej: interpreta 02/05 como Feb 5 en lugar de May 2), forzamos parse manual si hay barras.
            if ((isNaN(joinDate.getTime()) || s.joinDate.includes('/'))) {
                const parts = s.joinDate.split('/');
                if (parts.length === 3) {
                    // Intentamos asumir DD/MM/YYYY si el parsing directo falló o es ambiguo
                    const d = parseInt(parts[0]);
                    const m = parseInt(parts[1]) - 1; // Mes es base 0
                    const y = parseInt(parts[2]);
                    
                    const fixedDate = new Date(y, m, d);
                    if (!isNaN(fixedDate.getTime())) {
                        joinDate = fixedDate;
                    }
                }
            }

            // Normalizar fecha de registro para comparación justa
            joinDate.setHours(0, 0, 0, 0);

            return joinDate >= startOfPeriod;
        }).length;
    }, [students, timeRange]);

    // 4. Datos Gráfica Principal (Ingresos)
    const revenueChartData = useMemo(() => {
        return timeRange === 'year' ? monthlyRevenueData : rollingRevenueData;
    }, [timeRange, monthlyRevenueData, rollingRevenueData]);

    // 5. Datos Donut (Grados con Colores Estáticos)
    const studentsByRank = useMemo(() => {
        // Fix: Include all non-inactive students (active, debtor, exam_ready)
        const activeStudents = students.filter(s => s.status !== 'inactive');
        const distribution: Record<string, number> = {};

        activeStudents.forEach(s => {
            distribution[s.rank] = (distribution[s.rank] || 0) + 1;
        });

        // Mapa de colores estáticos hexadecimales (Enterprise Palette)
        const getColor = (rankName: string) => {
            const lower = rankName.toLowerCase();
            if (lower.includes('blanca')) return '#E5E7EB'; // Gray 200
            if (lower.includes('amarilla')) return '#FCD34D'; // Amber 300
            if (lower.includes('verde')) return '#4ADE80'; // Green 400
            if (lower.includes('azul')) return '#60A5FA'; // Blue 400
            if (lower.includes('cafe')) return '#78350F'; // Amber 900
            if (lower.includes('shodan ho')) return '#78350F'; // Brown
            if (lower.includes('negra')) return '#000000'; // Black
            return '#9CA3AF'; // Default Gray
        };

        // Orden lógico aproximado para la visualización
        const orderMap: Record<string, number> = { 
            blanca: 1, amarilla: 2, verde: 3, azul: 4, cafe: 5, 'shodan ho': 6, negra: 7 
        };

        return Object.entries(distribution).map(([name, value]) => {
            const key = Object.keys(orderMap).find(k => name.toLowerCase().includes(k)) || 'z';
            return {
                name,
                value,
                fill: getColor(name),
                order: orderMap[key] || 99
            };
        }).sort((a, b) => a.order - b.order);
    }, [students]);

    // 6. Total Alumnos Visualizados (Corrección para Donut)
    const totalChartStudents = useMemo(() => {
        return students.filter(s => s.status !== 'inactive').length;
    }, [students]);

    // 7. Total Cuentas por Cobrar
    const totalReceivable = stats.pendingCollection + stats.overdueAmount;

    // 8. Top Deudores (Alertas)
    const topDebtors = useMemo(() => {
        return students
            .filter(s => s.balance > 0)
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 5);
    }, [students]);

    return (
        <div className="p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto w-full flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-4 mb-1">
                <div>
                    <p className="text-xs md:text-[9px] font-bold uppercase tracking-[0.2em] mb-1" style={{color: 'var(--color-brand)'}}>IKC Management</p>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter" style={{color: 'var(--color-text-primary)'}}>Dashboard</h1>
                    <p className="mt-0.5 text-sm md:text-xs hidden sm:block" style={{color: 'var(--color-text-muted)'}}>Panel de control &mdash; {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p className="mt-0.5 text-base md:text-xs sm:hidden" style={{color: 'var(--color-text-muted)'}}>{new Date().toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                
                {/* Time range selector — Google-style pill segmented control */}
                <div className="flex items-center gap-0 rounded-none" style={{borderBottom: '2px solid var(--color-border-subtle)'}}>
                    <button 
                        onClick={() => setTimeRange('month')}
                        className="px-5 py-3 md:py-2 min-h-[48px] md:min-h-0 text-sm md:text-xs font-bold uppercase tracking-wider transition-all duration-200 relative"
                        style={timeRange === 'month' 
                            ? {color: 'var(--color-text-primary)', borderBottom: '2px solid var(--color-brand)', marginBottom: '-2px'}
                            : {color: 'var(--color-text-muted)', borderBottom: '2px solid transparent', marginBottom: '-2px'}}
                    >
                        Mensual
                    </button>
                    <button 
                        onClick={() => setTimeRange('year')}
                        className="px-5 py-3 md:py-2 min-h-[48px] md:min-h-0 text-sm md:text-xs font-bold uppercase tracking-wider transition-all duration-200"
                        style={timeRange === 'year' 
                            ? {color: 'var(--color-text-primary)', borderBottom: '2px solid var(--color-brand)', marginBottom: '-2px'}
                            : {color: 'var(--color-text-muted)', borderBottom: '2px solid transparent', marginBottom: '-2px'}}
                    >
                        Anual
                    </button>
                </div>
            </div>

            {/* ================================================================
                FILA 1: KPIs — 1 col mobile, 2 tablet, 4 desktop
                ================================================================ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                style={{
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--color-border-subtle)'  /* gap color between cells */
                }}>

                {/* KPI 1 — Ingresos */}
                <div className="flex flex-col justify-between p-7 group"
                    style={{backgroundColor: 'var(--color-bg-surface)'}}>
                    <div>
                        <p className="text-xs md:text-[9px] font-bold uppercase tracking-[0.2em] mb-3"
                            style={{color: 'var(--color-text-muted)'}}>Ingresos / {timeRange === 'month' ? 'Mes' : 'Año'}</p>
                        <p className="text-3xl font-black tracking-tighter tabular-nums"
                            style={{color: 'var(--color-text-primary)'}}>
                            ${displayRevenue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className="flex items-center justify-between mt-5 pt-4" style={{borderTop: '1px solid var(--color-border-subtle)'}}>
                        <span className="text-xs md:text-[10px] font-medium" style={{color: 'var(--color-text-muted)'}}>Total acumulado</span>
                        <span className="material-symbols-outlined" style={{fontSize: '16px', color: 'var(--color-brand)'}}>trending_up</span>
                    </div>
                </div>

                {/* KPI 2 — Alumnos */}
                <div className="flex flex-col justify-between p-7 cursor-pointer group transition-colors"
                    style={{backgroundColor: 'var(--color-bg-surface)'}}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'}
                    onClick={() => navigate('/master/students')}>
                    <div>
                        <p className="text-xs md:text-[9px] font-bold uppercase tracking-[0.2em] mb-3"
                            style={{color: 'var(--color-text-muted)'}}>Alumnos Inscritos</p>
                        <p className="text-3xl font-black tracking-tighter"
                            style={{color: 'var(--color-text-primary)'}}>{students.length}</p>
                    </div>
                    <div className="flex items-center justify-between mt-5 pt-4" style={{borderTop: '1px solid var(--color-border-subtle)'}}>
                        <span className="text-xs md:text-[10px] font-medium" style={{color: 'var(--color-text-muted)'}}>Ver estudiantes</span>
                        <span className="material-symbols-outlined" style={{fontSize: '16px', color: 'var(--color-text-muted)'}}>arrow_forward</span>
                    </div>
                </div>

                {/* KPI 3 — Nuevos */}
                <div className="flex flex-col justify-between p-7 group"
                    style={{backgroundColor: 'var(--color-bg-surface)'}}>
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em]"
                                style={{color: 'var(--color-text-muted)'}}>Nuevos Ingresos</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.5"
                                style={{color: 'var(--color-text-muted)', border: '1px solid var(--color-border-strong)', borderRadius: '3px'}}>
                                {timeRange === 'month' ? 'Mes' : 'Año'}
                            </span>
                        </div>
                        <p className="text-3xl font-black tracking-tighter"
                            style={{color: 'var(--color-text-primary)'}}>+{newStudentsCount}</p>
                    </div>
                    <div className="flex items-center justify-between mt-5 pt-4" style={{borderTop: '1px solid var(--color-border-subtle)'}}>
                        <span className="text-xs md:text-[10px] font-medium" style={{color: 'var(--color-text-muted)'}}>Nuevos registros</span>
                        <span className="material-symbols-outlined" style={{fontSize: '16px', color: 'var(--color-text-muted)'}}>person_add</span>
                    </div>
                </div>

                {/* KPI 4 — Por Cobrar */}
                <div className="flex flex-col justify-between p-7 cursor-pointer group transition-colors"
                    style={{backgroundColor: 'var(--color-bg-surface)'}}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'}
                    onClick={() => navigate('/master/finance')}>
                    <div>
                        <p className="text-xs md:text-[9px] font-bold uppercase tracking-[0.2em] mb-3"
                            style={{color: 'var(--color-text-muted)'}}>Por Cobrar</p>
                        <p className="text-3xl font-black tracking-tighter tabular-nums"
                            style={{color: 'var(--color-text-primary)'}}>
                            ${totalReceivable.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                        </p>
                        {stats.overdueAmount > 0 && (
                            <p className="text-[10px] font-bold mt-2 flex items-center gap-1.5" style={{color: 'var(--color-brand)'}}>
                                <span className="size-1.5 rounded-full animate-pulse inline-block" style={{backgroundColor: 'var(--color-brand)'}}></span>
                                ${stats.overdueAmount.toLocaleString()} vencido
                            </p>
                        )}
                    </div>
                    <div className="flex items-center justify-between mt-5 pt-4" style={{borderTop: '1px solid var(--color-border-subtle)'}}>
                        <span className="text-xs md:text-[10px] font-medium" style={{color: 'var(--color-text-muted)'}}>Ver finanzas</span>
                        <span className="material-symbols-outlined" style={{fontSize: '16px', color: 'var(--color-brand)'}}>account_balance_wallet</span>
                    </div>
                </div>
            </div>

            {/* ================================================================
                FILA 2: GRÁFICAS — Stack on mobile, side by side desktop
                ================================================================ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">

                {/* Gráfica Principal: Ingresos */}
                <div className="col-span-1 lg:col-span-8 flex flex-col min-h-[280px] sm:min-h-[360px] lg:min-h-[420px]"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: '10px',
                        overflow: 'hidden'
                    }}>
                    <div className="flex justify-between items-center px-7 py-5"
                        style={{borderBottom: '1px solid var(--color-border-subtle)'}}>
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-0.5"
                                style={{color: 'var(--color-text-muted)'}}>Análisis Financiero</p>
                            <h3 className="text-sm font-semibold"
                                style={{color: 'var(--color-text-primary)'}}>Tendencia de Ingresos</h3>
                        </div>
                        <button onClick={() => setShowAllIncomes(true)}
                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
                            style={{color: 'var(--color-brand)'}}>
                            Ver historial
                            <span className="material-symbols-outlined" style={{fontSize: '14px'}}>arrow_forward</span>
                        </button>
                    </div>
                    <div className="flex-1 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#e11d48" stopOpacity={0.15}/>
                                        <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false}
                                    tick={{fill: '#52525b', fontSize: 10, fontWeight: 600}} dy={10} />
                                <YAxis axisLine={false} tickLine={false}
                                    tick={{fill: '#52525b', fontSize: 10, fontWeight: 600}}
                                    tickFormatter={(v) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#111114', color: '#f4f4f5', fontSize: '12px', padding: '10px 14px' }}
                                    formatter={(value: number) => [new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(value)||0),'Ingresos']}
                                    cursor={{ stroke: 'rgba(255,255,255,0.05)', strokeWidth: 40 }}
                                />
                                <Area type="monotone" dataKey="total" stroke="#e11d48" strokeWidth={2}
                                    fillOpacity={1} fill="url(#colorRevenue)" animationDuration={1500} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfica Secundaria: Distribución por Grado */}
                <div className="col-span-1 lg:col-span-4 flex flex-col min-h-[280px] sm:min-h-[340px] lg:min-h-[420px]"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: '10px',
                        overflow: 'hidden'
                    }}>
                    <div className="px-7 py-5" style={{borderBottom: '1px solid var(--color-border-subtle)'}}>
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-0.5"
                            style={{color: 'var(--color-text-muted)'}}>Alumnos</p>
                        <h3 className="text-sm font-semibold"
                            style={{color: 'var(--color-text-primary)'}}>Distribución por Grado</h3>
                    </div>
                    <div className="flex-1 relative p-4 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={studentsByRank} innerRadius={60} outerRadius={78}
                                    paddingAngle={3} dataKey="value" stroke="none" cornerRadius={3}
                                    animationDuration={1500}>
                                    {studentsByRank.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#111114', color: '#f4f4f5' }} itemStyle={{ color: '#f4f4f5' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                            <span className="text-3xl font-black tabular-nums"
                                style={{color: 'var(--color-text-primary)'}}>{totalChartStudents}</span>
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em]"
                                style={{color: 'var(--color-text-muted)'}}>Total</span>
                        </div>
                    </div>
                    {/* Leyenda — rows with dividers */}
                    <div style={{borderTop: '1px solid var(--color-border-subtle)'}}>
                        {studentsByRank.map((rank, i) => (
                            <div key={rank.name}
                                className="flex items-center justify-between px-6 py-3"
                                style={{borderBottom: i < studentsByRank.length-1 ? '1px solid var(--color-border-subtle)' : 'none'}}>
                                <div className="flex items-center gap-2.5">
                                    <span className="size-1.5 rounded-full inline-block" style={{backgroundColor: rank.fill}}></span>
                                    <span className="text-xs font-medium" style={{color: 'var(--color-text-secondary)'}}>{rank.name}</span>
                                </div>
                                <span className="text-xs font-bold tabular-nums" style={{color: 'var(--color-text-primary)'}}>{rank.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ================================================================
                FILA 3: PAGOS PENDIENTES — Flush column grid, no inner cards
                ================================================================ */}
            <div style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '10px',
                overflow: 'hidden'
            }}>
                <div className="flex justify-between items-center px-7 py-5"
                    style={{borderBottom: '1px solid var(--color-border-subtle)'}}>
                    <div>
                        <p className="text-xs md:text-[9px] font-bold uppercase tracking-[0.2em] mb-0.5"
                            style={{color: 'var(--color-brand)'}}>Alertas</p>
                        <h3 className="text-sm font-semibold"
                            style={{color: 'var(--color-text-primary)'}}>Pagos Pendientes</h3>
                    </div>
                    <button onClick={() => navigate('/master/finance')}
                        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
                        style={{color: 'var(--color-brand)'}}>
                        Ver finanzas
                        <span className="material-symbols-outlined" style={{fontSize: '14px'}}>arrow_forward</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
                    style={{backgroundColor: 'var(--color-border-subtle)'}}>
                    {topDebtors.length === 0 ? (
                        <div className="col-span-full py-16 text-center flex flex-col items-center gap-3"
                            style={{backgroundColor: 'var(--color-bg-surface)'}}>
                            <span className="material-symbols-outlined" style={{fontSize: '28px', color: 'var(--color-border-strong)'}}>check_circle</span>
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: 'var(--color-text-muted)'}}>Sin deudores críticos</p>
                        </div>
                    ) : (
                        topDebtors.map((debtor, i) => (
                            <div key={debtor.id}
                                className="flex flex-col gap-5 p-6 cursor-pointer transition-colors"
                                style={{backgroundColor: 'var(--color-bg-surface)'}}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface)'}
                                onClick={() => navigate('/master/finance')}>
                                <div className="flex items-center gap-3">
                                    <Avatar src={debtor.avatarUrl} name={debtor.name} className="size-9 rounded-full text-xs" />
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-bold truncate" style={{color: 'var(--color-text-primary)'}}>{debtor.name}</p>
                                        <p className="text-[10px] uppercase tracking-wider font-medium truncate" style={{color: 'var(--color-text-muted)'}}>{debtor.rank}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5"
                                        style={{color: 'var(--color-brand)', border: '1px solid var(--color-brand-glow)', borderRadius: '3px'}}>
                                        Vencido
                                    </span>
                                    <span className="text-base font-black tabular-nums" style={{color: 'var(--color-brand)'}}>
                                        ${debtor.balance.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* --- MODAL DASHBOARD PANTALLA COMPLETA DE INGRESOS --- */}
            {showAllIncomes && (
                <div className="fixed inset-0 z-[60] flex flex-col animate-in fade-in zoom-in-95 duration-200" style={{backgroundColor: 'var(--color-bg-app)'}}>
                    <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0" style={{backgroundColor: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)'}}>
                        <div className="flex items-center gap-4">
                            <button onClick={() => setShowAllIncomes(false)} className="p-2 rounded-full transition-colors" style={{color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-raised)'}}>
                                <span className="material-symbols-outlined">arrow_back</span>
                            </button>
                            <div>
                                <h1 className="text-xl font-black leading-none" style={{color: 'var(--color-text-primary)'}}>Todos los Ingresos</h1>
                                <p className="text-sm" style={{color: 'var(--color-text-muted)'}}>Historial completo de pagos procesados</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                                <input
                                    type="text"
                                    placeholder="Buscar por concepto o alumno..."
                                    value={incomeSearch}
                                    onChange={(e) => setIncomeSearch(e.target.value)}
                                    className="w-full md:w-64 pl-9 pr-4 py-3 md:py-2 min-h-[48px] md:min-h-0 rounded-xl text-base md:text-sm outline-none transition-all font-medium placeholder:font-normal"
                                />
                                {incomeSearch && (
                                    <button onClick={() => setIncomeSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        <span className="material-symbols-outlined text-sm">close</span>
                                    </button>
                                )}
                            </div>
                            <select
                                value={incomeMonthFilter}
                                onChange={(e) => setIncomeMonthFilter(e.target.value)}
                                className="w-full md:w-48 px-4 py-3 md:py-2 min-h-[48px] md:min-h-0 rounded-xl text-base md:text-sm font-bold outline-none transition-all cursor-pointer appearance-none"
                                style={{color: 'var(--color-text-primary)'}}
                            >
                                <option value="">Todos los Meses</option>
                                {uniqueMonths.map(m => {
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

                    <div className="flex-1 overflow-auto p-6 md:p-10 max-w-[1400px] w-full mx-auto flex flex-col gap-6">
                        
                        {/* Resumen Rápid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                            <div className="p-5 rounded-2xl flex items-center gap-4" style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}>
                                <div className="size-12 rounded-xl flex items-center justify-center shrink-0" style={{backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981'}}>
                                    <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{color: 'var(--color-text-muted)'}}>Total en filtro</p>
                                    <p className="text-2xl font-black" style={{color: 'var(--color-text-primary)'}}>\${sumFilteredIncomes.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                                </div>
                            </div>
                            <div className="p-5 rounded-2xl flex items-center gap-4" style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}>
                                <div className="size-12 rounded-xl flex items-center justify-center shrink-0" style={{backgroundColor: 'rgba(96,165,250,0.15)', color: '#60a5fa'}}>
                                    <span className="material-symbols-outlined text-2xl">receipt_long</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{color: 'var(--color-text-muted)'}}>Movimientos</p>
                                    <p className="text-2xl font-black" style={{color: 'var(--color-text-primary)'}}>{cntFilteredIncomes}</p>
                                </div>
                            </div>
                        </div>

                        {/* Listado */}
                        <div className="rounded-3xl overflow-hidden flex-1 flex flex-col min-h-[400px]" style={{backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)'}}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[700px] md:min-w-full">
                                    <thead className="text-xs font-bold uppercase tracking-wider sticky top-0 z-10" style={{backgroundColor: 'var(--color-bg-raised)', color: 'var(--color-text-muted)'}}>
                                        <tr>
                                            <th className="px-6 py-4 w-32">Fecha</th>
                                            <th className="px-6 py-4">Concepto & Alumno</th>
                                            <th className="px-6 py-4 w-32">Monto</th>
                                            <th className="px-6 py-4 w-32">Método</th>
                                            <th className="px-6 py-4 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody style={{borderColor: 'var(--color-border-subtle)'}} className="divide-y">
                                        {filteredIncomes.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-20 text-center">
                                                    <div className="mx-auto size-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-dashed border-gray-200">
                                                        <span className="material-symbols-outlined text-gray-300 text-2xl">search_off</span>
                                                    </div>
                                                    <p className="font-bold text-gray-500">No se encontraron movimientos.</p>
                                                    <p className="text-sm text-gray-400 mt-1">Prueba con otro filtro o término de búsqueda.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredIncomes.map((inc) => {
                                                const isExpanded = expandedRecordId === inc.id;
                                                return (
                                                    <React.Fragment key={inc.id}>
                                                        <tr 
                                                            onClick={() => setExpandedRecordId(isExpanded ? null : inc.id)}
                                                            className="transition-colors cursor-pointer group"
                                                            style={{borderColor: 'var(--color-border-subtle)'}}
                                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-raised)'}
                                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
                                                        >
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <p className="font-bold text-sm" style={{color: 'var(--color-text-primary)'}}>
                                                                    {formatDateDisplay(inc.date, { day: '2-digit', month: 'short', year: '2-digit' })}
                                                                </p>
                                                                <p className="text-xs font-mono mt-0.5" style={{color: 'var(--color-text-muted)'}}>
                                                                    {new Date(inc.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="font-bold leading-tight" style={{color: 'var(--color-text-primary)'}}>{inc.concept}</p>
                                                                <p className="text-sm flex items-center gap-1.5 mt-1" style={{color: 'var(--color-text-muted)'}}>
                                                                    <span className="material-symbols-outlined text-[14px]">person</span> {inc.studentName}
                                                                </p>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="text-sm font-black px-2.5 py-1 rounded-lg" style={{color: '#10b981', backgroundColor: 'rgba(16,185,129,0.15)'}}>
                                                                    +${inc.amount.toLocaleString()}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded" style={{color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-strong)'}}>
                                                                    {inc.method}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <button className="p-1 rounded-full transition-all" style={{color: 'var(--color-text-muted)'}}>
                                                                    <span className={`material-symbols-outlined text-xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="animate-in fade-in duration-200 slide-in-from-top-2" style={{backgroundColor: 'var(--color-bg-raised)'}}>
                                                                <td colSpan={5} className="px-6 py-5">
                                                                    <div className="max-w-3xl">
                                                                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{color: 'var(--color-text-muted)'}}>Descripción / Información Adicional</h4>
                                                                        <p className="text-sm leading-relaxed font-medium p-4 rounded-xl italic" style={{color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)'}}>
                                                                            {inc.description ? inc.description : "Sin descripción adicional proporcionada al momento del pago."}
                                                                        </p>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MasterDashboard;
