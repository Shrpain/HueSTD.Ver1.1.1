import React from 'react';
import { AppTab, User } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  FileText,
  GraduationCap,
  Home,
  LogIn,
  LogOut,
  MessageCircle,
  ShieldCheck,
  X,
  Moon,
  Sun,
} from 'lucide-react';

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user: User | null;
  isLoggedIn: boolean;
  onShowAuth: () => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  unreadMessages?: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  isLoggedIn,
  onShowAuth,
  onLogout,
  isOpen,
  onClose,
  unreadMessages = 0,
}) => {
  const { theme, toggleTheme } = useTheme();
  const chatBadge = Number(unreadMessages);
  const menuItems = [
    { id: AppTab.DASHBOARD, label: 'Tổng quan', icon: <Home size={20} /> },
    { id: AppTab.DOCUMENTS, label: 'Tài liệu & Đề thi', icon: <FileText size={20} /> },
    {
      id: AppTab.CHAT,
      label: 'Tin nhắn',
      icon: <MessageCircle size={20} />,
      badge: Number.isFinite(chatBadge) && chatBadge > 0 ? chatBadge : undefined,
    },
    { id: AppTab.ONLINE_EXAM, label: 'Thi online', icon: <GraduationCap size={20} /> },
    { id: AppTab.ADMIN, label: 'Liên hệ Admin', icon: <ShieldCheck size={20} /> },
  ];

  return (
    <>
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 flex flex-col h-screen overflow-hidden shadow-2xl md:shadow-none transition-colors duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 h-16 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800 shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg shadow-teal-100 group-hover:shadow-teal-300 group-hover:scale-110 transition-all duration-300">
              H
            </div>
            <span className="text-xl font-black text-teal-700 tracking-tighter group-hover:text-teal-600 transition-colors duration-300">
              HueSTD
            </span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all duration-200 hover:rotate-90"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
          <nav className="p-4 space-y-1.5 py-6 flex-1">
            <p className="px-4 mb-3 text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">
              Menu chính
            </p>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${
                  activeTab === item.id
                    ? 'bg-teal-50/80 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-bold border-l-[4px] border-teal-600 pl-[12px]'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:translate-x-1'
                }`}
              >
                <span
                  className={`transition-transform duration-200 ${
                    activeTab === item.id ? 'scale-110' : 'group-hover:scale-110 group-hover:text-teal-600'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="flex-1 text-[13px] group-hover:text-teal-600 transition-colors duration-200">
                  {item.label}
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 transition-colors duration-300">
          <div className="mb-4 px-2">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
            >
              {theme === 'light' ? (
                <>
                  <Moon size={18} className="text-indigo-500" />
                  <span className="text-xs font-bold">Chế độ tối</span>
                </>
              ) : (
                <>
                  <Sun size={18} className="text-amber-500" />
                  <span className="text-xs font-bold">Chế độ sáng</span>
                </>
              )}
            </button>
          </div>
          {isLoggedIn && user ? (
            <div className="space-y-3">
              <div
                className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all duration-300 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:shadow-md group"
                onClick={() => setActiveTab(AppTab.PROFILE)}
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-full border-2 border-slate-100 dark:border-slate-700 shadow-sm shrink-0 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight group-hover:text-teal-600 transition-colors duration-300">
                    {user.name}
                  </p>
                  <p className="text-[9px] text-slate-400 truncate uppercase font-black tracking-tight group-hover:text-teal-500 transition-colors duration-300">
                    {user.school}
                  </p>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-xs font-black text-red-500 hover:text-red-600 rounded-xl transition-all duration-300 hover:bg-red-50 group border border-transparent hover:border-red-100"
              >
                <LogOut size={16} className="transition-transform group-hover:-translate-x-1 group-hover:rotate-6" />
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] text-slate-400 text-center px-4 font-bold uppercase tracking-widest">
                Khách tham quan
              </p>
              <button
                onClick={onShowAuth}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 text-xs font-black text-white bg-teal-600 hover:bg-teal-700 rounded-2xl transition-all duration-300 shadow-lg shadow-teal-100 hover:shadow-teal-300 hover:shadow-xl hover:-translate-y-1 active:scale-95"
              >
                <LogIn size={18} className="group-hover:animate-pulse" />
                Đăng nhập ngay
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
