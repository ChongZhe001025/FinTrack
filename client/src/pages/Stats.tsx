import { useEffect, useState } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Loader2, PieChart as PieIcon } from 'lucide-react';

// 1. 維持修正後的介面，包含索引簽章
interface CategoryStat {
  category: string;
  amount: number;
  [key: string]: unknown; 
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

const categoryMap: Record<string, string> = {
  Food: '🍔 餐飲',
  Transport: '🚗 交通',
  Shopping: '🛍️ 購物',
  Housing: '🏠 居住',
  Entertainment: '🎬 娛樂',
  Medical: '💊 醫療',
  Salary: '💰 薪水',
  Other: '📝 其他'
};

export default function Stats() {
  const [data, setData] = useState<CategoryStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('http://localhost:8080/api/v1/stats/category');
        setData(res.data || []);
      } catch (error) {
        console.error("無法取得統計資料", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const totalExpense = data.reduce((sum, item) => sum + item.amount, 0);

  if (isLoading) {
    return (
      <div className="flex h-64 justify-center items-center text-gray-400">
        <Loader2 className="animate-spin mr-2" /> 載入中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
        <PieIcon className="text-indigo-600" /> 支出類別分析
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 左側：圓餅圖 */}
        <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm min-h-[350px] md:min-h-[400px] flex flex-col items-center justify-center">
          {data.length > 0 ? (
            <div className="w-full h-[250px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="amount"
                    nameKey="category"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    // 修正重點在此：
                    // 1. 將型別改為 value: number | string | undefined (允許 undefined)
                    // 2. 使用 (value || 0) 確保如果真的是 undefined 則當作 0 處理，避免報錯
                    formatter={(value: number | string | undefined) => `NT$ ${Number(value || 0).toLocaleString()}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconSize={10} 
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <div className="text-gray-400">目前沒有支出資料可供分析</div>
          )}
        </div>

        {/* 右側：詳細列表 */}
        <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4">詳細數據</h3>
          <div className="space-y-3 md:space-y-4">
            {data.map((item, index) => {
              const percent = totalExpense > 0 
                ? ((item.amount / totalExpense) * 100).toFixed(1) 
                : "0.0";
                
              return (
                <div key={item.category} className="flex items-center justify-between p-2 md:p-3 hover:bg-gray-50 rounded-lg transition">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="font-medium text-sm md:text-base text-gray-700">
                      {categoryMap[item.category] || item.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm md:text-base text-gray-900">NT$ {item.amount.toLocaleString()}</p>
                    <p className="text-[10px] md:text-xs text-gray-400">{percent}%</p>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* 總計列 */}
          <div className="mt-4 md:mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
            <span className="text-gray-500 font-medium text-sm md:text-base">總支出</span>
            <span className="text-lg md:text-xl font-bold text-indigo-600">NT$ {totalExpense.toLocaleString()}</span>
          </div>
        </div>

      </div>
    </div>
  );
}