
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

        const fetchSession = async () => {
            try {
                // Safety timeout to prevent infinite loading
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Session fetch timeout')), 10000)
                );

                const user = await Promise.race([
                    PulseService.getCurrentUser(),
                    timeoutPromise
                ]) as UserProfile | null;

                if (mounted) setCurrentUser(user);
            } catch (error) {
                console.error("Error fetching session:", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                // Optionally ensure loading is valid?
                // Usually handle via state, but if we want to be safe we can re-fetch
                if (session?.user) {
                    const user = await PulseService.getCurrentUser();
                    if (mounted) setCurrentUser(user);
                }
            } else if (event === 'SIGNED_OUT') {
                if (mounted) setCurrentUser(null);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
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