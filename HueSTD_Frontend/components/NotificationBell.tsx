import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import api from '../services/api';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
    user_id?: string;
}

interface NotificationBellProps {
    onViewAll?: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onViewAll }) => {
    const { user: currentUser } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);

    // Fetch notifications from API
    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/Notification?limit=20');
            // Ensure data is sorted by date descending
            const data = Array.isArray(response.data) ? response.data : [];
            const sortedData = [...data].sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setNotifications(sortedData);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch unread count
    const fetchUnreadCount = useCallback(async () => {
        try {
            const response = await api.get('/Notification/unread-count');
            setUnreadCount(response.data.count);
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    }, []);

    useEffect(() => {
        const handleRefresh = () => {
            fetchNotifications();
            fetchUnreadCount();
        };
        window.addEventListener('REFRESH_NOTIFICATIONS', handleRefresh);
        return () => window.removeEventListener('REFRESH_NOTIFICATIONS', handleRefresh);
    }, [fetchNotifications, fetchUnreadCount]);

    // Re-fetch when dropdown is opened to ensure fresh data
    useEffect(() => {
        if (showDropdown) {
            fetchNotifications();
            fetchUnreadCount();
        }
    }, [showDropdown, fetchNotifications, fetchUnreadCount]);

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
        if (!currentUser?.id) return;

        console.log('[NotificationBell] User detected, fetching data and setting up realtime...');
        fetchNotifications();
        fetchUnreadCount();

        // Fallback polling every 10 seconds
        let pollingInterval: NodeJS.Timeout | null = null;
        const startPolling = () => {
            if (!pollingInterval) {
                console.log('[NotificationBell] Starting polling fallback...');
                pollingInterval = setInterval(() => {
                    fetchNotifications();
                    fetchUnreadCount();
                }, 10000);
            }
        };

        let channel: ReturnType<typeof supabase.channel> | null = null;

        // Ensure Supabase client is authenticated before subscribing
        const setupRealtime = async () => {
            try {
                // Try to restore existing Supabase session first
                const { data: sessionData } = await supabase.auth.getSession();
                
                if (!sessionData?.session) {
                    // No active Supabase session - sync from app's localStorage tokens
                    const token = localStorage.getItem('accessToken');
                    const refreshToken = localStorage.getItem('refreshToken');
                    
                    if (token && refreshToken) {
                        const { error } = await supabase.auth.setSession({
                            access_token: token,
                            refresh_token: refreshToken
                        });
                        if (error) {
                            console.warn('[NotificationBell] Could not sync Supabase session:', error.message);
                            console.log('[NotificationBell] Falling back to polling...');
                            startPolling();
                            return;
                        }
                        console.log('[NotificationBell] Supabase session synced successfully');
                    } else {
                        console.warn('[NotificationBell] No tokens available for Supabase auth, using polling');
                        startPolling();
                        return;
                    }
                } else {
                    console.log('[NotificationBell] Supabase session already active');
                }

                // Now subscribe with authenticated client
                channel = supabase
                    .channel(`notif_${currentUser.id.substring(0, 8)}_${Date.now()}`)
                    .on(
                        'postgres_changes',
                        { 
                            event: '*', 
                            schema: 'public', 
                            table: 'notifications', 
                            filter: `user_id=eq.${currentUser.id}` 
                        },
                        (payload) => {
                            console.log('[NotificationBell] 🔔 REALTIME EVENT:', payload.eventType, payload);
                            debouncedFetch();

                            if (payload.eventType === 'INSERT' && payload.new) {
                                const type = (payload.new as any).type;
                                if (type === 'document' || type === 'approval') {
                                    window.dispatchEvent(new Event('REFRESH_DOCUMENTS'));
                                }
                            }
                        }
                    )
                    .subscribe((status, err) => {
                        console.log(`[NotificationBell] Subscription status: ${status}`, err || '');
                        if (status === 'SUBSCRIBED') {
                            console.log('%c✅ Notification Realtime ACTIVE', 'color: green; font-weight: bold', 'User:', currentUser.id);
                        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                            console.error('❌ Notification Realtime FAILED:', status, err);
                            startPolling();
                        }
                    });
            } catch (err) {
                console.error('[NotificationBell] Setup error:', err);
                startPolling();
            }
        };

        setupRealtime();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            if (channel) supabase.removeChannel(channel);
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, [currentUser?.id, fetchNotifications, fetchUnreadCount]);

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

    const markAllAsRead = async () => {
        try {
            await api.put('/Notification/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
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
            case 'role_change':
                return '👤';
            case 'approval':
                return '✅';
            case 'rejection':
                return '❌';
            case 'deletion':
                return '🗑️';
            case 'system':
                return '⚙️';
            default:
                return '🔔';
        }
    };

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition"
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
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
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg z-50 max-h-[500px] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-800">Thông báo</h3>
                                {unreadCount > 0 && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                markAllAsRead();
                                            }}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            Đánh dấu đã đọc
                                        </button>
                                        <span className="text-sm text-blue-600">
                                            {unreadCount} chưa đọc
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notifications List */}
                        <div className="overflow-y-auto flex-1">
                            {loading ? (
                                <div className="p-4 text-center text-gray-500">Đang tải...</div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <Bell size={48} className="mx-auto mb-2 opacity-30" />
                                    <p>Không có thông báo nào</p>
                                </div>
                            ) : (
                                notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition ${!notification.isRead ? 'bg-blue-50' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="text-2xl flex-shrink-0">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="font-medium text-gray-800 text-sm">
                                                        {notification.title}
                                                    </h4>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteNotification(notification.id);
                                                        }}
                                                        className="text-gray-400 hover:text-red-600 flex-shrink-0"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-xs text-gray-500">
                                                        {formatTime(notification.createdAt)}
                                                    </span>
                                                    {!notification.isRead && (
                                                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-2">
                            <button
                                onClick={() => {
                                    setShowDropdown(false);
                                    if (onViewAll) onViewAll();
                                }}
                                className="flex-1 text-sm text-teal-600 hover:text-teal-700 font-black py-2 rounded-xl hover:bg-teal-50 transition-all"
                            >
                                Xem tất cả
                            </button>
                            <button
                                onClick={() => setShowDropdown(false)}
                                className="flex-1 text-sm text-gray-400 hover:text-gray-600 font-bold py-2 rounded-xl hover:bg-gray-100 transition-all"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationBell;
