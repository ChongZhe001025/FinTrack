import { useState, useMemo, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as PieTooltip,
    Legend,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Bar,
} from 'recharts';
import {
    Loader2,
    PieChart as PieIcon,
    ChevronLeft,
    ChevronRight,
    BarChart3,
    List,
    Wallet,
    Calendar,
    ArrowUpDown,
    TrendingUp,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSelectedMonth, setSelectedMonth } from '../utils/selectedMonth';
import { useTheme } from '../context/ThemeContext';
import { getYearlyReport } from '../api/reports';
import type { MonthAmount } from '../types/report';
import clsx from 'clsx';

// --- Shared Types & Utils ---

interface CategoryStat {
    categoryId?: string;
    category: string;
    amount: number;
    [key: string]: unknown;
}

interface ComparisonStat {
    categoryId?: string;
    category: string;
    current: number;
    previous: number;
    [key: string]: unknown;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        value: number;
        name: string;
        color: string;
        dataKey: string;
    }>;
    label?: string;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
        maximumFractionDigits: 0,
    }).format(value ?? 0);

const formatCompactNumber = (value: number) =>
    new Intl.NumberFormat('zh-TW', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value ?? 0);

const monthLabel = (month: number) => (month > 0 ? `${month}月` : '-');

const formatMonthAmount = (value: MonthAmount) => {
    if (!value || value.month === 0) {
        return '-';
    }
    return `${monthLabel(value.month)} ${formatCurrency(value.amount)}`;
};

// --- Monthly Report Component ---

const MonthlyReport = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [baseMonth, setBaseMonth] = useState(() => getSelectedMonth());
    const navigate = useNavigate();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Styling tokens
    const axisLabelColor = isDark ? '#d4d4d4' : '#374151';
    const axisTickColor = isDark ? '#a3a3a3' : '#9ca3af';
    const gridStroke = isDark ? '#262626' : '#f0f0f0';
    const tooltipStyle: React.CSSProperties = {
        borderRadius: '8px',
        border: isDark ? '1px solid #262626' : '1px solid #f3f4f6',
        backgroundColor: isDark ? '#0f0f0f' : '#ffffff',
        color: isDark ? '#e5e5e5' : '#111827',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    };
    const cursorFill = isDark ? '#1f1f1f' : '#f9fafb';

    const maxMonthStart = new Date();
    maxMonthStart.setHours(0, 0, 0, 0);
    maxMonthStart.setDate(1);
    maxMonthStart.setMonth(maxMonthStart.getMonth() + 12);

    const changeMonth = (offset: number) => {
        const d = new Date(baseMonth + '-01');
        d.setMonth(d.getMonth() + offset);
        if (d.getTime() > maxMonthStart.getTime()) return;

        const nextMonth = d.toISOString().slice(0, 7);
        setSelectedMonth(nextMonth);
        setBaseMonth(nextMonth);
    };

    const { data: baseStats, isLoading: isBaseLoading } = useQuery({
        queryKey: ['stats-base', baseMonth],
        queryFn: async () => {
            const [pieRes, barRes] = await Promise.all([
                axios.get(`/api/v1/stats/category?month=${baseMonth}`),
                axios.get(`/api/v1/stats/comparison?month=${baseMonth}`),
            ]);
            return {
                pie: pieRes.data || [],
                bar: barRes.data || []
            };
        },
        placeholderData: keepPreviousData,
    });

    const pieData = (baseStats?.pie || []) as CategoryStat[];
    const barData = (baseStats?.bar || []) as ComparisonStat[];

    useEffect(() => {
        setIsLoading(isBaseLoading);
    }, [isBaseLoading]);

    const totalExpense = pieData.reduce((sum: number, item: CategoryStat) => sum + item.amount, 0);

    const [selectedYear, selectedMonth] = baseMonth.split('-').map(Number);
    const selectedMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    const isNextDisabled =
        Number.isInteger(selectedYear) &&
        Number.isInteger(selectedMonth) &&
        selectedMonthDate.getTime() >= maxMonthStart.getTime();

    const CustomBarTooltip = ({ active, payload, label }: CustomTooltipProps) => {
        if (!active || !payload || payload.length === 0) return null;
        const currentItem = payload.find((item) => item.dataKey === 'current');
        const previousItem = payload.find((item) => item.dataKey === 'previous');

        return (
            <div style={tooltipStyle} className="p-3 text-sm">
                <p className="font-bold mb-2 text-gray-800 dark:text-neutral-100">{label}</p>
                <p className="text-gray-400 dark:text-neutral-400">
                    上月: NT$ {Number(previousItem?.value ?? 0).toLocaleString()}
                </p>
                <p className="text-indigo-600 dark:text-indigo-300">
                    本月: NT$ {Number(currentItem?.value ?? 0).toLocaleString()}
                </p>
            </div>
        );
    };

    const CustomPieTooltip = ({ active, payload }: CustomTooltipProps) => {
        if (!active || !payload || payload.length === 0) return null;
        const data = payload[0];

        return (
            <div style={tooltipStyle} className="p-3 text-sm">
                <p className="font-bold text-gray-800 dark:text-neutral-100">{data.name}</p>
                <p className="text-indigo-600 dark:text-indigo-300">
                    NT$ {Number(data.value || 0).toLocaleString()}
                </p>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex h-64 justify-center items-center text-gray-400 dark:text-neutral-500">
                <Loader2 className="animate-spin mr-2" /> 載入中...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-900 p-1 rounded-lg border border-gray-100 dark:border-neutral-800">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="p-1 hover:bg-white hover:shadow-sm rounded transition dark:hover:bg-neutral-800"
                        title="上個月"
                    >
                        <ChevronLeft size={18} className="text-gray-600 dark:text-neutral-300" />
                    </button>

                    <span className="font-bold text-gray-700 dark:text-neutral-100 w-20 text-center">{baseMonth}</span>

                    <button
                        onClick={() => changeMonth(1)}
                        disabled={isNextDisabled}
                        title="下個月"
                        className={clsx(
                            'p-1 rounded transition',
                            isNextDisabled
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-white hover:shadow-sm dark:hover:bg-neutral-800'
                        )}
                    >
                        <ChevronRight size={18} className="text-gray-600 dark:text-neutral-300" />
                    </button>
                </div>
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pie */}
                <div className="bg-white dark:bg-neutral-900 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-y-auto max-h-[400px] flex flex-col">
                    <div className="flex items-center gap-2 mb-6 w-full">
                        <PieIcon className="text-indigo-600 dark:text-neutral-200" />
                        <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100">支出占比</h3>
                    </div>

                    {pieData.length > 0 ? (
                        <div className="w-full flex-1 min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="amount"
                                        nameKey="category"
                                    >
                                        {pieData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>

                                    <PieTooltip
                                        content={<CustomPieTooltip />}
                                        cursor={{ fill: cursorFill }}
                                    />

                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconSize={10}
                                        wrapperStyle={{
                                            fontSize: '12px',
                                            paddingTop: '10px',
                                            color: axisTickColor,
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-neutral-500">
                            無數據
                        </div>
                    )}
                </div>

                {/* List */}
                <div className="bg-white dark:bg-neutral-900 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-y-auto max-h-[400px]">
                    <div className="flex items-center gap-2 mb-6">
                        <List className="text-indigo-600 dark:text-neutral-200" />
                        <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100">支出明細</h3>
                    </div>

                    <div className="space-y-3">
                        {pieData.map((item, index) => {
                            const percent = totalExpense > 0 ? ((item.amount / totalExpense) * 100).toFixed(1) : '0.0';
                            const categoryQuery = item.categoryId
                                ? `category_id=${encodeURIComponent(item.categoryId)}`
                                : `category=${encodeURIComponent(item.category)}`;

                            return (
                                <div
                                    key={item.categoryId || item.category}
                                    onClick={() => navigate(`/transactions?${categoryQuery}&month=${baseMonth}`)}
                                    className="flex items-center justify-between p-2 md:p-3 rounded-lg transition cursor-pointer group
                             hover:bg-indigo-50 dark:hover:bg-neutral-800"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <span className="font-medium text-sm text-gray-700 dark:text-neutral-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-200">
                                            {item.category}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="font-bold text-sm text-gray-900 dark:text-neutral-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-200">
                                                NT$ {item.amount.toLocaleString()}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-neutral-400">{percent}%</p>
                                        </div>
                                        <ChevronRight
                                            size={16}
                                            className="text-gray-300 dark:text-neutral-600 group-hover:text-indigo-400 dark:group-hover:text-indigo-300"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 gap-6">
                {/* Comparison */}
                <div className="bg-white dark:bg-neutral-900 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="text-indigo-600 dark:text-neutral-200" />
                            <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100">上月 vs 本月</h3>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-neutral-400">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-gray-200 dark:bg-neutral-700" />
                                <span>上月</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 dark:bg-indigo-400" />
                                <span>本月</span>
                            </div>
                        </div>
                    </div>

                    {barData.length > 0 ? (
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                    <XAxis
                                        dataKey="category"
                                        axisLine={false}
                                        tickLine={false}
                                        interval={0}
                                        tick={{ fill: axisLabelColor, fontSize: 12 }}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: axisTickColor, fontSize: 12 }} />

                                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: cursorFill }} />

                                    <Bar dataKey="previous" name="上月" fill={isDark ? '#404040' : '#e5e7eb'} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="current" name="本月" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-40 flex justify-center items-center text-gray-400 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-950 rounded-lg">
                            無資料
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Yearly Report Component ---

const YearlyReport = () => {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState<number>(currentYear);
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Chart tokens
    const chartVars = {
        grid: isDark ? '#262626' : '#f0f0f0',
        tick: isDark ? '#a3a3a3' : '#9ca3af',
        text: isDark ? '#e5e5e5' : '#111827',
        tooltipBg: isDark ? '#0f0f0f' : '#ffffff',
        tooltipBorder: isDark ? '#262626' : '#f3f4f6',
        tooltipText: isDark ? '#e5e5e5' : '#111827',
        expense: 'var(--chart-expense)',
        income: 'var(--chart-income)',
        net: 'var(--chart-net)',
        category: 'var(--chart-category)',
    };

    const changeYear = (offset: number) => {
        setYear((prev) => {
            const next = prev + offset;
            return next > currentYear ? currentYear : next;
        });
    };

    const { data, isLoading: loading } = useQuery({
        queryKey: ['reports-yearly', year],
        queryFn: () => getYearlyReport(year),
        placeholderData: keepPreviousData,
    });

    const monthlyChartData = useMemo(() => {
        if (!data) return [];
        return data.monthly.map((item) => ({
            name: monthLabel(item.month),
            month: item.month,
            expense: item.expense,
            income: item.income,
            net: item.net,
        }));
    }, [data]);

    const hasMonthlyData = monthlyChartData.some((item) => item.expense > 0 || item.income > 0);

    const MonthlyTooltip = ({ active, payload, label }: CustomTooltipProps) => {
        if (!active || !payload || payload.length === 0) return null;

        const values = payload.reduce<Record<string, number>>((acc, item) => {
            if (item.dataKey) acc[item.dataKey] = Number(item.value ?? 0);
            return acc;
        }, {});

        return (
            <div
                className="p-3 shadow-lg rounded-lg text-sm"
                style={{
                    backgroundColor: chartVars.tooltipBg,
                    border: `1px solid ${chartVars.tooltipBorder}`,
                    color: chartVars.tooltipText,
                }}
            >
                <p className="font-bold mb-2" style={{ color: chartVars.tooltipText }}>
                    {label}
                </p>
                <p style={{ color: 'var(--chart-expense)' }}>支出：{formatCurrency(values.expense ?? 0)}</p>
                <p style={{ color: 'var(--chart-income)' }}>收入：{formatCurrency(values.income ?? 0)}</p>
                <p style={{ color: 'var(--chart-net)' }}>結餘：{formatCurrency(values.net ?? 0)}</p>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-900 p-1 rounded-lg border border-gray-100 dark:border-neutral-800">
                    <button
                        onClick={() => changeYear(-1)}
                        className="p-1 hover:bg-white hover:shadow-sm rounded transition dark:hover:bg-neutral-800"
                    >
                        <ChevronLeft size={18} className="text-gray-600 dark:text-neutral-300" />
                    </button>
                    <span className="font-bold text-gray-700 dark:text-neutral-100 w-20 text-center">{year}</span>
                    <button
                        onClick={() => changeYear(1)}
                        disabled={year >= currentYear}
                        className={`p-1 rounded transition ${year >= currentYear
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-white hover:shadow-sm dark:hover:bg-neutral-800'
                            }`}
                    >
                        <ChevronRight size={18} className="text-gray-600 dark:text-neutral-300" />
                    </button>
                </div>
            </div>

            {loading && (
                <div className="flex items-center text-gray-400 dark:text-neutral-500">
                    <Loader2 className="animate-spin mr-2" /> 載入中...
                </div>
            )}

            {data && (
                <>
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Annual Summary Card */}
                        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm transition hover:shadow-md flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">年總支出</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mt-1">
                                        {formatCurrency(data.summary.totalExpense)}
                                    </h3>
                                </div>
                                <div className="p-3 bg-red-50 text-red-600 dark:bg-rose-950/40 dark:text-rose-300 rounded-full">
                                    <Wallet size={24} />
                                </div>
                            </div>
                            <div className="space-y-2 pt-3 border-t border-gray-50 dark:border-neutral-800">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-neutral-500">年總收入</span>
                                    <span className="font-medium text-green-600 dark:text-emerald-400 flex items-center gap-1">
                                        <TrendingUp size={14} /> {formatCurrency(data.summary.totalIncome)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-neutral-500">年結餘</span>
                                    <span className={`font-medium ${data.summary.net >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500 dark:text-red-400'} flex items-center gap-1`}>
                                        {formatCurrency(data.summary.net)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Monthly Average Card */}
                        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm transition hover:shadow-md flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">月平均支出</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mt-1">
                                        {formatCurrency(data.summary.avgMonthlyExpense)}
                                    </h3>
                                </div>
                                <div className="p-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-full">
                                    <Calendar size={24} />
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-50 dark:border-neutral-800">
                                <p className="text-xs text-gray-400 dark:text-neutral-500">基於 12 個月平均計算</p>
                            </div>
                        </div>

                        {/* Extremes Card */}
                        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm transition hover:shadow-md flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">支出峰值</p>
                                </div>
                                <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300 rounded-full">
                                    <ArrowUpDown size={24} />
                                </div>
                            </div>

                            <div className="space-y-2 pt-1">
                                <div className="flex justify-between items-center p-2 rounded-lg bg-red-50/50 dark:bg-rose-950/10">
                                    <span className="text-xs text-gray-500 dark:text-neutral-400">最高</span>
                                    <span className="text-sm font-bold text-gray-800 dark:text-neutral-200">
                                        {formatMonthAmount(data.summary.maxExpenseMonth)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-2 rounded-lg bg-green-50/50 dark:bg-emerald-950/10">
                                    <span className="text-xs text-gray-500 dark:text-neutral-400">最低</span>
                                    <span className="text-sm font-bold text-gray-800 dark:text-neutral-200">
                                        {formatMonthAmount(data.summary.minExpenseMonth)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 gap-4">
                        <div className="bg-white dark:bg-neutral-900 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100">每月收支走勢</h3>
                                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">支出 / 收入為長條，結餘為折線</p>
                                </div>
                                <div className="text-xs text-gray-400 dark:text-neutral-500">單位：新台幣</div>
                            </div>

                            {hasMonthlyData ? (
                                <div className="h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={monthlyChartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartVars.grid} />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: chartVars.tick, fontSize: 12 }}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: chartVars.tick, fontSize: 12 }}
                                                tickFormatter={formatCompactNumber}
                                            />
                                            <Tooltip content={<MonthlyTooltip />} />
                                            <Legend
                                                iconType="circle"
                                                wrapperStyle={{ fontSize: '12px', color: chartVars.text }}
                                            />
                                            <Bar dataKey="expense" name="支出" fill="var(--chart-expense)" radius={[6, 6, 0, 0]} barSize={10} />
                                            <Bar dataKey="income" name="收入" fill="var(--chart-income)" radius={[6, 6, 0, 0]} barSize={10} />
                                            <Line dataKey="net" name="結餘" stroke="var(--chart-net)" strokeWidth={2} dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-72 flex items-center justify-center text-gray-400 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-950 rounded-lg">
                                    目前沒有年度收支資料
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

// --- Main Reports Page ---

const TABS = [
    { id: 'monthly', label: '每月報表' },
    { id: 'yearly', label: '年度報表' },
] as const;

export default function Reports() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as 'monthly' | 'yearly') || 'monthly';

    const setActiveTab = (tab: 'monthly' | 'yearly') => {
        setSearchParams({ tab });
    };

    return (
        <div className="space-y-6 pb-20 pt-4">
            <div className="flex items-center gap-2">
                <BarChart3 className="text-indigo-600 dark:text-neutral-200" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100 shrink-0">財務報表</h2>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-neutral-800">
                <nav className="flex space-x-8" aria-label="Tabs">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                                activeTab === tab.id
                                    ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-neutral-400 dark:hover:text-neutral-300 dark:hover:border-neutral-700'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="pt-2">
                {activeTab === 'monthly' ? <MonthlyReport /> : <YearlyReport />}
            </div>
        </div>
    );
}
