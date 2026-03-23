import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Send, Loader2, AlertCircle, CheckCircle2, Trash2, Flag, Check } from 'lucide-react';
import api from '../../services/api';
import { chatService } from '../../services/chatService';
import { supabase } from '../../services/supabase';

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

const AdminNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
      pollingInterval = setInterval(() => {
        void fetchNotifications(false);
      }, 20000);
    };

    const channel = supabase
      .channel('admin_notifications_realtime_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, debouncedFetch)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          startPolling();
        }
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (pollingInterval) clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

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
      window.alert('Khong the xoa tin nhan nay luc nay.');
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
      setSendError(error.response?.data?.error || 'Gui thong bao that bai.');
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

    if (diffMins < 1) return 'Vua xong';
    if (diffMins < 60) return `${diffMins} phut truoc`;
    if (diffHours < 24) return `${diffHours} gio truoc`;
    if (diffDays < 7) return `${diffDays} ngay truoc`;
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
          <h2 className="text-2xl font-black text-slate-800">Quan ly thong bao</h2>
          <p className="text-slate-500">Thong bao chung va bao cao tin nhan cho admin</p>
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
            Thong bao
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
            }`}
          >
            <Flag size={16} className="inline mr-2" />
            Bao cao chat
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
            Gui thong bao
          </button>
        </div>
      </div>

      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Danh sach thong bao</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                  Danh dau tat ca da doc
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
                <p>Chua co thong bao nao</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {generalNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-50 transition-colors ${!notification.isRead ? 'bg-indigo-50/50' : ''}`}
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
                              Danh dau da doc
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
                  <span className="text-slate-600">Thong bao thuong</span>
                  <span className="font-bold text-slate-800">{generalNotifications.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Bao cao chat</span>
                  <span className="font-bold text-rose-600">{reportNotifications.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Chua doc</span>
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
                <h3 className="font-bold text-slate-800">Bao cao tin nhan</h3>
                <p className="text-sm text-slate-500 mt-1">Admin kiem duyet nguyen van noi dung bi bao cao</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
              </div>
            ) : reportNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Flag size={48} className="mb-3 opacity-30" />
                <p>Chua co bao cao chat nao</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {reportNotifications.map((notification) => (
                  <div key={notification.id} className={`p-5 ${!notification.isRead ? 'bg-rose-50/50' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🚩</span>
                          <h4 className="font-bold text-slate-800">{notification.title}</h4>
                          {!notification.isRead && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">Moi</span>
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
                            Da duyet
                          </button>
                        )}
                        <button
                          onClick={() => void deleteReportedMessage(notification)}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <Trash2 size={16} />
                          Xoa tin nhan
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
              <h3 className="font-bold text-slate-800 mb-4">Thong ke bao cao</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Tong bao cao</span>
                  <span className="font-bold text-slate-800">{reportNotifications.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Chua duyet</span>
                  <span className="font-bold text-rose-600">{unreadReportCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Da duyet</span>
                  <span className="font-bold text-emerald-600">{reportNotifications.length - unreadReportCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-rose-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-bold text-rose-900">Xu ly bao cao</h4>
                  <p className="text-sm text-rose-700 mt-1">
                    `Da duyet` se giu bao cao nhu mot muc da xu ly. `Xoa tin nhan` se xoa tin nhan goc trong chat va dong thoi xoa muc bao cao.
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
                <h3 className="text-xl font-bold text-slate-800">Gui thong bao thanh cong</h3>
                <p className="text-slate-500 mt-2">Tat ca nguoi dung da nhan duoc thong bao.</p>
              </div>
            ) : (
              <form onSubmit={handleBroadcast} className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Gui thong bao den tat ca nguoi dung</h3>
                </div>

                {sendError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                    <AlertCircle size={18} />
                    {sendError}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Loai thong bao</label>
                  <select
                    value={broadcastForm.type}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="system">Thong bao he thong</option>
                    <option value="document">Tai lieu</option>
                    <option value="message">Tin nhan</option>
                    <option value="approval">Thong bao chung</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Tieu de</label>
                  <input
                    type="text"
                    required
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Noi dung</label>
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
                      Dang gui...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Gui thong bao
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
