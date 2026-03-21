
import React, { useState, useEffect, useCallback } from 'react';
import { AppTab, Document } from '../types';
import { FileText, TrendingUp, Users, Download, Loader2 } from 'lucide-react';
import api from '../services/api';
import { supabase } from '../services/supabase';

interface DashboardProps {
  setActiveTab: (tab: AppTab) => void;
}

interface DashboardStats {
  totalDocuments: number;
  totalViews: number;
  totalDownloads: number;
  weeklyViews: number;
  weeklyDownloads: number;
  totalMembers: number;
}

interface UserRanking {
  fullName: string;
  publicId: string;
  avatarUrl?: string;
  points: number;
  rank: number;
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hotDocs, setHotDocs] = useState<Document[]>([]);
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = React.useCallback(async () => {
    // We only show loading on initial fetch
    try {
      const [statsRes, hotDocsRes, rankingsRes] = await Promise.all([
        api.get('/Dashboard/stats'),
        api.get('/Dashboard/hot-documents'),
        api.get('/Dashboard/rankings')
      ]);

      setStats(statsRes.data);
      setHotDocs(hotDocsRes.data);
      setRankings(rankingsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Realtime subscription for Dashboard stats
  useEffect(() => {
    // Debounce ref for realtime updates
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchDashboardData();
      }, 500);
    };

    // Fallback polling every 30 seconds
    let pollingInterval: NodeJS.Timeout | null = null;
    const startPolling = () => {
      if (!pollingInterval) {
        console.log('[Dashboard] Starting polling fallback...');
        pollingInterval = setInterval(() => {
          console.log('[Dashboard] Polling for updates...');
          fetchDashboardData();
        }, 30000);
      }
    };

    const channel = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documents' }, () => {
        console.log('[Dashboard] New document inserted');
        debouncedFetch();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents' }, () => {
        console.log('[Dashboard] Document updated');
        debouncedFetch();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => {
        console.log('[Dashboard] New user registered');
        debouncedFetch();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        console.log('[Dashboard] Profile updated');
        debouncedFetch();
      })
      .subscribe((status) => {
        console.log('[Dashboard] Realtime Status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Dashboard Realtime Connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Dashboard Realtime Error. Starting polling fallback...');
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
  }, [fetchDashboardData]);

  const statsList = [
    { label: 'Tài liệu', value: stats?.totalDocuments ?? '...', icon: <FileText className="text-teal-600" />, color: 'bg-teal-50' },
    { label: 'Lượt truy cập', value: stats?.totalViews ?? '...', icon: <TrendingUp className="text-blue-600" />, color: 'bg-blue-50' },
    { label: 'Lượt tải', value: stats?.totalDownloads ?? '...', icon: <Download className="text-emerald-600" />, color: 'bg-emerald-50' },
    { label: 'Thành viên', value: stats?.totalMembers ?? '...', icon: <Users className="text-purple-600" />, color: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-teal-100 relative overflow-hidden group transition-all duration-500 hover:shadow-2xl hover:shadow-teal-200">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2 transition-all duration-300 group-hover:translate-x-2">Chào mừng trở lại!</h1>
          <p className="opacity-90 max-w-lg transition-opacity duration-300 group-hover:opacity-100">
            HueSTD là nơi kết nối hàng nghìn sinh viên tại Thừa Thiên Huế. Chia sẻ tài liệu của bạn để nhận điểm thưởng và hỗ trợ cộng đồng.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => setActiveTab(AppTab.DOCUMENTS)}
              className="bg-white text-teal-700 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-95"
            >
              Tìm tài liệu ngay
            </button>
            <button
              onClick={() => setActiveTab(AppTab.DOCUMENTS)}
              className="bg-teal-500/30 backdrop-blur-md border border-white/30 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-500/50 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              Xem tài liệu
            </button>
          </div>
        </div>
        {/* Background decorative element */}
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl transition-all duration-700 group-hover:scale-150"></div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsList.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border shadow-sm flex items-center justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default group">
            <div className="group-hover:text-teal-600 transition-colors duration-300">
              <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-800 group-hover:text-teal-600 transition-colors duration-300">
                {loading ? <div className="h-8 w-16 bg-slate-100 animate-pulse rounded"></div> : stat.value}
              </h3>
            </div>
            <div className={`p-3 rounded-xl ${stat.color} group-hover:scale-110 transition-transform duration-300`}>{stat.icon}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Tài liệu HOT tuần này</h2>
            <button
              onClick={() => setActiveTab(AppTab.DOCUMENTS)}
              className="text-teal-600 text-sm font-semibold hover:underline"
            >
              Xem tất cả
            </button>
          </div>

          <div className="space-y-4">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 animate-pulse flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-50 rounded w-1/2"></div>
                  </div>
                </div>
              ))
            ) : hotDocs.length > 0 ? (
              hotDocs.map(doc => (
                <div key={doc.id} className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-teal-300 transition-all duration-300 flex items-center gap-4 group cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-all duration-300 group-hover:scale-110">
                    <FileText size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate group-hover:text-teal-700 transition-colors duration-300">{doc.title}</h4>
                    <p className="text-xs text-slate-500 group-hover:text-slate-600 transition-colors duration-300">Môn: {doc.subject} • Đăng bởi: {doc.uploaderName}</p>
                  </div>
                  <div className="text-right group-hover:scale-110 transition-transform duration-300">
                    <p className="text-sm font-bold text-slate-800">{doc.downloads?.toLocaleString() || 0}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Lượt tải</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed text-slate-400">
                Chưa có tài liệu nổi bật tuần này.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Bảng xếp hạng đóng góp</h2>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mb-2" />
                <span className="text-sm">Đang tải xếp hạng...</span>
              </div>
            ) : rankings.length > 0 ? (
              rankings.map((user, idx) => (
                <div key={user.publicId} className="flex items-center gap-3 p-4 border-b last:border-b-0 hover:bg-gradient-to-r hover:from-teal-50 hover:to-transparent transition-all duration-300 cursor-pointer group">
                  <span className={`w-6 text-center font-bold ${idx < 3 ? 'text-amber-500 group-hover:scale-110 transition-transform duration-300' : 'text-slate-400'}`}>
                    {user.rank}
                  </span>
                  <div className="relative">
                    <img
                      src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random`}
                      className="w-10 h-10 rounded-full border-2 border-white shadow-sm group-hover:scale-110 transition-transform duration-300"
                      alt={user.fullName}
                    />
                    {idx === 0 && <span className="absolute -top-1 -right-1 text-xs animate-bounce">👑</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-700 truncate group-hover:text-teal-700 transition-colors duration-300">{user.fullName}</div>
                    <div className="text-[10px] text-slate-400 uppercase group-hover:text-teal-600 transition-colors duration-300">{user.rank === 1 ? 'Hạng nhất' : 'Thành viên'}</div>
                  </div>
                  <div className="text-right group-hover:scale-110 transition-transform duration-300">
                    <div className="text-sm font-bold text-teal-700">{user.points?.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Điểm</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-sm">
                Chưa có dữ liệu xếp hạng.
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl text-white group hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            <h4 className="font-bold mb-2 group-hover:text-teal-400 transition-colors duration-300">Đóng góp của bạn</h4>
            <p className="text-xs text-slate-400 mb-4 group-hover:text-slate-300 transition-colors duration-300">Chia sẻ tài liệu ngay hôm nay để leo hạng và nhận những phần quà ý nghĩa từ HueSTD.</p>
            <button
              onClick={() => setActiveTab(AppTab.DOCUMENTS)}
              className="w-full bg-teal-600 py-2 rounded-xl text-sm font-bold hover:bg-teal-500 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/30 active:scale-95"
            >
              Tìm hiểu thêm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
