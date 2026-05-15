import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Send, Loader2, AlertCircle, CheckCircle2, Trash2, Flag, Check } from 'lucide-react';
import api from '../../services/api';
import { chatService } from '../../services/chatService';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  referenceId?: string;
}

interface BroadcastForm {
  title: string;
  message: string;
  type: string;
}

const parseConversationIdFromReport = (message: string) => {
  const match = message.match(/Conversation:\s*([0-9a-fA-F-]{36})/);
  return match?.[1] ?? null;
};

const mapDbNotification = (payload: any): Notification & { userId?: string } => ({
  id: payload.id,
  title: payload.title,
  message: payload.message,
  type: payload.type,
  isRead: payload.is_read,
  createdAt: payload.created_at,
  referenceId: payload.reference_id,
  userId: payload.user_id,
});

const AdminNotifications: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notifications' | 'reports' | 'broadcast'>('notifications');
  const [broadcastForm, setBroadcastForm] = useState<BroadcastForm>({
    title: '',
    message: '',
    type: 'system',
  });
  const isFetchingRef = useRef(false);

  const fetchNotifications = useCallback(async (showLoading = true) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (showLoading) setLoading(true);
      const response = await api.get('/Notification?limit=50');
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;

    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void fetchNotifications(false);
      }, 500);
    };

    const startPolling = () => {
      if (pollingInterval) return;
      // Fallback polling every 30 seconds (standard fallback, not primary)
      pollingInterval = setInterval(() => {
        void fetchNotifications(false);
      }, 30000);
    };

    const handleRealtimeChange = (payload: any) => {
      console.log('[AdminNotifications] Realtime event received:', payload.eventType, payload);

      if (payload.eventType === 'INSERT') {
        const newNotification = mapDbNotification(payload.new);
        if (user?.id && newNotification.userId && newNotification.userId !== user.id) {
          return;
        }
        setNotifications((prev) => {
          if (prev.some((n) => n.id === newNotification.id)) return prev;
          console.log('[AdminNotifications] Adding new notification to UI');
          return [newNotification, ...prev];
        });
        setHighlightedId(newNotification.id);
        setTimeout(() => setHighlightedId((current) => (current === newNotification.id ? null : current)), 4000);

        if (newNotification.type === 'chat_report') {
          showToast({
            type: 'warning',
            title: 'Báo cáo chat mới',
            message: newNotification.title,
            duration: 4000,
          });
        } else {
          showToast({
            type: 'info',
            title: 'Thông báo mới',
            message: newNotification.title,
            duration: 3000,
          });
        }
      } else if (payload.eventType === 'UPDATE') {
        const updatedNotification = mapDbNotification(payload.new);
        setNotifications((prev) =>
          prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
        );
      } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old.id;
        setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
      }
    };

    // Use a unique channel name to avoid conflicts and force fresh subscription
    const channelName = `admin_notif_v2_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: user?.id ? `user_id=eq.${user.id}` : undefined,
        },
        handleRealtimeChange
      )
      .subscribe(async (status) => {
        console.log(`[AdminNotifications] Channel [${channelName}] status:`, status);
        if (status === 'SUBSCRIBED') {
          console.log('🚀 Realtime Subscribed successfully! Ready for new reports.');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[AdminNotifications] Realtime connection failed. Falling back to polling.');
          startPolling();
        }
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (pollingInterval) clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, user?.id]);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/Notification/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/Notification/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/Notification/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const deleteReportedMessage = async (notification: Notification) => {
    if (!notification.referenceId) {
      await deleteNotification(notification.id);
      return;
    }

    try {
      await chatService.adminDeleteMessage(notification.referenceId);

      const conversationId = parseConversationIdFromReport(notification.message);
      if (conversationId) {
        const channel = supabase.channel(`chat-typing:${conversationId}`, {
          config: {
            broadcast: { self: true },
          },
        });

        await new Promise<void>((resolve) => {
          channel.subscribe(async () => {
            await channel.send({
              type: 'broadcast',
              event: 'message_deleted',
              payload: { messageId: notification.referenceId },
            });
            await supabase.removeChannel(channel);
            resolve();
          });
        });
      }

      await deleteNotification(notification.id);
    } catch (error) {
      console.error('Failed to delete reported message:', error);
      window.alert('Không thể xóa tin nhắn này lúc này.');
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
    } catch (error: any) {
      setSendError(error.response?.data?.error || 'Gửi thông báo thất bại.');
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
      case 'document':
        return '📄';
      case 'message':
        return '💬';
      case 'approval':
        return '✅';
      case 'rejection':
        return '❌';
      case 'chat_report':
        return '🚩';
      default:
        return '🔔';
    }
  };

  const reportNotifications = notifications.filter((n) => n.type === 'chat_report');
  const generalNotifications = notifications.filter((n) => n.type !== 'chat_report');
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const unreadReportCount = reportNotifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Quản lý thông báo</h2>
          <p className="text-slate-500">Thông báo chung và báo cáo tin nhắn cho admin</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'notifications'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            } ${unreadCount > 0 ? 'animate-pulse' : ''}`}
          >
            <Bell size={16} className="inline mr-2" />
            Thông báo
            {unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">{unreadCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'reports'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            } ${unreadReportCount > 0 ? 'animate-pulse' : ''}`}
          >
            <Flag size={16} className="inline mr-2" />
            Báo cáo chat
            {unreadReportCount > 0 && (
              <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">{unreadReportCount}</span>
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

      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Danh sách thông báo</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                  Danh dấu tất cả đã đọc
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            ) : generalNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Bell size={48} className="mb-3 opacity-30" />
                <p>Chưa có thông báo nào</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {generalNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-50 transition-all ${!notification.isRead ? 'bg-indigo-50/50' : ''} ${
                      highlightedId === notification.id ? 'ring-2 ring-indigo-400 bg-indigo-50 ring-inset animate-pulse' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-slate-800 text-sm">{notification.title}</h4>
                          <button onClick={() => deleteNotification(notification.id)} className="text-slate-400 hover:text-red-600 flex-shrink-0">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">{notification.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-slate-500">{formatTime(notification.createdAt)}</span>
                          {!notification.isRead && (
                            <button onClick={() => markAsRead(notification.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                              Danh dấu đã đọc
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

          <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">Tong quan</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Thông báo thuong</span>
                  <span className="font-bold text-slate-800">{generalNotifications.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Báo cáo chat</span>
                  <span className="font-bold text-rose-600">{reportNotifications.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Chưa đọc</span>
                  <span className="font-bold text-indigo-600">{unreadCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Báo cáo tin nhắn</h3>
                <p className="text-sm text-slate-500 mt-1">Admin kiểm duyệt nguyên văn nội dung bị báo cáo</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
              </div>
            ) : reportNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Flag size={48} className="mb-3 opacity-30" />
                <p>Chưa có báo cáo chat nào</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {reportNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-5 transition-all ${
                      highlightedId === notification.id ? 'ring-2 ring-rose-400 bg-rose-50 ring-inset animate-pulse' :
                      !notification.isRead ? 'bg-rose-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🚩</span>
                          <h4 className="font-bold text-slate-800">{notification.title}</h4>
                          {!notification.isRead && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">Mới</span>
                          )}
                        </div>
                        <pre className="whitespace-pre-wrap break-words text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl p-4 font-sans">
                          {notification.message}
                        </pre>
                        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                          <span>{formatTime(notification.createdAt)}</span>
                          {notification.referenceId && <span className="font-mono text-slate-400">MessageId: {notification.referenceId}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                          >
                            <Check size={16} />
                            Đã duyệt
                          </button>
                        )}
                        <button
                          onClick={() => void deleteReportedMessage(notification)}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <Trash2 size={16} />
                          Xóa tin nhắn
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">Thống kê báo cáo</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Tổng báo cáo</span>
                  <span className="font-bold text-slate-800">{reportNotifications.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Chưa duyệt</span>
                  <span className="font-bold text-rose-600">{unreadReportCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Đã duyệt</span>
                  <span className="font-bold text-emerald-600">{reportNotifications.length - unreadReportCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-rose-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-bold text-rose-900">Xử lý báo cáo</h4>
                  <p className="text-sm text-rose-700 mt-1">
                    `Đã duyệt` sẽ giữ báo cáo như một mục đã xử lý. `Xóa tin nhắn` sẽ xóa tin nhắn gốc trong chat và đồng thời xóa mục báo cáo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'broadcast' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            {sendSuccess ? (
              <div className="py-12 flex flex-col items-center text-center animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Gửi thông báo thành công</h3>
                <p className="text-slate-500 mt-2">Tất cả người dùng đã nhận được thông báo.</p>
              </div>
            ) : (
              <form onSubmit={handleBroadcast} className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Gửi thông báo đến tất cả người dùng</h3>
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
                    <option value="system">Thông báo hệ thống</option>
                    <option value="document">Tài liệu</option>
                    <option value="message">Tin nhắn</option>
                    <option value="approval">Thông báo chung</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Tiêu đề</label>
                  <input
                    type="text"
                    required
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
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
