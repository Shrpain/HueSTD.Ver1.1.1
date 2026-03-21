import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Search, Bell, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ADMIN_PATH_TO_TAB: Record<string, string> = {
  '/admin': 'dashboard',
  '/admin/': 'dashboard',
  '/admin/dashboard': 'dashboard',
  '/admin/users': 'users',
  '/admin/documents': 'documents',
  '/admin/notifications': 'notifications',
  '/admin/settings': 'settings',
};
function adminPathToTab(pathname: string): string {
  const normalized = pathname.replace(/\/$/, '') || '/admin';
  return ADMIN_PATH_TO_TAB[normalized] ?? 'dashboard';
}
import AdminDashboard from './AdminDashboard';
import AdminUsersManagement from './AdminUsersManagement';
import AdminDocumentsManagement from './AdminDocumentsManagement';
import AdminSettings from './AdminSettings';
import AdminNotifications from './AdminNotifications';
import api from '../../services/api';
import { supabase } from '../../services/supabase';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
}

const AdminLayout: React.FC = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const activeTab = adminPathToTab(location.pathname);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);

    const fetchNotifications = async () => {
        try {
            const response = await api.get('/Notification?limit=10');
            setNotifications(response.data);
            setUnreadCount(response.data.filter((n: Notification) => !n.isRead).length);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    // Debounce ref for realtime updates
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchNotifications();
        }, 500);
    };

    useEffect(() => {
        fetchNotifications();

        // Fallback polling every 20 seconds
        let pollingInterval: NodeJS.Timeout | null = null;
        const startPolling = () => {
            if (!pollingInterval) {
                console.log('[AdminLayout] Starting polling fallback...');
                pollingInterval = setInterval(() => {
                    console.log('[AdminLayout] Polling for notifications...');
                    fetchNotifications();
                }, 20000);
            }
        };

        // Realtime subscription for admin notifications
        const channel = supabase
            .channel('admin_header_notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                () => {
                    console.log('[AdminLayout] New notification inserted');
                    debouncedFetch();
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'notifications' },
                () => {
                    console.log('[AdminLayout] Notification updated');
                    debouncedFetch();
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'notifications' },
                () => {
                    console.log('[AdminLayout] Notification deleted');
                    debouncedFetch();
                }
            )
            .subscribe((status) => {
                console.log('[AdminLayout] Realtime Status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Admin Layout Realtime Connected');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('⚠️ Admin Layout Realtime Error. Starting polling fallback...');
                    startPolling();
                }
            });

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await api.put(`/Notification/${id}/read`);
            setNotifications(prev =>
                prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins}p`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}g`;
        return `${Math.floor(diffHours / 24)}d`;
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'document': return '📄';
            case 'approval': return '✅';
            case 'rejection': return '❌';
            case 'role_change': return '👤';
            default: return '🔔';
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <AdminDashboard />;
            case 'users':
                return <AdminUsersManagement />;
            case 'documents':
                return <AdminDocumentsManagement />;
            case 'notifications':
                return <AdminNotifications />;
            case 'settings':
                return <AdminSettings />;
            default:
                return <AdminDashboard />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col fixed inset-y-0 left-0 z-50">
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/30">
                            A
                        </div>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">Admin</h1>
                            <p className="text-xs text-slate-400">HueSTD Manager</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <button
                        onClick={() => navigate('/admin')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <LayoutDashboard size={20} />
                        <span className="font-semibold text-sm">Dashboard</span>
                    </button>

                    <button
                        onClick={() => navigate('/admin/users')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <Users size={20} />
                        <span className="font-semibold text-sm">Người dùng</span>
                    </button>

                    <button
                        onClick={() => navigate('/admin/documents')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'documents' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <FileText size={20} />
                        <span className="font-semibold text-sm">Tài liệu</span>
                    </button>

                    <button
                        onClick={() => navigate('/admin/notifications')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'notifications' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <Bell size={20} />
                        <span className="font-semibold text-sm">Thông báo</span>
                    </button>

                    <button
                        onClick={() => navigate('/admin/settings')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <Settings size={20} />
                        <span className="font-semibold text-sm">Cài đặt</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={() => { logout(); navigate('/', { replace: true }); }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-all font-semibold text-sm"
                    >
                        <LogOut size={20} />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 ml-64 flex flex-col min-w-0">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40 bg-white/80 backdrop-blur-md">
                    <div className="flex items-center gap-4 text-slate-400 bg-slate-100 px-4 py-2 rounded-lg w-96">
                        <Search size={18} />
                        <input className="bg-transparent border-none outline-none text-sm text-slate-700 w-full" placeholder="Tìm kiếm..." />
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                                        <span className="text-[10px] text-white font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown */}
                            {showNotifications && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setShowNotifications(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-96 overflow-hidden flex flex-col">
                                        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                                            <span className="font-bold text-slate-800 text-sm">Thông báo</span>
                                            {unreadCount > 0 && (
                                                <button 
                                                    onClick={() => {
                                                        notifications.forEach((n: Notification) => {
                                                            if (!n.isRead) markAsRead(n.id);
                                                        });
                                                    }}
                                                    className="text-xs text-indigo-600 hover:text-indigo-800"
                                                >
                                                    Đánh dấu tất cả
                                                </button>
                                            )}
                                        </div>
                                        <div className="overflow-y-auto flex-1">
                                            {notifications.length === 0 ? (
                                                <div className="p-6 text-center text-slate-400 text-sm">
                                                    Chưa có thông báo
                                                </div>
                                            ) : (
                                                notifications.slice(0, 5).map((notification: Notification) => (
                                                    <div
                                                        key={notification.id}
                                                        onClick={() => !notification.isRead && markAsRead(notification.id)}
                                                        className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${!notification.isRead ? 'bg-indigo-50/50' : ''}`}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm font-medium ${!notification.isRead ? 'text-slate-800' : 'text-slate-600'}`}>
                                                                    {notification.title}
                                                                </p>
                                                                <p className="text-xs text-slate-500 truncate">{notification.message}</p>
                                                                <span className="text-[10px] text-slate-400">{formatTime(notification.createdAt)}</span>
                                                            </div>
                                                            {!notification.isRead && (
                                                                <span className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0 mt-1"></span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        {notifications.length > 0 && (
                                            <div className="p-2 border-t border-slate-100 text-center">
                                                <button 
                                                    onClick={() => {
                                                        setShowNotifications(false);
                                                        navigate('/admin/notifications');
                                                    }}
                                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                                >
                                                    Xem tất cả
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-3 pl-4 border-l">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-bold text-slate-800">{user?.fullName ?? user?.email}</p>
                                <p className="text-xs text-indigo-600 font-semibold uppercase">{user?.role}</p>
                            </div>
                            <img src={user?.avatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName ?? 'A')}`} alt="" className="w-10 h-10 rounded-full border-2 border-indigo-100" />
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6 overflow-y-auto">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
