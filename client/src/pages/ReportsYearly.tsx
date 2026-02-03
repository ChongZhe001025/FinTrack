/* eslint-disable react-hooks/static-components */
/* eslint-disable react-hooks/set-state-in-effect */
import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Loader2, LineChart, ChevronLeft, ChevronRight, Wallet, Calendar, ArrowUpDown, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Bar,
} from 'recharts';
import { getYearlyReport } from '../api/reports';
import type { MonthAmount } from '../types/report';

interface ChartTooltipPayload {
  dataKey: string;
  value: number;
  color?: string;
  payload?: Record<string, unknown>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
}

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

// ✅ 全站共用 chart style token（吃 index.css 的 CSS variables）
const chartVars = {
  grid: 'var(--chart-grid)',
  tick: 'var(--chart-tick)',
  text: 'var(--chart-text)',
  tooltipBg: 'var(--chart-tooltip-bg)',
  tooltipBorder: 'var(--chart-tooltip-border)',
  tooltipText: 'var(--chart-tooltip-text)',
  expense: 'var(--chart-expense)',
  income: 'var(--chart-income)',
  net: 'var(--chart-net)',
  category: 'var(--chart-category)',
} as const;

export default function ReportsYearly() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);

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



  // Handle error via useQuery error definition if needed, or simple try/catch in fn. 
  // Here we simplify by assuming query mostly works, or we can use error object from useQuery.
  // For now let's keep it simple.

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
        <p style={{ color: chartVars.expense }}>支出：{formatCurrency(values.expense ?? 0)}</p>
        <p style={{ color: chartVars.income }}>收入：{formatCurrency(values.income ?? 0)}</p>
        <p style={{ color: chartVars.text }}>結餘：{formatCurrency(values.net ?? 0)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20 pt-4">
      <div className="flex flex-col items-start sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <LineChart className="text-indigo-600 dark:text-indigo-300" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100 shrink-0">年度報表</h2>
        </div>
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
                      <Bar dataKey="expense" name="支出" fill={chartVars.expense} radius={[6, 6, 0, 0]} barSize={10} />
                      <Bar dataKey="income" name="收入" fill={chartVars.income} radius={[6, 6, 0, 0]} barSize={10} />
                      <Line dataKey="net" name="結餘" stroke={chartVars.net} strokeWidth={2} dot={false} />
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
}
