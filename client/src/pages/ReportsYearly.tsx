/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2, BarChart3, ChevronLeft, ChevronRight, PieChart as PieIcon, LineChart } from 'lucide-react';
import { getYearlyReport } from '../api/reports';
import type { MonthAmount, YearlyReportResponse } from '../types/report';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const monthLabel = (month: number) => (month > 0 ? `${month}月` : '-');

const CHART_COLORS = {
  expense: '#f97316',
  income: '#22c55e',
  net: '#6366f1',
};

const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#94a3b8'];

const METRIC_LABELS: Record<string, string> = {
  expense: '支出',
  income: '收入',
  net: '結餘',
};

const formatTooltipCurrency = (value: number | string | Array<number | string>) => {
  const normalized = Array.isArray(value) ? value[0] : value;
  return formatCurrency(Number(normalized ?? 0));
};

const formatMonthAmount = (value: MonthAmount) => {
  if (!value || value.month === 0) {
    return '-';
  }
  return `${monthLabel(value.month)} ${formatCurrency(value.amount)}`;
};

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
    if (!data) {
      return [];
    }
    return data.monthly.map((item) => ({
      month: monthLabel(item.month),
      expense: item.expense,
      income: item.income,
      net: item.net,
    }));
  }, [data]);

  const categoryChartData = useMemo(() => {
    if (!data) {
      return [];
    }
    const totalExpense = data.summary.totalExpense;
    const top = data.byCategory.slice(0, 6);
    const rest = data.byCategory.slice(6);
    const restTotal = rest.reduce((sum, item) => sum + item.total, 0);
    const rows = top.map((item) => ({
      name: item.categoryName || item.categoryId,
      value: item.total,
      percent: totalExpense > 0 ? (item.total / totalExpense) * 100 : 0,
    }));
    if (restTotal > 0) {
      rows.push({
        name: '其他',
        value: restTotal,
        percent: totalExpense > 0 ? (restTotal / totalExpense) * 100 : 0,
      });
    }
    return rows;
  }, [data]);

  return (
    <div className="space-y-6 pb-20 pt-4">
      <header className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <LineChart className="text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-800">年度報表</h2>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-lg">
          <button
            onClick={() => changeYear(-1)}
            className="p-1 hover:bg-white hover:shadow-sm rounded transition"
          >
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <span className="font-bold text-gray-700 w-16 text-center">{year}</span>
          <button
            onClick={() => changeYear(1)}
            disabled={year >= currentYear}
            className={`p-1 rounded transition ${
              year >= currentYear
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-white hover:shadow-sm'
            }`}
          >
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
      </header>

      {loading && (
        <div className="flex items-center text-gray-400">
          <Loader2 className="animate-spin mr-2" /> 載入中...
        </div>
      )}

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {data && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-sm text-gray-500">年總支出</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(data.summary.totalExpense)}
              </div>
              <div className="text-sm text-gray-500 mt-2">
                年總收入：{formatCurrency(data.summary.totalIncome)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                年結餘：{formatCurrency(data.summary.net)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-sm text-gray-500">月平均支出</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(data.summary.avgMonthlyExpense)}
              </div>
              <div className="text-sm text-gray-500 mt-2">（用 12 個月平均）</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-sm text-gray-500">支出最高 / 最低月份</div>
              <div className="text-sm text-gray-600 mt-3">
                最高：{formatMonthAmount(data.summary.maxExpenseMonth)}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                最低：{formatMonthAmount(data.summary.minExpenseMonth)}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-indigo-600" />
                  <h3 className="text-lg font-bold text-gray-800">每月收支趨勢</h3>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: CHART_COLORS.expense }}
                    />
                    <span>支出</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: CHART_COLORS.income }}
                    />
                    <span>收入</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: CHART_COLORS.net }}
                    />
                    <span>結餘</span>
                  </div>
                </div>
              </div>
              {monthlyChartData.length > 0 ? (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={monthlyChartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                        tickFormatter={(value) => formatNumber(Number(value))}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          formatTooltipCurrency(value),
                          METRIC_LABELS[String(name)] ?? String(name),
                        ]}
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                      <Bar
                        dataKey="expense"
                        fill={CHART_COLORS.expense}
                        radius={[4, 4, 0, 0]}
                        barSize={18}
                      />
                      <Bar
                        dataKey="income"
                        fill={CHART_COLORS.income}
                        radius={[4, 4, 0, 0]}
                        barSize={18}
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        stroke={CHART_COLORS.net}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                  無數據
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <PieIcon className="text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-800">支出分類佔比</h3>
              </div>
              {categoryChartData.length > 0 ? (
                <>
                  <div className="relative h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={105}
                          paddingAngle={3}
                        >
                          {categoryChartData.map((entry, index) => (
                            <Cell
                              key={`${entry.name}-${index}`}
                              fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatTooltipCurrency(value)}
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          height={36}
                          wrapperStyle={{ fontSize: '12px', color: '#6b7280' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-xs text-gray-500">年度支出</div>
                      <div className="text-lg font-bold text-gray-800">
                        {formatCurrency(data.summary.totalExpense)}
                      </div>
                    </div>
                  </div>
                  {data.byCategory.length > 6 && (
                    <div className="text-xs text-gray-500 mt-3">前 6 類 + 其他</div>
                  )}
                </>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                  無數據
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
