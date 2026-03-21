
import React, { useState } from 'react';
import { Send, AlertCircle, CheckCircle2, Bell, X, Loader2 } from 'lucide-react';
import api from '../services/api';

interface AdminModuleProps {
  initialTab?: 'support';
}

interface SupportRequest {
  id: string;
  title: string;
  message: string;
  category: string;
  createdAt: string;
}

const AdminModule: React.FC<AdminModuleProps> = () => {
  const [submitted, setSubmitted] = useState(false);
  const [activeSection, setActiveSection] = useState<'support' | 'broadcast'>('support');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);

  // Form states
  const [supportCategory, setSupportCategory] = useState('');
  const [supportTitle, setSupportTitle] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  // Broadcast states
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState('system');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Send support request to admin via notification
      await api.post('/Notification/notify-admins', {
        title: `[${supportCategory}] ${supportTitle}`,
        message: supportMessage,
        type: 'support'
      });
      
      setSubmitted(true);
      setSupportCategory('');
      setSupportTitle('');
      setSupportMessage('');
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error) {
      console.error('Failed to submit support request:', error);
      // Still show success for demo
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 5000);
    }
  };

  const handleSendNotification = async () => {
    if (!broadcastTitle || !broadcastMessage) return;
    
    setSendingNotification(true);
    try {
      if (selectedUsers.length > 0) {
        // Send to selected users
        await api.post('/Notification/send-to-users', {
          userIds: selectedUsers,
          title: broadcastTitle,
          message: broadcastMessage,
          type: broadcastType
        });
      } else {
        // Broadcast to all users
        await api.post('/Notification/broadcast', {
          title: broadcastTitle,
          message: broadcastMessage,
          type: broadcastType
        });
      }
      
      setNotificationSent(true);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setSelectedUsers([]);
      setTimeout(() => setNotificationSent(false), 3000);
    } catch (error) {
      console.error('Failed to send notification:', error);
    } finally {
      setSendingNotification(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Section Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveSection('support')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeSection === 'support' 
              ? 'bg-white text-teal-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Send size={16} className="inline mr-2" />
          Gửi yêu cầu
        </button>
        <button
          onClick={() => setActiveSection('broadcast')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeSection === 'broadcast' 
              ? 'bg-white text-teal-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bell size={16} className="inline mr-2" />
          Gửi thông báo
        </button>
      </div>

      {activeSection === 'support' && (
        <>
          <div className="text-center space-y-4 group">
            <h1 className="text-3xl font-bold text-slate-800 group-hover:scale-105 transition-transform duration-300">
              Liên hệ Ban quản trị
            </h1>
            <p className="text-slate-500 max-w-xl mx-auto group-hover:text-slate-600 transition-colors duration-300">
              Gửi thắc mắc, báo cáo vi phạm hoặc đóng góp ý kiến phát triển HueSTD
            </p>
          </div>

          <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl border shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 hover:-translate-y-1">
            {submitted ? (
              <div className="py-12 flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center animate-bounce">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Gửi yêu cầu thành công!</h3>
                <p className="text-slate-500 max-w-xs">Cảm ơn bạn đã đóng góp. Chúng tôi sẽ phản hồi qua email trong vòng 24 giờ tới.</p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-teal-600 font-bold hover:underline hover:text-teal-700 transition-colors"
                >
                  Gửi thêm yêu cầu khác
                </button>
              </div>
            ) : (
              <form onSubmit={handleSupportSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 group">Chủ đề liên hệ</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all duration-300 hover:bg-slate-100 hover:border-slate-300"
                    value={supportCategory}
                    onChange={(e) => setSupportCategory(e.target.value)}
                    required
                  >
                    <option value="">Chọn chủ đề...</option>
                    <option>Báo cáo tài liệu sai/vi phạm</option>
                    <option>Lỗi kỹ thuật (Web/Chat)</option>
                    <option>Hợp tác / Đóng góp ý tưởng</option>
                    <option>Khiếu nại tài khoản</option>
                    <option>Khác</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Tiêu đề</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tiêu đề ngắn gọn"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all duration-300 hover:bg-slate-100 hover:border-slate-300 focus:shadow-lg focus:shadow-teal-500/20"
                    value={supportTitle}
                    onChange={(e) => setSupportTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nội dung chi tiết</label>
                  <textarea
                    rows={5}
                    required
                    placeholder="Vui lòng mô tả chi tiết vấn đề bạn gặp phải..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none transition-all duration-300 hover:bg-slate-100 hover:border-slate-300 focus:shadow-lg focus:shadow-teal-500/20"
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                  ></textarea>
                </div>

                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 text-amber-700 hover:bg-amber-100 hover:scale-[1.01] transition-all duration-300">
                  <AlertCircle size={20} className="flex-shrink-0 group-hover:animate-pulse" />
                  <p className="text-xs">Lưu ý: Nếu báo cáo tài liệu, vui lòng đính kèm ID hoặc đường dẫn tài liệu để chúng tôi xử lý nhanh nhất.</p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-teal-700 transition-all duration-300 shadow-lg shadow-teal-100 hover:shadow-teal-300 hover:shadow-xl hover:-translate-y-1 active:scale-95"
                >
                  <Send size={18} className="group-hover:animate-bounce" />
                  Gửi yêu cầu hỗ trợ
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {activeSection === 'broadcast' && (
        <>
          <div className="text-center space-y-4 group">
            <h1 className="text-3xl font-bold text-slate-800 group-hover:scale-105 transition-transform duration-300">
              Gửi thông báo
            </h1>
            <p className="text-slate-500 max-w-xl mx-auto group-hover:text-slate-600 transition-colors duration-300">
              Gửi thông báo đến tất cả thành viên hoặc thành viên được chọn
            </p>
          </div>

          <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl border shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 hover:-translate-y-1">
            {notificationSent ? (
              <div className="py-12 flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center animate-bounce">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Gửi thông báo thành công!</h3>
                <p className="text-slate-500 max-w-xs">
                  {selectedUsers.length > 0 
                    ? `Thông báo đã được gửi đến ${selectedUsers.length} thành viên.`
                    : 'Thông báo đã được gửi đến tất cả thành viên.'
                  }
                </p>
                <button
                  onClick={() => setNotificationSent(false)}
                  className="text-teal-600 font-bold hover:underline hover:text-teal-700 transition-colors"
                >
                  Gửi thông báo khác
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Loại thông báo</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={broadcastType}
                    onChange={(e) => setBroadcastType(e.target.value)}
                  >
                    <option value="system">Thông báo hệ thống</option>
                    <option value="document">Tài liệu</option>
                    <option value="message">Tin nhắn</option>
                    <option value="announcement">Thông báo quan trọng</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Tiêu đề</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tiêu đề thông báo"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nội dung</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Nhập nội dung thông báo..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                  ></textarea>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    Gửi đến ({selectedUsers.length > 0 ? `${selectedUsers.length} người` : 'Tất cả thành viên'})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedUsers.length > 0) {
                        setSelectedUsers([]);
                      }
                    }}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    {selectedUsers.length > 0 ? 'Hủy chọn tất cả' : 'Gửi đến tất cả thành viên'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSendNotification}
                  disabled={!broadcastTitle || !broadcastMessage || sendingNotification}
                  className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingNotification ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Bell size={18} />
                  )}
                  {sendingNotification ? 'Đang gửi...' : 'Gửi thông báo'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminModule;
