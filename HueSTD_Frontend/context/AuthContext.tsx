
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { supabase } from '../services/supabase';
import { useToast } from '../components/Toast';

export interface User {
    id: string;
    // ... rest of User interface constant ...
    email: string;
    fullName?: string;
    school?: string;
    major?: string;
    avatarUrl?: string;
    points?: number;
    rank?: number;
    badge?: string;
    publicId?: string;
    role?: string;
    totalDocuments?: number;
    totalDownloads?: number;
    averageRating?: number;
}

export interface UpdateProfileData {
    fullName?: string;
    school?: string;
    major?: string;
    avatarUrl?: string;
}

interface AuthContextType {
    user: User | null;
    login: (token: string, refreshToken: string, user: User) => void;
    logout: () => void;
    updateUser: (data: UpdateProfileData) => Promise<boolean>;
    refreshUser: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { showToast } = useToast();
    const [user, setUser] = useState<User | null>(null);

    const refreshUser = useCallback(async () => {
        try {
            const response = await api.get('/Profile/me');
            if (response.data) {
                localStorage.setItem('user', JSON.stringify(response.data));
                setUser(response.data);
            }
        } catch (error) {
            console.error('Refresh user failed:', error);
        }
    }, []);

    useEffect(() => {
        // Check for existing token on load
        const token = localStorage.getItem('accessToken');
        const savedUser = localStorage.getItem('user');
        if (token && savedUser) {
            try {
                setUser(JSON.parse(savedUser));
                // Refresh user data from API to get latest stats (totalDocuments, totalDownloads)
                refreshUser();
            } catch (e) {
                console.error("Failed to parse user", e);
                logout();
            }
            return;
        }
        // After OAuth redirect: Supabase has session but we don't have token in localStorage yet
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('[AuthContext] getSession result:', session ? 'has session, user: ' + session.user?.email : 'no session');
            if (session && !localStorage.getItem('accessToken')) {
                localStorage.setItem('accessToken', session.access_token);
                localStorage.setItem('refreshToken', session.refresh_token ?? '');
                console.log('[AuthContext] Calling /Auth/me with token:', session.access_token.substring(0, 20) + '...');
                api.get('/Auth/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
                    .then((res) => {
                        console.log('[AuthContext] /Auth/me SUCCESS:', res.data);
                        const u = res.data;
                        setUser(u);
                        localStorage.setItem('user', JSON.stringify(u));
                        window.dispatchEvent(new CustomEvent('auth-toast', {
                            detail: { type: 'success', title: 'Đăng nhập thành công', message: 'Chào mừng bạn trở lại!' }
                        }));
                    })
                    .catch((err) => {
                        console.error('[AuthContext] /Auth/me FAILED:', err.response?.data || err.message);
                        supabase.auth.signOut();
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('refreshToken');
                        localStorage.removeItem('user');
                        const msg = err.response?.data?.message || err.message || 'Không thể lấy thông tin tài khoản. Vui lòng thử lại.';
                        window.dispatchEvent(new CustomEvent('auth-toast', {
                            detail: { type: 'error', title: 'Đăng nhập thất bại', message: msg }
                        }));
                    });
            } else {
                console.log('[AuthContext] No session or token already exists');
            }
        });
    }, []);

    // Realtime subscription for profile changes (points, etc.)
    useEffect(() => {
        if (!user || !user.id) return;

        const channel = supabase
            .channel(`profile_realtime_${user.id}`)
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                },
                (payload) => {
                    console.log('Profile updated via Realtime:', payload);
                    // Update user state with new data from payload
                    const updatedData = payload.new as any;
                    setUser(prev => prev ? {
                        ...prev,
                        fullName: updatedData.full_name || updatedData.FullName,
                        avatarUrl: updatedData.avatar_url || updatedData.AvatarUrl,
                        points: updatedData.points || updatedData.Points,
                        badge: updatedData.badge || updatedData.Badge,
                        school: updatedData.school || updatedData.School,
                        major: updatedData.major || updatedData.Major
                    } : null);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const login = (token: string, refreshToken: string, newUser: User) => {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
        showToast({
            type: 'success',
            title: 'Đăng nhập thành công',
            message: `Chào mừng ${newUser.fullName || newUser.email} trở lại!`,
            duration: 4000
        });
    };

    const logout = () => {
        const oldUser = user;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setUser(null);
        supabase.auth.signOut().catch(() => { });
        showToast({
            type: 'info',
            title: 'Hẹn gặp lại',
            message: `Tạm biệt ${oldUser?.fullName || 'bạn'}!`,
            duration: 3000
        });
    };

    const updateUser = async (data: UpdateProfileData): Promise<boolean> => {
        try {
            const response = await api.put('/Profile/update', data);
            if (response.data.user) {
                const updatedUser = response.data.user;
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);
            }
            showToast({
                type: 'success',
                title: 'Thành công',
                message: 'Thông tin cá nhân đã được cập nhật.',
                duration: 4000
            });
            return true;
        } catch (error) {
            console.error('Update profile failed:', error);
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser, refreshUser, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
