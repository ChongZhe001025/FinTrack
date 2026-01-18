import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as PieTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip
} from 'recharts';
import { Loader2, PieChart as PieIcon, ChevronLeft, ChevronRight, BarChart3, CalendarDays, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  const [pieData, setPieData] = useState<CategoryStat[]>([]);
  const [barData, setBarData] = useState<ComparisonStat[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyStat[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  
  // 1. 新增：獨立控制習慣分析的時間範圍
  const [weeklyRange, setWeeklyRange] = useState('90days');
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);

  // 新增：支出占比/明細/對比 的月份（預設當前月份）
  const [baseMonth, setBaseMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const maxMonthStart = new Date();
  maxMonthStart.setHours(0, 0, 0, 0);
  maxMonthStart.setDate(1);
  maxMonthStart.setMonth(maxMonthStart.getMonth() + 12);

  const changeMonth = (offset: number) => {
    const d = new Date(baseMonth + '-01');
    d.setMonth(d.getMonth() + offset);
    if (d.getTime() > maxMonthStart.getTime()) {
      return;
    }
    setBaseMonth(d.toISOString().slice(0, 7));
  };

  const navigate = useNavigate();

  // 2. 載入：圓餅圖 & 月度對比 (依月份變動)
  useEffect(() => {
    const fetchBaseStats = async () => {
      try {
        const [pieRes, barRes] = await Promise.all([
            axios.get(`/api/v1/stats/category?month=${baseMonth}`),
            axios.get(`/api/v1/stats/comparison?month=${baseMonth}`),
        ]);
        setPieData(pieRes.data || []);
        setBarData(barRes.data || []);
      } catch (error) {
        console.error("無法取得基礎統計資料", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBaseStats();
  }, [baseMonth]);

  // 3. 獨立載入：消費習慣 (當 weeklyRange 改變時觸發)
  useEffect(() => {
      const fetchWeeklyStats = async () => {
          setIsWeeklyLoading(true);
          try {
              // 帶入參數 range
              const res = await axios.get(`/api/v1/stats/weekly?range=${weeklyRange}`);
              setWeeklyData(res.data || []);
          } catch (error) {
              console.error("無法取得消費習慣", error);
          } finally {
              setIsWeeklyLoading(false);
          }
      };
      fetchWeeklyStats();
  }, [weeklyRange]);

  const totalExpense = pieData.reduce((sum, item) => sum + item.amount, 0);
  const [selectedYear, selectedMonth] = baseMonth.split('-').map(Number);
  const selectedMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
  const isNextDisabled =
    Number.isInteger(selectedYear) &&
    Number.isInteger(selectedMonth) &&
    selectedMonthDate.getTime() >= maxMonthStart.getTime();

  const CustomBarTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const currentItem = payload.find((item) => item.dataKey === 'current');
      const previousItem = payload.find((item) => item.dataKey === 'previous');
      return (
        <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg text-sm">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          <p className="text-gray-400">上月: NT$ {previousItem?.value?.toLocaleString()}</p>
          <p className="text-indigo-600">本月: NT$ {currentItem?.value?.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 justify-center items-center text-gray-400">
        <Loader2 className="animate-spin mr-2" /> 載入中...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 pt-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-800 shrink-0">每月報表</h2>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-lg">
          <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white hover:shadow-sm rounded transition">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <span className="font-bold text-gray-700 w-20 text-center">{baseMonth}</span>
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

      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm overflow-y-auto max-h-[400px] flex flex-col">
            <div className="flex items-center gap-2 mb-6 w-full">
                <PieIcon className="text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-800">支出占比</h3>
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
                        formatter={(value: number | undefined) => `NT$ ${Number(value || 0).toLocaleString()}`}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    </PieChart>
                </ResponsiveContainer>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">無數據</div>
            )}
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm overflow-y-auto max-h-[400px]">
          <div className="flex items-center gap-2 mb-6">
            <List className="text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-800">支出明細</h3>
          </div>
          <div className="space-y-3">
            {pieData.map((item, index) => {
              const percent = totalExpense > 0 
                ? ((item.amount / totalExpense) * 100).toFixed(1) 
                : "0.0";
              const categoryQuery = item.categoryId
                ? `category_id=${encodeURIComponent(item.categoryId)}`
                : `category=${encodeURIComponent(item.category)}`;
              return (
                <div 
                    key={item.categoryId || item.category} 
                    onClick={() => navigate(`/transactions?${categoryQuery}&month=${baseMonth}`)}
                    className="flex items-center justify-between p-2 md:p-3 hover:bg-indigo-50 rounded-lg transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="font-medium text-sm text-gray-700 group-hover:text-indigo-700">
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="font-bold text-sm text-gray-900 group-hover:text-indigo-700">NT$ {item.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{percent}%</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <div className="flex items-center gap-2">
                    <BarChart3 className="text-indigo-600" />
                    <h3 className="text-lg font-bold text-gray-800">上月 vs 本月</h3>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-gray-200"></span>
                        <span>上月</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span>
                        <span>本月</span>
                    </div>
                </div>
            </div>
            
            {barData.length > 0 ? (
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                                dataKey="category" 
                                tickFormatter={(val) => val} 
                                axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} interval={0}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                            <BarTooltip content={<CustomBarTooltip />} cursor={{fill: '#f9fafb'}} />
                            <Bar dataKey="previous" name="上月" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="current" name="本月" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-40 flex justify-center items-center text-gray-400 bg-gray-50 rounded-lg">無資料</div>
            )}
          </div>

          <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
                <div className="flex items-center gap-2">
                    <CalendarDays className="text-emerald-600" />
                    <h3 className="text-lg font-bold text-gray-800">消費習慣</h3>
                </div>
                
                {/* 4. 新增：下拉選單 */}
                <select 
                    value={weeklyRange}
                    onChange={(e) => setWeeklyRange(e.target.value)}
                    className="text-xs md:text-sm border border-gray-200 rounded-lg p-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-100 text-gray-600 cursor-pointer"
                >
                    {RANGE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
            
            {/* 載入中遮罩 */}
            {isWeeklyLoading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-xl">
                    <Loader2 className="animate-spin text-emerald-500" />
                </div>
            )}

            {weeklyData.length > 0 ? (
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                                dataKey="day" 
                                axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} 
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                            <BarTooltip 
                                cursor={{fill: '#f9fafb'}}
                                formatter={(value: number | undefined) => [`NT$ ${(value || 0).toLocaleString()}`, '總支出']}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
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
                <div className="h-40 flex justify-center items-center text-gray-400 bg-gray-50 rounded-lg">無資料</div>
            )}
          </div>

      </div>

    </div>
  );
}
