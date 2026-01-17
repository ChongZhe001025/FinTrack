import { useEffect, useState, useMemo, forwardRef } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, DollarSign, Loader2, Calendar, X, ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { zhTW } from 'date-fns/locale';
import BudgetSection from '../components/BudgetSection';

interface DashboardStats {
  total_income: number;
  total_expense: number;
  balance: number;
  income_trend?: number;
  expense_trend?: number;
  balance_trend?: number;
  month?: string;
}

interface Transaction {
  amount: number;
  date: string;
  category_id: string;
}

interface ChartData {
  name: string;
  fullDate: string;
  amount: number;
}

interface Category {
  id: string;
  type: 'income' | 'expense';
}

const normalizeTransactions = (value: unknown): Transaction[] => {
  if (Array.isArray(value)) {
    return value as Transaction[];
  }
  if (value && typeof value === 'object') {
    const record = value as { data?: unknown; transactions?: unknown };
    if (Array.isArray(record.data)) {
      return record.data as Transaction[];
    }
    if (Array.isArray(record.transactions)) {
      return record.transactions as Transaction[];
    }
  }
  return [];
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
        income: "bg-green-50 text-green-600",
        expense: "bg-red-50 text-red-600",
        balance: "bg-indigo-50 text-indigo-600"
    }
    const icons = {
        income: <TrendingUp size={24} />,
        expense: <TrendingDown size={24} />,
        balance: <DollarSign size={24} />
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between transition hover:shadow-md">
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <h3 className={`text-2xl font-bold mt-1 ${
                    type === 'income' ? 'text-green-600' : 
                    type === 'expense' ? 'text-gray-900' : 'text-indigo-600'
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
  const [stats, setStats] = useState<DashboardStats>({ total_income: 0, total_expense: 0, balance: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const maxMonthStart = new Date();
  maxMonthStart.setHours(0, 0, 0, 0);
  maxMonthStart.setDate(1);
  maxMonthStart.setMonth(maxMonthStart.getMonth() + 12);
  
  // 2. 新增：自訂區間的開始與結束日期
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, transRes, catRes] = await Promise.all([
            axios.get('/api/v1/stats', { params: { month: currentMonth } }),
            axios.get('/api/v1/transactions'),
            axios.get('/api/v1/categories')
        ]);
        setStats(statsRes.data);
        const normalizedTransactions = normalizeTransactions(transRes.data);
        if (normalizedTransactions.length === 0 && !Array.isArray(transRes.data)) {
          console.warn('Unexpected transactions response:', transRes.data);
        }
        setTransactions(normalizedTransactions);
        setCategories(catRes.data || []);
      } catch (error) {
        console.error("無法取得 Dashboard 資料:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentMonth]);

  const changeMonth = (offset: number) => {
    const date = new Date(currentMonth + "-01");
    date.setMonth(date.getMonth() + offset);
    if (date.getTime() > maxMonthStart.getTime()) {
      return;
    }
    setCurrentMonth(date.toISOString().slice(0, 7));
  };
  const [selectedYear, selectedMonth] = currentMonth.split('-').map(Number);
  const selectedMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
  const isNextDisabled =
    Number.isInteger(selectedYear) &&
    Number.isInteger(selectedMonth) &&
    selectedMonthDate.getTime() >= maxMonthStart.getTime();

  const categoryTypeById = useMemo(() => {
    const map = new Map<string, 'income' | 'expense'>();
    categories.forEach((category) => {
      map.set(category.id, category.type);
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

    const isCurrentMonth = selectedMonthStart.getFullYear() === now.getFullYear() &&
        selectedMonthStart.getMonth() === now.getMonth();
    const rangeEndExclusive = isCurrentMonth
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        : selectedMonthEndExclusive;

    const cutoffDate = new Date(rangeEndExclusive);
    cutoffDate.setHours(0, 0, 0, 0);
    if (timeRange === '7days') {
        cutoffDate.setDate(cutoffDate.getDate() - 7);
    } else if (timeRange === '30days') {
        cutoffDate.setDate(cutoffDate.getDate() - 30);
    }
    // 注意：如果是 'custom'，我們會在下面迴圈內直接比較 startStr 和 endStr

    transactions.forEach(t => {
        if (categoryTypeById.get(t.category_id) === 'expense') {
            const tDate = new Date(t.date);
            // 清除時分秒，確保只比對日期
            tDate.setHours(0, 0, 0, 0);
            
            let isValid = false;

            if (timeRange === 'thisMonth') {
                isValid = tDate >= selectedMonthStart && tDate < selectedMonthEndExclusive;
            } else if (timeRange === 'custom') {
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
        }
    });

    return Array.from(dailyExpenses.entries())
        .map(([date, amount]) => ({ 
            name: date.slice(5),
            fullDate: date,
            amount 
        }))
        .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [transactions, categoryTypeById, timeRange, startDate, endDate, currentMonth]); // 注意：這裡要加入 startDate, endDate 到依賴陣列

  // 4. 自訂 DatePicker 的 Trigger 按鈕元件
  // 使用 forwardRef 讓 DatePicker 可以綁定點擊事件
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomDateInput = forwardRef(({ value, onClick }: any, ref: any) => (
    <div 
        className={clsx(
            "flex items-center gap-2 bg-white border px-3 py-2 rounded-lg cursor-pointer transition-all w-full md:w-auto min-w-[240px]",
            value ? "border-indigo-300 text-indigo-700 bg-indigo-50/30" : "border-gray-200 text-gray-500 hover:border-gray-300"
        )}
        onClick={onClick}
        ref={ref}
    >
        <Calendar size={18} className={value ? "text-indigo-500" : "text-gray-400"} />
        
        <span className="flex-1 text-sm font-medium">
            {value || "選擇日期區間"}
        </span>

        {value && (
            <div 
                onClick={(e) => {
                    e.stopPropagation();
                    setDateRange([null, null]);
                }}
                className="p-1 hover:bg-black/10 rounded-full text-gray-400 hover:text-gray-600 transition"
                title="清除日期"
            >
                <X size={14} />
            </div>
        )}
    </div>
  ));

  if (isLoading) {
      return (
        <div className="flex h-64 justify-center items-center text-gray-400">
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
          <LayoutDashboard className="text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-800 shrink-0">月度概況</h2>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-lg">
          <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white hover:shadow-sm rounded transition">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <span className="font-bold text-gray-700 w-20 text-center">{currentMonth}</span>
          <button
            onClick={() => changeMonth(1)}
            disabled={isNextDisabled}
            className={`p-1 rounded transition ${
              isNextDisabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-white hover:shadow-sm'
            }`}
          >
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="月收入" amount={`NT$ ${stats.total_income.toLocaleString()}`} type="income" />
        <StatCard title="月支出" amount={`NT$ ${stats.total_expense.toLocaleString()}`} type="expense" />
        <StatCard title="月結餘" amount={`NT$ ${stats.balance.toLocaleString()}`} type="balance" />
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        {/* 標題與篩選器區域 - 為了適應手機版，改為 flex-wrap */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                支出趨勢
                {/* 5. 當選擇自訂時，顯示日期區間 */}
                {timeRange === 'custom' && (startDate || endDate) && (
                    <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded-md animate-fade-in">
                        <Calendar size={14} />
                        <span>{formatDisplayDate(startDate) || '開始日期'}</span>
                        <span>➔</span>
                        <span>{formatDisplayDate(endDate) || '結束日期'}</span>
                    </div>
                )}
            </h3>
            
            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
                    {[
                        { key: '7days', label: '近 7 天' },
                        { key: 'thisMonth', label: '本月' },
                        { key: 'custom', label: '自訂' }, // 新增按鈕
                    ].map((item) => (
                        <button
                            key={item.key}
                            onClick={() => setTimeRange(item.key as TimeRange)}
                            className={clsx(
                                "flex-1 md:flex-none px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap",
                                timeRange === item.key 
                                    ? "bg-white text-indigo-600 shadow-sm" 
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
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
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                        <Tooltip 
                            formatter={(value: number | undefined) => `NT$ ${Number(value || 0).toLocaleString()}`}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="amount" 
                            stroke="#4f46e5" 
                            strokeWidth={2} 
                            fillOpacity={1} 
                            fill="url(#colorAmount)" 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                <TrendingDown size={32} className="mb-2 opacity-50"/>
                <p>該區間尚無支出資料</p>
            </div>
        )}
      </div>

      <BudgetSection month={currentMonth} />
    </div>
  );
}
