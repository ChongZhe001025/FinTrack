import { useEffect, useState, useMemo, useCallback, forwardRef } from 'react';
import axios from 'axios';
import { Loader2, AlertCircle, Edit2, Filter, ArrowUpDown, ArrowUp, ArrowDown, Calendar, X, Clock, Check, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AddTransactionModal from '../components/AddTransactionModal';
import clsx from 'clsx';

// 1. 引入 DatePicker 相關套件
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { zhTW } from 'date-fns/locale'; 
import { subDays } from 'date-fns'; // ✨ 引入日期計算函式

// 註冊繁體中文語系
registerLocale('zh-TW', zhTW);

interface Transaction {
  id: string;
  amount: number;
  category_id: string;
  date: string;
  note: string;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  order?: number;
}

type SortKey = 'date' | 'category' | 'amount';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

// ✨ 定義快速選取區間選項
const QUICK_RANGES = [
    { label: '近 7 天', days: 7 },
    { label: '近 30 天', days: 30 },
    { label: '近 3 個月', days: 90 },
    { label: '近半年', days: 180 },
    { label: '近一年', days: 365 },
];

const formatDate = (date: Date | null) => {
    if (!date) return '';
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

const formatMonth = (date: Date) => formatDate(date).slice(0, 7);

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>(undefined);

  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category_id') || '';
  const legacyCategoryFilter = searchParams.get('category') || '';
  const monthParam = searchParams.get('month') || '';
  const [currentMonth, setCurrentMonth] = useState(() => monthParam || formatMonth(new Date()));
  const maxMonthStart = new Date();
  maxMonthStart.setHours(0, 0, 0, 0);
  maxMonthStart.setDate(1);
  maxMonthStart.setMonth(maxMonthStart.getMonth() + 12);

  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;

  // ✨ 控制快速選單開關
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [transRes, catRes] = await Promise.all([
            axios.get('/api/v1/transactions'),
            axios.get('/api/v1/categories')
        ]);
        setTransactions(transRes.data || []);
        const categoryData = (catRes.data || []).slice().sort((a: Category, b: Category) => {
          const orderDiff = (a.order ?? 0) - (b.order ?? 0);
          if (orderDiff !== 0) return orderDiff;
          return a.name.localeCompare(b.name, 'zh-Hant');
        });
        setCategories(categoryData);
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

  useEffect(() => {
    const fallbackMonth = formatMonth(new Date());
    const nextMonth = monthParam || fallbackMonth;
    setCurrentMonth(nextMonth);

    const start = new Date(`${nextMonth}-01T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0); // 當月最後一天

    setDateRange([start, end]);
  }, [monthParam]);

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

  const getCategoryName = useCallback(
    (categoryId: string) => categoriesById.get(categoryId)?.name || '未分類',
    [categoriesById]
  );

  const getCategoryType = useCallback(
    (categoryId: string) => categoriesById.get(categoryId)?.type || 'expense',
    [categoriesById]
  );

  const legacyCategoryId = useMemo(() => {
    if (!legacyCategoryFilter) return '';
    const match = categories.find((category) => category.name === legacyCategoryFilter);
    return match?.id || '';
  }, [categories, legacyCategoryFilter]);

  const activeCategoryFilter = categoryFilter || legacyCategoryId;

  const changeMonth = (offset: number) => {
      const date = new Date(`${currentMonth}-01T00:00:00`);
      date.setMonth(date.getMonth() + offset);
      if (date.getTime() > maxMonthStart.getTime()) {
        return;
      }
      const nextMonth = formatMonth(date);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('month', nextMonth);
      setSearchParams(nextParams);
  };

  const [selectedYear, selectedMonth] = currentMonth.split('-').map(Number);
  const selectedMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
  const isNextDisabled =
    Number.isInteger(selectedYear) &&
    Number.isInteger(selectedMonth) &&
    selectedMonthDate.getTime() >= maxMonthStart.getTime();

  const handleEditClick = (transaction: Transaction) => {
      setSelectedTransaction(transaction);
      setIsEditModalOpen(true);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      const nextParams = new URLSearchParams(searchParams);
      if (value) {
          nextParams.set('category_id', value);
      } else {
          nextParams.delete('category_id');
      }
      nextParams.delete('category');
      setSearchParams(nextParams);
  };

  // ✨ 處理快速選取邏輯
  const applyQuickRange = (days: number) => {
      const end = new Date();
      const start = subDays(end, days);
      setDateRange([start, end]);
      setShowQuickMenu(false);
  };

  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const processedTransactions = useMemo(() => {
      let data = [...transactions];
      
      if (activeCategoryFilter) {
          data = data.filter(t => t.category_id === activeCategoryFilter);
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
                  comparison = getCategoryName(a.category_id).localeCompare(getCategoryName(b.category_id), 'zh-Hant');
                  break;
          }

          return direction === 'asc' ? comparison : -comparison;
      });

      return data;
  }, [transactions, activeCategoryFilter, startDate, endDate, sortConfig, getCategoryName]);

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
      if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="text-gray-300 ml-1" />;
      return sortConfig.direction === 'asc' 
        ? <ArrowUp size={14} className="text-indigo-600 ml-1" /> 
        : <ArrowDown size={14} className="text-indigo-600 ml-1" />;
  };

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

  return (
    <div className="space-y-6 relative"> 
      {/* 覆寫 DatePicker 樣式 */}
      <style>{`
        .react-datepicker-wrapper { width: auto; }
      `}</style>

      {/* 點擊遮罩 (當快速選單開啟時，點擊外部關閉) */}
      {showQuickMenu && (
        <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowQuickMenu(false)}
        ></div>
      )}

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <List className="text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-800 shrink-0">交易紀錄</h2>
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
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto relative z-20">
            
            {/* 日期選擇器組合 */}
            <div className="flex items-center gap-2">
                {/* 1. ✨ 快速選取按鈕（移到左邊） */}
                <div className="relative">
                    <button
                    onClick={() => setShowQuickMenu(!showQuickMenu)}
                    className={clsx(
                        "p-2.5 rounded-lg border transition-all hover:bg-gray-50",
                        showQuickMenu
                        ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                        : "border-gray-200 text-gray-500"
                    )}
                    title="快速選取區間"
                    >
                    <Clock size={18} />
                    </button>

                    {showQuickMenu && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 animate-fade-in z-30">
                        <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        快速篩選
                        </div>
                        {QUICK_RANGES.map((range) => {
                        const isSelected =
                            startDate &&
                            endDate &&
                            Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) === range.days;

                        return (
                            <button
                            key={range.days}
                            onClick={() => applyQuickRange(range.days)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between group"
                            >
                            <span>{range.label}</span>
                            {isSelected && <Check size={14} className="text-indigo-600" />}
                            </button>
                        );
                        })}
                    </div>
                    )}
                </div>

                {/* 2. DatePicker */}
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
            </div>

            {/* 類別篩選器 */}
            <div className="w-full md:w-48 relative shrink-0">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <Filter size={16} />
                </div>
                <select
                    value={activeCategoryFilter}
                    onChange={handleFilterChange}
                    className={clsx(
                        "w-full pl-10 pr-10 py-2.5 bg-white border rounded-lg appearance-none text-sm font-medium transition-all cursor-pointer shadow-sm",
                        "focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400",
                        activeCategoryFilter 
                            ? "border-indigo-200 text-indigo-700 bg-indigo-50/50" 
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                    )}
                >
                    <option value="">所有類別</option>
                    <option disabled>──────────</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name}
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
             {(activeCategoryFilter || startDate || endDate) && (
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
                      {getCategoryName(t.category_id)}
                    </span>
                    <div className="md:hidden text-[10px] text-gray-400 mt-1 truncate max-w-[80px]">
                        {t.note}
                    </div>
                  </td>

                  <td className="hidden md:table-cell py-4 px-4 md:px-6 text-sm text-gray-800">
                    {t.note || <span className="text-gray-300">-</span>}
                  </td>

                  <td className={`py-4 px-4 md:px-6 text-xs md:text-sm font-bold text-right whitespace-nowrap ${
                    getCategoryType(t.category_id) === 'income' ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {getCategoryType(t.category_id) === 'expense' ? '' : '+'} 
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
