import { useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2, Edit2, Plus, Check, X, Tag } from 'lucide-react';
import clsx from 'clsx';

interface Category {
  id: string;
  name: string;
  type: string;
}

export default function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 編輯狀態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // 新增狀態
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/v1/categories');
      setCategories(res.data || []);
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
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      alert('刪除失敗');
    }
  };

  // 開始編輯
  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
  };

  // 儲存編輯
  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await axios.put(`/api/v1/categories/${editingId}`, { name: editName });
      setCategories(prev => prev.map(c => c.id === editingId ? { ...c, name: editName } : c));
      setEditingId(null);
    } catch (error) {
      alert('修改失敗');
    }
  };

  // 儲存新增
  const saveNew = async () => {
    if (!newName.trim()) return;
    try {
      const res = await axios.post('/api/v1/categories', {
        name: newName,
        type: 'expense',
      });
      setCategories(prev => [...prev, res.data]);
      setIsAdding(false);
      setNewName('');
    } catch (error) {
      alert('新增失敗');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Tag className="text-indigo-600" /> 分類標籤管理
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition"
        >
          <Plus size={18} /> 新增分類
        </button>
      </div>

      {/* 新增區塊 */}
      {isAdding && (
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3 animate-fade-in">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="輸入新分類名稱..."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            autoFocus
          />
          <button onClick={saveNew} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            <Check size={18} />
          </button>
          <button onClick={() => setIsAdding(false)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">
            <X size={18} />
          </button>
        </div>
      )}

      {/* 列表區塊 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">載入中...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {categories.map((cat) => (
              <div key={cat.id} className="p-4 flex items-center justify-between group hover:bg-gray-50 transition">
                {editingId === cat.id ? (
                  // 編輯模式
                  <div className="flex items-center gap-3 w-full">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <button onClick={saveEdit} className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                      <Check size={18} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  // 顯示模式
                  <>
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          "w-2 h-8 rounded-full",
                          cat.type === 'income' ? "bg-emerald-400" : "bg-rose-400"
                        )}
                      ></div>
                      <span className="font-medium text-gray-700">{cat.name}</span>
                    </div>

                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(cat)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
