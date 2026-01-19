import { useEffect, useState, useMemo, forwardRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { TrendingUp, TrendingDown, DollarSign, Loader2, Calendar, X, ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { zhTW } from 'date-fns/locale';
import BudgetSection from '../components/BudgetSection';
import { getSelectedMonth, setSelectedMonth } from '../utils/selectedMonth';
import { useTheme } from '../context/ThemeContext';

interface DashboardStats {
  total_income: number;
  total_expense: number;
  balance: number;
  income_trend?: number;
  expense_trend?: number;
  balance_trend?: number;
  month?: string;
}

type TransactionType = 'income' | 'expense';

interface Transaction {
  amount: number;
  date: string;
  category_id?: string;
  category?: string | null;
  type?: TransactionType;
}

interface ChartData {
  name: string;
  fullDate: string;
  amount: number;
}

interface Category {
  id: string;
  name?: string;
  type: TransactionType;
}

const normalizeObjectId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as { $oid?: string; id?: string; _id?: string };
    if (typeof record.$oid === 'string') return record.$oid;
    if (typeof record.id === 'string') return record.id;
    if (typeof record._id === 'string') return record._id;
  }
  return '';
};

const normalizeAmount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDateString = (value: unknown): string => {
  if (value instanceof Date) {
    const offset = value.getTimezoneOffset();
    const localDate = new Date(value.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  }
  if (value && typeof value === 'object') {
    const record = value as { $date?: string | { $numberLong?: string } };
    if (typeof record.$date === 'string') {
      return normalizeDateString(record.$date);
    }
    if (record.$date && typeof record.$date === 'object') {
      const millis = Number(record.$date.$numberLong);
      if (Number.isFinite(millis)) {
        return normalizeDateString(new Date(millis));
      }
    }
  }
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  const offset = parsed.getTimezoneOffset();
  const localDate = new Date(parsed.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const normalizeTransactionType = (value: unknown): TransactionType | undefined => {
  if (value === 'income' || value === 'expense') return value;
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'income' || lowered === 'expense') {
      return lowered as TransactionType;
    }
  }
  return undefined;
};

const normalizeTransactions = (value: unknown): Transaction[] => {
  let raw: unknown[] = [];
  if (Array.isArray(value)) {
    raw = value;
  } else if (value && typeof value === 'object') {
    const record = value as { data?: unknown; transactions?: unknown };
    if (Array.isArray(record.data)) {
      raw = record.data;
    } else if (Array.isArray(record.transactions)) {
      raw = record.transactions;
    }
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const date = normalizeDateString(record.date);
      if (!date) return null;
      const amount = normalizeAmount(record.amount);
      const categoryId = normalizeObjectId(record.category_id ?? record.categoryId);
      const category = typeof record.category === 'string' ? record.category : undefined;
      const type = normalizeTransactionType(record.type);
      const result: Transaction = { amount, date };
      if (categoryId) {
        result.category_id = categoryId;
      }
      if (category) {
        result.category = category;
      }
      if (type) {
        result.type = type;
      }
      return result;
    })
    .filter((item): item is Transaction => item !== null);
};

const normalizeCategories = (value: unknown): Category[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const id = normalizeObjectId(record.id ?? record._id);
      const type = normalizeTransactionType(record.type);
      if (!id || !type) return null;
      const name = typeof record.name === 'string' ? record.name : undefined;
      const result: Category = { id, type };
      if (name) {
        result.name = name;
      }
      return result;
    })
    .filter((item): item is Category => item !== null);
};

const normalizeStats = (value: unknown): DashboardStats => {
  const fallback = { total_income: 0, total_expense: 0, balance: 0 };
  if (!value || typeof value !== 'object') return fallback;
  const record = value as Record<string, unknown>;
  const payload =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : record;

  return {
    total_income: normalizeAmount(payload.total_income),
    total_expense: normalizeAmount(payload.total_expense),
    balance: normalizeAmount(payload.balance),
    income_trend: typeof payload.income_trend === 'number' ? payload.income_trend : undefined,
    expense_trend: typeof payload.expense_trend === 'number' ? payload.expense_trend : undefined,
    balance_trend: typeof payload.balance_trend === 'number' ? payload.balance_trend : undefined,
    month: typeof payload.month === 'string' ? payload.month : undefined,
  };
};

const resolveTransactionType = (
  transaction: Transaction,
  typeById: Map<string, TransactionType>,
  typeByName: Map<string, TransactionType>
): TransactionType | undefined => {
  if (transaction.type) return transaction.type;
  if (transaction.category_id) {
    const type = typeById.get(transaction.category_id);
    if (type) return type;
  }
  if (transaction.category) {
    const type = typeByName.get(transaction.category);
    if (type) return type;
  }
  return undefined;
};

// 註冊繁體中文語系
registerLocale('zh-TW', zhTW);

const formatDate = (date: Date | null) => {
  if (!date) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const formatDisplayDate = (date: Date | null) => {
  const value = formatDate(date);
  return value ? value.replace(/-/g, '/') : '';
};

// 1. 修改：加入 'custom' 選項
type TimeRange = '7days' | '30days' | 'thisMonth' | 'custom';

const StatCard = ({ title, amount, type }: { title: string, amount: string, type: 'income' | 'expense' | 'balance' }) => {
  const colors = {
    income: "bg-green-50 text-green-600 dark:bg-emerald-950/40 dark:text-emerald-300",
    expense: "bg-red-50 text-red-600 dark:bg-rose-950/40 dark:text-rose-300",
    balance: "bg-indigo-50 text-indigo-600 dark:bg-neutral-800 dark:text-neutral-200"
  }
  const icons = {
    income: <TrendingUp size={24} />,
    expense: <TrendingDown size={24} />,
    balance: <DollarSign size={24} />
  }

  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm flex items-center justify-between transition hover:shadow-md">
      <div>
        <p className="text-sm text-gray-500 dark:text-neutral-400 font-medium">{title}</p>
        <h3 className={`text-2xl font-bold mt-1 ${type === 'income' ? 'text-green-600 dark:text-emerald-300' :
          type === 'expense' ? 'text-gray-900 dark:text-neutral-100' : 'text-indigo-600 dark:text-neutral-200'
          }`}>
          {amount}
        </h3>
      </div>
      <div className={`p-3 rounded-full ${colors[type]}`}>
        {icons[type]}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(() => getSelectedMonth());
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axisTickColor = isDark ? '#a3a3a3' : '#9ca3af';
  const gridStroke = isDark ? '#262626' : '#f0f0f0';
  const chartAccent = isDark ? '#d4d4d4' : '#4f46e5';
  const tooltipStyle = {
    borderRadius: '8px',
    border: isDark ? '1px solid #262626' : 'none',
    backgroundColor: isDark ? '#0f0f0f' : '#ffffff',
    color: isDark ? '#e5e5e5' : '#111827',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  };
  const maxMonthStart = new Date();
  maxMonthStart.setHours(0, 0, 0, 0);
  maxMonthStart.setDate(1);
  maxMonthStart.setMonth(maxMonthStart.getMonth() + 12);

  // 2. 新增：自訂區間的開始與結束日期
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', currentMonth],
    queryFn: async () => {
      const [statsRes, transRes, catRes] = await Promise.all([
        axios.get('/api/v1/stats', { params: { month: currentMonth } }),
        axios.get('/api/v1/transactions'),
        axios.get('/api/v1/categories')
      ]);
      return {
        stats: normalizeStats(statsRes.data),
        transactions: normalizeTransactions(transRes.data),
        categories: normalizeCategories(catRes.data)
      };
    },
    placeholderData: keepPreviousData,
  });

  const stats = dashboardData?.stats || { total_income: 0, total_expense: 0, balance: 0 };
  const transactions = useMemo(() => dashboardData?.transactions || [], [dashboardData]);
  const categories = useMemo(() => dashboardData?.categories || [], [dashboardData]);

  const changeMonth = (offset: number) => {
    const date = new Date(currentMonth + "-01");
    date.setMonth(date.getMonth() + offset);
    if (date.getTime() > maxMonthStart.getTime()) {
      return;
    }
    const nextMonth = date.toISOString().slice(0, 7);
    setSelectedMonth(nextMonth);
    setCurrentMonth(nextMonth);
  };
  const [selectedYear, selectedMonth] = currentMonth.split('-').map(Number);
  const selectedMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
  const isNextDisabled =
    Number.isInteger(selectedYear) &&
    Number.isInteger(selectedMonth) &&
    selectedMonthDate.getTime() >= maxMonthStart.getTime();
  const now = new Date();
  const isCurrentMonth =
    Number.isInteger(selectedYear) &&
    Number.isInteger(selectedMonth) &&
    selectedYear === now.getFullYear() &&
    selectedMonth === now.getMonth() + 1;
  const effectiveTimeRange = !isCurrentMonth && timeRange === '7days' ? 'thisMonth' : timeRange;

  useEffect(() => {
    if (!isCurrentMonth && timeRange === '7days') {
      setTimeRange('thisMonth');
    }
  }, [isCurrentMonth, timeRange]);

  const categoryTypeById = useMemo(() => {
    const map = new Map<string, TransactionType>();
    categories.forEach((category) => {
      if (category.id) {
        map.set(category.id, category.type);
      }
    });
    return map;
  }, [categories]);

  const categoryTypeByName = useMemo(() => {
    const map = new Map<string, TransactionType>();
    categories.forEach((category) => {
      if (category.name) {
        map.set(category.name, category.type);
      }
    });
    return map;
  }, [categories]);

  // 3. 修改 useMemo 邏輯，加入 custom 判斷
  const chartData = useMemo<ChartData[]>(() => {
    const now = new Date();
    const dailyExpenses = new Map<string, number>();
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    const [yearText, monthText] = currentMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const isValidMonth = Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12;
    const selectedMonthStart = isValidMonth
      ? new Date(year, month - 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    selectedMonthStart.setHours(0, 0, 0, 0);

    const selectedMonthEndExclusive = new Date(selectedMonthStart);
    selectedMonthEndExclusive.setMonth(selectedMonthEndExclusive.getMonth() + 1);

    const rangeEndExclusive = isCurrentMonth
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      : selectedMonthEndExclusive;

    const cutoffDate = new Date(rangeEndExclusive);
    cutoffDate.setHours(0, 0, 0, 0);
    if (effectiveTimeRange === '7days') {
      cutoffDate.setDate(cutoffDate.getDate() - 7);
    } else if (effectiveTimeRange === '30days') {
      cutoffDate.setDate(cutoffDate.getDate() - 30);
    }
    // 注意：如果是 'custom'，我們會在下面迴圈內直接比較 startStr 和 endStr

    transactions.forEach(t => {
      if (resolveTransactionType(t, categoryTypeById, categoryTypeByName) !== 'expense') {
        return;
      }
      const tDate = new Date(t.date);
      if (Number.isNaN(tDate.getTime())) return;
      // 清除時分秒，確保只比對日期
      tDate.setHours(0, 0, 0, 0);

      let isValid = false;

      if (effectiveTimeRange === 'thisMonth') {
        isValid = tDate >= selectedMonthStart && tDate < selectedMonthEndExclusive;
      } else if (effectiveTimeRange === 'custom') {
        // 自訂區間邏輯：比對交易日期是否在 Start 和 End 之間
        isValid = (!startStr || t.date >= startStr) && (!endStr || t.date <= endStr);
      } else {
        // 7天 或 30天
        isValid = tDate >= cutoffDate && tDate < rangeEndExclusive;
      }

      if (isValid) {
        const current = dailyExpenses.get(t.date) || 0;
        dailyExpenses.set(t.date, current + t.amount);
      }
    });

    return Array.from(dailyExpenses.entries())
      .map(([date, amount]) => ({
        name: date.slice(5),
        fullDate: date,
        amount
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [transactions, categoryTypeById, categoryTypeByName, effectiveTimeRange, startDate, endDate, currentMonth, isCurrentMonth]); // 注意：這裡要加入 startDate, endDate 到依賴陣列

  const derivedStats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let matchedCount = 0;

    transactions.forEach((transaction) => {
      const dateKey = transaction.date.slice(0, 7);
      if (dateKey !== currentMonth) return;
      const type = resolveTransactionType(transaction, categoryTypeById, categoryTypeByName);
      if (!type) return;
      matchedCount += 1;
      if (type === 'income') {
        totalIncome += transaction.amount;
      } else {
        totalExpense += transaction.amount;
      }
    });

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      balance: totalIncome - totalExpense,
      matchedCount,
    };
  }, [transactions, currentMonth, categoryTypeById, categoryTypeByName]);

  const displayStats = useMemo<DashboardStats>(() => {
    if (derivedStats.matchedCount > 0) {
      return {
        total_income: derivedStats.total_income,
        total_expense: derivedStats.total_expense,
        balance: derivedStats.balance,
      };
    }
    return stats;
  }, [stats, derivedStats]);

  // 4. 自訂 DatePicker 的 Trigger 按鈕元件
  // 使用 forwardRef 讓 DatePicker 可以綁定點擊事件
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomDateInput = forwardRef(({ value, onClick }: any, ref: any) => (
    <div
      className={clsx(
        "flex items-center gap-2 bg-white dark:bg-neutral-900 border px-3 py-2 rounded-lg cursor-pointer transition-all w-full md:w-auto min-w-[240px]",
        value
          ? "border-indigo-300 text-indigo-700 bg-indigo-50/30 dark:border-neutral-600 dark:text-neutral-100 dark:bg-neutral-800"
          : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600"
      )}
      onClick={onClick}
      ref={ref}
    >
      <Calendar size={18} className={value ? "text-indigo-500 dark:text-neutral-200" : "text-gray-400 dark:text-neutral-500"} />

      <span className="flex-1 text-sm font-medium">
        {value || "選擇日期區間"}
      </span>

      {value && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setDateRange([null, null]);
          }}
          className="p-1 hover:bg-black/10 rounded-full text-gray-400 hover:text-gray-600 transition dark:text-neutral-500 dark:hover:text-neutral-200 dark:hover:bg-neutral-800"
          title="清除日期"
        >
          <X size={14} />
        </div>
      )}
    </div>
  ));

  if (isLoading) {
    return (
      <div className="flex h-64 justify-center items-center text-gray-400 dark:text-neutral-500">
        <Loader2 className="animate-spin mr-2" /> 數據載入中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 覆寫 DatePicker 樣式 */}
      <style>{`
        .react-datepicker-wrapper { width: auto; }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="text-indigo-600 dark:text-indigo-300" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100 shrink-0">月度概況</h2>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-900 p-1 rounded-lg border border-gray-100 dark:border-neutral-800">
          <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white hover:shadow-sm rounded transition dark:hover:bg-neutral-800">
            <ChevronLeft size={18} className="text-gray-600 dark:text-neutral-300" />
          </button>
          <span className="font-bold text-gray-700 dark:text-neutral-100 w-20 text-center">{currentMonth}</span>
          <button
            onClick={() => changeMonth(1)}
            disabled={isNextDisabled}
            className={`p-1 rounded transition ${isNextDisabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-white hover:shadow-sm dark:hover:bg-neutral-800'
              }`}
          >
            <ChevronRight size={18} className="text-gray-600 dark:text-neutral-300" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="月收入" amount={`NT$ ${displayStats.total_income.toLocaleString()}`} type="income" />
        <StatCard title="月支出" amount={`NT$ ${displayStats.total_expense.toLocaleString()}`} type="expense" />
        <StatCard title="月結餘" amount={`NT$ ${displayStats.balance.toLocaleString()}`} type="balance" />
      </div>

      <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
        {/* 標題與篩選器區域 - 為了適應手機版，改為 flex-wrap */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100 flex items-center gap-2">
            支出趨勢
            {/* 5. 當選擇自訂時，顯示日期區間 */}
            {timeRange === 'custom' && (startDate || endDate) && (
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-900 px-2 py-1 rounded-md animate-fade-in">
                <Calendar size={14} />
                <span>{formatDisplayDate(startDate) || '開始日期'}</span>
                <span>➔</span>
                <span>{formatDisplayDate(endDate) || '結束日期'}</span>
              </div>
            )}
          </h3>

          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            <div className="flex bg-gray-100 dark:bg-neutral-900 p-1 rounded-lg w-full md:w-auto">
              {[
                { key: '7days', label: '近 7 天', disabled: !isCurrentMonth },
                { key: 'thisMonth', label: '本月' },
                { key: 'custom', label: '自訂' }, // 新增按鈕
              ].map((item) => {
                const isDisabled = Boolean(item.disabled);
                const isActive = effectiveTimeRange === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      if (!isDisabled) {
                        setTimeRange(item.key as TimeRange);
                      }
                    }}
                    disabled={isDisabled}
                    title={isDisabled ? '近 7 天僅支援當前月份' : undefined}
                    className={clsx(
                      "flex-1 md:flex-none px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap",
                      isActive
                        ? "bg-white text-indigo-600 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                        : isDisabled
                          ? "text-gray-400 cursor-not-allowed dark:text-neutral-600"
                          : "text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* 6. 自訂日期的輸入框 (只有選中 'custom' 時才顯示) */}
            {timeRange === 'custom' && (
              <DatePicker
                selectsRange={true}
                startDate={startDate}
                endDate={endDate}
                onChange={(update) => setDateRange(update)}
                isClearable={false}
                dateFormat="yyyy/MM/dd"
                locale="zh-TW"
                customInput={<CustomDateInput />}
              />
            )}
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartAccent} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={chartAccent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: axisTickColor, fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: axisTickColor, fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number | undefined) => `NT$ ${Number(value || 0).toLocaleString()}`}
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke={chartAccent}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAmount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-900 rounded-lg">
            <TrendingDown size={32} className="mb-2 opacity-50" />
            <p>該區間尚無支出資料</p>
          </div>
        )}
      </div>

      <BudgetSection month={currentMonth} />
    </div>
  );
}
