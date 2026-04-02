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

    const syncTokens = useCallback((token: string, refreshToken: string) => {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('refreshToken', refreshToken);
        void syncSupabaseRealtimeAuth(token);
    }, []);

    const persistUser = useCallback((nextUser: User, token: string, refreshToken: string) => {
        syncTokens(token, refreshToken);
        localStorage.setItem('user', JSON.stringify(nextUser));
        setUser(nextUser);
    }, [syncTokens]);

    const clearAuthStorage = useCallback(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
    }, []);

    const hydrateUserFromSession = useCallback(async (token: string, refreshToken: string) => {
        const response = await api.get('/Auth/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        persistUser(response.data, token, refreshToken);
        return response.data as User;
    }, [persistUser]);

    const refreshUser = useCallback(async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            return;
        }

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

    const logout = useCallback(() => {
        const oldUser = user;
        clearAuthStorage();
        setUser(null);
        void syncSupabaseRealtimeAuth(null);
        supabase.auth.signOut().catch(() => {});
        showToast({
            type: 'info',
            title: 'Hen gap lai',
            message: `Tam biet ${oldUser?.fullName || 'ban'}!`,
            duration: 3000,
        });
    }, [clearAuthStorage, showToast, user]);

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        const savedUser = localStorage.getItem('user');
        const refreshToken = localStorage.getItem('refreshToken') ?? '';

        if (token && savedUser) {
            void hydrateUserFromSession(token, refreshToken)
                .then(() => {
                    void supabase.auth.setSession({
                        access_token: token,
                        refresh_token: refreshToken,
                    }).catch(() => {});
                })
                .catch((error) => {
                    console.error('Stored session is invalid:', error);
                    clearAuthStorage();
                    setUser(null);
                    void syncSupabaseRealtimeAuth(null);
                    supabase.auth.signOut().catch(() => {});
                });
            return;
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('[AuthContext] getSession result:', session ? `has session, user: ${session.user?.email}` : 'no session');

            if (!session) {
                console.log('[AuthContext] No session found');
                return;
            }

            console.log('[AuthContext] Calling /Auth/me with token:', `${session.access_token.substring(0, 20)}...`);

            hydrateUserFromSession(session.access_token, session.refresh_token ?? '')
                .then((nextUser) => {
                    console.log('[AuthContext] /Auth/me SUCCESS:', nextUser);
                    window.dispatchEvent(new CustomEvent('auth-toast', {
                        detail: {
                            type: 'success',
                            title: 'Dang nhap thanh cong',
                            message: 'Chao mung ban tro lai!',
                        },
                    }));
                })
                .catch((err) => {
                    console.error('[AuthContext] /Auth/me FAILED:', err.response?.data || err.message);
                    clearAuthStorage();
                    supabase.auth.signOut().catch(() => {});
                    const msg = err.response?.data?.message || err.message || 'Khong the lay thong tin tai khoan. Vui long thu lai.';
                    window.dispatchEvent(new CustomEvent('auth-toast', {
                        detail: {
                            type: 'error',
                            title: 'Dang nhap that bai',
                            message: msg,
                        },
                    }));
                });
        });
    }, [clearAuthStorage, hydrateUserFromSession, refreshUser]);

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'TOKEN_REFRESHED' && session?.access_token) {
                syncTokens(session.access_token, session.refresh_token ?? '');
                return;
            }

            if (event === 'SIGNED_IN' && session?.access_token && user) {
                persistUser(user, session.access_token, session.refresh_token ?? '');
                return;
            }

            if (event === 'SIGNED_OUT') {
                clearAuthStorage();
                setUser(null);
                void syncSupabaseRealtimeAuth(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [clearAuthStorage, persistUser, syncTokens, user]);

    useEffect(() => {
        const handleExpiredSession = () => {
            clearAuthStorage();
            setUser(null);
            void syncSupabaseRealtimeAuth(null);
            supabase.auth.signOut().catch(() => {});
        };

        window.addEventListener('auth-session-expired', handleExpiredSession);
        return () => {
            window.removeEventListener('auth-session-expired', handleExpiredSession);
        };
    }, [clearAuthStorage]);

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
        if (!token) {
            console.warn('[Auth] login called without access token; skipping session persistence');
            return;
        }

        persistUser(newUser, token, refreshToken);
        void supabase.auth.setSession({ access_token: token, refresh_token: refreshToken }).then(({ error }) => {
            if (error) {
                console.warn('[Auth] supabase.auth.setSession:', error.message);
            }
        });
        showToast({
            type: 'success',
            title: 'Dang nhap thanh cong',
            message: `Chao mung ${newUser.fullName || newUser.email} tro lai!`,
            duration: 4000,
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
                title: 'Thanh cong',
                message: 'Thong tin ca nhan da duoc cap nhat.',
                duration: 4000,
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
