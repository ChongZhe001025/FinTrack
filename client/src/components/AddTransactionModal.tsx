/* eslint-disable react-hooks/incompatible-library */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Check, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';

interface Transaction {
  id: string;
  amount: number;
  category_id: string;
  date: string;
  note: string;
}

type TransactionFormInputs = {
  amount: number;
  category_id: string;
  date: string;
  note: string;
};

interface Category {
  id: string;
  name: string;
  type: string;
  order?: number;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editData?: Transaction;
}

const LAST_SELECTED_DATE_KEY = 'fintrack:lastSelectedTransactionDate';

const getDefaultDate = () => {
  if (typeof window === 'undefined') {
    return new Date().toISOString().split('T')[0];
  }
  const saved = localStorage.getItem(LAST_SELECTED_DATE_KEY);
  if (saved) {
    return saved;
  }
  return new Date().toISOString().split('T')[0];
};

const setLastSelectedDate = (value: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_SELECTED_DATE_KEY, value);
};

export default function TransactionModal({ isOpen, onClose, editData }: TransactionModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors },
  } = useForm<TransactionFormInputs>({
    defaultValues: {
      date: getDefaultDate(),
      category_id: '',
    },
  });

  const [selectedType, setSelectedType] = useState<'expense' | 'income'>('expense');
  const [isTypeTouched, setIsTypeTouched] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const filteredCategories = categories.filter((category) => category.type === selectedType);

  // 初始化
  useEffect(() => {
    fetchCategories();
  }, []);

  // 監聽 Modal 開啟與編輯資料
  useEffect(() => {
    if (!isOpen) return;

    if (editData) {
      setValue('amount', editData.amount);
      setValue('category_id', editData.category_id);
      setValue('date', editData.date);
      setValue('note', editData.note);
    } else {
      reset({
        date: getDefaultDate(),
        category_id: '',
        amount: undefined,
        note: '',
      });
      setSelectedType('expense');
    }

    setIsTypeTouched(false);
    setIsAddingCategory(false);
    setNewCategoryName('');
  }, [isOpen, editData, setValue, reset]);

  useEffect(() => {
    if (!isOpen || categories.length === 0) return;

    const currentCategoryId = getValues('category_id');

    // 編輯模式：尚未手動切換收支時，不要動 category_id
    if (editData && !isTypeTouched && currentCategoryId) return;

    const filtered = categories.filter((category) => category.type === selectedType);
    if (filtered.length === 0) return;

    const hasCurrent = filtered.some((category) => category.id === currentCategoryId);
    if (!currentCategoryId || !hasCurrent) {
      setValue('category_id', filtered[0].id);
    }
  }, [isOpen, categories, selectedType, editData, isTypeTouched, getValues, setValue]);

  useEffect(() => {
    if (!isOpen || !editData || categories.length === 0 || isTypeTouched) return;
    const current = categories.find((category) => category.id === editData.category_id);
    if (current && (current.type === 'income' || current.type === 'expense')) {
      setSelectedType(current.type as 'income' | 'expense');
    }
  }, [isOpen, editData, categories, isTypeTouched]);

  // 取得類別列表
  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/v1/categories');
      const data = (res.data || []).slice().sort((a: Category, b: Category) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name, 'zh-Hant');
      });
      setCategories(data);
    } catch (error) {
      console.error('無法取得類別', error);
    }
  };

  // 處理選單變更
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'custom_new_category_trigger') {
      setIsAddingCategory(true);
      // 保持當前選擇，避免跳掉
      const currentCategory = watch('category_id');
      setValue('category_id', currentCategory);
    } else {
      setValue('category_id', value);
    }
  };

  // 執行新增自訂類別
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await axios.post('/api/v1/categories', {
        name: newCategoryName,
        type: selectedType,
      });

      const updatedList = [...categories, res.data].sort((a: Category, b: Category) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name, 'zh-Hant');
      });
      setCategories(updatedList);

      setIsAddingCategory(false);
      setValue('category_id', res.data.id);
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
      await axios.delete(`/api/v1/transactions/${editData.id}`);
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert('刪除失敗');
    }
  };

  // 送出表單
  const onSubmit = async (data: TransactionFormInputs) => {
    try {
      const payload = { ...data, amount: Number(data.amount) };

      if (editData) {
        await axios.put(`/api/v1/transactions/${editData.id}`, payload);
      } else {
        await axios.post('/api/v1/transactions', payload);
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
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-[95%] md:w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-neutral-800">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100">
            {editData ? '編輯紀錄' : '記一筆'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition dark:text-neutral-500 dark:hover:text-neutral-200"
            title="關閉"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 space-y-4">
            {/* 收支切換 */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-neutral-800 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setSelectedType('expense');
                  setIsTypeTouched(true);
                }}
                className={clsx(
                  'py-2 text-sm font-bold rounded-md transition-all',
                  selectedType === 'expense'
                    ? 'bg-white text-red-500 shadow-sm dark:bg-neutral-950 dark:text-rose-300'
                    : 'text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                )}
              >
                支出
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('income');
                  setIsTypeTouched(true);
                }}
                className={clsx(
                  'py-2 text-sm font-bold rounded-md transition-all',
                  selectedType === 'income'
                    ? 'bg-white text-green-500 shadow-sm dark:bg-neutral-950 dark:text-emerald-300'
                    : 'text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                )}
              >
                收入
              </button>
            </div>

            {/* 金額輸入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">金額</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  {...register('amount', { required: true, min: 1 })}
                  className={clsx(
                    'w-full text-3xl font-bold p-3 border rounded-xl focus:ring-2 focus:outline-none transition-colors text-right bg-white dark:bg-neutral-950',
                    errors.amount
                      ? 'border-red-300 focus:ring-red-200 dark:border-red-800 dark:focus:ring-red-900/40'
                      : 'border-gray-200 focus:ring-indigo-100 focus:border-indigo-400 dark:border-neutral-700 dark:focus:ring-neutral-700 dark:focus:border-neutral-600',
                    selectedType === 'expense'
                      ? 'text-red-500 dark:text-rose-300'
                      : 'text-green-500 dark:text-emerald-300'
                  )}
                  placeholder="0"
                  autoFocus={!editData}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 font-bold">
                  NT$
                </span>
              </div>
            </div>

            {/* 日期與類別 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">日期</label>
                <input
                  type="date"
                  {...register('date', {
                    required: true,
                    onChange: (event) => {
                      if (!editData) setLastSelectedDate(event.target.value);
                    },
                  })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:border-indigo-400 dark:focus:border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">類別</label>

                {!isAddingCategory ? (
                  <div className="relative">
                    <select
                      {...register('category_id')}
                      onChange={handleCategoryChange}
                      className="w-full p-2.5 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:border-indigo-400 dark:focus:border-neutral-600 appearance-none"
                    >
                      {filteredCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}

                      <option disabled>──────────</option>

                      <option value="custom_new_category_trigger" className="font-bold text-indigo-600">
                        ＋ 新增自訂類別...
                      </option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-neutral-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 animate-fade-in">
                    <input
                      type="text"
                      placeholder="輸入名稱..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-neutral-950 border border-indigo-300 dark:border-neutral-700 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-neutral-700"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 flex-shrink-0 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
                      title="新增"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelAddCategory}
                      className="bg-gray-100 text-gray-500 p-2.5 rounded-lg hover:bg-gray-200 flex-shrink-0 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                      title="取消"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 備註 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">備註</label>
              <textarea
                {...register('note')}
                rows={2}
                className="w-full p-3 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 rounded-lg focus:outline-none focus:border-indigo-400 dark:focus:border-neutral-600 resize-none"
                placeholder="寫點什麼..."
              ></textarea>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 flex justify-between gap-3">
            {editData ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition flex items-center gap-2
                           dark:text-red-300 dark:hover:bg-neutral-800"
                title="刪除"
              >
                <Trash2 size={18} />
                <span className="hidden md:inline">刪除</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition
                           dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-200
                           dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white dark:shadow-none"
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
