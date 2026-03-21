import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Send, Check, X, Users, Loader2, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { supabase } from '../../services/supabase';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
    user_id?: string;
}

interface BroadcastForm {
    title: string;
    message: string;
    type: string;
}

const AdminNotifications: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [broadcastForm, setBroadcastForm] = useState<BroadcastForm>({
        title: '',
        message: '',
        type: 'system'
    });
    const [sendSuccess, setSendSuccess] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'notifications' | 'broadcast'>('notifications');
    const [newNotifications, setNewNotifications] = useState<Notification[]>([]);
    const [showNewNotiToast, setShowNewNotiToast] = useState(false);
    const isFetchingRef = useRef(false);

    const fetchNotifications = useCallback(async (showLoading = true, isRealtimeUpdate = false) => {
        if (isFetchingRef.current && !isRealtimeUpdate) return;
        isFetchingRef.current = true;

        try {
            if (showLoading) setLoading(true);

            const response = await api.get('/Notification?limit=50');
            const newNotis = response.data;

            // Check for new notifications (only on realtime updates)
            if (isRealtimeUpdate) {
                setNotifications(currentNotis => {
                    const currentIds = new Set(currentNotis.map(n => n.id));
                    const newNotiList = newNotis.filter(n => !currentIds.has(n.id));
                    if (newNotiList.length > 0) {
                        setTimeout(() => {
                            setNewNotifications(prev => [...newNotiList, ...prev]);
                            setShowNewNotiToast(true);
                            setTimeout(() => setShowNewNotiToast(false), 5000);
                        }, 0);
                    }
                    return newNotis;
                });
            } else {
                setNotifications(newNotis);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, []);

    // Debounce ref for realtime updates
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchNotifications();
        }, 500);
    };

    useEffect(() => {
        // Initial fetch
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const response = await api.get('/Notification?limit=50');
                setNotifications(response.data);
            } catch (err) {
                console.error('Failed to fetch notifications:', err);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();

        // Debounce ref for realtime updates
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchNotifications(false, true);
            }, 500);
        };

        // Fallback polling every 20 seconds
        let pollingInterval: NodeJS.Timeout | null = null;
        const startPolling = () => {
            if (!pollingInterval) {
                console.log('[AdminNotifications] Starting polling fallback...');
                pollingInterval = setInterval(() => {
                    console.log('[AdminNotifications] Polling for new notifications...');
                    fetchNotifications();
                }, 20000);
            }
        };

        // Realtime subscription for admin notifications
        const channel = supabase
            .channel('admin_notifications_realtime_page')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    console.log('[AdminNotifications] New notification inserted:', payload);
                    const newNoti = payload.new as Notification;
                    setNewNotifications(prev => [newNoti, ...prev]);
                    setShowNewNotiToast(true);
                    setTimeout(() => setShowNewNotiToast(false), 5000);
                    debouncedFetch();
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'notifications' },
                (payload) => {
                    console.log('[AdminNotifications] Notification updated:', payload);
                    debouncedFetch();
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'notifications' },
                (payload) => {
                    console.log('[AdminNotifications] Notification deleted:', payload);
                    debouncedFetch();
                }
            )
            .subscribe((status) => {
                console.log('[AdminNotifications] Realtime Status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Admin Notifications Page Realtime Connected');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('⚠️ Admin Notifications Page Realtime Error. Starting polling fallback...');
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
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/Notification/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            await api.delete(`/Notification/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setSendError(null);
        setSendSuccess(false);

        try {
            await api.post('/Notification/broadcast', broadcastForm);
            setSendSuccess(true);
            setBroadcastForm({ title: '', message: '', type: 'system' });
            setTimeout(() => {
                setSendSuccess(false);
                setActiveTab('notifications');
            }, 2000);
        } catch (err: any) {
            setSendError(err.response?.data?.error || 'Gửi thông báo thất bại. Vui lòng thử lại.');
        } finally {
            setSending(false);
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
            case 'document': return '📄';
            case 'message': return '💬';
            case 'marketplace': return '🛒';
            case 'role_change': return '👤';
            case 'approval': return '✅';
            case 'rejection': return '❌';
            case 'deletion': return '🗑️';
            case 'system': return '⚙️';
            default: return '🔔';
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            <div className="flex items-center justify-between">

                <div>
                    <h2 className="text-2xl font-black text-slate-800">Quản lý thông báo</h2>
                    <p className="text-slate-500">Xem và gửi thông báo đến người dùng</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                            activeTab === 'notifications' 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <Bell size={16} className="inline mr-2" />
                        Thông báo
                        {unreadCount > 0 && (
                            <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('broadcast')}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                            activeTab === 'broadcast' 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <Send size={16} className="inline mr-2" />
                        Gửi thông báo
                    </button>
                </div>
            </div>

            {activeTab === 'notifications' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Notifications List */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800">Danh sách thông báo</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    Đánh dấu tất cả đã đọc
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <Bell size={48} className="mb-3 opacity-30" />
                                <p>Chưa có thông báo nào</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 hover:bg-slate-50 transition-colors ${
                                            !notification.isRead ? 'bg-indigo-50/50' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="text-2xl flex-shrink-0">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="font-semibold text-slate-800 text-sm">
                                                        {notification.title}
                                                    </h4>
                                                    <button
                                                        onClick={() => deleteNotification(notification.id)}
                                                        className="text-slate-400 hover:text-red-600 flex-shrink-0"
                                                    >
                                                        <Trash2 size={16} />
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
                                                        <button
                                                            onClick={() => markAsRead(notification.id)}
                                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                                        >
                                                            Đánh dấu đã đọc
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="space-y-4">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-4">Tổng quan</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Tổng thông báo</span>
                                    <span className="font-bold text-slate-800">{notifications.length}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Chưa đọc</span>
                                    <span className="font-bold text-indigo-600">{unreadCount}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Đã đọc</span>
                                    <span className="font-bold text-green-600">{notifications.length - unreadCount}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="text-indigo-600 flex-shrink-0 mt-0.5" size={20} />
                                <div>
                                    <h4 className="font-bold text-indigo-900">Chế độ Realtime</h4>
                                    <p className="text-sm text-indigo-700 mt-1">
                                        Hệ thống đang lắng nghe realtime. Thông báo mới sẽ tự động cập nhật mà không cần tải lại trang.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Broadcast Form */
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        {sendSuccess ? (
                            <div className="py-12 flex flex-col items-center text-center animate-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle2 size={40} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">Gửi thông báo thành công!</h3>
                                <p className="text-slate-500 mt-2">Tất cả người dùng đã nhận được thông báo.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleBroadcast} className="space-y-6">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Send size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800">Gửi thông báo đến tất cả người dùng</h3>
                                    <p className="text-slate-500 text-sm mt-1">Thông báo này sẽ được gửi đến tất cả thành viên trong hệ thống.</p>
                                </div>

                                {sendError && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                                        <AlertCircle size={18} />
                                        {sendError}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Loại thông báo</label>
                                    <select
                                        value={broadcastForm.type}
                                        onChange={(e) => setBroadcastForm({ ...broadcastForm, type: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="system">⚙️ Thông báo hệ thống</option>
                                        <option value="document">📄 Tài liệu</option>
                                        <option value="message">💬 Tin nhắn</option>
                                        <option value="approval">✅ Thông báo chung</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Tiêu đề</label>
                                    <input
                                        type="text"
                                        required
                                        value={broadcastForm.title}
                                        onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                                        placeholder="Nhập tiêu đề thông báo"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Nội dung</label>
                                    <textarea
                                        rows={5}
                                        required
                                        value={broadcastForm.message}
                                        onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                                        placeholder="Nhập nội dung thông báo..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                    ></textarea>
                                </div>

                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 text-amber-700">
                                    <AlertCircle size={20} className="flex-shrink-0" />
                                    <p className="text-xs">Lưu ý: Thông báo sẽ được gửi đến TẤT CẢ người dùng trong hệ thống. Hãy đảm bảo nội dung phù hợp.</p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {sending ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Đang gửi...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={18} />
                                            Gửi thông báo
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminNotifications;
