import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast, { Toaster } from 'react-hot-toast';

interface FixedExpense {
    id: string;
    amount: number;
    category_id: string;
    note: string;
    day: number;
}

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
}

interface FixedExpenseForm {
    amount: number;
    category_id: string;
    note: string;
    day: number;
}

export default function FixedExpenses() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch Categories
    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await axios.get('/api/v1/categories');
            return res.data;
        },
    });

    const expenseCategories = useMemo(() =>
        categories.filter(c => c.type === 'expense'),
        [categories]
    );

    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '未分類';

    // Fetch Fixed Expenses
    const { data: expenses = [], isLoading } = useQuery<FixedExpense[]>({
        queryKey: ['fixed-expenses'],
        queryFn: async () => {
            const res = await axios.get('/api/v1/fixed-expenses');
            return res.data;
        },
    });

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async (data: FixedExpenseForm) => {
            await axios.post('/api/v1/fixed-expenses', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
            // Invalidate transactions too since creating one adds a transaction
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            setIsModalOpen(false);
            reset();
            toast.success('已新增固定支出');
        },
        onError: () => {
            toast.error('新增失敗');
        }
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await axios.delete(`/api/v1/fixed-expenses/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
            toast.success('已刪除固定支出');
        },
        onError: () => {
            toast.error('刪除失敗');
        }
    });

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FixedExpenseForm>();

    const onSubmit = (data: FixedExpenseForm) => {
        // 確保數字正確轉型
        createMutation.mutate({
            ...data,
            amount: Number(data.amount),
            day: Number(data.day),
        });
    };

    return (
        <div className="space-y-6">
            <Toaster position="top-center" />
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100 flex items-center gap-2">
                    <Calendar className="text-indigo-600 dark:text-indigo-400" />
                    每月固定支出設定
                </h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition font-medium shadow-sm dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                >
                    <Plus size={18} /> 新增設定
                </button>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
                {isLoading ? (
                    <div className="p-12 flex justify-center text-gray-400 dark:text-neutral-500">
                        <Loader2 className="animate-spin mr-2" /> 載入中...
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 dark:text-neutral-500">
                        <p>目前沒有固定支出設定</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-neutral-950 border-b border-gray-100 dark:border-neutral-800 text-sm font-semibold text-gray-600 dark:text-neutral-300">
                                    <tr>
                                        <th className="py-4 px-6">每月扣款日</th>
                                        <th className="py-4 px-6">類別</th>
                                        <th className="py-4 px-6">金額</th>
                                        <th className="py-4 px-6">備註</th>
                                        <th className="py-4 px-6 w-20">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {expenses.map((exp) => (
                                        <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition">
                                            <td className="py-4 px-6 text-gray-800 dark:text-neutral-200">
                                                每月 <span className="font-bold text-indigo-600 dark:text-indigo-400">{exp.day}</span> 號
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300">
                                                    {getCategoryName(exp.category_id)}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 font-bold text-gray-900 dark:text-neutral-100">
                                                NT$ {exp.amount.toLocaleString()}
                                            </td>
                                            <td className="py-4 px-6 text-gray-600 dark:text-neutral-400 text-sm">
                                                {exp.note || '-'}
                                            </td>
                                            <td className="py-4 px-6">
                                                <button
                                                    onClick={() => {
                                                        if (confirm('確定要刪除此固定支出設定嗎？')) {
                                                            deleteMutation.mutate(exp.id);
                                                        }
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                                                    title="刪除"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden grid grid-cols-1 divide-y divide-gray-100 dark:divide-neutral-800">
                            {expenses.map((exp) => (
                                <div key={exp.id} className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-center bg-indigo-50 dark:bg-neutral-800 rounded-lg p-2 min-w-[50px]">
                                                <span className="text-[10px] text-gray-500 dark:text-neutral-400">每月</span>
                                                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{exp.day}</span>
                                                <span className="text-[10px] text-gray-500 dark:text-neutral-400">日</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300">
                                                        {getCategoryName(exp.category_id)}
                                                    </span>
                                                </div>
                                                <div className="font-bold text-lg text-gray-900 dark:text-neutral-100">
                                                    NT$ {exp.amount.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (confirm('確定要刪除此固定支出設定嗎？')) {
                                                    deleteMutation.mutate(exp.id);
                                                }
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    {exp.note && (
                                        <div className="text-sm text-gray-500 dark:text-neutral-400 pl-[62px]">
                                            {exp.note}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center zs-50 p-4 z-50 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-scale-in border border-gray-100 dark:border-neutral-800">
                        <div className="p-6 border-b border-gray-100 dark:border-neutral-800">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-100">新增固定支出</h3>
                            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">設定後，系統將於每月指定日期自動記帳</p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">扣款日 (每月1-31號)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="31"
                                    {...register("day", { required: "請輸入扣款日", min: 1, max: 31 })}
                                    className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition"
                                    placeholder="例如: 5"
                                />
                                {errors.day && <span className="text-red-500 text-xs mt-1">{errors.day.message}</span>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">類別</label>
                                <select
                                    {...register("category_id", { required: "請選擇類別" })}
                                    className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition appearance-none"
                                >
                                    <option value="">選擇類別</option>
                                    {expenseCategories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                {errors.category_id && <span className="text-red-500 text-xs mt-1">{errors.category_id.message}</span>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">金額</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    {...register("amount", { required: "請輸入金額", min: 1 })}
                                    className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition"
                                    placeholder="0"
                                />
                                {errors.amount && <span className="text-red-500 text-xs mt-1">{errors.amount.message}</span>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">備註 (選填)</label>
                                <input
                                    {...register("note")}
                                    className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition"
                                    placeholder="例如: 房租、Spotify"
                                />
                            </div>

                            {/* 提示訊息 */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex gap-2 text-sm text-blue-700 dark:text-blue-300">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <p>新增後，系統會立即為「本月」建立一筆交易紀錄。</p>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
                                    disabled={createMutation.isPending}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-sm disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                                    disabled={createMutation.isPending}
                                >
                                    {createMutation.isPending ? '處理中...' : '確認新增'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
