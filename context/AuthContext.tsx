
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { PulseService } from '../services/pulseService';
import { useToast } from './ToastContext';
import { supabase } from '../src/supabaseClient';

interface LoginResult {
    success: boolean;
    user?: UserProfile;
    error?: string;
}

interface AuthContextType {
    currentUser: UserProfile | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<LoginResult>;
    registerStudent: (data: any) => Promise<boolean>;
    registerMaster: (data: any) => Promise<boolean>;
    logout: () => void;
    updateUserProfile: (profile: Partial<UserProfile>) => void;
    changePassword: (newPassword: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    // Initialize Session
    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            console.log("AuthContext: Starting session init...");
            try {
                // 1. Check current session
                const user = await PulseService.getCurrentUser();
                if (mounted) {
                    setCurrentUser(user);
                    console.log("AuthContext: Initial session loaded", user?.id);
                }
            } catch (error) {
                console.error("AuthContext: Error initializing session:", error);
            } finally {
                if (mounted) setLoading(false);
            }

            // 2. Listen for auth changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                console.log(`AuthContext: Auth event ${event}`);

                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    // Only re-fetch if we have a session but no user, or if it changed
                    if (session?.user) {
                        try {
                            const user = await PulseService.getCurrentUser();
                            if (mounted) setCurrentUser(user);
                        } catch (e) {
                            console.warn("AuthContext: Silent error fetching user on change", e);
                        }
                    }
                } else if (event === 'SIGNED_OUT') {
                    if (mounted) setCurrentUser(null);
                    // Ensure we are not loading if signed out
                    if (mounted) setLoading(false);
                }
            });

            return subscription;
        };

        const subscriptionPromise = initAuth();

        return () => {
            mounted = false;
            subscriptionPromise.then(sub => sub?.unsubscribe());
        };
    }, []);

    const login = async (email: string, pass: string): Promise<LoginResult> => {
        try {
            const user = await PulseService.login(email, pass);
            setCurrentUser(user); // Optimistic update
            addToast(`Bienvenido de nuevo, ${user.name}`, 'success');
            return { success: true, user };
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error al iniciar sesión";
            addToast(msg, 'error');
            return { success: false, error: msg };
        }
    };

    const logout = async () => {
        await PulseService.logout();
        setCurrentUser(null);
        addToast('Sesión cerrada correctamente', 'info');
    };

    const updateUserProfile = async (updates: Partial<UserProfile>) => {
        if (!currentUser) return;
        try {
            const { error } = await supabase.from('profiles').update(updates).eq('id', currentUser.id);
            if (error) throw error;

            const updatedUser = { ...currentUser, ...updates };
            setCurrentUser(updatedUser);
            addToast('Perfil actualizado', 'success');
        } catch (error) {
            addToast("Error al actualizar perfil", "error");
        }
    };

    const changePassword = async (newPassword: string) => {
        if (!currentUser) return;
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            addToast('Contraseña actualizada', 'success');
        } catch (error) {
            addToast("Error al actualizar contraseña", "error");
        }
    };

    const registerStudentAction = async (data: any) => {
        try {
            const user = await PulseService.registerStudent(data);
            setCurrentUser(user);
            addToast('Cuenta de alumno creada exitosamente', 'success');
            return true;
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Error al registrar", 'error');
            return false;
        }
    };

    const registerMasterAction = async (data: any) => {
        try {
            await PulseService.registerMaster(data);
            // Don't set currentUser here. User must verify email first.
            addToast('Registro enviado. Por favor verifica tu correo.', 'success');
            return true;
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Error al registrar", 'error');
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{
            currentUser,
            loading,
            login,
            logout,
            registerStudent: registerStudentAction,
            registerMaster: registerMasterAction,
            updateUserProfile,
            changePassword
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};