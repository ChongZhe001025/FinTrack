/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Target, Edit3, X, Check, AlertTriangle, ChevronRight, Trash2, Plus } from 'lucide-react';
import clsx from 'clsx';

interface BudgetStatus {
  id: string;
  category: string;
  limit: number;
  spent: number;
  percentage: number;
  year_month: string;
}

interface Category {
  id: string;
  name: string;
  type?: string;
}

interface BudgetSectionProps {
  month: string;
}

export default function BudgetSection({ month }: BudgetSectionProps) {
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal 狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [selectedCategory, setSelectedCategory] = useState('');
  const [amount, setAmount] = useState('');

  // 新增類別相關狀態
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // 1. 初始化資料
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [budgetRes, catRes] = await Promise.all([
        axios.get(`/api/v1/budgets/status?month=${month}`),
        axios.get('/api/v1/categories')
      ]);
      setBudgets(budgetRes.data || []);
      setCategories(catRes.data || []);
    } catch (error) {
      console.error("無法取得預算資料", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month]);

  // 2. 開啟 Modal
  const openModal = (budget?: BudgetStatus) => {
      // 重置新增類別狀態
      setIsAddingCategory(false);
      setNewCategoryName('');

      if (budget) {
          setEditMode(true);
          setEditingId(budget.id);
          setSelectedCategory(budget.category);
          setAmount(budget.limit.toString());
      } else {
          setEditMode(false);
          setEditingId(null);
          // 預設選取第一個類別
          if(categories.length > 0) setSelectedCategory(categories[0].name);
          setAmount('');
      }
      setIsModalOpen(true);
  };

  // 3. 處理類別選單變更 (監聽新增選項)
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value === 'custom_new_category_trigger') {
          setIsAddingCategory(true);
          // 保持當前值，避免跳掉
      } else {
          setSelectedCategory(value);
      }
  };

  // 4. 執行新增自訂類別 (呼叫後端 API)
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      // 預設 type 為 expense (通常預算都是針對支出)
      const res = await axios.post('/api/v1/categories', {
        name: newCategoryName,
        type: 'expense' 
      });
      
      // 更新前端列表
      const updatedList = [...categories, res.data];
      setCategories(updatedList);
      
      // 自動選中新類別並切換回一般模式
      setSelectedCategory(res.data.name);
      setIsAddingCategory(false);
      setNewCategoryName('');
    } catch (error) {
      console.error(error); 
      alert('新增類別失敗');
    }
  };

  const cancelAddCategory = () => {
      setIsAddingCategory(false);
      setNewCategoryName('');
      // 回復到列表第一個選項，避免空值
      if(categories.length > 0) setSelectedCategory(categories[0].name);
  };

  // 5. 儲存預算
  const handleSaveBudget = async () => {
    if (!selectedCategory || !amount) return;
    try {
      await axios.post('/api/v1/budgets', {
        category: selectedCategory,
        amount: Number(amount),
        year_month: month
      });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      alert('設定失敗');
    }
  };

  const handleDeleteBudget = async (id: string) => {
      if(!confirm("確定要刪除此預算設定嗎？")) return;
      try {
          await axios.delete(`/api/v1/budgets/${id}`);
          fetchData();
      } catch (error) {
          console.error(error);
          alert("刪除失敗");
      }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-yellow-400';
    return 'bg-emerald-500';
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
           <Target className="text-rose-500" />
           <h3 className="text-lg font-bold text-gray-800">
              預算規劃與回顧
              <span className="ml-2 text-xs text-gray-400">({month})</span>
           </h3>
        </div>

        <button 
            onClick={() => openModal()}
            className="text-sm flex items-center gap-1 bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition font-medium"
        >
            <Plus size={16} /> 新增預算
        </button>
      </div>

      {isLoading ? (
          <div className="text-gray-400 text-center py-8">讀取中...</div>
      ) : budgets.length === 0 ? (
          <div className="text-gray-400 text-center py-8 bg-gray-50 rounded-lg flex flex-col items-center gap-2">
             <p>本月尚未設定預算</p>
             <button onClick={() => openModal()} className="text-indigo-600 font-bold hover:underline">立即設定</button>
          </div>
      ) : (
          <div className="space-y-6">
              {budgets.map((b) => (
                  <div key={b.id} className="group">
                      <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-700 flex items-center gap-2">
                              {b.category}
                          </span>
                          
                          <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => openModal(b)}
                                className="text-gray-400 hover:text-indigo-600" title="修改"
                              >
                                  <Edit3 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteBudget(b.id)}
                                className="text-gray-400 hover:text-red-500" title="刪除"
                              >
                                  <Trash2 size={14} />
                              </button>
                          </div>
                      </div>
                      
                      <div className="flex justify-between text-xs mb-1.5">
                           <span className={clsx("font-medium", b.percentage > 100 ? "text-red-500" : "text-gray-500")}>
                              已花費: {b.spent.toLocaleString()}
                           </span>
                           <span className="text-gray-400">
                              預算: {b.limit.toLocaleString()}
                           </span>
                      </div>

                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden relative">
                          <div 
                              className={clsx("h-2.5 rounded-full transition-all duration-500", getProgressColor(b.percentage))} 
                              style={{ width: `${Math.min(b.percentage, 100)}%` }}
                          ></div>
                      </div>
                      
                      {b.percentage >= 100 && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-bold animate-pulse">
                              <AlertTriangle size={12} /> 
                              超支 { (b.spent - b.limit).toLocaleString() }
                          </p>
                      )}
                  </div>
              ))}
          </div>
      )}

      {/* 設定預算 Modal */}
      {isModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800">
                        {editMode ? '修改預算' : '新增預算'} ({month})
                    </h3>
                    <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400" /></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">選擇類別</label>
                        
                        {/* 邏輯判斷：如果正在新增類別，顯示輸入框；否則顯示下拉選單 */}
                        {!isAddingCategory ? (
                            <div className="relative">
                                <select 
                                    value={selectedCategory}
                                    onChange={handleCategoryChange}
                                    className="w-full p-2 border rounded-lg bg-white disabled:bg-gray-100 disabled:text-gray-400 appearance-none"
                                    disabled={editMode} // 修改模式下不允許改類別
                                >
                                    {categories.map(c => (
                                        <option key={c.id} value={c.name}>
                                            {c.name}
                                        </option>
                                    ))}
                                    
                                    {/* 只有在「新增預算」時才顯示「新增類別」選項 */}
                                    {!editMode && (
                                        <>
                                            <option disabled>──────────</option>
                                            <option value="custom_new_category_trigger" className="font-bold text-indigo-600">
                                                ＋ 新增自訂類別...
                                            </option>
                                        </>
                                    )}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <ChevronRight size={16} className="rotate-90" />
                                </div>
                            </div>
                        ) : (
                            // 新增類別模式
                            <div className="flex gap-2 animate-fade-in">
                                <input 
                                    type="text" 
                                    placeholder="輸入新類別名稱..."
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    className="w-full p-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                    autoFocus
                                />
                                <button 
                                    onClick={handleAddCategory}
                                    className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 flex-shrink-0"
                                >
                                    <Check size={18} />
                                </button>
                                <button 
                                    onClick={cancelAddCategory}
                                    className="bg-gray-100 text-gray-500 p-2 rounded-lg hover:bg-gray-200 flex-shrink-0"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm text-gray-600 mb-1">預算金額</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="例如: 6000"
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-rose-100 outline-none text-right pr-8"
                                autoFocus={!isAddingCategory}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">元</span>
                        </div>
                    </div>

                    <button 
                        onClick={handleSaveBudget}
                        className="w-full bg-rose-600 text-white py-2 rounded-lg font-bold hover:bg-rose-700 flex justify-center items-center gap-2 transition shadow-lg shadow-rose-200 mt-2"
                    >
                        <Check size={18} /> 儲存設定
                    </button>
                </div>
            </div>
         </div>
      )}
    </div>
  );
}
