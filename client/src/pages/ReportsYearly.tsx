/* eslint-disable react-hooks/static-components */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, LineChart, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { getYearlyReport } from '../api/reports';
import type { MonthAmount, YearlyReportResponse } from '../types/report';

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
  const [data, setData] = useState<YearlyReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const changeYear = (offset: number) => {
    setYear((prev) => {
      const next = prev + offset;
      return next > currentYear ? currentYear : next;
    });
  };

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setError('');
    getYearlyReport(year)
      .then((res) => {
        if (isActive) {
          setData(res);
        }
      })
      .catch((err) => {
        if (isActive) {
          setError(err?.response?.data?.error || 'Failed to load report');
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [year]);

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

  const categoryChartData = useMemo(() => {
    if (!data) return [];
    const limit = 7;
    const top = data.byCategory.slice(0, limit);
    const rest = data.byCategory.slice(limit);
    const restTotal = rest.reduce((sum, item) => sum + item.total, 0);
    const restCount = rest.reduce((sum, item) => sum + item.count, 0);
    const restPercent = data.summary.totalExpense > 0 ? (restTotal / data.summary.totalExpense) * 100 : 0;
    const restAvg = restTotal / 12;

    const merged =
      restTotal > 0
        ? [
            ...top,
            {
              categoryId: 'other',
              categoryName: '其他',
              total: restTotal,
              percent: restPercent,
              count: restCount,
              avgMonthly: restAvg,
            },
          ]
        : top;

    return merged.map((item) => ({
      name: item.categoryName || item.categoryId || '未分類',
      total: item.total,
      percent: item.percent,
      count: item.count,
      avgMonthly: item.avgMonthly,
    }));
  }, [data]);

  const hasMonthlyData = monthlyChartData.some((item) => item.expense > 0 || item.income > 0);
  const hasCategoryData = categoryChartData.some((item) => item.total > 0);
  const hasOtherCategory = categoryChartData.some((item) => item.name === '其他');

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

  const CategoryTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;

    const item = payload[0]?.payload as {
      name: string;
      total: number;
      percent: number;
      count: number;
      avgMonthly: number;
    };
    if (!item) return null;

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
          {item.name}
        </p>
        <p style={{ color: chartVars.text }}>總額：{formatCurrency(item.total ?? 0)}</p>
        <p style={{ color: chartVars.text }}>占比：{(item.percent ?? 0).toFixed(1)}%</p>
        <p style={{ color: chartVars.text }}>筆數：{item.count ?? 0}</p>
        <p style={{ color: chartVars.text }}>月均：{formatCurrency(item.avgMonthly ?? 0)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20 pt-4">
      <header className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <LineChart className="text-indigo-600 dark:text-neutral-200" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">年度報表</h2>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-900 p-1 rounded-lg">
          <button
            onClick={() => changeYear(-1)}
            className="p-1 hover:bg-white hover:shadow-sm rounded transition dark:hover:bg-neutral-800"
          >
            <ChevronLeft size={18} className="text-gray-600 dark:text-neutral-300" />
          </button>
          <span className="font-bold text-gray-700 dark:text-neutral-200 w-16 text-center">{year}</span>
          <button
            onClick={() => changeYear(1)}
            disabled={year >= currentYear}
            className={`p-1 rounded transition ${
              year >= currentYear
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-white hover:shadow-sm dark:hover:bg-neutral-800'
            }`}
          >
            <ChevronRight size={18} className="text-gray-600 dark:text-neutral-300" />
          </button>
        </div>
      </header>

      {loading && (
        <div className="flex items-center text-gray-400 dark:text-neutral-500">
          <Loader2 className="animate-spin mr-2" /> 載入中...
        </div>
      )}

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {data && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
              <div className="text-sm text-gray-500 dark:text-neutral-400">年總支出</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mt-2">
                {formatCurrency(data.summary.totalExpense)}
              </div>
              <div className="text-sm text-gray-500 dark:text-neutral-400 mt-2">
                年總收入：{formatCurrency(data.summary.totalIncome)}
              </div>
              <div className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                年結餘：{formatCurrency(data.summary.net)}
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
              <div className="text-sm text-gray-500 dark:text-neutral-400">月平均支出</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mt-2">
                {formatCurrency(data.summary.avgMonthlyExpense)}
              </div>
              <div className="text-sm text-gray-500 dark:text-neutral-400 mt-2">（用 12 個月平均）</div>
            </div>

            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
              <div className="text-sm text-gray-500 dark:text-neutral-400">支出最高 / 最低月份</div>
              <div className="text-sm text-gray-600 dark:text-neutral-300 mt-3">
                最高：{formatMonthAmount(data.summary.maxExpenseMonth)}
              </div>
              <div className="text-sm text-gray-600 dark:text-neutral-300 mt-2">
                最低：{formatMonthAmount(data.summary.minExpenseMonth)}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm lg:col-span-3">
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

            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100">分類支出分布</h3>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">依總額排序，含其他分類</p>
                </div>
                <div className="text-xs text-gray-400 dark:text-neutral-500">Top {categoryChartData.length}</div>
              </div>

              {hasCategoryData ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical" margin={{ left: 16, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartVars.grid} />
                      <XAxis
                        type="number"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: chartVars.tick, fontSize: 12 }}
                        tickFormatter={formatCompactNumber}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        width={80}
                        tick={{ fill: chartVars.text, fontSize: 12 }}
                      />
                      <Tooltip content={<CategoryTooltip />} />
                      <Bar dataKey="total" fill={chartVars.category} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-gray-400 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-950 rounded-lg">
                  目前沒有分類資料
                </div>
              )}

              {hasOtherCategory && (
                <div className="text-xs text-gray-500 dark:text-neutral-400 mt-3">
                  其他分類已合併為「其他」顯示
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
