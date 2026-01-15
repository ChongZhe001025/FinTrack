import { useEffect, useState, useMemo, forwardRef } from 'react';
import axios from 'axios';
import { Loader2, AlertCircle, Edit2, Filter, ArrowUpDown, ArrowUp, ArrowDown, Calendar, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AddTransactionModal from '../components/AddTransactionModal';
import clsx from 'clsx';

// 1. 引入 DatePicker 相關套件
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { zhTW } from 'date-fns/locale'; 

// 註冊繁體中文語系
registerLocale('zh-TW', zhTW);

// 定義中文映射
const CATEGORY_LABELS: Record<string, string> = {
    Food: '🍔 餐飲',
    Transport: '🚗 交通',
    Shopping: '🛍️ 購物',
    Housing: '🏠 居住',
    Entertainment: '🎬 娛樂',
    Medical: '💊 醫療',
    Salary: '💰 薪水'
};

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  note: string;
}

interface Category {
  id: string;
  name: string;
}

type SortKey = 'date' | 'category' | 'amount';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

const formatDate = (date: Date | null) => {
    if (!date) return '';
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>(undefined);

  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category') || '';

  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [transRes, catRes] = await Promise.all([
            axios.get('/api/v1/transactions'),
            axios.get('/api/v1/categories')
        ]);
        setTransactions(transRes.data || []);
        setCategories(catRes.data || []);
        setError('');
      } catch (err) {
        console.error('API 錯誤:', err);
        setError('無法連接到伺服器');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleEditClick = (transaction: Transaction) => {
      setSelectedTransaction(transaction);
      setIsEditModalOpen(true);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value) {
          setSearchParams({ category: value });
      } else {
          setSearchParams({});
      }
  };

  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const processedTransactions = useMemo(() => {
      let data = [...transactions];
      
      if (categoryFilter) {
          data = data.filter(t => t.category === categoryFilter);
      }

      if (startDate) {
          const startStr = formatDate(startDate);
          data = data.filter(t => t.date >= startStr);
      }
      if (endDate) {
          const endStr = formatDate(endDate);
          data = data.filter(t => t.date <= endStr);
      }

      data.sort((a, b) => {
          const { key, direction } = sortConfig;
          let comparison = 0;

          switch (key) {
              case 'date':
                  comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
                  break;
              case 'amount':
                  comparison = a.amount - b.amount;
                  break;
              case 'category':
                  { const nameA = CATEGORY_LABELS[a.category] || a.category;
                  const nameB = CATEGORY_LABELS[b.category] || b.category;
                  comparison = nameA.localeCompare(nameB, 'zh-Hant');
                  break; }
          }

          return direction === 'asc' ? comparison : -comparison;
      });

      return data;
  }, [transactions, categoryFilter, startDate, endDate, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
      if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="text-gray-300 ml-1" />;
      return sortConfig.direction === 'asc' 
        ? <ArrowUp size={14} className="text-indigo-600 ml-1" /> 
        : <ArrowDown size={14} className="text-indigo-600 ml-1" />;
  };

  // 2. 自訂 DatePicker 的 Trigger 按鈕元件
  // 使用 forwardRef 讓 DatePicker 可以綁定點擊事件
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomDateInput = forwardRef(({ value, onClick }: any, ref: any) => (
    <div 
        className={clsx(
            "flex items-center gap-2 bg-white border px-3 py-2 rounded-lg cursor-pointer transition-all w-full md:w-auto min-w-[240px]",
            // 如果有選日期，邊框加深；沒選則為灰色
            value ? "border-indigo-300 text-indigo-700 bg-indigo-50/30" : "border-gray-200 text-gray-500 hover:border-gray-300"
        )}
        onClick={onClick}
        ref={ref}
    >
        <Calendar size={18} className={value ? "text-indigo-500" : "text-gray-400"} />
        
        <span className="flex-1 text-sm font-medium">
            {value || "選擇日期區間"}
        </span>

        {/* 清除按鈕：只有在有值的時候顯示 */}
        {value && (
            <div 
                onClick={(e) => {
                    e.stopPropagation(); // 防止觸發外層的 DatePicker 開啟
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

  return (
    <div className="space-y-6">
      {/* 覆寫 DatePicker 樣式 */}
      <style>{`
        .react-datepicker-wrapper { width: auto; }
      `}</style>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 shrink-0">交易紀錄</h2>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
            
            {/* 3. 使用自訂 Input 的 DatePicker */}
            <DatePicker
                selectsRange={true}
                startDate={startDate}
                endDate={endDate}
                onChange={(update) => setDateRange(update)}
                isClearable={false} // 我們自己實作清除按鈕
                dateFormat="yyyy/MM/dd"
                locale="zh-TW"
                customInput={<CustomDateInput />} // 使用上面定義的元件
            />

            {/* 類別篩選器 */}
            <div className="w-full md:w-48 relative shrink-0">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <Filter size={16} />
                </div>
                <select
                    value={categoryFilter}
                    onChange={handleFilterChange}
                    className={clsx(
                        "w-full pl-10 pr-10 py-2.5 bg-white border rounded-lg appearance-none text-sm font-medium transition-all cursor-pointer shadow-sm",
                        "focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400",
                        categoryFilter 
                            ? "border-indigo-200 text-indigo-700 bg-indigo-50/50" 
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                    )}
                >
                    <option value="">所有類別</option>
                    <option disabled>──────────</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.name}>
                            {CATEGORY_LABELS[c.name] || c.name}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
            </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 border border-red-100">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        {isLoading ? (
          <div className="p-12 flex justify-center items-center text-gray-400">
            <Loader2 className="animate-spin mr-2" /> 載入中...
          </div>
        ) : processedTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
             <Filter className="opacity-20" size={48} />
             <p>沒有符合篩選條件的交易紀錄</p>
             {(categoryFilter || startDate || endDate) && (
                <button 
                    onClick={() => {
                        setSearchParams({});
                        setDateRange([null, null]);
                    }}
                    className="text-sm text-indigo-600 hover:underline"
                >
                    清除所有篩選條件
                </button>
             )}
          </div>
        ) : (
          <table className="w-full text-left min-w-[350px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-0">
                    <button 
                        onClick={() => handleSort('date')}
                        className="w-full py-4 px-4 md:px-6 flex items-center text-xs md:text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                    >
                        日期 <SortIcon columnKey="date" />
                    </button>
                </th>
                
                <th className="p-0">
                    <button 
                        onClick={() => handleSort('category')}
                        className="w-full py-4 px-4 md:px-6 flex items-center text-xs md:text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                    >
                        類別 <SortIcon columnKey="category" />
                    </button>
                </th>

                <th className="hidden md:table-cell py-4 px-4 md:px-6 text-xs md:text-sm font-semibold text-gray-600 cursor-default">
                    備註
                </th>
                
                <th className="p-0">
                    <button 
                        onClick={() => handleSort('amount')}
                        className="w-full py-4 px-4 md:px-6 flex items-center justify-end text-xs md:text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                    >
                        金額 <SortIcon columnKey="amount" />
                    </button>
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition group cursor-pointer" onClick={() => handleEditClick(t)}>
                  <td className="py-4 px-4 md:px-6 text-xs md:text-sm text-gray-600 whitespace-nowrap">{t.date}</td>
                  
                  <td className="py-4 px-4 md:px-6 text-xs md:text-sm">
                    <span className="px-2 py-1 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-medium bg-gray-100 text-gray-700">
                      {CATEGORY_LABELS[t.category] || t.category}
                    </span>
                    <div className="md:hidden text-[10px] text-gray-400 mt-1 truncate max-w-[80px]">
                        {t.note}
                    </div>
                  </td>

                  <td className="hidden md:table-cell py-4 px-4 md:px-6 text-sm text-gray-800">
                    {t.note || <span className="text-gray-300">-</span>}
                  </td>

                  <td className={`py-4 px-4 md:px-6 text-xs md:text-sm font-bold text-right whitespace-nowrap ${
                    t.type === 'income' ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {t.type === 'expense' ? '' : '+'} 
                    NT$ {t.amount.toLocaleString()}
                  </td>
                  
                  <td className="pr-4 text-gray-300 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit2 size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AddTransactionModal 
        isOpen={isEditModalOpen} 
        onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTransaction(undefined);
        }}
        editData={selectedTransaction} 
      />
    </div>
  );
}
