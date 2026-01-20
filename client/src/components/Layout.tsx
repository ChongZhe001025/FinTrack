import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, List, LineChart, PlusCircle, Wallet, LogOut, Tags, BarChart3, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import AddTransactionModal from './AddTransactionModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: '總覽' },
  { to: '/transactions', icon: List, label: '紀錄' },
  { to: '/stats', icon: BarChart3, label: '每月報表' },
  { to: '/reports/yearly', icon: LineChart, label: '年度報表' },
  { to: '/categories', icon: Tags, label: '分類管理' },
];
const APP_TITLE = 'FinTrack';
const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Transactions',
  '/stats': 'Monthly Report',
  '/reports/yearly': 'Yearly Report',
  '/categories': 'Categories',
};

export default function Layout({ children }: LayoutProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const pageTitle = PAGE_TITLES[location.pathname];
    document.title = pageTitle ? `${APP_TITLE} | ${pageTitle}` : APP_TITLE;
  }, [location.pathname]);

  const handleLogout = () => {
    if (confirm("確定要登出嗎？")) {
      logout();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 dark:text-neutral-100 flex flex-col md:flex-row pb-20 md:pb-0">
      {/* === Desktop Sidebar (電腦版側邊欄) === */}
      <aside className="w-64 bg-white dark:bg-neutral-950 border-r border-gray-200 dark:border-neutral-800 hidden md:flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="text-indigo-600 dark:text-neutral-200" size={28} />
            <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100">FinTrack</h1>
          </div>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition flex items-center justify-center dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            title={isDark ? "切換為亮色模式" : "切換為暗色模式"}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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
                  isActive
                    ? "bg-indigo-50 text-indigo-600 dark:bg-neutral-900 dark:text-neutral-100"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                )}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* 底部按鈕區：記帳 + 登出 */}
        <div className="p-4 border-t border-gray-100 dark:border-neutral-800 space-y-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition shadow-sm dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white dark:shadow-none"
          >
            <PlusCircle size={18} />
            記一筆
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-gray-500 hover:bg-red-50 hover:text-red-600 py-2 rounded-lg transition text-sm font-medium dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-red-300"
          >
            <LogOut size={18} />
            登出系統
          </button>
        </div>
      </aside>

      {/* === Mobile Header (手機版頂部) === */}
      <header className="md:hidden bg-white dark:bg-neutral-950 p-4 border-b border-gray-200 dark:border-neutral-800 sticky top-0 z-10 flex justify-between items-center px-4">
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition flex items-center justify-center dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          title={isDark ? "切換為亮色模式" : "切換為暗色模式"}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <h1 className="font-bold text-lg text-gray-800 dark:text-neutral-100 flex items-center gap-2">
          <Wallet size={24} className="text-indigo-600 dark:text-neutral-200" /> FinTrack
        </h1>

        <button
          onClick={handleLogout}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 transition dark:text-neutral-400 dark:hover:text-red-300"
          title="登出"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* === Main Content === */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* === Mobile Bottom Navigation (手機版底部) === */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-800 z-20 pb-safe">
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
                  isActive
                    ? "text-indigo-600 dark:text-neutral-100"
                    : "text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-200"
                )}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex flex-col items-center justify-center w-full h-full text-indigo-600 dark:text-neutral-100"
          >
            <div className="bg-indigo-600 text-white p-2 rounded-full shadow-md -mt-6 border-4 border-gray-50 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-950">
              <PlusCircle size={28} />
            </div>
            <span className="text-[10px] font-medium mt-1">記一筆</span>
          </button>
        </div>
      </div>

      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
