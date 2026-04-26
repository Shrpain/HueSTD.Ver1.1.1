import React, { Suspense, lazy, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider, useToast } from './components/Toast';
import { supabase } from './services/supabase';
import api from './services/api';
import { AppTab, User } from './types';

const PATH_TO_TAB: Record<string, AppTab> = {
  '/': AppTab.DASHBOARD,
  '/dashboard': AppTab.DASHBOARD,
  '/documents': AppTab.DOCUMENTS,
  '/chat': AppTab.CHAT,
  '/online-exam': AppTab.ONLINE_EXAM,
  '/notifications': AppTab.NOTIFICATIONS,
  '/profile': AppTab.PROFILE,
  '/admin': AppTab.ADMIN,
};
const TAB_TO_PATH: Record<AppTab, string> = {
  [AppTab.DASHBOARD]: '/',
  [AppTab.DOCUMENTS]: '/documents',
  [AppTab.CHAT]: '/chat',
  [AppTab.ONLINE_EXAM]: '/online-exam',
  [AppTab.NOTIFICATIONS]: '/notifications',
  [AppTab.PROFILE]: '/profile',
  [AppTab.ADMIN]: '/admin',
};
function pathnameToTab(pathname: string): AppTab {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return PATH_TO_TAB[normalized] ?? AppTab.DASHBOARD;
}
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import DocumentModule from './components/DocumentModule';
import ChatModule from './components/chat/ChatModule';
import AdminModule from './components/AdminModule';
import AdminLayout from './components/admin/AdminLayout';
import ProfileModule from './components/ProfileModule';
import NotificationModule from './components/NotificationModule';
import AuthModule from './components/AuthModule';
import OnlineExamModule from './components/OnlineExamModule';
const AssistantChatBox = lazy(() => import('./components/AssistantChatBox'));

const GlobalNotificationListener: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`global_notifications_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNoti = payload.new as any;
          showToast({
            type: 'success',
            title: newNoti.title || 'Thông báo mới',
            message: newNoti.message || 'Bạn vừa nhận được một thông báo mới.',
            duration: 6000
          });
          
          window.dispatchEvent(new Event('REFRESH_NOTIFICATIONS'));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, showToast]);

  return null;
};

const AuthToastListener: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  useEffect(() => {
    const handler = (e: CustomEvent<{ type: 'success' | 'error'; title: string; message: string }>) => {
      const { type, title, message } = e.detail || {};
      if (type && title && message) {
        showToast({ type, title, message, duration: 5000 });
      }
    };
    window.addEventListener('auth-toast', handler as EventListener);
    return () => window.removeEventListener('auth-toast', handler as EventListener);
  }, [showToast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description') || '';
    if (error) {
      const msg =
        error === 'server_error' && errorDescription.includes('exchange')
          ? 'Supabase không trao đổi mã với Google. Kiểm tra:\n• Google Cloud: Redirect URI = https://oubkbvypiabgfulnhsnd.supabase.co/auth/v1/callback\n• Supabase: Client ID và Client Secret đúng chưa.'
          : decodeURIComponent(errorDescription || 'Đăng nhập thất bại.');
      showToast({ type: 'error', title: 'Lỗi đăng nhập', message: msg, duration: 8000 });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showToast]);

  return <>{children}</>;
};

const mapAuthUserToUser = (authUser: any): User | null => {
  if (!authUser) return null;
  return {
    id: authUser.id,
    name: authUser.fullName || authUser.FullName || authUser.email?.split('@')[0] || 'Người dùng',
    email: authUser.email || '',
    school: authUser.school || authUser.School || 'Chưa cập nhật',
    major: authUser.major || authUser.Major || 'Chưa cập nhật',
    avatar: authUser.avatarUrl || authUser.AvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser.fullName || authUser.FullName || 'User')}&background=0d9488&color=fff&size=200`,
    points: authUser.points || authUser.Points || 0,
    rank: authUser.rank || authUser.Rank || 0,
    role: authUser.role || authUser.Role || 'user',
    badge: authUser.badge || authUser.Badge || 'Thành viên mới',
    totalDocuments: authUser.totalDocuments || authUser.TotalDocuments || 0,
    totalDownloads: authUser.totalDownloads || authUser.TotalDownloads || 0,
    averageRating: authUser.averageRating || authUser.AverageRating || 0.0
  };
};

const AppContent: React.FC = () => {
  const { user: authUser, isAuthenticated, logout } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = pathnameToTab(location.pathname);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    api.post('/Dashboard/track-view', null, { params: { pagePath: activeTab } }).catch(() => {});
  }, [activeTab]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const user = mapAuthUserToUser(authUser);

  const handleLogin = () => {
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const renderContent = () => {
    const isProtected = [AppTab.PROFILE].includes(activeTab);

    if (isProtected && !isAuthenticated) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center text-teal-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800">Tính năng giới hạn</h2>
            <p className="text-slate-500 max-w-sm mx-auto font-medium">Vui lòng đăng nhập để sử dụng tính năng quản lý hồ sơ cá nhân.</p>
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-teal-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all active:scale-95"
          >
            Đăng nhập ngay
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case AppTab.DASHBOARD: return <Dashboard setActiveTab={(tab) => navigate(TAB_TO_PATH[tab])} />;
      case AppTab.DOCUMENTS: return <DocumentModule onRequireLogin={() => setShowAuthModal(true)} />;
      case AppTab.CHAT: return isAuthenticated ? <ChatModule /> : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center text-teal-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800">Tin nhắn</h2>
            <p className="text-slate-500 max-w-sm mx-auto font-medium">Vui lòng đăng nhập để sử dụng tính năng nhắn tin.</p>
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-teal-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all active:scale-95"
          >
            Đăng nhập ngay
          </button>
        </div>
      );
      case AppTab.ONLINE_EXAM: return isAuthenticated ? <OnlineExamModule /> : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center text-teal-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8a2 2 0 0 1 2-2h12l6 6v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" /><path d="M6 14h12" /><path d="M8 10h4" /></svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800">Thi online</h2>
            <p className="text-slate-500 max-w-sm mx-auto font-medium">Vui lòng đăng nhập để tạo đề thi thủ công và quản lý ngân hàng câu hỏi.</p>
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-teal-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all active:scale-95"
          >
            Đăng nhập ngay
          </button>
        </div>
      );
      case AppTab.NOTIFICATIONS: return <NotificationModule />;
      case AppTab.ADMIN: return <AdminModule initialTab="support" />;
      case AppTab.PROFILE: return user ? <ProfileModule user={user} /> : null;
      default: return <Dashboard setActiveTab={(tab) => navigate(TAB_TO_PATH[tab])} />;
    }
  };

  const handleTabChange = (tab: AppTab) => {
    navigate(TAB_TO_PATH[tab]);
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    if (user?.role === 'admin' && !location.pathname.startsWith('/admin')) {
      navigate('/admin', { replace: true });
    }
  }, [user?.role, location.pathname, navigate]);

  if (user && user.role === 'admin') {
    return (
      <>
        {showAuthModal && (
          <AuthModule
            onClose={() => setShowAuthModal(false)}
            onLoginSuccess={handleLogin}
          />
        )}
        <AdminLayout />
      </>
    );
  }

  return (
    <div className={`flex bg-slate-50 dark:bg-slate-950 transition-colors duration-300 ${activeTab === AppTab.CHAT ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {showAuthModal && (
        <AuthModule
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={handleLogin}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        user={user}
        isLoggedIn={isAuthenticated}
        onShowAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 md:ml-64 overflow-hidden">
        <Header
          user={user}
          isLoggedIn={isAuthenticated}
          onMenuClick={() => setIsSidebarOpen(true)}
          onProfileClick={() => isAuthenticated ? handleTabChange(AppTab.PROFILE) : setShowAuthModal(true)}
          onShowAuth={() => setShowAuthModal(true)}
          onNotificationClick={() => handleTabChange(AppTab.NOTIFICATIONS)}
        />
        <main
          className={`flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full transition-colors duration-300 ${
            activeTab === AppTab.CHAT ? 'overflow-hidden min-h-0 flex' : 'overflow-y-auto'
          }`}
        >
          {renderContent()}
        </main>

        <footer className="shrink-0 p-4 text-center text-slate-400 text-sm border-t dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-300">
          &copy; 2026 HueSTD - Nền tảng sinh viên Thừa Thiên Huế
        </footer>
      </div>

      <Suspense fallback={null}>
        <AssistantChatBox />
      </Suspense>
    </div>
  );
};

import { Analytics } from '@vercel/analytics/react';

const App: React.FC = () => {
  return (
    <ToastProvider>
      <ThemeProvider>
        <AuthProvider>
          <AuthToastListener>
            <GlobalNotificationListener />
            <AppContent />
            <Analytics />
          </AuthToastListener>
        </AuthProvider>
      </ThemeProvider>
    </ToastProvider>
  );
};

export default App;
