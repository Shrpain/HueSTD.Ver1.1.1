import React, { useState } from 'react';
import { Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

interface AdminModuleProps {
  initialTab?: 'support';
}

const AdminModule: React.FC<AdminModuleProps> = () => {
  const [submitted, setSubmitted] = useState(false);
  const [supportCategory, setSupportCategory] = useState('');
  const [supportTitle, setSupportTitle] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
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
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 5000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
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
              <label className="text-sm font-bold text-slate-700">Chủ đề liên hệ</label>
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
              <AlertCircle size={20} className="flex-shrink-0" />
              <p className="text-xs">Lưu ý: Nếu báo cáo tài liệu, vui lòng đính kèm ID hoặc đường dẫn tài liệu để chúng tôi xử lý nhanh nhất.</p>
            </div>

            <button
              type="submit"
              className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-teal-700 transition-all duration-300 shadow-lg shadow-teal-100 hover:shadow-teal-300 hover:shadow-xl hover:-translate-y-1 active:scale-95"
            >
              <Send size={18} />
              Gửi yêu cầu hỗ trợ
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminModule;
