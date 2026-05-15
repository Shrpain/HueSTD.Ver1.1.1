import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { supabase, syncSupabaseRealtimeAuth } from '../services/supabase';
import { useToast } from '../components/Toast';

export interface User {
    id: string;
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
    isHydrating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { showToast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [isHydrating, setIsHydrating] = useState(true);

    const hydrateUserFromCookie = useCallback(async () => {
        try {
            const response = await api.get('/Auth/me');
            const nextUser = response.data as User & { accessToken?: string; AccessToken?: string };
            const token = nextUser.accessToken || nextUser.AccessToken;

            if (token) {
                void syncSupabaseRealtimeAuth(token);
                void supabase.auth.setSession({ access_token: token, refresh_token: '' }).catch(() => {});
            }

            setUser(nextUser);
            return nextUser as User;
        } catch {
            setUser(null);
            void syncSupabaseRealtimeAuth(null);
            return null;
        } finally {
            setIsHydrating(false);
        }
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const response = await api.get('/Profile/me');
            if (response.data) {
                setUser(response.data);
            }
        } catch (error) {
            console.error('Refresh user failed:', error);
        }
    }, []);

    const logout = useCallback(() => {
        const oldUser = user;
        setIsHydrating(false);
        setUser(null);
        void syncSupabaseRealtimeAuth(null);

        // Standard POST to the absolute path just to be safe
        api.post('/Auth/logout').finally(() => {
            // Clear Supabase client session too
            supabase.auth.signOut().catch(() => {});

            showToast({
                type: 'info',
                title: 'Hẹn gặp lại',
                message: `Tạm biệt ${oldUser?.fullName || 'bạn'}!`,
                duration: 3000,
            });
        });
    }, [showToast, user]);

    useEffect(() => {
        const handleAuthFromUrl = async () => {
            const hash = window.location.hash;
            if (hash && (hash.includes('access_token=') || hash.includes('error='))) {
                try {
                    const { data: { session }, error } = await supabase.auth.getSession();
                    if (error) throw error;
                    if (session) {
                        // Exchange Supabase session for backend cookie session
                        const response = await api.post('/Auth/login-callback', {
                            accessToken: session.access_token,
                            refreshToken: session.refresh_token
                        });

                        // Clear the hash from URL without reloading
                        window.history.replaceState(null, '', window.location.pathname);

                        // Use the user data from backend
                        login('cookie-session', '', response.data);
                    }
                } catch (err) {
                    console.error('Xử lý Google Auth thất bại:', err);
                }
            }
        };

        handleAuthFromUrl();

        void hydrateUserFromCookie();
    }, [hydrateUserFromCookie]);

    useEffect(() => {
        const handleExpiredSession = () => {
            setUser(null);
            void syncSupabaseRealtimeAuth(null);
            supabase.auth.signOut().catch(() => {});
        };

        window.addEventListener('auth-session-expired', handleExpiredSession);
        return () => {
            window.removeEventListener('auth-session-expired', handleExpiredSession);
        };
    }, []);

    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`profile_realtime_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`,
                },
                (payload) => {
                    const updatedData = payload.new as any;
                    setUser((prev) => prev ? {
                        ...prev,
                        fullName: updatedData.full_name || updatedData.FullName,
                        avatarUrl: updatedData.avatar_url || updatedData.AvatarUrl,
                        points: updatedData.points || updatedData.Points,
                        badge: updatedData.badge || updatedData.Badge,
                        school: updatedData.school || updatedData.School,
                        major: updatedData.major || updatedData.Major,
                    } : null);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const login = (token: string, refreshToken: string, newUser: User) => {
        // When using cookie auth, token might be a placeholder or null if the backend already set the cookie.
        // However, we still want to sync Supabase Realtime if we have a token.
        if (token && token !== 'cookie-session') {
            void syncSupabaseRealtimeAuth(token);
            void supabase.auth.setSession({ access_token: token, refresh_token: refreshToken }).catch(() => {});
        }

        setIsHydrating(false);
        setUser(newUser);
        showToast({
            type: 'success',
            title: 'Đăng nhập thành công',
            message: `Chào mừng ${newUser.fullName || newUser.email} trở lại!`,
            duration: 4000,
        });
    };

    const updateUser = async (data: UpdateProfileData): Promise<boolean> => {
        try {
            const response = await api.put('/Profile/update', data);
            if (response.data.user) {
                setUser(response.data.user);
            }
            showToast({
                type: 'success',
                title: 'Thành công',
                message: 'Thông tin cá nhân đã được cập nhật.',
                duration: 4000,
            });
            return true;
        } catch (error) {
            console.error('Update profile failed:', error);
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser, refreshUser, isAuthenticated: !!user, isHydrating }}>
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
