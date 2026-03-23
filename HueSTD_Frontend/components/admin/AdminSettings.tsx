import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Key, Save, Eye, EyeOff, AlertCircle, CheckCircle, Bot, Users, RotateCcw, Lock, Unlock, Check, X, Search, ChevronLeft, ChevronRight, Loader2, Database, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { supabase } from '../../services/supabase';

interface UserAiUsage {
    userId: string;
    fullName?: string;
    email?: string;
    avatarUrl?: string;
    apiKey?: string;
    messageLimit: number;
    messagesUsed: number;
    isUnlocked: boolean;
    remaining: number;
    createdAt: string;
    updatedAt: string;
}

/*
interface UnlockRequest {
    id: string;
    userId: string;
    userFullName?: string;
    userEmail?: string;
    message?: string;
    status: string;
    adminNote?: string;
    createdAt: string;
}
*/

const PAGE_SIZE = 10;

const AdminSettings: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const tabFromUrl = (t: string | null): 'general' | 'custom' | 'api' => {
        if (t === 'custom') return 'custom';
        if (t === 'api') return 'api';
        return 'general';
    };
    const [activeTab, setActiveTab] = useState<'general' | 'custom' | 'api'>(() =>
        tabFromUrl(searchParams.get('tab'))
    );

    useEffect(() => {
        setActiveTab(tabFromUrl(searchParams.get('tab')));
    }, [searchParams]);

    const handleTabChange = (tab: 'general' | 'custom' | 'api') => {
        setActiveTab(tab);
        if (tab === 'custom') {
            navigate('/admin/settings?tab=custom', { replace: true });
        } else if (tab === 'api') {
            navigate('/admin/settings?tab=api', { replace: true });
        } else {
            navigate('/admin/settings', { replace: true });
        }
    };

    // General settings
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gemini-3-flash');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Custom user settings
    const [userUsages, setUserUsages] = useState<UserAiUsage[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    // const [unlockRequests, setUnlockRequests] = useState<UnlockRequest[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ messageLimit: 10, apiKey: '', isUnlocked: false });
    const [processing, setProcessing] = useState<string | null>(null);
    const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

    // Quản lý API — user đã được cấp API key riêng
    const [dedicatedApiUsers, setDedicatedApiUsers] = useState<UserAiUsage[]>([]);
    const [loadingDedicatedApi, setLoadingDedicatedApi] = useState(false);
    const [revealedKeyUserId, setRevealedKeyUserId] = useState<string | null>(null);
    const [selectedApiUsers, setSelectedApiUsers] = useState<Set<string>>(new Set());
    const [editingApiUserId, setEditingApiUserId] = useState<string | null>(null);
    const [editApiForm, setEditApiForm] = useState({ apiKey: '', messageLimit: 10 });

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    // Use refs to avoid stale closures in realtime callback
    const currentPageRef = useRef(currentPage);
    const searchQueryRef = useRef(searchQuery);
    const activeTabRef = useRef(activeTab);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // Keep refs in sync with state
    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);

    useEffect(() => {
        searchQueryRef.current = searchQuery;
    }, [searchQuery]);

    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    const fetchAISettings = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/AI/settings');
            setApiKey(response.data.apiKey || '');
            setModel(response.data.model || 'gemini-3-flash');
        } catch (error: any) {
            console.error('Failed to fetch AI settings:', error);
            if (error.response?.status !== 404) {
                setMessage({ type: 'error', text: 'Không thể tải cài đặt AI' });
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUserUsages = useCallback(async (page = 1, search = '') => {
        try {
            setLoadingUsers(true);
            const response = await api.get('/AI/admin/users', {
                params: { page, pageSize: PAGE_SIZE, search: search || undefined }
            });
            setUserUsages(response.data.items || []);
            setTotalCount(response.data.totalCount || 0);
            setCurrentPage(page);
        } catch (error) {
            console.error('Failed to fetch user AI usages:', error);
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    /*
    const fetchUnlockRequests = useCallback(async () => {
        try {
            const response = await api.get('/AI/unlock-requests?status=pending');
            setUnlockRequests(response.data);
        } catch (error) {
            console.error('Failed to fetch unlock requests:', error);
        }
    }, []);
    */

    const fetchDedicatedApiUsers = useCallback(async () => {
        try {
            setLoadingDedicatedApi(true);
            const response = await api.get('/AI/admin/users-with-dedicated-api');
            setDedicatedApiUsers(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Failed to fetch dedicated API users:', error);
            setDedicatedApiUsers([]);
        } finally {
            setLoadingDedicatedApi(false);
        }
    }, []);

    const handleSelectApiUser = (userId: string) => {
        setSelectedApiUsers(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleSelectAllApiUsers = () => {
        if (selectedApiUsers.size === dedicatedApiUsers.length) {
            setSelectedApiUsers(new Set());
        } else {
            setSelectedApiUsers(new Set(dedicatedApiUsers.map(u => u.userId)));
        }
    };

    const handleEditApiUser = (user: UserAiUsage) => {
        setEditingApiUserId(user.userId);
        setEditApiForm({ apiKey: user.apiKey || '', messageLimit: user.messageLimit });
    };

    const handleSaveApiUserEdit = async (userId: string) => {
        try {
            setProcessing(userId);
            await api.put(`/AI/admin/users/${userId}`, {
                apiKey: editApiForm.apiKey || null,
                messageLimit: editApiForm.messageLimit
            });
            setMessage({ type: 'success', text: 'Đã cập nhật API cho người dùng!' });
            setEditingApiUserId(null);
            setTimeout(() => setMessage(null), 3000);
            fetchDedicatedApiUsers();
            fetchUserUsages(currentPage, searchQuery);
        } catch (error) {
            console.error('Failed to update API user:', error);
            setMessage({ type: 'error', text: 'Không thể cập nhật API' });
        } finally {
            setProcessing(null);
        }
    };

    const handleDeleteApiKey = async (userId: string) => {
        try {
            setProcessing(userId);
            await api.put(`/AI/admin/users/${userId}`, { apiKey: null });
            setMessage({ type: 'success', text: 'Đã xóa API key của người dùng!' });
            setTimeout(() => setMessage(null), 3000);
            setSelectedApiUsers(prev => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
            fetchDedicatedApiUsers();
            fetchUserUsages(currentPage, searchQuery);
        } catch (error) {
            console.error('Failed to delete API key:', error);
            setMessage({ type: 'error', text: 'Không thể xóa API key' });
        } finally {
            setProcessing(null);
        }
    };

    const handleDeleteSelectedApiKeys = async () => {
        if (selectedApiUsers.size === 0) return;
        const confirmed = window.confirm(`Xóa API key của ${selectedApiUsers.size} người dùng đã chọn?`);
        if (!confirmed) return;
        try {
            setProcessing('batch');
            await Promise.all(
                Array.from(selectedApiUsers).map(userId =>
                    api.put(`/AI/admin/users/${userId}`, { apiKey: null })
                )
            );
            setMessage({ type: 'success', text: `Đã xóa API key của ${selectedApiUsers.size} người dùng!` });
            setSelectedApiUsers(new Set());
            setTimeout(() => setMessage(null), 3000);
            fetchDedicatedApiUsers();
            fetchUserUsages(currentPage, searchQuery);
        } catch (error) {
            console.error('Failed to delete selected API keys:', error);
            setMessage({ type: 'error', text: 'Không thể xóa API key đã chọn' });
        } finally {
            setProcessing(null);
        }
    };

    // Realtime subscription for user_ai_usages changes
    // Lives as its own effect so it doesn't re-subscribe on page/search changes
    useEffect(() => {
        if (activeTab !== 'custom' && activeTab !== 'api') {
            // Cleanup channel when leaving tabs that need live updates
            if (channelRef.current) {
                console.log('[AdminSettings] Cleaning up realtime channel (tab change)');
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
                setIsRealtimeConnected(false);
            }
            return;
        }

        // Unsubscribe from previous channel if any
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel = supabase
            .channel('admin_ai_usages_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_ai_usages'
                },
                (payload) => {
                    console.log('[AdminSettings] 🚀 Realtime event received:', payload.eventType, (payload.new as any)?.user_id);
                    const tab = activeTabRef.current;
                    if (tab === 'custom') {
                        fetchUserUsages(currentPageRef.current, searchQueryRef.current);
                    }
                    if (tab === 'api') {
                        fetchDedicatedApiUsers();
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime: Subscribed to user_ai_usages');
                    setIsRealtimeConnected(true);
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Realtime: Channel error', err);
                    setIsRealtimeConnected(false);
                } else if (status === 'TIMED_OUT') {
                    console.warn('⚠️ Realtime: Timed out');
                    setIsRealtimeConnected(false);
                }
            });

        channelRef.current = channel;

        return () => {
            console.log('[AdminSettings] Cleanup: removing realtime channel');
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
                setIsRealtimeConnected(false);
            }
        };
    }, [activeTab, fetchUserUsages, fetchDedicatedApiUsers]);

    useEffect(() => {
        fetchAISettings();
    }, [fetchAISettings]);

    useEffect(() => {
        if (activeTab === 'custom') {
            fetchUserUsages(currentPage, searchQuery);
            // fetchUnlockRequests(); // commented out: no user-facing unlock requests
        } else if (activeTab === 'api') {
            fetchDedicatedApiUsers();
        }
    }, [activeTab]);

    // Debounced search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            fetchUserUsages(1, searchQuery);
        }, 400);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]);

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        fetchUserUsages(page, searchQuery);
    };

    const handleSave = async () => {
        if (!apiKey.trim()) {
            setMessage({ type: 'error', text: 'Vui lòng nhập API key' });
            return;
        }

        try {
            setSaving(true);
            await api.put('/AI/settings', {
                apiKey: apiKey,
                model: model
            });
            setMessage({ type: 'success', text: 'Đã lưu cài đặt AI thành công!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Failed to save AI settings:', error);
            setMessage({ type: 'error', text: 'Không thể lưu cài đặt AI' });
        } finally {
            setSaving(false);
        }
    };

    const handleEditUser = (user: UserAiUsage) => {
        setEditingUser(user.userId);
        setEditForm({
            messageLimit: user.messageLimit,
            apiKey: user.apiKey || '',
            isUnlocked: user.isUnlocked
        });
    };

    const handleSaveUserEdit = async (userId: string) => {
        try {
            setProcessing(userId);
            await api.put(`/AI/admin/users/${userId}`, {
                messageLimit: editForm.messageLimit,
                apiKey: editForm.apiKey || null,
                isUnlocked: editForm.isUnlocked
            });
            setMessage({ type: 'success', text: 'Đã cập nhật cài đặt AI cho người dùng!' });
            setEditingUser(null);
            setTimeout(() => setMessage(null), 3000);
            fetchUserUsages(currentPage, searchQuery);
            fetchDedicatedApiUsers();
        } catch (error) {
            console.error('Failed to update user AI usage:', error);
            setMessage({ type: 'error', text: 'Không thể cập nhật cài đặt AI cho người dùng' });
        } finally {
            setProcessing(null);
        }
    };

    const handleResetUsage = async (userId: string, currentLimit: number) => {
        try {
            setProcessing(userId);
            const newLimit = prompt('Nhập số lượt chat mới cho người dùng:', String(currentLimit));
            if (newLimit === null) return;
            const limit = parseInt(newLimit);
            if (isNaN(limit) || limit < 0) {
                setMessage({ type: 'error', text: 'Số lượt không hợp lệ' });
                return;
            }
            await api.post(`/AI/admin/users/${userId}/reset`, { messageLimit: limit });
            setMessage({ type: 'success', text: 'Đã làm mới lượt chat cho người dùng!' });
            setTimeout(() => setMessage(null), 3000);
            fetchUserUsages(currentPage, searchQuery);
        } catch (error) {
            console.error('Failed to reset user AI usage:', error);
            setMessage({ type: 'error', text: 'Không thể làm mới lượt chat' });
        } finally {
            setProcessing(null);
        }
    };

    /*
    const handleApproveRequest = async (requestId: string) => {
        try {
            setProcessing(requestId);
            await api.post(`/AI/unlock-requests/${requestId}/approve`);
            setMessage({ type: 'success', text: 'Đã duyệt yêu cầu mở khóa AI!' });
            setTimeout(() => setMessage(null), 3000);
            fetchUnlockRequests();
            fetchUserUsages(currentPage, searchQuery);
        } catch (error) {
            console.error('Failed to approve unlock request:', error);
            setMessage({ type: 'error', text: 'Không thể duyệt yêu cầu' });
        } finally {
            setProcessing(null);
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        try {
            setProcessing(requestId);
            const note = prompt('Lý do từ chối (tùy chọn):', '');
            await api.post(`/AI/unlock-requests/${requestId}/reject`, note || null);
            setMessage({ type: 'success', text: 'Đã từ chối yêu cầu mở khóa AI!' });
            setTimeout(() => setMessage(null), 3000);
            fetchUnlockRequests();
        } catch (error) {
            console.error('Failed to reject unlock request:', error);
            setMessage({ type: 'error', text: 'Không thể từ chối yêu cầu' });
        } finally {
            setProcessing(null);
        }
    };
    */

    const maskKey = (key: string) => {
        if (key.length <= 8) return '*'.repeat(key.length);
        return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Cài đặt Hệ thống</h2>
                <p className="text-gray-600 mt-1">Quản lý cấu hình AI và API keys</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                <button
                    onClick={() => handleTabChange('general')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'general'
                            ? 'bg-white text-violet-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                    <Bot size={16} />
                    Cài đặt chung
                </button>
                <button
                    onClick={() => handleTabChange('custom')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                        activeTab === 'custom'
                            ? 'bg-white text-violet-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                    <Users size={16} />
                    Custom User
                </button>
                <button
                    onClick={() => handleTabChange('api')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'api'
                            ? 'bg-white text-violet-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                    <Database size={16} />
                    Quản lý API
                </button>
            </div>

            {/* ===== GENERAL TAB ===== */}
            {activeTab === 'general' && (
                <>
                    {/* AI Settings Section */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Bot className="text-violet-600" size={28} />
                            <h3 className="text-lg font-semibold text-gray-800">Cấu hình AI Chat</h3>
                        </div>

                        <div className="space-y-5">
                            {/* Model ID */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Model ID
                                </label>
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                                >
                                    <option value="gpt-oss-120b-medium">gpt-oss-120b-medium</option>
                                    <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                                    <option value="gemini-3-pro-high">gemini-3-pro-high</option>
                                    <option value="gemini-3-pro-low">gemini-3-pro-low</option>
                                    <option value="gemini-2.5-flash-thinking">gemini-2.5-flash-thinking</option>
                                    <option value="gemini-3.1-pro-high">gemini-3.1-pro-high</option>
                                    <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                                    <option value="gemini-3.1-flash-image">gemini-3.1-flash-image</option>
                                    <option value="gemini-3.1-pro-low">gemini-3.1-pro-low</option>
                                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                                    <option value="claude-opus-4-6-thinking">claude-opus-4-6-thinking</option>
                                    <option value="gemini-3-flash-agent">gemini-3-flash-agent</option>
                                    <option value="gemini-3-flash">gemini-3-flash</option>
                                </select>
                            </div>

                            {/* API Key */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    API Key
                                </label>
                                <div className="relative">
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="sk-..."
                                        className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        type="button"
                                    >
                                        {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                {!showKey && apiKey && (
                                    <p className="mt-1 text-sm text-gray-500">
                                        Hiện tại: {maskKey(apiKey)}
                                    </p>
                                )}
                            </div>

                            {/* Instructions */}
                            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                                <div className="flex gap-3">
                                    <AlertCircle className="text-violet-600 flex-shrink-0 mt-0.5" size={20} />
                                    <div className="text-sm text-violet-800">
                                        <p className="font-semibold mb-2">Hướng dẫn cài đặt:</p>
                                        <ol className="list-decimal list-inside space-y-1.5">
                                            <li>Truy cập <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-violet-900 font-medium">Google AI Studio</a> để lấy API Key</li>
                                            <li>Nhập Model ID phù hợp với API của bạn</li>
                                            <li>Nhấn "Lưu thay đổi" để áp dụng</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    <Save size={18} />
                                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ===== CUSTOM USER TAB ===== */}
            {activeTab === 'custom' && (
                <>
                    {/* Unlock Requests Section — COMMENTED OUT: user must be logged in to use AI
                    {unlockRequests.length > 0 && (
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <MessageSquare className="text-orange-500" size={24} />
                                <h3 className="text-lg font-semibold text-gray-800">Yêu cầu mở khóa AI</h3>
                                <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {unlockRequests.length} chờ duyệt
                                </span>
                            </div>
                            <div className="space-y-3">
                                {unlockRequests.map(req => (
                                    <div key={req.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-gray-800 truncate">{req.userFullName || req.userEmail || 'Người dùng'}</span>
                                                <span className="text-xs text-gray-400">{req.userEmail}</span>
                                            </div>
                                            {req.message && (
                                                <p className="text-sm text-gray-600 italic">"{req.message}"</p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-1">
                                                {new Date(req.createdAt).toLocaleString('vi-VN')}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => handleApproveRequest(req.id)}
                                                disabled={processing === req.id}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                            >
                                                <Check size={14} />
                                                Duyệt
                                            </button>
                                            <button
                                                onClick={() => handleRejectRequest(req.id)}
                                                disabled={processing === req.id}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                            >
                                                <X size={14} />
                                                Từ chối
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    */}

                    {/* User AI Usage Table */}
                    <div className="bg-white rounded-lg shadow p-6">
                        {/* Header with search */}
                        <div className="flex items-center justify-between mb-4 gap-4">
                            <div className="flex items-center gap-3">
                                <Users className="text-violet-600" size={24} />
                                <h3 className="text-lg font-semibold text-gray-800">Quản lý AI User</h3>
                                <span className="text-sm text-gray-500">
                                    ({totalCount} người dùng)
                                </span>
                                {/* Realtime indicator */}
                                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                    isRealtimeConnected
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-500'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                        isRealtimeConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                                    }`} />
                                    {isRealtimeConnected ? 'Live' : 'Offline'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Search */}
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Tìm tên, email..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent w-56"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={() => fetchUserUsages(currentPage, searchQuery)}
                                    className="p-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                    title="Làm mới"
                                >
                                    <RotateCcw size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        {loadingUsers ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                            </div>
                        ) : userUsages.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Users size={40} className="mx-auto mb-2 text-gray-300" />
                                {searchQuery ? (
                                    <>
                                        <p>Không tìm thấy người dùng nào.</p>
                                        <p className="text-sm mt-1">Thử từ khóa khác.</p>
                                    </>
                                ) : (
                                    <>
                                        <p>Chưa có dữ liệu sử dụng AI của người dùng.</p>
                                        <p className="text-sm mt-1">Dữ liệu sẽ xuất hiện khi người dùng bắt đầu hỏi AI.</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="text-left py-3 px-2 font-semibold text-gray-600">Người dùng</th>
                                                <th className="text-center py-3 px-2 font-semibold text-gray-600">Đã dùng / Giới hạn</th>
                                                <th className="text-center py-3 px-2 font-semibold text-gray-600">Còn lại</th>
                                                <th className="text-center py-3 px-2 font-semibold text-gray-600">Trạng thái</th>
                                                <th className="text-center py-3 px-2 font-semibold text-gray-600">Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {userUsages.map(usage => (
                                                <React.Fragment key={usage.userId}>
                                                    <tr className="border-b border-gray-100 hover:bg-slate-50">
                                                        <td className="py-3 px-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                                    {(usage.fullName || usage.email || 'U')[0].toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-medium text-gray-800 truncate">{usage.fullName || usage.email || 'Người dùng'}</p>
                                                                    <p className="text-xs text-gray-400 truncate">{usage.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-2 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="font-medium">{usage.messagesUsed} / {usage.messageLimit}</span>
                                                                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${
                                                                            usage.messagesUsed >= usage.messageLimit ? 'bg-red-500' : 'bg-violet-500'
                                                                        }`}
                                                                        style={{ width: `${Math.min(100, (usage.messagesUsed / usage.messageLimit) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-2 text-center">
                                                            <span className={`font-bold ${usage.remaining <= 0 ? 'text-red-500' : usage.remaining <= 3 ? 'text-amber-500' : 'text-green-600'}`}>
                                                                {usage.remaining}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-2 text-center">
                                                            {usage.isUnlocked ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                                    <Unlock size={12} /> Mở khóa
                                                                </span>
                                                            ) : usage.remaining <= 0 ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                                                    <Lock size={12} /> Khóa
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                                    Hoạt động
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-2 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => handleResetUsage(usage.userId, usage.messageLimit)}
                                                                    disabled={processing === usage.userId}
                                                                    className="p-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                                                    title="Làm mới lượt chat"
                                                                >
                                                                    <RotateCcw size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleEditUser(usage)}
                                                                    className="p-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                                                    title="Chỉnh sửa"
                                                                >
                                                                    <Key size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Inline edit form */}
                                                    {editingUser === usage.userId && (
                                                        <tr className="bg-violet-50">
                                                            <td colSpan={5} className="py-4 px-4">
                                                                <div className="space-y-3 max-w-xl">
                                                                    <h4 className="font-semibold text-gray-700 text-sm">
                                                                        Chỉnh sửa AI cho: {usage.fullName || usage.email}
                                                                    </h4>
                                                                    <div className="grid grid-cols-3 gap-3">
                                                                        <div>
                                                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                                Giới hạn tin nhắn
                                                                            </label>
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                value={editForm.messageLimit}
                                                                                onChange={e => setEditForm(f => ({ ...f, messageLimit: parseInt(e.target.value) || 0 }))}
                                                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                                API Key riêng
                                                                            </label>
                                                                            <input
                                                                                type="text"
                                                                                value={editForm.apiKey}
                                                                                onChange={e => setEditForm(f => ({ ...f, apiKey: e.target.value }))}
                                                                                placeholder="Để trống = dùng chung"
                                                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                                Mở khóa
                                                                            </label>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setEditForm(f => ({ ...f, isUnlocked: !f.isUnlocked }))}
                                                                                className={`w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                                                    editForm.isUnlocked
                                                                                        ? 'bg-green-600 text-white'
                                                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                                }`}
                                                                            >
                                                                                {editForm.isUnlocked ? 'Có' : 'Không'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => handleSaveUserEdit(usage.userId)}
                                                                            disabled={processing === usage.userId}
                                                                            className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                                                                        >
                                                                            <Check size={14} />
                                                                            Lưu
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEditingUser(null)}
                                                                            className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                                                                        >
                                                                            Hủy
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                                        <p className="text-sm text-gray-500">
                                            Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} của {totalCount} người dùng
                                        </p>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage <= 1}
                                                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                let pageNum: number;
                                                if (totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (currentPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (currentPage >= totalPages - 2) {
                                                    pageNum = totalPages - 4 + i;
                                                } else {
                                                    pageNum = currentPage - 2 + i;
                                                }
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => handlePageChange(pageNum)}
                                                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                                                            pageNum === currentPage
                                                                ? 'bg-violet-600 text-white'
                                                                : 'text-gray-600 hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage >= totalPages}
                                                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            {/* ===== QUẢN LÝ API (user có API key riêng) ===== */}
            {activeTab === 'api' && (
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <Database className="text-violet-600" size={24} />
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Quản lý API</h3>
                                <p className="text-sm text-gray-500">
                                    Người dùng được cấp API key riêng — không giới hạn tin nhắn theo gói miễn phí
                                </p>
                            </div>
                            <span
                                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                    isRealtimeConnected
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-500'
                                }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                        isRealtimeConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                                    }`}
                                />
                                {isRealtimeConnected ? 'Live' : 'Offline'}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => fetchDedicatedApiUsers()}
                            className="p-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                            title="Làm mới"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>

                    {selectedApiUsers.size > 0 && (
                        <div className="flex items-center gap-3 mb-3 px-2 py-2 bg-red-50 border border-red-200 rounded-lg">
                            <span className="text-sm text-red-700 font-medium">
                                Đã chọn {selectedApiUsers.size} người dùng
                            </span>
                            <button
                                onClick={handleDeleteSelectedApiKeys}
                                disabled={processing === 'batch'}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                <Trash2 size={14} />
                                Xóa API đã chọn
                            </button>
                            <button
                                onClick={() => setSelectedApiUsers(new Set())}
                                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Hủy chọn
                            </button>
                        </div>
                    )}

                    {loadingDedicatedApi ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                        </div>
                    ) : dedicatedApiUsers.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Key size={40} className="mx-auto mb-2 text-gray-300" />
                            <p>Chưa có người dùng nào được cấp API key riêng.</p>
                            <p className="text-sm mt-1">Thêm API key trong tab Custom User.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="py-3 px-2 w-10">
                                            <input
                                                type="checkbox"
                                                checked={selectedApiUsers.size === dedicatedApiUsers.length && dedicatedApiUsers.length > 0}
                                                onChange={handleSelectAllApiUsers}
                                                className="w-4 h-4 rounded border-gray-300 text-violet-600 cursor-pointer"
                                            />
                                        </th>
                                        <th className="text-left py-3 px-2 font-semibold text-gray-600">Người dùng</th>
                                        <th className="text-left py-3 px-2 font-semibold text-gray-600">API Key</th>
                                        <th className="text-left py-3 px-2 font-semibold text-gray-600">Đã tạo lúc</th>
                                        <th
                                            className="text-center py-3 px-2 font-semibold text-gray-600"
                                            title="Bộ đếm lượt gói miễn phí; không tăng khi user chat bằng API riêng"
                                        >
                                            Sử dụng
                                        </th>
                                        <th className="text-center py-3 px-2 font-semibold text-gray-600 w-24">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dedicatedApiUsers.map((row) => (
                                        <React.Fragment key={row.userId}>
                                            <tr className={`border-b border-gray-100 hover:bg-slate-50 ${selectedApiUsers.has(row.userId) ? 'bg-red-50' : ''}`}>
                                                <td className="py-3 px-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedApiUsers.has(row.userId)}
                                                        onChange={() => handleSelectApiUser(row.userId)}
                                                        className="w-4 h-4 rounded border-gray-300 text-violet-600 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="py-3 px-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                            {(row.fullName || row.email || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-800 truncate">
                                                                {row.fullName || row.email || 'Người dùng'}
                                                            </p>
                                                            <p className="text-xs text-gray-400 truncate">{row.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 max-w-[200px]">
                                                    <div className="flex items-center gap-2">
                                                        <code className="text-xs bg-slate-100 px-2 py-1 rounded truncate flex-1 min-w-0 block">
                                                            {revealedKeyUserId === row.userId
                                                                ? row.apiKey || '—'
                                                                : row.apiKey
                                                                  ? maskKey(row.apiKey)
                                                                  : '—'}
                                                        </code>
                                                        {row.apiKey && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setRevealedKeyUserId((id) =>
                                                                        id === row.userId ? null : row.userId
                                                                    )
                                                                }
                                                                className="p-1.5 text-gray-500 hover:text-violet-600 shrink-0 rounded-lg hover:bg-violet-50"
                                                                title={revealedKeyUserId === row.userId ? 'Ẩn' : 'Hiện'}
                                                            >
                                                                {revealedKeyUserId === row.userId ? (
                                                                    <EyeOff size={16} />
                                                                ) : (
                                                                    <Eye size={16} />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 text-gray-600 whitespace-nowrap">
                                                    {row.createdAt
                                                        ? new Date(row.createdAt).toLocaleString('vi-VN')
                                                        : '—'}
                                                </td>
                                                <td
                                                    className="py-3 px-2 text-center font-medium text-gray-800"
                                                    title="Lượt đã ghi trong gói miễn phí; không cộng dồn khi dùng API riêng"
                                                >
                                                    {row.messagesUsed}
                                                </td>
                                                <td className="py-3 px-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => handleEditApiUser(row)}
                                                            className="p-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                                            title="Sửa"
                                                        >
                                                            <Key size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteApiKey(row.userId)}
                                                            disabled={processing === row.userId}
                                                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                            title="Xóa API"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Inline edit form */}
                                            {editingApiUserId === row.userId && (
                                                <tr className="bg-violet-50">
                                                    <td colSpan={6} className="py-4 px-4">
                                                        <div className="space-y-3 max-w-lg">
                                                            <h4 className="font-semibold text-gray-700 text-sm">
                                                                Chỉnh sửa API: {row.fullName || row.email}
                                                            </h4>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                        API Key mới (để trống = xóa)
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={editApiForm.apiKey}
                                                                        onChange={e => setEditApiForm(f => ({ ...f, apiKey: e.target.value }))}
                                                                        placeholder="sk-..."
                                                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                        Giới hạn tin nhắn (khi xóa API)
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={editApiForm.messageLimit}
                                                                        onChange={e => setEditApiForm(f => ({ ...f, messageLimit: parseInt(e.target.value) || 0 }))}
                                                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleSaveApiUserEdit(row.userId)}
                                                                    disabled={processing === row.userId}
                                                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                                                                >
                                                                    <Check size={14} />
                                                                    Lưu
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingApiUserId(null)}
                                                                    className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                                                                >
                                                                    Hủy
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Message Toast */}
            {message && (
                <div
                    className={`fixed bottom-4 right-4 flex items-center gap-3 px-6 py-3 rounded-lg shadow-lg z-50 ${
                        message.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}
                >
                    {message.type === 'success' ? (
                        <CheckCircle size={20} />
                    ) : (
                        <AlertCircle size={20} />
                    )}
                    <span>{message.text}</span>
                </div>
            )}
        </div>
    );
};

export default AdminSettings;
