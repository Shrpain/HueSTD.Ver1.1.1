import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Trash2, Calendar, Loader2, Filter, MailOpen, Mail } from 'lucide-react';
import api from '../services/api';
import { supabase } from '../services/supabase';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
    referenceId?: string;
}

const NotificationModule: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
    const [stats, setStats] = useState({ total: 0, unread: 0 });

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/Notification?limit=100');
            setNotifications(response.data);
            
            const unread = response.data.filter((n: Notification) => !n.isRead).length;
            setStats({ total: response.data.length, unread });
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();

        // Subscribe to realtime updates
        const setupRealtime = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            const channel = supabase
                .channel('notification_module_realtime')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
                    () => {
                        fetchNotifications();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        setupRealtime();
    }, [fetchNotifications]);

    const markAsRead = async (id: string) => {
        try {
            await api.put(`/Notification/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/Notification/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setStats(prev => ({ ...prev, unread: 0 }));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const deleteNotification = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return;
        try {
            await api.delete(`/Notification/${id}`);
            const deleted = notifications.find(n => n.id === id);
            setNotifications(prev => prev.filter(n => n.id !== id));
            setStats(prev => ({
                total: prev.total - 1,
                unread: deleted?.isRead ? prev.unread : Math.max(0, prev.unread - 1)
            }));
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') return !n.isRead;
        if (filter === 'read') return n.isRead;
        return true;
    });

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'document': return '📄';
            case 'approval': return '✅';
            case 'rejection': return '❌';
            case 'system': return '⚙️';
            default: return '🔔';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <Bell className="text-teal-600" size={32} />
                        Thông báo của tôi
                    </h2>
                    <p className="text-slate-500 font-medium">Bạn có {stats.unread} thông báo chưa đọc</p>
                </div>
                <div className="flex items-center gap-2">
                    {stats.unread > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="bg-teal-50 text-teal-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-teal-100 transition-all flex items-center gap-2"
                        >
                            <Check size={16} />
                            Đọc tất cả
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                {/* Filters */}
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    <Filter size={16} className="text-slate-400 ml-2 mr-1 shrink-0" />
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${
                            filter === 'all' ? 'bg-teal-600 text-white shadow-lg shadow-teal-100' : 'text-slate-500 hover:bg-white'
                        }`}
                    >
                        Tất cả
                    </button>
                    <button
                        onClick={() => setFilter('unread')}
                        className={`px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${
                            filter === 'unread' ? 'bg-teal-600 text-white shadow-lg shadow-teal-100' : 'text-slate-500 hover:bg-white'
                        }`}
                    >
                        Chưa đọc ({stats.unread})
                    </button>
                    <button
                        onClick={() => setFilter('read')}
                        className={`px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${
                            filter === 'read' ? 'bg-teal-600 text-white shadow-lg shadow-teal-100' : 'text-slate-500 hover:bg-white'
                        }`}
                    >
                        Đã đọc
                    </button>
                </div>

                {loading ? (
                    <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="animate-spin text-teal-600 mb-4" size={40} />
                        <p className="font-bold">Đang tải thông báo...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="p-20 flex flex-col items-center justify-center text-slate-400 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Bell size={40} className="opacity-20" />
                        </div>
                        <p className="font-bold text-lg text-slate-500">Trống trơn!</p>
                        <p className="text-sm">Bạn không có thông báo nào ở mục này.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filteredNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`p-5 flex items-start gap-4 hover:bg-slate-50/80 transition-all cursor-pointer group ${
                                    !notification.isRead ? 'bg-teal-50/30' : ''
                                }`}
                                onClick={() => !notification.isRead && markAsRead(notification.id)}
                            >
                                <div className="text-3xl shrink-0 h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-50 group-hover:scale-110 transition-transform">
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className={`text-base font-bold truncate ${
                                            !notification.isRead ? 'text-slate-900' : 'text-slate-600'
                                        }`}>
                                            {notification.title}
                                        </h4>
                                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!notification.isRead ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(notification.id);
                                                    }}
                                                    className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg"
                                                    title="Đánh dấu đã đọc"
                                                >
                                                    <MailOpen size={16} />
                                                </button>
                                            ) : (
                                                <div className="p-1.5 text-slate-300">
                                                    <Mail size={16} />
                                                </div>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notification.id);
                                                }}
                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                title="Xóa"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className={`text-sm mt-1 leading-relaxed ${
                                        !notification.isRead ? 'text-slate-700' : 'text-slate-500'
                                    }`}>
                                        {notification.message}
                                    </p>
                                    <div className="flex items-center gap-4 mt-3">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            <Calendar size={12} />
                                            {formatTime(notification.createdAt)}
                                        </div>
                                        {!notification.isRead && (
                                            <span className="flex items-center gap-1 text-[10px] font-black text-teal-600 bg-teal-100 px-2.5 py-0.5 rounded-full uppercase tracking-tighter">
                                                Mới
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationModule;
