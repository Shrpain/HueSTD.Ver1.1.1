import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, FileText, Download, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { supabase } from '../../services/supabase';

interface AdminStats {
    totalUsers: number;
    totalDocuments: number;
    totalDownloads: number;
    reportsCount: number;
    recentActivities: RecentActivity[];
}

interface RecentActivity {
    id: string;
    type: string;
    description: string;
    userName: string;
    userAvatar?: string;
    timestamp: string;
}

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [debugMessage, setDebugMessage] = useState<string>('');
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Refs for realtime updates
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFetchingRef = useRef(false);
    const fetchStatsRef = useRef<() => Promise<void>>();

    const fetchStats = useCallback(async (showLoading = false) => {
        // Prevent concurrent fetches
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            if (showLoading) {
                setLoading(true);
            }
            const response = await api.get('/Admin/stats');
            setStats(response.data);
            setError(null);
            console.log('[AdminDashboard] Stats fetched successfully:', response.data);
        } catch (err: any) {
            console.error('Failed to fetch admin stats:', err);
            if (showLoading) {
                setError('Không thể tải thống kê. Vui lòng thử lại.');
            }
        } finally {
            if (showLoading) {
                setLoading(false);
            }
            isFetchingRef.current = false;
        }
    }, []);

    // Keep ref updated with latest fetchStats
    fetchStatsRef.current = fetchStats;

    // Debounced fetch function - uses ref to always call latest version
    const debouncedFetch = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            console.log('[AdminDashboard] Debounced fetch triggered');
            // Call directly to bypass ref issue
            api.get('/Admin/stats')
                .then(response => {
                    console.log('[AdminDashboard] Stats fetched via realtime:', response.data);
                    setStats(response.data);
                    setError(null);
                    setDebugMessage(`Updated at ${new Date().toLocaleTimeString()}`);
                    setTimeout(() => setDebugMessage(''), 3000);
                })
                .catch(err => {
                    console.error('[AdminDashboard] Failed to fetch stats:', err);
                });
        }, 500);
    }, []);

    useEffect(() => {
        // Initial fetch
        fetchStats(true).then(() => setIsInitialLoad(false));

        // Fallback polling every 30 seconds if realtime fails
        let pollingInterval: NodeJS.Timeout | null = null;
        const startPolling = () => {
            if (!pollingInterval) {
                console.log('[AdminDashboard] Starting polling fallback...');
                pollingInterval = setInterval(() => {
                    console.log('[AdminDashboard] Polling for updates...');
                    fetchStats(false);
                }, 30000);
            }
        };

        // Realtime subscription for admin dashboard
        const channel = supabase
            .channel('admin_dashboard_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
                console.log('[AdminDashboard] New user registered:', payload);
                debouncedFetch();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
                console.log('[AdminDashboard] Profile updated:', payload);
                debouncedFetch();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documents' }, (payload) => {
                console.log('[AdminDashboard] New document uploaded:', payload);
                debouncedFetch();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents' }, (payload) => {
                console.log('[AdminDashboard] Document updated:', payload);
                debouncedFetch();
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'documents' }, (payload) => {
                console.log('[AdminDashboard] Document deleted:', payload);
                debouncedFetch();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
                console.log('[AdminDashboard] New notification:', payload);
                debouncedFetch();
            })
            .subscribe((status) => {
                console.log('[AdminDashboard] Realtime status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Admin Dashboard Realtime Connected');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('⚠️ Realtime disconnected, starting polling fallback');
                    startPolling();
                }
            });

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            supabase.removeChannel(channel);
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, []); // Empty dependency - only run once on mount

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} giờ trước`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} ngày trước`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                <p className="text-rose-700 font-semibold">{error || 'Lỗi không xác định'}</p>
                <button onClick={() => fetchStats(true)} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700">
                    Thử lại
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Debug message for realtime */}
            {debugMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg text-sm">
                    🔄 {debugMessage}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Tổng quan</h2>
                    <p className="text-slate-500">Chào mừng trở lại! Đây là báo cáo hôm nay.</p>
                </div>
                <button
                    onClick={() => fetchStats(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-2"
                >
                    <Loader2 className="w-4 h-4" />
                    Làm mới
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-slate-500 text-sm font-semibold mb-1">Tổng người dùng</p>
                        <h3 className="text-3xl font-black text-slate-800">{stats.totalUsers.toLocaleString()}</h3>
                        <p className="text-green-500 text-xs font-bold mt-2 flex items-center gap-1">
                            <TrendingUp size={12} /> Thực tế
                        </p>
                    </div>
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Users size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-slate-500 text-sm font-semibold mb-1">Tổng tài liệu</p>
                        <h3 className="text-3xl font-black text-slate-800">{stats.totalDocuments.toLocaleString()}</h3>
                        <p className="text-green-500 text-xs font-bold mt-2 flex items-center gap-1">
                            <TrendingUp size={12} /> Thực tế
                        </p>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <FileText size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-slate-500 text-sm font-semibold mb-1">Lượt tải xuống</p>
                        <h3 className="text-3xl font-black text-slate-800">{stats.totalDownloads.toLocaleString()}</h3>
                        <p className="text-green-500 text-xs font-bold mt-2 flex items-center gap-1">
                            <TrendingUp size={12} /> Thực tế
                        </p>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Download size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-slate-500 text-sm font-semibold mb-1">Báo cáo vi phạm</p>
                        <h3 className="text-3xl font-black text-slate-800">{stats.reportsCount}</h3>
                        <p className={`text-xs font-bold mt-2 flex items-center gap-1 ${stats.reportsCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                            {stats.reportsCount > 0 ? (
                                <><AlertTriangle size={12} /> Cần xử lý</>
                            ) : (
                                'Không có'
                            )}
                        </p>
                    </div>
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                        <AlertTriangle size={24} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px]">
                    <h3 className="font-bold text-slate-800 mb-4">Hoạt động gần đây</h3>
                    <div className="space-y-4">
                        {stats.recentActivities.length > 0 ? (
                            stats.recentActivities.map((activity) => (
                                <div key={activity.id} className="flex items-center gap-4 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                    <img
                                        src={activity.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activity.userName || 'U')}&background=0d9488&color=fff&size=40`}
                                        alt={activity.userName}
                                        className="w-10 h-10 rounded-full flex-shrink-0 border-2 border-slate-100"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-700 truncate">
                                            {activity.type === 'user_registered' ? (
                                                <span>
                                                    <span className="text-indigo-600">{activity.userName}</span>
                                                    <span className="text-slate-500 font-normal"> vừa đăng ký</span>
                                                </span>
                                            ) : activity.type === 'document_uploaded' ? (
                                                <span>
                                                    <span className="text-emerald-600">{activity.userName}</span>
                                                    <span className="text-slate-500 font-normal"> đã tải lên </span>
                                                    <span className="text-indigo-600">{activity.description.replace('Tài liệu mới: ', '')}</span>
                                                </span>
                                            ) : (
                                                activity.description
                                            )}
                                        </p>
                                        <p className="text-xs text-slate-400">{formatTimestamp(activity.timestamp)}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-400 text-center py-8">Chưa có hoạt động nào</p>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px]">
                    <h3 className="font-bold text-slate-800 mb-4">Biểu đồ tăng trưởng</h3>
                    <div className="flex items-center justify-center h-full text-slate-300">
                        (Biểu đồ sẽ hiển thị ở đây)
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
