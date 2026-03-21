import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './components/Toast';
import { supabase } from './services/supabase';
import api from './services/api';
import { AppTab, User } from './types';

// Đồng bộ URL với tab: pathname <-> AppTab
const PATH_TO_TAB: Record<string, AppTab> = {
  '/': AppTab.DASHBOARD,
  '/dashboard': AppTab.DASHBOARD,
  '/documents': AppTab.DOCUMENTS,
  '/notifications': AppTab.NOTIFICATIONS,
  '/profile': AppTab.PROFILE,
  '/admin': AppTab.ADMIN,
};
const TAB_TO_PATH: Record<AppTab, string> = {
  [AppTab.DASHBOARD]: '/',
  [AppTab.DOCUMENTS]: '/documents',
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
import AdminModule from './components/AdminModule';
import AdminLayout from './components/admin/AdminLayout';
import ProfileModule from './components/ProfileModule';
import NotificationModule from './components/NotificationModule';
import AuthModule from './components/AuthModule';

// Lắng nghe sự kiện notification-realtime để hiện toast toàn cục
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
          
          // Refresh list if needed via event
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

// Lắng nghe sự kiện auth-toast (sau đăng nhập Google) và xử lý lỗi OAuth từ URL
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

  // Khi redirect về với ?error=... (OAuth thất bại) → hiện toast và xóa query
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

// Helper function to convert AuthContext user to types.ts User format
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

// Inner App component that uses AuthContext
const AppContent: React.FC = () => {
  const { user: authUser, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = pathnameToTab(location.pathname);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Track page view on every navigation
  useEffect(() => {
    api.post('/Dashboard/track-view', null, { params: { pagePath: activeTab } }).catch(() => {});
  }, [activeTab]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Convert auth user to User type for components
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

  // --- ADMIN REDIRECT: đồng bộ URL /admin khi đăng nhập admin (trong useEffect để tránh cập nhật khi render)
  useEffect(() => {
    if (user?.role === 'admin' && !location.pathname.startsWith('/admin')) {
      navigate('/admin', { replace: true });
    }
  }, [user?.role, location.pathname, navigate]);

  // --- ADMIN: render Admin Layout
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
    <div className="flex min-h-screen bg-slate-50">
      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModule
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={handleLogin}
        />
      )}

      {/* Main UI */}
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

      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        <Header
          user={user}
          isLoggedIn={isAuthenticated}
          onMenuClick={() => setIsSidebarOpen(true)}
          onProfileClick={() => isAuthenticated ? handleTabChange(AppTab.PROFILE) : setShowAuthModal(true)}
          onShowAuth={() => setShowAuthModal(true)}
          onNotificationClick={() => handleTabChange(AppTab.NOTIFICATIONS)}
        />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {renderContent()}
        </main>

        <footer className="p-4 text-center text-slate-400 text-sm border-t bg-white">
          &copy; 2026 HueSTD - Nền tảng sinh viên Thừa Thiên Huế
        </footer>
      </div>
    </div>
  );
};

import { Analytics } from '@vercel/analytics/react';

// Main App wrapper with ToastProvider + AuthProvider + AuthToastListener
const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <AuthToastListener>
          <GlobalNotificationListener />
          <AppContent />
          <Analytics />
        </AuthToastListener>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
