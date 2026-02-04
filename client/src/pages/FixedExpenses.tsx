/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, Plus, Trash2, Calendar, GripVertical, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface FixedExpense {
    id: string;
    amount: number;
    category_id: string;
    note: string;
    day: number;
    type: 'income' | 'expense';
    order?: number;
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
    type: 'income' | 'expense';
}

const normalizeObjectId = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
        const record = value as { $oid?: string; id?: string; _id?: string };
        if (typeof record.$oid === 'string') return record.$oid;
        if (typeof record.id === 'string') return record.id;
        if (typeof record._id === 'string') return record._id;
    }
    return '';
};

const normalizeNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeFixedExpenses = (value: unknown): FixedExpense[] => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const record = item as Record<string, unknown>;
            const id = normalizeObjectId(record.id ?? record._id);
            if (!id) return null;
            const categoryId = normalizeObjectId(record.category_id ?? record.categoryId);
            const amount = normalizeNumber(record.amount);
            const day = normalizeNumber(record.day);
            const typeRaw = typeof record.type === 'string' ? record.type.toLowerCase() : '';
            const type: 'income' | 'expense' = typeRaw === 'income' || typeRaw === 'expense' ? (typeRaw as 'income' | 'expense') : 'expense';
            const note = typeof record.note === 'string' ? record.note : '';
            const orderValue = normalizeNumber(record.order, 0);

            const expense: FixedExpense = {
                id,
                amount,
                category_id: categoryId,
                note,
                day,
                type,
            };

            if (Number.isFinite(orderValue) && orderValue > 0) {
                expense.order = orderValue;
            }

            return expense;
        })
        .filter((item): item is FixedExpense => item !== null);
};

export default function FixedExpenses() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
    const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');

    // 拖拉排序狀態
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const dragPointerIdRef = useRef<number | null>(null);

    // Fetch Categories
    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await axios.get('/api/v1/categories');
            return res.data;
        },
    });

    const filteredCategories = useMemo(() =>
        categories.filter(c => c.type === transactionType),
        [categories, transactionType]
    );

    const getCategory = (id: string) => categories.find(c => c.id === id);

    // Fetch Fixed Expenses
    const { data: expenses = [], isLoading } = useQuery<FixedExpense[]>({
        queryKey: ['fixed-expenses'],
        queryFn: async () => {
            const res = await axios.get('/api/v1/fixed-expenses');
            const normalized = normalizeFixedExpenses(res.data);
            return normalized.slice().sort((a: FixedExpense, b: FixedExpense) => {
                const orderDiff = (a.order ?? 0) - (b.order ?? 0);
                if (orderDiff !== 0) return orderDiff;
                return a.day - b.day;
            });
        },
    });

    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FixedExpenseForm>();

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async (data: FixedExpenseForm) => {
            await axios.post('/api/v1/fixed-expenses', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            setIsModalOpen(false);
            reset();
            toast.success('已新增固定交易');
        },
        onError: () => {
            toast.error('新增失敗');
        }
    });

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: FixedExpenseForm }) => {
            await axios.put(`/api/v1/fixed-expenses/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            setIsModalOpen(false);
            setEditingExpense(null);
            reset();
            toast.success('已更新固定交易');
        },
        onError: () => {
            toast.error('更新失敗');
        }
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await axios.delete(`/api/v1/fixed-expenses/${id}`);
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
            if (editingExpense?.id === id) {
                setIsModalOpen(false);
                setEditingExpense(null);
                reset();
            }
            toast.success('已刪除固定交易');
        },
        onError: () => {
            toast.error('刪除失敗');
        }
    });

    // Sorting Helper Functions
    const persistOrder = async (updates: Array<{ id: string; order: number }>) => {
        if (updates.length === 0) return;
        try {
            await Promise.all(updates.map((item) => axios.put(`/api/v1/fixed-expenses/${item.id}`, { order: item.order })));
            queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
        } catch (error) {
            toast.error('排序更新失敗');
        }
    };

    const resetDragState = () => {
        setDraggingId(null);
        setDragOverId(null);
        dragPointerIdRef.current = null;
    };

    const applyReorder = (fromId: string, toId: string) => {
        const fromIndex = expenses.findIndex((e) => e.id === fromId);
        const toIndex = expenses.findIndex((e) => e.id === toId);
        if (fromIndex === -1 || toIndex === -1) return;

        const next = [...expenses];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        const nextWithOrder = next.map((e, index) => ({ ...e, order: index + 1 }));

        // Optimistic update
        queryClient.setQueryData(['fixed-expenses'], nextWithOrder);

        const updates = nextWithOrder
            .map((e) => {
                const previous = expenses.find((prev) => prev.id === e.id);
                const previousOrder = previous?.order ?? 0;
                if (previousOrder !== e.order) {
                    return { id: e.id, order: e.order ?? 0 };
                }
                return null;
            })
            .filter((item): item is { id: string; order: number } => item !== null);

        persistOrder(updates);
    };

    const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, id: string) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
        setDraggingId(id);
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>, id: string) => {
        if (!draggingId || draggingId === id) return;
        event.preventDefault();
        setDragOverId(id);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>, id: string) => {
        event.preventDefault();
        if (!draggingId || draggingId === id) {
            setDragOverId(null);
            return;
        }
        applyReorder(draggingId, id);
        resetDragState();
    };

    const handleDragEnd = () => {
        resetDragState();
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
        if (event.pointerType !== 'touch') return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragPointerIdRef.current = event.pointerId;
        setDraggingId(id);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType !== 'touch') return;
        if (!draggingId || dragPointerIdRef.current !== event.pointerId) return;
        event.preventDefault();

        const target = document.elementFromPoint(event.clientX, event.clientY);
        const row = target?.closest<HTMLElement>('[data-expense-id]');
        const overId = row?.dataset.expenseId;

        if (!overId) {
            if (dragOverId) setDragOverId(null);
            return;
        }
        if (overId === draggingId) {
            if (dragOverId) setDragOverId(null);
            return;
        }
        if (overId !== dragOverId) {
            setDragOverId(overId);
        }
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType !== 'touch') return;
        if (dragPointerIdRef.current !== event.pointerId) return;
        event.preventDefault();

        if (draggingId && dragOverId && draggingId !== dragOverId) {
            applyReorder(draggingId, dragOverId);
        }
        resetDragState();
    };

    const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType !== 'touch') return;
        if (dragPointerIdRef.current !== event.pointerId) return;
        resetDragState();
    };

    const handleEdit = (exp: FixedExpense) => {
        // Find category to set correct type
        const cat = categories.find(c => c.id === exp.category_id);
        if (cat) {
            setTransactionType(cat.type as 'income' | 'expense');
        }

        setEditingExpense(exp);
        setValue('amount', exp.amount);
        setValue('category_id', exp.category_id);
        setValue('note', exp.note);
        setValue('day', exp.day);
        setIsModalOpen(true);
    };

    const onSubmit = (data: FixedExpenseForm) => {
        const payload = {
            ...data,
            amount: Number(data.amount),
            day: Number(data.day),
            type: transactionType,
        };

        if (editingExpense) {
            updateMutation.mutate({ id: editingExpense.id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    return (
        <div className="space-y-6">
            <Toaster position="top-center" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100 flex items-center gap-2">
                    <Calendar className="text-indigo-600 dark:text-neutral-200" />
                    每月固定交易
                </h2>
                <button
                    onClick={() => {
                        setTransactionType('expense');
                        setEditingExpense(null);
                        reset();
                        setIsModalOpen(true);
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
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
                    <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                        {expenses.map((exp) => {
                            const isDragging = draggingId === exp.id;
                            const isDragOver = dragOverId === exp.id;
                            return (
                                <div
                                    key={exp.id}
                                    data-expense-id={exp.id}
                                    onDragOver={(event) => handleDragOver(event, exp.id)}
                                    onDrop={(event) => handleDrop(event, exp.id)}
                                    className={clsx(
                                        "p-4 flex items-center gap-3 group transition",
                                        isDragOver ? "bg-indigo-50 dark:bg-neutral-800" : "hover:bg-gray-50 dark:hover:bg-neutral-800",
                                        isDragging && "opacity-60"
                                    )}
                                >
                                    <button
                                        type="button"
                                        title="拖曳排序"
                                        draggable
                                        onDragStart={(event) => handleDragStart(event, exp.id)}
                                        onDragEnd={handleDragEnd}
                                        onPointerDown={(event) => handlePointerDown(event, exp.id)}
                                        onPointerMove={handlePointerMove}
                                        onPointerUp={handlePointerUp}
                                        onPointerCancel={handlePointerCancel}
                                        className="p-1 rounded touch-none text-gray-300 dark:text-neutral-600 cursor-grab hover:text-gray-500 dark:hover:text-neutral-300 shrink-0"
                                    >
                                        <GripVertical size={16} />
                                    </button>

                                    {/* Vertical Color Bar */}
                                    <div
                                        className={clsx(
                                            'w-1.5 h-8 rounded-full shrink-0 mr-2',
                                            getCategory(exp.category_id)?.type === 'income' ? 'bg-emerald-400 dark:bg-emerald-300' : 'bg-rose-400 dark:bg-rose-300'
                                        )}
                                    ></div>

                                    <div className="flex flex-row items-center gap-4 sm:gap-8 flex-1 min-w-0">
                                        {/* Day Column (Fixed Width for alignment) */}
                                        <div className="flex items-center gap-1 shrink-0 w-12 sm:w-16 justify-center">
                                            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{exp.day}</span>
                                            <span className="text-gray-400 dark:text-neutral-500 text-xs mt-1">日</span>
                                        </div>

                                        {/* Category & Badge & Note Wrapper - Desktop: Left Aligned, Mobile: Stacked Centered */}
                                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 min-w-0">
                                            {/* Category & Badge */}
                                            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3 min-w-0">
                                                <span className="text-sm font-semibold text-gray-800 dark:text-neutral-100 truncate max-w-[120px] sm:max-w-none">
                                                    {getCategory(exp.category_id)?.name || '未分類'}
                                                </span>
                                                <span
                                                    className={clsx(
                                                        'text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap',
                                                        getCategory(exp.category_id)?.type === 'income'
                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                    )}
                                                >
                                                    {getCategory(exp.category_id)?.type === 'income' ? '收入' : '支出'}
                                                </span>
                                            </div>

                                            {/* Note */}
                                            <div className="text-sm text-gray-500 dark:text-neutral-400 truncate sm:text-left text-center">
                                                {exp.note || <span className="opacity-40">無備註</span>}
                                            </div>
                                        </div>

                                        {/* Amount Column (1/4) */}
                                        <div className="flex-1 min-w-0 text-right font-bold text-gray-900 dark:text-neutral-100 whitespace-nowrap">
                                            NT$ {exp.amount.toLocaleString()}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(exp)}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition dark:text-neutral-500 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20"
                                            title="編輯"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm('確定要刪除此固定交易設定嗎？')) {
                                                    deleteMutation.mutate(exp.id);
                                                }
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                                            title="刪除"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-neutral-800">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-100">{editingExpense ? '編輯固定交易' : '新增固定交易'}</h3>
                        </div>
                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                            {/* Toggle Switch */}
                            <div className="flex bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setTransactionType('expense')}
                                    className={clsx(
                                        "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                                        transactionType === 'expense'
                                            ? "bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                            : "text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300"
                                    )}
                                >
                                    支出
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTransactionType('income')}
                                    className={clsx(
                                        "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                                        transactionType === 'income'
                                            ? "bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                                            : "text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300"
                                    )}
                                >
                                    收入
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">每月扣款日</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        {...register('day', { required: true, min: 1, max: 31 })}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 dark:bg-neutral-950 dark:border-neutral-700 dark:text-white"
                                        placeholder="例如: 1 (每月1號)"
                                    />
                                    <span className="absolute right-3 top-3 text-gray-400 dark:text-neutral-500 text-sm">日</span>
                                </div>
                                {errors.day && <p className="text-red-500 text-xs mt-1">請輸入 1-31 之間的日期</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">交易類別</label>
                                <select
                                    {...register('category_id', { required: true })}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 dark:bg-neutral-950 dark:border-neutral-700 dark:text-white"
                                >
                                    <option value="">請選擇類別...</option>
                                    {filteredCategories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                {errors.category_id && <p className="text-red-500 text-xs mt-1">請選擇類別</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">金額</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-500 dark:text-neutral-400">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...register('amount', { required: true, min: 1 })}
                                        className="w-full p-3 pl-8 border rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 dark:bg-neutral-950 dark:border-neutral-700 dark:text-white"
                                        placeholder="0.00"
                                    />
                                </div>
                                {errors.amount && <p className="text-red-500 text-xs mt-1">請輸入有效金額</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">備註 (選填)</label>
                                <input
                                    type="text"
                                    {...register('note')}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 dark:bg-neutral-950 dark:border-neutral-700 dark:text-white"
                                    placeholder="例如: Gemini Submit、Salary"
                                />
                            </div>

                            <div className="flex justify-between items-center pt-4">
                                {editingExpense ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm('確定要刪除此固定交易設定嗎？')) {
                                                deleteMutation.mutate(editingExpense.id);
                                            }
                                        }}
                                        className="text-red-500 hover:text-red-700 text-sm font-medium transition"
                                    >
                                        刪除設定
                                    </button>
                                ) : <div />}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsModalOpen(false);
                                            setEditingExpense(null);
                                            reset();
                                        }}
                                        className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"
                                    >
                                        {editingExpense ? '更新設定' : '儲存設定'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
