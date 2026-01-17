/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { getYearlyReport } from '../api/reports';
import type { MonthAmount, YearlyReportResponse } from '../types/report';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const monthLabel = (month: number) => (month > 0 ? `${month}月` : '-');

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

  const topCategories = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.byCategory.slice(0, 8);
  }, [data]);

  return (
    <div className="space-y-6 pb-20 pt-4">
      <header className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-indigo-600" />
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

          <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-3">每月收支</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 px-3 font-semibold">月份</th>
                    <th className="py-2 px-3 font-semibold">支出</th>
                    <th className="py-2 px-3 font-semibold">收入</th>
                    <th className="py-2 px-3 font-semibold">結餘</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((item) => (
                    <tr key={item.month} className="border-b border-gray-50">
                      <td className="py-2 px-3 text-gray-600">{monthLabel(item.month)}</td>
                      <td className="py-2 px-3 text-gray-800">
                        {formatCurrency(item.expense)}
                      </td>
                      <td className="py-2 px-3 text-gray-800">{formatCurrency(item.income)}</td>
                      <td className="py-2 px-3 text-gray-800">{formatCurrency(item.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-3">分類統計（支出）</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 px-3 font-semibold">分類</th>
                    <th className="py-2 px-3 font-semibold">總額</th>
                    <th className="py-2 px-3 font-semibold">占比</th>
                    <th className="py-2 px-3 font-semibold">筆數</th>
                    <th className="py-2 px-3 font-semibold">月均</th>
                  </tr>
                </thead>
                <tbody>
                  {topCategories.map((item) => (
                    <tr key={item.categoryId} className="border-b border-gray-50">
                      <td className="py-2 px-3 text-gray-600">
                        {item.categoryName || item.categoryId}
                      </td>
                      <td className="py-2 px-3 text-gray-800">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="py-2 px-3 text-gray-800">
                        {(item.percent ?? 0).toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-gray-800">{item.count}</td>
                      <td className="py-2 px-3 text-gray-800">
                        {formatCurrency(item.avgMonthly)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.byCategory.length > topCategories.length && (
              <div className="text-xs text-gray-500 mt-3">
                只顯示前 {topCategories.length} 個分類（總共 {data.byCategory.length} 個）
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
