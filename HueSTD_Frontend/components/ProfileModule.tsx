
import React, { useState, useEffect, useRef } from 'react';
import { User, Document } from '../types';
import {
  Award,
  BookOpen,
  Download,
  Edit2,
  Eye,
  FileText,
  Shield,
  Star,
  TrendingUp,
  Calendar,
  Settings,
  Mail,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import EditProfileModal from './EditProfileModal';
import api from '../services/api';
import { examService, ExamDocument } from '../services/examService';
import { supabase } from '../services/supabase';

interface ProfileModuleProps {
  user: User;
}

const ProfileModule: React.FC<ProfileModuleProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'docs' | 'exams' | 'stats'>('docs');
  const [showEditModal, setShowEditModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Pagination states
  const [docs, setDocs] = useState<Document[]>([]);
  const [myExams, setMyExams] = useState<ExamDocument[]>([]);
  const [docPage, setDocPage] = useState(1);
  const [examPage, setExamPage] = useState(1);
  const [totalDocPages, setTotalDocPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleProfileUpdated = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Define fetch functions BEFORE useEffect to avoid closure issues
  const fetchDocuments = async (page: number) => {
    console.log('[ProfileModule] Fetching documents...');
    setLoading(true);
    try {
      const response = await api.get(`/Profile/my-documents?page=${page}&pageSize=3`);
      const items = Array.isArray(response.data?.items) ? response.data.items : [];
      console.log('[ProfileModule] Documents fetched:', items);
      setDocs(items);
      setTotalDocPages(response.data?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyExams = async (page: number) => {
    setLoading(true);
    try {
      const data = await examService.getMyExams();
      const exams = Array.isArray(data) ? data : [];
      setMyExams(exams);
    } catch (error) {
      console.error('Error fetching exams:', error);
      setMyExams([]);
    } finally {
      setLoading(false);
    }
  };

  // Listen for global refresh events - triggered by DocumentModule's Realtime subscription
  // This is more reliable than having duplicate Supabase subscriptions
  useEffect(() => {
    console.log('[ProfileModule] Setting up global event listeners...');

    const handleDocumentRefresh = () => {
      console.log('🔥 [ProfileModule] Received REFRESH_DOCUMENTS event, refreshing...');
      if (activeTab === 'docs') {
        fetchDocuments(docPage);
      }
    };

    const handleExamRefresh = () => {
      console.log('🔥 [ProfileModule] Received REFRESH_EXAMS event, refreshing...');
      if (activeTab === 'exams') {
        fetchMyExams(examPage);
      }
    };

    window.addEventListener('REFRESH_DOCUMENTS', handleDocumentRefresh);
    window.addEventListener('REFRESH_EXAMS', handleExamRefresh);

    console.log('✅ Profile Global Event Listeners Ready');

    return () => {
      window.removeEventListener('REFRESH_DOCUMENTS', handleDocumentRefresh);
      window.removeEventListener('REFRESH_EXAMS', handleExamRefresh);
    };
  }, [activeTab, docPage, examPage]);

  // Direct Supabase Realtime subscription for profile data
  useEffect(() => {
    console.log('[ProfileModule] Setting up direct Supabase realtime subscription...');

    // Debounce ref for realtime updates
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = (type: 'docs' | 'exams') => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (type === 'docs') {
          fetchDocuments(docPage);
        } else if (type === 'exams') {
          fetchMyExams(examPage);
        }
      }, 500);
    };

    // Fallback polling every 30 seconds
    let pollingInterval: NodeJS.Timeout | null = null;
    const startPolling = () => {
      if (!pollingInterval) {
        console.log('[ProfileModule] Starting polling fallback...');
        pollingInterval = setInterval(() => {
          console.log('[ProfileModule] Polling for updates...');
          if (activeTab === 'docs') {
            fetchDocuments(docPage);
          } else if (activeTab === 'exams') {
            fetchMyExams(examPage);
          }
        }, 30000);
      }
    };

    const channel = supabase
      .channel('profile_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documents' }, (payload) => {
        console.log('[ProfileModule] New document inserted:', payload);
        debouncedFetch('docs');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents' }, (payload) => {
        console.log('[ProfileModule] Document updated:', payload);
        debouncedFetch('docs');
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'documents' }, (payload) => {
        console.log('[ProfileModule] Document deleted:', payload);
        debouncedFetch('docs');
      })
      .subscribe((status) => {
        console.log('[ProfileModule] Realtime Status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Profile Realtime Connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Profile Realtime Error. Starting polling fallback...');
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
  }, [activeTab, docPage, examPage]);

  // Fetch data when tab changes or refreshKey updates
  useEffect(() => {
    if (activeTab === 'docs') {
      fetchDocuments(docPage);
    } else if (activeTab === 'exams') {
      fetchMyExams(examPage);
    }
  }, [activeTab, docPage, examPage, refreshKey]);

  return (
    <>
      <style>{`
        @keyframes rainbowShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes rainbowGlow {
          0% {
            opacity: 0.25;
            transform: scale(1) rotate(0deg);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.08) rotate(8deg);
          }
          100% {
            opacity: 0.25;
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        currentUser={{
          name: user.name,
          school: user.school,
          major: user.major,
          avatar: user.avatar,
        }}
        onProfileUpdated={handleProfileUpdated}
      />

      <div className="space-y-6 animate-in fade-in duration-700 max-w-6xl mx-auto pb-12">
        {/* Header Section - Modern Overlapping Design */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden relative">
          {/* 7-Color Rainbow Animated Cover */}
          <div
            className="h-44 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #4400ff, #ff00ff)',
              backgroundSize: '400% 400%',
              animation: 'rainbowShift 20s ease infinite',
            }}
          >
            {/* Floating rainbow glow blobs */}
            {[
              { w: '70%', h: '70%', top: '-15%', left: '-10%', delay: '0s', dur: '12s' },
              { w: '60%', h: '60%', top: '30%', left: '60%', delay: '-4s', dur: '15s' },
              { w: '80%', h: '80%', top: '-5%', left: '30%', delay: '-8s', dur: '10s' },
              { w: '50%', h: '50%', top: '20%', left: '80%', delay: '-2s', dur: '14s' },
            ].map((b, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: b.w,
                  height: b.h,
                  top: b.top,
                  left: b.left,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.08))',
                  animationName: 'rainbowGlow',
                  animationDuration: b.dur,
                  animationDelay: b.delay,
                  animationTimingFunction: 'ease-in-out',
                  animationDirection: 'alternate',
                  animationIterationCount: 'infinite',
                  backdropFilter: 'blur(8px)',
                }}
              />
            ))}

            {/* Grid overlay for texture */}
            <svg className="absolute inset-0 opacity-20" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="rainbowGrid" patternUnits="userSpaceOnUse" width="20" height="20">
                  <path d="M0,0 L20,0 L20,20 L0,20 Z M10,0 L10,20 M0,10 L20,10" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" fill="none" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#rainbowGrid)" />
            </svg>

            {/* Dark overlay for settings button readability */}
            <div className="absolute inset-0 bg-black/20" />

            {/* Settings button */}
            <button
              onClick={() => setShowEditModal(true)}
              className="absolute top-6 right-6 p-2.5 bg-white/30 backdrop-blur-md rounded-xl text-white hover:bg-white/50 transition-all border border-white/30 shadow-lg z-10"
            >
              <Settings size={20} />
            </button>
          </div>

          {/* Profile Info Overlay */}
          <div className="px-8 pb-8 flex flex-col md:flex-row items-center md:items-end -mt-16 gap-6 relative">
            <div className="relative group shrink-0">
              <div className="p-1 bg-white rounded-[2.2rem] shadow-2xl">
                <img
                  src={user.avatar}
                  className="w-32 h-32 rounded-[2rem] object-cover bg-slate-100"
                  alt={user.name}
                />
              </div>
              <button
                onClick={() => setShowEditModal(true)}
                className="absolute bottom-1 right-1 p-2.5 bg-teal-600 text-white rounded-xl shadow-lg hover:bg-teal-700 transition-all border-2 border-white group-hover:scale-110"
              >
                <Edit2 size={14} />
              </button>
            </div>

            <div className="flex-1 pb-1 text-center md:text-left space-y-1.5">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">{user.name}</h1>
                <span className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-teal-100/50">
                  <Shield size={12} /> {user.badge}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-slate-400 text-[13px] font-bold">
                <span className="flex items-center gap-1.5">
                  <GraduationCap size={16} className="text-teal-500" /> {user.school}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen size={16} className="text-teal-500" /> {user.major}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail size={16} className="text-teal-500" /> {user.email}
                </span>
              </div>
            </div>

            {/* Points & Rank Stats Cards */}
            <div className="flex gap-4 md:pb-1 shrink-0">
              <div className="text-center bg-teal-50/50 px-6 py-4 rounded-3xl border border-teal-100 min-w-[100px] shadow-sm">
                <p className="text-[10px] text-teal-600/70 font-black uppercase tracking-widest mb-1">Điểm</p>
                <p className="text-2xl font-black text-teal-700 leading-none">{user.points}</p>
              </div>
              <div className="text-center bg-orange-50/50 px-6 py-4 rounded-3xl border border-orange-100 min-w-[100px] shadow-sm">
                <p className="text-[10px] text-orange-600/70 font-black uppercase tracking-widest mb-1">Hạng</p>
                <p className="text-2xl font-black text-orange-700 leading-none">#{user.rank || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Stats Sidebar (3/12) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] flex items-center gap-2 px-1">
                <TrendingUp size={14} className="text-teal-600" /> Thành tích
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                      <FileText size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-600">Tài liệu đã đăng</span>
                  </div>
                  <span className="text-sm font-black text-slate-800">{user.totalDocuments || 0}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                      <Download size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-600">Lượt tải</span>
                  </div>
                  <span className="text-sm font-black text-slate-800">
                    {user.totalDownloads && user.totalDownloads >= 1000
                      ? `${(user.totalDownloads / 1000).toFixed(1)}k`
                      : user.totalDownloads || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-5">
              <h3 className="font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] px-1">Huy hiệu</h3>
              <div className="flex flex-wrap gap-3 px-1">
                <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner border border-amber-200/50" title="Người đóng góp tích cực">
                  <Award size={22} />
                </div>
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner border border-blue-200/50" title="Thành viên cũ">
                  <Star size={22} />
                </div>
                <div className="w-11 h-11 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center border-2 border-dashed border-slate-200 opacity-40">
                  <Shield size={22} />
                </div>
              </div>
            </div>
          </div>

          {/* Main Tabs & List Content (9/12) */}
          <div className="lg:col-span-9 space-y-6">
            <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
              <button
                onClick={() => setActiveTab('docs')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-black transition-all ${activeTab === 'docs'
                  ? 'bg-teal-600 text-white shadow-xl shadow-teal-100'
                  : 'text-slate-500 hover:bg-slate-50'
                  }`}
              >
                <FileText size={16} /> Tài liệu của tôi
              </button>
              <button
                onClick={() => setActiveTab('exams')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-black transition-all ${activeTab === 'exams'
                  ? 'bg-teal-600 text-white shadow-xl shadow-teal-100'
                  : 'text-slate-500 hover:bg-slate-50'
                  }`}
              >
                <FileText size={16} /> Kho đề thi cá nhân
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-black transition-all ${activeTab === 'stats'
                  ? 'bg-teal-600 text-white shadow-xl shadow-teal-100'
                  : 'text-slate-500 hover:bg-slate-50'
                  }`}
              >
                <TrendingUp size={16} /> Thống kê chi tiết
              </button>
            </div>

            <div className="min-h-[400px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 gap-3">
                  <Loader2 size={40} className="animate-spin text-teal-600" />
                  <p className="font-bold text-sm">Đang tải dữ liệu...</p>
                </div>
              ) : (
                <>
                  {activeTab === 'docs' && (
                    <div className="space-y-4">
                      {docs.length > 0 ? (
                        <>
                          <div className="space-y-4">
                            {docs.map(doc => (
                              <div key={doc.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 hover:border-teal-200 transition-all flex items-center justify-between group shadow-sm hover:shadow-md animate-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center gap-5">
                                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors border border-transparent group-hover:border-teal-100">
                                    <FileText size={28} />
                                  </div>
                                  <div className="space-y-1.5">
                                    <h4 className="font-bold text-slate-800 text-base leading-tight line-clamp-1">{doc.title}</h4>
                                    <div className="flex items-center gap-4 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                      <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-md"><Eye size={12} className="text-teal-500" /> {doc.views} views</span>
                                      <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-md"><Download size={12} className="text-teal-500" /> {doc.downloads} downloads</span>
                                      <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-md"><Calendar size={12} className="text-teal-500" /> {new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl border shadow-sm ${doc.status === 'active' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                    }`}>
                                    {doc.status === 'active' ? 'Đã duyệt' : 'Chờ duyệt'}
                                  </span>
                                  <button className="p-2.5 text-slate-300 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all border border-transparent hover:border-teal-100">
                                    <Edit2 size={18} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Pagination */}
                          {totalDocPages > 1 && (
                            <div className="flex items-center justify-center gap-4 mt-8">
                              <button
                                disabled={docPage === 1}
                                onClick={() => setDocPage(p => p - 1)}
                                className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-teal-600 disabled:opacity-30 transition-all shadow-sm"
                              >
                                <ChevronLeft size={20} />
                              </button>
                              <span className="text-sm font-black text-slate-600 bg-white px-5 py-2.5 rounded-xl border border-slate-100 shadow-sm">
                                Trang {docPage} / {totalDocPages}
                              </span>
                              <button
                                disabled={docPage === totalDocPages}
                                onClick={() => setDocPage(p => p + 1)}
                                className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-teal-600 disabled:opacity-30 transition-all shadow-sm"
                              >
                                <ChevronRight size={20} />
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[300px] bg-white rounded-[2.5rem] border border-slate-100 border-dashed text-slate-400 gap-4">
                          <FileText size={48} className="opacity-20" />
                          <p className="font-bold text-sm italic">Bạn chưa đăng tài liệu nào</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'exams' && (
                    <div className="space-y-6">
                      {myExams.length > 0 ? (
                        <>
                          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col max-h-[720px]">
                            <div className="shrink-0 px-7 py-6 bg-gradient-to-r from-teal-50 via-white to-emerald-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-600">Kho cá nhân</p>
                                <h3 className="text-xl font-black text-slate-800 mt-1">Đề thi của tôi</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1">Quản lý các đề thi bạn đã tạo thủ công hoặc lưu vào kho.</p>
                              </div>
                              <div className="flex items-center gap-3 text-xs font-black text-slate-500">
                                <span className="px-3 py-2 rounded-2xl bg-white border border-slate-100 shadow-sm">{myExams.length} đề thi</span>
                                <span className="px-3 py-2 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                  {myExams.reduce((sum, exam) => sum + (exam.questionCount ?? exam.questions?.length ?? 0), 0)} câu hỏi
                                </span>
                              </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/40 overscroll-contain">
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {myExams.map(exam => (
                                  <div key={exam.id ?? exam.title} className="group bg-white rounded-[2rem] border border-slate-100 p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-100/60 hover:border-teal-100 transition-all duration-300">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-100 shrink-0">
                                        <FileText size={23} />
                                      </div>
                                      <span className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl border shadow-sm ${exam.status === 'published'
                                        ? 'bg-green-50 text-green-600 border-green-100'
                                        : exam.status === 'ready'
                                          ? 'bg-blue-50 text-blue-600 border-blue-100'
                                          : 'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                        {exam.status === 'published' ? 'Đã xuất bản' : exam.status === 'ready' ? 'Sẵn sàng' : 'Bản nháp'}
                                      </span>
                                    </div>

                                    <div className="mt-5 space-y-2 min-h-[88px]">
                                      <h4 className="text-base font-black text-slate-800 line-clamp-2 leading-tight group-hover:text-teal-700 transition-colors">{exam.title}</h4>
                                      <p className="text-xs text-slate-500 line-clamp-2 font-bold leading-relaxed">{exam.description || 'Không có mô tả'}</p>
                                    </div>

                                    <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                                      <div className="rounded-2xl bg-slate-50 border border-slate-100 px-2 py-3">
                                        <Calendar size={14} className="text-teal-500 mx-auto mb-1" />
                                        <p className="text-[10px] font-black text-slate-500 truncate">{exam.createdAt ? new Date(exam.createdAt).toLocaleDateString('vi-VN') : 'Chưa rõ'}</p>
                                      </div>
                                      <div className="rounded-2xl bg-slate-50 border border-slate-100 px-2 py-3">
                                        <BookOpen size={14} className="text-teal-500 mx-auto mb-1" />
                                        <p className="text-[10px] font-black text-slate-500">{exam.questionCount ?? exam.questions?.length ?? 0} câu</p>
                                      </div>
                                      <div className="rounded-2xl bg-slate-50 border border-slate-100 px-2 py-3">
                                        <TrendingUp size={14} className="text-teal-500 mx-auto mb-1" />
                                        <p className="text-[10px] font-black text-slate-500">{exam.durationMinutes} phút</p>
                                      </div>
                                    </div>

                                    <button className="mt-5 w-full py-3 rounded-2xl bg-teal-50 text-teal-700 text-xs font-black hover:bg-teal-600 hover:text-white transition-all">
                                      Xem chi tiết
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[300px] bg-white rounded-[2.5rem] border border-slate-100 border-dashed text-slate-400 gap-4">
                          <FileText size={48} className="opacity-20" />
                          <p className="font-bold text-sm italic">Bạn chưa có đề thi nào trong kho cá nhân</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'stats' && (
                    <>
                      {/* Stats Grid */}
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {/* Total Documents */}
                        <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col items-center">
                          <div className="flex items-center justify-center w-12 h-12 bg-teal-50 rounded-lg">
                            <FileText size={20} className="text-teal-600" />
                          </div>
                          <h3 className="mt-4 text-2xl font-black text-slate-800">{docs.length}</h3>
                          <p className="mt-2 text-sm text-slate-500 uppercase tracking-wider">Tài liệu đã đăng</p>
                        </div>
                        {/* Total Views */}
                        <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col items-center">
                          <div className="flex items-center justify-center w-12 h-12 bg-blue-50 rounded-lg">
                            <Eye size={20} className="text-blue-600" />
                          </div>
                          <h3 className="mt-4 text-2xl font-black text-slate-800">{docs.reduce((sum, doc) => sum + doc.views, 0)}</h3>
                          <p className="mt-2 text-sm text-slate-500 uppercase tracking-wider">Tổng lượt xem</p>
                        </div>
                        {/* Total Downloads */}
                        <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col items-center">
                          <div className="flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-lg">
                            <Download size={20} className="text-emerald-600" />
                          </div>
                          <h3 className="mt-4 text-2xl font-black text-slate-800">{docs.reduce((sum, doc) => sum + doc.downloads, 0)}</h3>
                          <p className="mt-2 text-sm text-slate-500 uppercase tracking-wider">Tổng lượt tải</p>
                        </div>
                        {/* Total Exams */}
                        <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col items-center">
                          <div className="flex items-center justify-center w-12 h-12 bg-amber-50 rounded-lg">
                            <FileText size={20} className="text-amber-600" />
                          </div>
                          <h3 className="mt-4 text-2xl font-black text-slate-800">{myExams.length}</h3>
                          <p className="mt-2 text-sm text-slate-500 uppercase tracking-wider">Đề thi đã tạo</p>
                        </div>
                        {/* Total Questions */}
                        <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col items-center">
                          <div className="flex items-center justify-center w-12 h-12 bg-violet-50 rounded-lg">
                            <Calendar size={20} className="text-violet-600" />
                          </div>
                          <h3 className="mt-4 text-2xl font-black text-slate-800">
                            {myExams.reduce((sum, exam) => sum + (exam.questions?.length || 0), 0)}
                          </h3>
                          <p className="mt-2 text-sm text-slate-500 uppercase tracking-wider">Tổng câu hỏi</p>
                        </div>
                      </div>

                      {/* Refresh Button */}
                      <div className="mt-8 flex justify-center">
                        <button
                          onClick={() => handleProfileUpdated()}
                          className="bg-teal-600 text-white px-8 py-3 rounded-[1.5rem] font-[600] hover:bg-teal-700 transition-all shadow-md hover:shadow-lg"
                        >
                          Làm mới ngay
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileModule;
