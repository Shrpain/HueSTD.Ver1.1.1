
import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, Check, FileText, MessageSquare, Award, Clock, LogIn } from 'lucide-react';
import { User } from '../types';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  user: User | null;
  isLoggedIn: boolean;
  onMenuClick: () => void;
  onProfileClick: () => void;
  onShowAuth: () => void;
  onNotificationClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, isLoggedIn, onMenuClick, onProfileClick, onShowAuth, onNotificationClick }) => {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300">
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <Menu size={22} />
        </button>

        <div className="relative max-w-sm w-full hidden sm:block group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-hover:text-teal-500 transition-colors duration-300" size={16} />
          <input
            type="text"
            placeholder="Tìm tài liệu, bài viết..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full py-2 pl-10 pr-4 text-[13px] text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none placeholder:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-600"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {isLoggedIn && user ? (
          <>
            <div className="hidden lg:flex flex-col items-end shrink-0 group cursor-default">
              <span className="text-[13px] font-black text-teal-600 group-hover:text-teal-700 transition-colors duration-300">
                {user.points} điểm
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest group-hover:text-teal-500 transition-colors duration-300">{user.badge}</span>
            </div>


            <NotificationBell onViewAll={onNotificationClick} />

            <button
              onClick={onProfileClick}
              className="flex items-center gap-3 pl-4 border-l border-slate-100 dark:border-slate-800 hover:opacity-80 transition-all duration-300 active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl p-2 -ml-2"
            >
              <img src={user.avatar} className="w-9 h-9 rounded-full border-2 border-slate-50 dark:border-slate-800 shadow-sm object-cover hover:scale-110 transition-transform duration-300" alt="Profile" />
              <span className="hidden sm:inline text-[13px] font-bold text-slate-700 dark:text-slate-200 hover:text-teal-600 transition-colors duration-300">Hồ sơ</span>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onShowAuth}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95"
            >
              Đăng ký
            </button>
            <button
              onClick={onShowAuth}
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white text-[13px] font-black rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-100 transition-all duration-300 hover:shadow-teal-300 hover:shadow-xl hover:-translate-y-1 active:scale-95"
            >
              <LogIn size={16} className="group-hover:animate-pulse" />
              Đăng nhập
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
