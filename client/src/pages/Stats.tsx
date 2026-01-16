import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as PieTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip
} from 'recharts';
import { Loader2, PieChart as PieIcon, ChevronRight, BarChart3, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BudgetSection from '../components/BudgetSection';

interface CategoryStat {
  category: string;
  amount: number;
  [key: string]: unknown; 
}

interface ComparisonStat {
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

  const navigate = useNavigate();

  // 2. 初始載入：圓餅圖 & 月度對比 (這些不需要常變動)
  useEffect(() => {
    const fetchBaseStats = async () => {
      try {
        const [pieRes, barRes] = await Promise.all([
            axios.get('/api/v1/stats/category'),
            axios.get('/api/v1/stats/comparison'),
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
  }, []);

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

  const CustomBarTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg text-sm">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          <p className="text-indigo-600">本月: NT$ {payload[0]?.value.toLocaleString()}</p>
          <p className="text-gray-400">上月: NT$ {payload[1]?.value.toLocaleString()}</p>
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
    <div className="space-y-6 pb-20">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
        <PieIcon className="text-indigo-600" /> 支出分析
      </h2>

      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm min-h-[350px] flex flex-col items-center justify-center">
            <h3 className="text-base font-bold text-gray-700 mb-4 w-full text-left">本月支出占比</h3>
            {pieData.length > 0 ? (
                <div className="w-full h-[250px]">
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
                        {pieData.map((entry, index) => (
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
                <div className="text-gray-400">無數據</div>
            )}
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm overflow-y-auto max-h-[400px]">
          <h3 className="text-base font-bold text-gray-700 mb-4">支出明細 (點擊查看)</h3>
          <div className="space-y-3">
            {pieData.map((item, index) => {
              const percent = totalExpense > 0 
                ? ((item.amount / totalExpense) * 100).toFixed(1) 
                : "0.0";
              return (
                <div 
                    key={item.category} 
                    onClick={() => navigate(`/transactions?category=${item.category}`)}
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
            <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-800">月度對比 (本月 vs 上月)</h3>
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
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar dataKey="current" name="本月" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="previous" name="上月" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
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

      {/* Row 3: 預算達成率 (新增) */}
      <div className="w-full">
          <BudgetSection />
      </div>
    </div>
  );
}
