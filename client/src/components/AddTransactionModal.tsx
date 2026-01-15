import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Check, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';

// 1. 定義預設類別的顯示名稱 (中文 + Icon)
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
  type: 'expense' | 'income';
  amount: number;
  category: string;
  date: string;
  note: string;
}

type TransactionFormInputs = {
  type: 'expense' | 'income';
  amount: number;
  category: string;
  date: string;
  note: string;
};

interface Category {
  id: string;
  name: string;
  type: string;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editData?: Transaction; 
}

export default function TransactionModal({ isOpen, onClose, editData }: TransactionModalProps) {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<TransactionFormInputs>({
    defaultValues: {
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      category: 'Food'
    }
  });

  const type = watch('type');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // 初始化
  useEffect(() => {
    fetchCategories();
  }, []);

  // 監聽 Modal 開啟與編輯資料
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        // 編輯模式
        setValue('type', editData.type);
        setValue('amount', editData.amount);
        setValue('category', editData.category);
        setValue('date', editData.date);
        setValue('note', editData.note);
      } else {
        // 新增模式：重置表單
        reset({
            type: 'expense',
            date: new Date().toISOString().split('T')[0],
            category: 'Food', // 預設值
            amount: undefined,
            note: ''
        });
      }
      setIsAddingCategory(false);
      setNewCategoryName('');
    }
  }, [isOpen, editData, setValue, reset]);

  // 取得類別列表
  const fetchCategories = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/v1/categories');
      setCategories(res.data || []);
    } catch (error) {
      console.error("無法取得類別", error);
    }
  };

  // 處理選單變更
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value === 'custom_new_category_trigger') {
          setIsAddingCategory(true);
          // 保持當前選擇，避免跳掉
          const currentCategory = watch('category');
          setValue('category', currentCategory); 
      } else {
          setValue('category', value);
      }
  };

  // 執行新增自訂類別
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await axios.post('http://localhost:8080/api/v1/categories', {
        name: newCategoryName,
        type: type 
      });
      
      const updatedList = [...categories, res.data];
      setCategories(updatedList);
      
      setIsAddingCategory(false);
      setValue('category', res.data.name);
      setNewCategoryName('');
    } catch (error) {
      console.error(error); 
      alert('新增類別失敗');
    }
  };

  const cancelAddCategory = () => {
      setIsAddingCategory(false);
      setNewCategoryName('');
  };

  // 刪除交易
  const handleDelete = async () => {
      if (!editData || !confirm('確定要刪除這筆紀錄嗎？')) return;
      try {
          await axios.delete(`http://localhost:8080/api/v1/transactions/${editData.id}`);
          window.location.reload();
      } catch (error) {
          console.error(error);
          alert('刪除失敗');
      }
  }

  // 送出表單
  const onSubmit = async (data: TransactionFormInputs) => {
    try {
      const payload = { ...data, amount: Number(data.amount) };

      if (editData) {
        await axios.put(`http://localhost:8080/api/v1/transactions/${editData.id}`, payload);
      } else {
        await axios.post('http://localhost:8080/api/v1/transactions', payload);
      }
      
      onClose();
      window.location.reload(); 

    } catch (error) {
      console.error('操作失敗:', error);
      alert('操作失敗，請檢查後端連線');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-[95%] md:w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">
             {editData ? '編輯紀錄' : '記一筆'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 space-y-4">
            
            {/* 收支切換 */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setValue('type', 'expense')}
                className={clsx(
                  "py-2 text-sm font-bold rounded-md transition-all",
                  type === 'expense' ? "bg-white text-red-500 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                支出
              </button>
              <button
                type="button"
                onClick={() => setValue('type', 'income')}
                className={clsx(
                  "py-2 text-sm font-bold rounded-md transition-all",
                  type === 'income' ? "bg-white text-green-500 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                收入
              </button>
            </div>

            {/* 金額輸入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">金額</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  {...register('amount', { required: true, min: 1 })}
                  className={clsx(
                    "w-full text-3xl font-bold p-3 border rounded-xl focus:ring-2 focus:outline-none transition-colors text-right",
                    errors.amount ? "border-red-300 focus:ring-red-200" : "border-gray-200 focus:ring-indigo-100 focus:border-indigo-400",
                    type === 'expense' ? "text-red-500" : "text-green-500"
                  )}
                  placeholder="0"
                  autoFocus={!editData}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">NT$</span>
              </div>
            </div>

            {/* 日期與類別 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                <input
                  type="date"
                  {...register('date', { required: true })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">類別</label>
                
                {!isAddingCategory ? (
                    <div className="relative">
                        <select
                        {...register('category')}
                        onChange={handleCategoryChange}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 appearance-none"
                        >
                            {/* 2. 顯示類別：如果有 Mapping 就顯示中文，否則顯示原始名稱 */}
                            {categories.map(c => (
                                <option key={c.id} value={c.name}>
                                    {CATEGORY_LABELS[c.name] || c.name}
                                </option>
                            ))}
                            
                            <option disabled>──────────</option>
                            
                            <option value="custom_new_category_trigger" className="font-bold text-indigo-600">
                                ＋ 新增自訂類別...
                            </option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2 animate-fade-in">
                        <input 
                            type="text" 
                            placeholder="輸入名稱..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="w-full p-2.5 bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            autoFocus
                        />
                        <button 
                            type="button" 
                            onClick={handleAddCategory}
                            className="bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 flex-shrink-0"
                        >
                            <Check size={18} />
                        </button>
                        <button 
                            type="button" 
                            onClick={cancelAddCategory}
                            className="bg-gray-100 text-gray-500 p-2.5 rounded-lg hover:bg-gray-200 flex-shrink-0"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}
              </div>
            </div>

            {/* 備註 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
              <textarea
                {...register('note')}
                rows={2}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 resize-none"
                placeholder="寫點什麼..."
              ></textarea>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between gap-3">
             {editData ? (
                 <button
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition flex items-center gap-2"
                 >
                    <Trash2 size={18} />
                    <span className="hidden md:inline">刪除</span>
                 </button>
             ) : (
                 <div></div> 
             )}

             <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition"
                >
                    取消
                </button>
                <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                    <Check size={18} />
                    {editData ? '更新' : '儲存'}
                </button>
             </div>
          </div>
        </form>
      </div>
    </div>
  );
}