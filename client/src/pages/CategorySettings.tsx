/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Trash2, Edit2, Plus, Check, X, Tag, GripVertical } from 'lucide-react';
import clsx from 'clsx';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  order?: number;
}

export default function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 編輯狀態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'income' | 'expense'>('expense');

  // 新增狀態
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // 拖拉排序狀態
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);

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
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // 刪除
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此類別嗎？(這不會刪除已關聯的交易紀錄，但可能會影響分類統計)')) return;
    try {
      await axios.delete(`/api/v1/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      alert('刪除失敗');
    }
  };

  // 開始編輯
  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditType(category.type === 'income' ? 'income' : 'expense');
  };

  // 儲存編輯
  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      const payload = { name: editName.trim(), type: editType };
      await axios.put(`/api/v1/categories/${editingId}`, payload);
      setCategories((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...payload } : c)));
      setEditingId(null);
    } catch (error) {
      alert('修改失敗');
    }
  };

  const persistOrder = async (updates: Array<{ id: string; order: number }>) => {
    if (updates.length === 0) return;

    try {
      await Promise.all(updates.map((item) => axios.put(`/api/v1/categories/${item.id}`, { order: item.order })));
    } catch (error) {
      alert('排序更新失敗，請再試一次');
      fetchCategories();
    }
  };

  const resetDragState = () => {
    setDraggingId(null);
    setDragOverId(null);
    dragPointerIdRef.current = null;
  };

  const applyReorder = (fromId: string, toId: string) => {
    const fromIndex = categories.findIndex((cat) => cat.id === fromId);
    const toIndex = categories.findIndex((cat) => cat.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...categories];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    const nextWithOrder = next.map((cat, index) => ({ ...cat, order: index + 1 }));
    const updates = nextWithOrder
      .map((cat) => {
        const previous = categories.find((prevCat) => prevCat.id === cat.id);
        const previousOrder = previous?.order ?? 0;
        if (previousOrder !== cat.order) {
          return { id: cat.id, order: cat.order ?? 0 };
        }
        return null;
      })
      .filter((item): item is { id: string; order: number } => item !== null);

    setCategories(nextWithOrder);
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
    if (event.pointerType !== 'touch' || editingId === id) return;
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
    const row = target?.closest<HTMLElement>('[data-category-id]');
    const overId = row?.dataset.categoryId;

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

  // 儲存新增
  const saveNew = async () => {
    if (!newName.trim()) return;
    try {
      const res = await axios.post('/api/v1/categories', {
        name: newName,
        type: 'expense',
      });
      setCategories((prev) =>
        [...prev, res.data].sort((a: Category, b: Category) => {
          const orderDiff = (a.order ?? 0) - (b.order ?? 0);
          if (orderDiff !== 0) return orderDiff;
          return a.name.localeCompare(b.name, 'zh-Hant');
        })
      );
      setIsAdding(false);
      setNewName('');
    } catch (error) {
      alert('新增失敗');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag className="text-indigo-600 dark:text-neutral-200" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100 shrink-0">分類標籤管理</h2>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
        >
          <Plus size={18} /> 新增分類
        </button>
      </div>

      {/* 新增區塊 */}
      {isAdding && (
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3 animate-fade-in dark:bg-neutral-900 dark:border-neutral-800">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="輸入新分類名稱..."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-900 border-gray-200 placeholder:text-gray-400 dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-700 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-700"
            autoFocus
          />
          <button
            onClick={saveNew}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
            title="儲存新增"
          >
            <Check size={18} />
          </button>
          <button
            onClick={() => setIsAdding(false)}
            className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            title="取消新增"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* 列表區塊 */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 dark:text-neutral-500">載入中...</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-neutral-800">
            {categories.map((cat) => {
              const isEditing = editingId === cat.id;
              const isDragging = draggingId === cat.id;
              const isDragOver = dragOverId === cat.id;

              return (
                <div
                  key={cat.id}
                  data-category-id={cat.id}
                  onDragOver={(event) => handleDragOver(event, cat.id)}
                  onDrop={(event) => handleDrop(event, cat.id)}
                  className={clsx(
                    'p-4 flex items-center gap-3 group transition',
                    isDragOver ? 'bg-indigo-50 dark:bg-neutral-800' : 'hover:bg-gray-50 dark:hover:bg-neutral-800',
                    isDragging && 'opacity-60'
                  )}
                >
                  <button
                    type="button"
                    title="拖曳排序"
                    draggable={!isEditing}
                    onDragStart={(event) => handleDragStart(event, cat.id)}
                    onDragEnd={handleDragEnd}
                    onPointerDown={(event) => handlePointerDown(event, cat.id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    className={clsx(
                      'p-1 rounded touch-none text-gray-300 dark:text-neutral-600',
                      isEditing ? 'cursor-not-allowed' : 'cursor-grab hover:text-gray-500 dark:hover:text-neutral-300'
                    )}
                  >
                    <GripVertical size={16} />
                  </button>

                  {isEditing ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full sm:flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-900 border-gray-200 placeholder:text-gray-400 dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-700 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-700"
                        />
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as 'income' | 'expense')}
                          className="w-full sm:w-auto p-2 border rounded-lg text-sm bg-white text-gray-900 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-700 dark:focus:ring-neutral-700"
                        >
                          <option value="expense">支出</option>
                          <option value="income">收入</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 justify-end sm:justify-start">
                        <button
                          onClick={saveEdit}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg dark:text-emerald-300 dark:hover:bg-neutral-800"
                          title="儲存"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg dark:text-neutral-500 dark:hover:bg-neutral-800"
                          title="取消"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={clsx(
                            'w-2 h-8 rounded-full',
                            cat.type === 'income' ? 'bg-emerald-400 dark:bg-emerald-300' : 'bg-rose-400 dark:bg-rose-300'
                          )}
                        ></div>

                        <span className="font-medium text-gray-700 dark:text-neutral-200">{cat.name}</span>

                        <span
                          className={clsx(
                            'text-xs px-2 py-1 rounded-full font-medium',
                            cat.type === 'income'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          )}
                        >
                          {cat.type === 'income' ? '收入' : '支出'}
                        </span>
                      </div>

                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(cat)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition dark:text-neutral-500 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
                          title="編輯"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition dark:text-neutral-500 dark:hover:text-red-300 dark:hover:bg-neutral-800"
                          title="刪除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
