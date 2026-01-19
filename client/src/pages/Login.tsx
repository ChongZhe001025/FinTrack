/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, Moon, Sun } from 'lucide-react'; // 1. 新增引入 Eye, EyeOff
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const AUTH_BASE_URL = '/api/v1/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // 2. 新增控制密碼顯示的狀態
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  useEffect(() => {
    document.title = 'FinTrack | Login';
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await axios.post(`${AUTH_BASE_URL}/login`, {
        username,
        password,
      });
      login();
      navigate('/');
    } catch (err) {
      setError('帳號或密碼錯誤');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-neutral-950 p-4 relative">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition flex items-center justify-center dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        title={isDark ? '切換為亮色模式' : '切換為暗色模式'}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="bg-white dark:bg-neutral-900 dark:border dark:border-neutral-800 p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4 dark:bg-neutral-800 dark:text-neutral-100">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Welcome Back!</h1>
          <p className="text-gray-500 dark:text-neutral-400 text-sm">FinTrack</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center font-medium dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-2">使用者名稱</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-neutral-500">
                <User size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-700 dark:focus:border-neutral-600"
                placeholder="請輸入帳號"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-2">密碼</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-neutral-500">
                <Lock size={18} />
              </div>
              
              <input
                // 3. 根據狀態動態切換 type
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                // 4. 將 pr-4 改為 pr-10，避免文字被右邊的眼睛圖示擋住
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-700 dark:focus:border-neutral-600"
                placeholder="請輸入密碼"
              />

              {/* 5. 新增切換按鈕 */}
              <button
                type="button" // 重要：設定為 button 避免觸發表單 submit
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none dark:text-neutral-500 dark:hover:text-neutral-300"
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white dark:shadow-none"
          >
            登入系統
          </button>
        </form>
      </div>
    </div>
  );
}
