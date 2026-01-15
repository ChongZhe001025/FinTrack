import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, List, PieChart, PlusCircle, Wallet } from 'lucide-react';
import clsx from 'clsx';
import AddTransactionModal from './AddTransactionModal';

interface LayoutProps {
  children: ReactNode;
}

// 導航設定檔
const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: '總覽' },
  { to: '/transactions', icon: List, label: '紀錄' },
  { to: '/stats', icon: PieChart, label: '報表' },
];

export default function Layout({ children }: LayoutProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row pb-20 md:pb-0"> 
      {/* ^^^ pb-20 是為了預留底部導航列的高度，避免內容被遮住 */}

      {/* === Desktop Sidebar (桌機版側邊欄) === */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
            <Wallet className="text-indigo-600" size={28} />
            <h1 className="text-xl font-bold text-gray-800">FinTrack</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {NAV_ITEMS.map((item) => {
             const Icon = item.icon;
             const isActive = location.pathname === item.to;
             return (
               <Link
                 key={item.to}
                 to={item.to}
                 className={clsx(
                   "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                   isActive ? "bg-indigo-50 text-indigo-600" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                 )}
               >
                 <Icon size={20} />
                 <span>{item.label}</span>
               </Link>
             )
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
            <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition shadow-sm"
            >
                <PlusCircle size={18} />
                記一筆
            </button>
        </div>
      </aside>

      {/* === Mobile Header (手機版頂部 Logo) === */}
      <header className="md:hidden bg-white p-4 border-b border-gray-200 sticky top-0 z-10 flex justify-center">
          <h1 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <Wallet size={24} className="text-indigo-600"/> FinTrack
          </h1>
      </header>

      {/* === Main Content (內容區) === */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* === Mobile Bottom Navigation (手機版底部導航) === */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 pb-safe">
        <div className="flex justify-around items-center h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  "flex flex-col items-center justify-center w-full h-full space-y-1",
                  isActive ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          {/* 手機版浮動記帳按鈕 (通常放在正中間或右下角，這裡整合在 Tab Bar 中) */}
          <button 
             onClick={() => setIsModalOpen(true)}
             className="flex flex-col items-center justify-center w-full h-full text-indigo-600"
          >
             <div className="bg-indigo-600 text-white p-2 rounded-full shadow-md -mt-6 border-4 border-gray-50">
               <PlusCircle size={28} />
             </div>
             <span className="text-[10px] font-medium mt-1">記一筆</span>
          </button>
        </div>
      </div>

      {/* Modal */}
      <AddTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}