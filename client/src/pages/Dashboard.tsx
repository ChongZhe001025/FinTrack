import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, DollarSign, Loader2, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

interface DashboardStats {
  total_income: number;
  total_expense: number;
  balance: number;
}

interface Transaction {
  amount: number;
  date: string;
  type: 'income' | 'expense';
}

interface ChartData {
  name: string;
  fullDate: string;
  amount: number;
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
  const [isLoading, setIsLoading] = useState(true);
  
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  
  // 2. 新增：自訂區間的開始與結束日期 (預設為今天)
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, transRes] = await Promise.all([
            axios.get('/api/v1/stats'),
            axios.get('/api/v1/transactions')
        ]);
        setStats(statsRes.data);
        const normalizedTransactions = normalizeTransactions(transRes.data);
        if (normalizedTransactions.length === 0 && !Array.isArray(transRes.data)) {
          console.warn('Unexpected transactions response:', transRes.data);
        }
        setTransactions(normalizedTransactions);
      } catch (error) {
        console.error("無法取得 Dashboard 資料:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // 3. 修改 useMemo 邏輯，加入 custom 判斷
  const chartData = useMemo<ChartData[]>(() => {
    const now = new Date();
    const dailyExpenses = new Map<string, number>();

    const cutoffDate = new Date();
    // 將 cutoffDate 設為當天的 00:00:00，確保比較準確
    cutoffDate.setHours(0, 0, 0, 0);

    if (timeRange === '7days') {
        cutoffDate.setDate(now.getDate() - 7);
    } else if (timeRange === '30days') {
        cutoffDate.setDate(now.getDate() - 30);
    } else if (timeRange === 'thisMonth') {
        cutoffDate.setDate(1);
    }
    // 注意：如果是 'custom'，我們會在下面迴圈內直接比較 customStart 和 customEnd

    transactions.forEach(t => {
        if (t.type === 'expense') {
            const tDate = new Date(t.date);
            // 清除時分秒，確保只比對日期
            tDate.setHours(0, 0, 0, 0);
            
            let isValid = false;

            if (timeRange === 'thisMonth') {
                isValid = tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
            } else if (timeRange === 'custom') {
                // 自訂區間邏輯：比對交易日期是否在 Start 和 End 之間
                const startDate = new Date(customStart);
                const endDate = new Date(customEnd);
                // 結束日期也包含當天，所以要設為當天比較
                isValid = tDate >= startDate && tDate <= endDate;
            } else {
                // 7天 或 30天
                isValid = tDate >= cutoffDate;
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
  }, [transactions, timeRange, customStart, customEnd]); // 注意：這裡要加入 customStart, customEnd 到依賴陣列

  if (isLoading) {
      return (
        <div className="flex h-64 justify-center items-center text-gray-400">
            <Loader2 className="animate-spin mr-2" /> 數據載入中...
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">本月概況</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="本月收入" amount={`NT$ ${stats.total_income.toLocaleString()}`} type="income" />
        <StatCard title="本月支出" amount={`NT$ ${stats.total_expense.toLocaleString()}`} type="expense" />
        <StatCard title="目前結餘" amount={`NT$ ${stats.balance.toLocaleString()}`} type="balance" />
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        {/* 標題與篩選器區域 - 為了適應手機版，改為 flex-wrap */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                支出趨勢
                {/* 4. 當選擇自訂時，顯示日期選擇器 */}
                {timeRange === 'custom' && (
                    <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded-md animate-fade-in">
                        <Calendar size={14} />
                        <span>{customStart}</span>
                        <span>➔</span>
                        <span>{customEnd}</span>
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

                {/* 5. 自訂日期的輸入框 (只有選中 'custom' 時才顯示) */}
                {timeRange === 'custom' && (
                    <div className="flex items-center gap-2 bg-white border border-gray-200 p-1.5 rounded-lg shadow-sm animate-fade-in w-full md:w-auto">
                        <input 
                            type="date" 
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="text-sm bg-transparent border-none focus:ring-0 text-gray-600 p-0"
                        />
                        <span className="text-gray-400 text-xs">至</span>
                        <input 
                            type="date" 
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="text-sm bg-transparent border-none focus:ring-0 text-gray-600 p-0"
                        />
                    </div>
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
    </div>
  );
}
