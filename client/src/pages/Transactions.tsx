import { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, AlertCircle, Edit2 } from 'lucide-react';
import AddTransactionModal from '../components/AddTransactionModal'; // 引入 Modal

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  note: string;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 新增：控制編輯 Modal 的狀態
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>(undefined);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.get('http://localhost:8080/api/v1/transactions');
        setTransactions(response.data || []);
        setError('');
      } catch (err) {
        console.error('API 錯誤:', err);
        setError('無法連接到伺服器');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  // 處理點擊編輯
  const handleEditClick = (transaction: Transaction) => {
      setSelectedTransaction(transaction);
      setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">交易紀錄</h2>
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
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            目前還沒有任何紀錄
          </div>
        ) : (
          <table className="w-full text-left min-w-[350px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="py-4 px-4 md:px-6 text-xs md:text-sm font-semibold text-gray-600 whitespace-nowrap">日期</th>
                <th className="py-4 px-4 md:px-6 text-xs md:text-sm font-semibold text-gray-600 whitespace-nowrap">類別</th>
                <th className="hidden md:table-cell py-4 px-4 md:px-6 text-xs md:text-sm font-semibold text-gray-600">備註</th>
                <th className="py-4 px-4 md:px-6 text-xs md:text-sm font-semibold text-gray-600 text-right whitespace-nowrap">金額</th>
                <th className="w-10"></th> {/* 編輯按鈕欄位 */}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition group cursor-pointer" onClick={() => handleEditClick(t)}>
                  <td className="py-4 px-4 md:px-6 text-xs md:text-sm text-gray-600 whitespace-nowrap">{t.date}</td>
                  
                  <td className="py-4 px-4 md:px-6 text-xs md:text-sm">
                    <span className="px-2 py-1 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-medium bg-gray-100 text-gray-700">
                      {t.category}
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
                  
                  {/* 編輯 icon，電腦版 hover 才顯示，手機版一直顯示但很淡 */}
                  <td className="pr-4 text-gray-300 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit2 size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 獨立的編輯 Modal */}
      <AddTransactionModal 
        isOpen={isEditModalOpen} 
        onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTransaction(undefined);
        }}
        editData={selectedTransaction} // 傳入選中的資料
      />
    </div>
  );
}