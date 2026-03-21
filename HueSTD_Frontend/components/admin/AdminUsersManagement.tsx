import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Edit2, Trash2, X, Loader2, Search, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { supabase } from '../../services/supabase';

interface User {
    id: string;
    email: string;
    fullName?: string;
    school?: string;
    major?: string;
    points: number;
    role: string;
    createdAt: string;
}

interface UserFormData {
    email: string;
    password: string;
    fullName: string;
    school: string;
    major: string;
    role: string;
}

interface UpdateUserFormData {
    fullName?: string;
    school?: string;
    major?: string;
    points?: number;
    role?: string;
}

const AdminUsersManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<UserFormData>({
        email: '',
        password: '',
        fullName: '',
        school: '',
        major: '',
        role: 'user'
    });
    const [updateFormData, setUpdateFormData] = useState<UpdateUserFormData>({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchUsers = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            else setRefreshing(true);
            const response = await api.get('/Admin/users');
            // API trả về { data: User[], totalCount, page, pageSize } hoặc mảng trực tiếp
            const list = Array.isArray(response.data)
                ? response.data
                : (response.data?.data ?? []);
            setUsers(list);
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch users:', err);
            setError('Không thể tải danh sách người dùng');
            setUsers([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Debounce ref for realtime updates
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchUsers(false);
        }, 500);
    };

    useEffect(() => {
        fetchUsers();

        // Fallback polling every 20 seconds
        let pollingInterval: NodeJS.Timeout | null = null;
        const startPolling = () => {
            if (!pollingInterval) {
                console.log('[AdminUsersManagement] Starting polling fallback...');
                pollingInterval = setInterval(() => {
                    console.log('[AdminUsersManagement] Polling for updates...');
                    fetchUsers(false);
                }, 20000);
            }
        };

        // Realtime subscription for profiles
        const channel = supabase
            .channel('admin_users_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'profiles' },
                (payload) => {
                    console.log('[AdminUsersManagement] New user inserted:', payload);
                    debouncedFetch();
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles' },
                (payload) => {
                    console.log('[AdminUsersManagement] Profile updated:', payload);
                    debouncedFetch();
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'profiles' },
                (payload) => {
                    console.log('[AdminUsersManagement] Profile deleted:', payload);
                    debouncedFetch();
                }
            )
            .subscribe((status) => {
                console.log('[AdminUsersManagement] Realtime Status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Admin Users Management Realtime Connected');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('⚠️ Admin Users Management Realtime Error. Starting polling fallback...');
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
    }, [fetchUsers]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await api.post('/Admin/users', formData);
            setShowCreateModal(false);
            setFormData({ email: '', password: '', fullName: '', school: '', major: '', role: 'user' });
            fetchUsers(false);
        } catch (err: any) {
            console.error('Failed to create user:', err);
            alert('Tạo người dùng thất bại: ' + (err.response?.data?.error || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        try {
            setSubmitting(true);
            const response = await api.put(`/Admin/users/${selectedUser.id}`, updateFormData);
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...response.data } : u));
            setShowEditModal(false);
            setSelectedUser(null);
            setUpdateFormData({});
        } catch (err: any) {
            console.error('Failed to update user:', err);
            alert('Cập nhật thất bại: ' + (err.response?.data?.error || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        try {
            setProcessingId(selectedUser.id);
            await api.delete(`/Admin/users/${selectedUser.id}`);
            setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
            setShowDeleteModal(false);
            setSelectedUser(null);
        } catch (err: any) {
            console.error('Failed to delete user:', err);
            alert('Xóa người dùng thất bại: ' + (err.response?.data?.error || err.message));
        } finally {
            setProcessingId(null);
        }
    };

    const handleUpdateRole = async (userId: string, newRole: string) => {
        try {
            setProcessingId(userId);
            const response = await api.put(`/Admin/users/${userId}`, { role: newRole });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...response.data } : u));
        } catch (err: any) {
            console.error('Failed to update role:', err);
            alert('Cập nhật quyền thất bại: ' + (err.response?.data?.error || err.message));
        } finally {
            setProcessingId(null);
        }
    };

    const openEditModal = (user: User) => {
        setSelectedUser(user);
        setUpdateFormData({
            fullName: user.fullName || '',
            school: user.school || '',
            major: user.major || '',
            points: user.points,
            role: user.role
        });
        setShowEditModal(true);
    };

    const openDeleteModal = (user: User) => {
        setSelectedUser(user);
        setShowDeleteModal(true);
    };

    const filteredUsers = (Array.isArray(users) ? users : []).filter(user =>
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.school?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Quản lý người dùng</h2>
                    <p className="text-slate-500">Quản lý tất cả người dùng trong hệ thống</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchUsers(false)}
                        disabled={refreshing}
                        className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Đang tải...' : 'Làm mới'}
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Tạo người dùng
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4 bg-white px-4 py-3 rounded-xl border border-slate-200">
                <Search size={20} className="text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm theo email, tên, trường..."
                    className="flex-1 bg-transparent outline-none text-slate-700"
                />
            </div>

            {/* Error */}
            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                    <span className="text-rose-700">{error}</span>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Email</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Tên</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Trường</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Điểm</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Vai trò</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Ngày tạo</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-700">{user.email}</td>
                                    <td className="px-6 py-4 text-sm text-slate-700 font-medium">{user.fullName || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{user.school || '-'}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-indigo-600">{user.points}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(user)}
                                                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                                title="Chỉnh sửa"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => openDeleteModal(user)}
                                                className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                                title="Xóa"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            Không tìm thấy người dùng nào
                        </div>
                    )}
                </div>
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-slate-800">Tạo người dùng mới</h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Mật khẩu *</label>
                                <input
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Tên</label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Trường</label>
                                    <input
                                        type="text"
                                        value={formData.school}
                                        onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Chuyên ngành</label>
                                    <input
                                        type="text"
                                        value={formData.major}
                                        onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Vai trò</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-100"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? <><Loader2 size={16} className="animate-spin" /> Đang tạo...</> : 'Tạo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-slate-800">Chỉnh sửa người dùng</h3>
                            <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                                <input
                                    type="text"
                                    value={selectedUser.email}
                                    disabled
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Tên</label>
                                <input
                                    type="text"
                                    value={updateFormData.fullName || ''}
                                    onChange={(e) => setUpdateFormData({ ...updateFormData, fullName: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Trường</label>
                                    <input
                                        type="text"
                                        value={updateFormData.school || ''}
                                        onChange={(e) => setUpdateFormData({ ...updateFormData, school: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Chuyên ngành</label>
                                    <input
                                        type="text"
                                        value={updateFormData.major || ''}
                                        onChange={(e) => setUpdateFormData({ ...updateFormData, major: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Điểm</label>
                                <input
                                    type="number"
                                    value={updateFormData.points || 0}
                                    onChange={(e) => setUpdateFormData({ ...updateFormData, points: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Vai trò</label>
                                <select
                                    value={updateFormData.role || 'user'}
                                    onChange={(e) => setUpdateFormData({ ...updateFormData, role: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-100"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? <><Loader2 size={16} className="animate-spin" /> Đang lưu...</> : 'Lưu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-rose-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Xác nhận xóa</h3>
                                <p className="text-slate-600 text-sm">Bạn có chắc chắn muốn xóa người dùng này?</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4 mb-6">
                            <p className="text-sm text-slate-600"><span className="font-bold">Email:</span> {selectedUser.email}</p>
                            <p className="text-sm text-slate-600"><span className="font-bold">Tên:</span> {selectedUser.fullName || '-'}</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={submitting}
                                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-100"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleDeleteUser}
                                disabled={submitting}
                                className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitting ? <><Loader2 size={16} className="animate-spin" /> Đang xóa...</> : 'Xóa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsersManagement;
