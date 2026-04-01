
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const Login: React.FC = () => {
    const { login } = useStore();
    const { currentUser, loading: authLoading } = useAuth(); // Enhanced auth check
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);

    // Mount Status Ref
    const isMounted = React.useRef(true);
    React.useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    // Redirect if already logged in
    React.useEffect(() => {
        if (!authLoading && currentUser) {
            if (currentUser.role === 'master') navigate('/master/dashboard', { replace: true });
            else navigate('/student/dashboard', { replace: true });
        }
    }, [currentUser, authLoading, navigate]);

    if (authLoading) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#08080a]">
                <div className="loader"></div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await login(formData.email, formData.password);
            if (result.success && result.user) {
                if (result.user.role === 'master') navigate('/master/dashboard');
                else navigate('/student/dashboard');
                // Do NOT call setLoading(false) here — component unmounts on navigate.
                return;
            }
            // Login failed (wrong credentials, etc.) — always unblock the button
            // Note: we do NOT check isMounted here to avoid a race condition where
            // a stale SIGNED_IN event from Supabase briefly unmounts this component.
            setLoading(false);
        } catch {
            // Unexpected exception: always unblock the button
            setLoading(false);
        }
    };

    return (
        <div className="login-dark-theme">
            {/* Fondo mosaico + glow de branding */}
            <div className="enterprise-bg"></div>
            <div className="ambient-glow"></div>

            <main className="layout-container">
                {/* PANEL CENTRAL: AUTENTICACIÓN */}
                <section className="auth-side">
                    <div className="auth-wrapper">

                        {/* Logo */}
                        <div className="auth-logo">
                            <img src="/logo.svg" alt="IKC Logo" style={{ height: '68px', filter: 'brightness(0) invert(1)' }} />
                        </div>

                        {/* Separador */}
                        <div className="auth-divider"></div>

                        {/* Título */}
                        <div className="auth-header">
                            <h2>Iniciar Sesión</h2>
                            <p>Accede a tu entorno de trabajo seguro</p>
                        </div>

                        {/* Formulario */}
                        <form id="enterpriseForm" onSubmit={handleSubmit}>

                            <div className="form-group">
                                <input
                                    type="email"
                                    id="email"
                                    className="form-control"
                                    placeholder=" "
                                    required
                                    autoComplete="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                                <label htmlFor="email" className="floating-label">Correo Institucional</label>
                            </div>

                            <div className="form-group">
                                <input
                                    type="password"
                                    id="password"
                                    className="form-control"
                                    placeholder=" "
                                    required
                                    autoComplete="current-password"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                                <label htmlFor="password" className="floating-label">Contraseña</label>
                            </div>

                            <div className="form-actions">
                                <label className="checkbox-wrapper">
                                    <input type="checkbox" id="remember" />
                                    <span>Mantener sesión</span>
                                </label>
                                <a href="#">Recuperar acceso</a>
                            </div>

                            <button type="submit" className={`btn-primary ${loading ? 'is-loading' : ''}`} id="loginBtn" disabled={loading}>
                                Continuar
                            </button>

                        </form>

                        <div className="text-center mt-6">
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                ¿No tienes cuenta?{' '}
                                <Link to="/role-selection" style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                                    Crear cuenta
                                </Link>
                            </p>
                        </div>

                        <div className="secure-badge">
                            <i className="fa-solid fa-lock"></i>
                            Conexión cifrada E2EE de 256 bits
                        </div>

                    </div>
                </section>
            </main>
        </div>
    );
};

export default Login;
