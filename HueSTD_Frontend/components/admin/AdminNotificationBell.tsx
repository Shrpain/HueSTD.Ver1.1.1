import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
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

const AdminNotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const getUserId = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
            }
        };
        getUserId();
    }, []);

    // Debounce ref for realtime updates
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchNotifications();
            fetchUnreadCount();
        }, 500);
    };

    useEffect(() => {
        if (!userId) return;

        console.log('[AdminNotificationBell] Component mounted, setting up...');

        fetchNotifications();
        fetchUnreadCount();

        // Fallback polling every 20 seconds
        let pollingInterval: NodeJS.Timeout | null = null;
        const startPolling = () => {
            if (!pollingInterval) {
                console.log('[AdminNotificationBell] Starting polling fallback...');
                pollingInterval = setInterval(() => {
                    console.log('[AdminNotificationBell] Polling for new notifications...');
                    fetchNotifications();
                    fetchUnreadCount();
                }, 20000);
            }
        };

        // Realtime subscription for admin notifications - filtered by user_id
        const channel = supabase
            .channel(`admin_notifications_realtime_${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                (payload) => {
                    console.log('[AdminNotificationBell] Notification change:', payload);
                    debouncedFetch();
                }
            )
            .subscribe((status) => {
                console.log('[AdminNotificationBell] Realtime Status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Admin Notification Realtime Connected');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('⚠️ Admin Notification Realtime Error. Starting polling fallback...');
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
    }, [userId]);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const response = await api.get('/Notification?limit=10');
            const newNotifications: Notification[] = response.data;
            setNotifications(newNotifications);
        } catch (error) {
            console.error('Failed to fetch admin notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const response = await api.get('/Notification/unread-count');
            setUnreadCount(response.data.count);
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    };

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

    const deleteNotification = async (id: string) => {
        try {
            await api.delete(`/Notification/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
            fetchUnreadCount();
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead) {
            markAsRead(notification.id);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'document':
                return '📄';
            case 'message':
                return '💬';
            case 'marketplace':
                return '🛒';
            default:
                return '🔔';
        }
    };

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {showDropdown && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDropdown(false)}
                    />

                    {/* Dropdown Content */}
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg z-50 max-h-[500px] overflow-hidden flex flex-col border border-slate-200">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-800">Thông báo</h3>
                                {unreadCount > 0 && (
                                    <span className="text-sm text-indigo-600 font-medium">
                                        {unreadCount} chưa đọc
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Notifications List */}
                        <div className="overflow-y-auto flex-1">
                            {loading ? (
                                <div className="p-4 text-center text-slate-500">Đang tải...</div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <Bell size={48} className="mx-auto mb-2 opacity-30" />
                                    <p>Không có thông báo nào</p>
                                </div>
                            ) : (
                                notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition ${!notification.isRead ? 'bg-indigo-50' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="text-2xl flex-shrink-0">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="font-medium text-slate-800 text-sm">
                                                        {notification.title}
                                                    </h4>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteNotification(notification.id);
                                                        }}
                                                        className="text-slate-400 hover:text-red-600 flex-shrink-0"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-xs text-slate-500">
                                                        {formatTime(notification.createdAt)}
                                                    </span>
                                                    {!notification.isRead && (
                                                        <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="p-3 border-t border-slate-200 text-center">
                                <button
                                    onClick={() => setShowDropdown(false)}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    Đóng
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminNotificationBell;
