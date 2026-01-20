import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as PieTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as BarTooltip,
} from 'recharts';
import {
  Loader2,
  PieChart as PieIcon,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  CalendarDays,
  List,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSelectedMonth, setSelectedMonth } from '../utils/selectedMonth';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';

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

interface WeeklyStat {
  day: string;
  amount: number;
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

// 定義篩選選項
const RANGE_OPTIONS = [
  { value: '7days', label: '近 7 天' },
  { value: '30days', label: '近 30 天' },
  { value: '90days', label: '近 3 個月' },
  { value: '180days', label: '近半年' },
  { value: '365days', label: '近一年' },
];

export default function Stats() {


  const [isLoading, setIsLoading] = useState(true);

  // 獨立控制消費習慣時間範圍
  const [weeklyRange, setWeeklyRange] = useState('90days');
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);

  // 支出占比/明細/對比 的月份（預設當前月份）
  const [baseMonth, setBaseMonth] = useState(() => getSelectedMonth());

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Recharts styling tokens
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

  const navigate = useNavigate();

  // 載入：圓餅圖 & 月度對比 (依月份變動)
  // 載入：圓餅圖 & 月度對比 (依月份變動)
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

  // 獨立載入：消費習慣 (當 weeklyRange 改變時觸發)
  const { data: weeklyStats, isLoading: isWeekLoading } = useQuery({
    queryKey: ['stats-weekly', weeklyRange],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/stats/weekly?range=${weeklyRange}`);
      return res.data || [];
    },
    placeholderData: keepPreviousData,
  });

  const weeklyData = (weeklyStats || []) as WeeklyStat[];

  useEffect(() => {
    setIsWeeklyLoading(isWeekLoading);
  }, [isWeekLoading]);

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

  if (isLoading) {
    return (
      <div className="flex h-64 justify-center items-center text-gray-400 dark:text-neutral-500">
        <Loader2 className="animate-spin mr-2" /> 載入中...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 pt-4">
      <div className="flex flex-col items-start sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-indigo-600 dark:text-indigo-300" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100 shrink-0">每月報表</h2>
        </div>

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
            <PieIcon className="text-indigo-600 dark:text-indigo-300" />
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
                    formatter={(value: number | undefined) =>
                      `NT$ ${Number(value || 0).toLocaleString()}`
                    }
                    contentStyle={tooltipStyle}
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
            <List className="text-indigo-600 dark:text-indigo-300" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Comparison */}
        <div className="bg-white dark:bg-neutral-900 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-indigo-600 dark:text-indigo-300" />
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
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis
                    dataKey="category"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tick={{ fill: axisLabelColor, fontSize: 12 }}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: axisTickColor, fontSize: 12 }} />

                  <BarTooltip content={<CustomBarTooltip />} cursor={{ fill: cursorFill }} />

                  <Bar dataKey="previous" name="上月" fill={isDark ? '#404040' : '#e5e7eb'} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="current" name="本月" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex justify-center items-center text-gray-400 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-950 rounded-lg">
              無資料
            </div>
          )}
        </div>

        {/* Weekly */}
        <div className="bg-white dark:bg-neutral-900 p-4 md:p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-emerald-600 dark:text-emerald-300" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100">消費習慣</h3>
            </div>

            <select
              value={weeklyRange}
              onChange={(e) => setWeeklyRange(e.target.value)}
              className="text-xs md:text-sm border border-gray-200 dark:border-neutral-700 rounded-lg p-1.5
                         bg-gray-50 dark:bg-neutral-950 text-gray-600 dark:text-neutral-200
                         focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-neutral-700 cursor-pointer"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 載入中遮罩 */}
          {isWeeklyLoading && (
            <div className="absolute inset-0 bg-white/60 dark:bg-neutral-950/60 flex items-center justify-center z-10 rounded-xl">
              <Loader2 className="animate-spin text-emerald-500" />
            </div>
          )}

          {weeklyData.length > 0 ? (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: axisLabelColor, fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: axisTickColor, fontSize: 12 }} />

                  <BarTooltip
                    cursor={{ fill: cursorFill }}
                    formatter={(value: number | undefined) => [`NT$ ${(value || 0).toLocaleString()}`, '總支出']}
                    contentStyle={tooltipStyle}
                  />

                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {weeklyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={['週六', '週日'].includes(entry.day) ? '#f59e0b' : '#10b981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
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
}
