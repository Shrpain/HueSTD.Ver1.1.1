import React, { useState } from 'react';
import { X, Mail, Lock, User, GraduationCap, ArrowRight, Github, Chrome } from 'lucide-react';
import api from '../services/api';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { HUE_UNIVERSITIES } from '../constants';

interface AuthModuleProps {
  onClose: () => void;
  onLoginSuccess: () => void;
}

const AuthModule: React.FC<AuthModuleProps> = ({ onClose, onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { login, refreshUser } = useAuth();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [school, setSchool] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        const response = await api.post('/Auth/login', { email, password });
        login(response.data.accessToken, response.data.refreshToken, response.data.user);
        setSuccess('Đăng nhập thành công! Đang chuyển hướng...');
        setTimeout(() => onLoginSuccess(), 1000);
      } else {
        const response = await api.post('/Auth/register', {
          email,
          password,
          fullName,
          school,
        });
        login(response.data.accessToken, response.data.refreshToken, response.data.user);
        
        // Refresh to get full profile data (e.g. from DB triggers)
        try {
          await refreshUser();
        } catch (e) {
          console.warn('Refresh failed', e);
        }

        setSuccess('Đăng ký thành công! Chào mừng bạn đến với HueSTD!');
        setTimeout(() => onLoginSuccess(), 1500);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname || '/'}`;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthError) {
        setError(oauthError.message || 'Đăng nhập Google thất bại.');
        setLoading(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={onClose}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 md:p-10">
          <div className="text-center space-y-2 mb-8">
            <div className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white font-black mx-auto shadow-xl shadow-teal-100 mb-4 text-xl">
              H
            </div>
            <h2 className="text-3xl font-black text-slate-800">
              {mode === 'login' ? 'Chào mừng trở lại!' : 'Tham gia HueSTD'}
            </h2>
            <p className="text-slate-500 font-medium">
              {mode === 'login'
                ? 'Đăng nhập để tiếp tục kết nối cùng sinh viên Huế'
                : 'Tạo tài khoản để bắt đầu chia sẻ và học tập ngay'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium text-center">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm font-medium text-center">
                {success}
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    placeholder="Họ và tên"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select
                    required
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none appearance-none text-slate-700"
                  >
                    <option value="">Chọn trường đại học</option>
                    {HUE_UNIVERSITIES.map((univ) => (
                      <option key={univ} value={univ}>{univ}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                required
                placeholder="Email sinh viên (@hueuni.edu.vn)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                required
                placeholder="Mật khẩu (8+ ký tự, A-Z, a-z, 0-9)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none placeholder:text-slate-400"
              />
            </div>
            {mode === 'register' && (
              <p className="text-[10px] text-slate-400 font-medium px-2">
                * Mật khẩu tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường và chữ số.
              </p>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" className="text-xs font-bold text-teal-600 hover:underline">Quên mật khẩu?</button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 space-y-6">
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-slate-100"></div>
              <span className="px-4 text-[10px] text-slate-400 font-black uppercase tracking-widest">Hoặc tiếp tục với</span>
              <div className="flex-1 border-t border-slate-100"></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all font-bold text-sm text-slate-700 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Chrome size={18} className="text-red-500" />
                Google
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all font-bold text-sm text-slate-700 active:scale-95 opacity-60 cursor-not-allowed"
                title="Sắp ra mắt"
              >
                <Github size={18} className="text-slate-900" />
                Github
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-slate-500 font-medium">
                {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                <button
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="ml-2 text-teal-600 font-black hover:underline transition-all"
                >
                  {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập ngay'}
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 text-center">
          <p className="text-[10px] text-slate-400 font-bold leading-relaxed max-w-xs mx-auto">
            Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật của HueSTD.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModule;
