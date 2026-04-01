
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
    updateUserProfile: (profile: Partial<UserProfile>) => Promise<boolean>;
    changePassword: (newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    // Guard: prevents SIGNED_IN events from firing while logout is in progress
    const isLoggingOut = React.useRef(false);
    const { addToast } = useToast();

    // Initialize Session
    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            console.log("AuthContext: Starting session init...");
            const startTime = Date.now();
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
                // Ensure the loader is visible for at least 1.5s as requested
                const elapsed = Date.now() - startTime;
                const delay = Math.max(0, 2000 - elapsed);
                setTimeout(() => {
                    if (mounted) setLoading(false);
                }, delay);
            }

            // 2. Intercept email confirmation redirects BEFORE processing normal auth state
            const hash = window.location.hash;
            const search = window.location.search;
            if (hash.includes('type=signup') || hash.includes('type=recovery') || search.includes('type=signup')) {
                console.log("AuthContext: Intercepted email confirmation redirect. Forcing logout.");
                await PulseService.logout();
                if (mounted) setLoading(false);
                // Redirect cleanly to email-confirmed screen
                setTimeout(() => {
                    window.location.hash = '#/email-confirmed';
                }, 100);
                return;
            }

            // 3. Listen for auth changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                console.log(`AuthContext: Auth event ${event}`);

                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    // Guard: ignore SIGNED_IN fired during/after logout (stale localStorage events)
                    if (isLoggingOut.current) {
                        console.log('AuthContext: Ignoring SIGNED_IN — logout in progress');
                        return;
                    }
                    // Verify the session has a valid user ID before fetching
                    if (session?.user?.id) {
                        try {
                            // Small delay to let Supabase fully commit the session
                            // This eliminates the race condition where getCurrentUser
                            // returns a stale/null profile right after login.
                            await new Promise(resolve => setTimeout(resolve, 100));
                            // Double-check the active session matches the event's user
                            // to avoid loading a stale/previous user's profile
                            const { data: { session: freshSession } } = await supabase.auth.getSession();
                            if (!freshSession || freshSession.user.id !== session.user.id) {
                                console.log('AuthContext: Session mismatch, skipping profile load');
                                return;
                            }
                            const user = await PulseService.getCurrentUser();
                            if (mounted) {
                                setCurrentUser(user);
                                setLoading(false);
                            }
                        } catch (e) {
                            console.warn("AuthContext: Silent error fetching user on change", e);
                            if (mounted) setLoading(false);
                        }
                    }
                } else if (event === 'SIGNED_OUT') {
                    // Immediate cleanup — loading=false was already set optimistically in logout()
                    if (mounted) {
                        setCurrentUser(null);
                        setLoading(false);
                    }
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
        isLoggingOut.current = false;
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
        // 1. Set guard to block SIGNED_IN events during logout
        isLoggingOut.current = true;

        // 2. Optimistic Cleanup (Immediate) — loading=true keeps ProtectedRoute in spinner mode
        //    so the Login page never flashes before the full-page redirect fires.
        setLoading(true);
        setCurrentUser(null);
        addToast('Sesión cerrada correctamente', 'info');

        // 3. Server Cleanup — await so the session is fully cleared before next login
        try {
            await PulseService.logout();
            window.location.href = '/login';
        } catch (error) {
            // Ignore network errors on logout, user is already gone locally.
            console.warn("Supabase signOut error (ignorable):", error);
            window.location.href = '/login';
        } finally {
            // Release the guard after a small buffer so any pending
            // SIGNED_OUT / stale SIGNED_IN events from Supabase have time to fire and be ignored
            setTimeout(() => { isLoggingOut.current = false; }, 500);
        }
    };

    const updateUserProfile = async (updates: Partial<UserProfile>) => {
        if (!currentUser) return false;
        try {
            // Update Profile
            const dbUpdates: any = { ...updates };
            if (dbUpdates.avatarUrl !== undefined) {
                dbUpdates.avatar_url = dbUpdates.avatarUrl;
                delete dbUpdates.avatarUrl;
            }
            if (dbUpdates.academyId !== undefined) {
                dbUpdates.academy_id = dbUpdates.academyId;
                delete dbUpdates.academyId;
            }
            if (dbUpdates.studentId !== undefined) {
                dbUpdates.student_id = dbUpdates.studentId;
                delete dbUpdates.studentId;
            }

            const { error: profileError } = await supabase.from('profiles').update(dbUpdates).eq('id', currentUser.id);
            if (profileError) throw profileError;

            // If it's a student and they changed their name, keep the `students` table in sync
            if (currentUser.role === 'student' && updates.name) {
                const { error: studentError } = await supabase.from('students').update({ name: updates.name }).eq('user_id', currentUser.id);
                if (studentError) {
                    console.error("Failed to sync student table name:", studentError);
                    // Non-fatal, keep going
                }
            }

            const updatedUser = { ...currentUser, ...updates };
            setCurrentUser(updatedUser);
            addToast('Perfil actualizado', 'success');
            return true;
        } catch (error) {
            console.error("updateUserProfile Error:", error);
            addToast("Error al actualizar perfil", "error");
            return false;
        }
    };
    const changePassword = async (newPassword: string) => {
        if (!currentUser) return false;
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            addToast('Contraseña actualizada', 'success');
            return true;
        } catch (error) {
            console.error("changePassword Error:", error);
            addToast("Error al actualizar contraseña", "error");
            return false;
        }
    };

    const registerStudentAction = async (data: any) => {
        try {
            const user = await PulseService.registerStudent(data);
            if (!user.pendingVerification) {
                // Only log them in if Supabase didn't require email verification
                setCurrentUser(user);
            }
            // Always show success because the UI redirects to login 
            addToast('Cuenta de alumno creada. Verifica tu correo.', 'success');
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