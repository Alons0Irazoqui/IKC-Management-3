
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
            {/* Fondos de grado corporativo */}
            <div className="enterprise-bg"></div>
            <div className="ambient-glow"></div>

            <main className="layout-container">
                
                {/* LADO IZQUIERDO: PRESENTACIÓN */}
                <section className="presentation-side">
                    <div className="brand-header">
                        <div className="logo-mark">
                            <i className="fa-solid fa-shield-halved"></i>
                        </div>
                        <span>IKC Enterprise</span>
                    </div>
                    
                    <div className="value-prop">
                        <h1>Infraestructura marcial <span>de clase mundial.</span></h1>
                        
                        <ul className="feature-list">
                            <li className="feature-item">
                                <div className="feature-icon"><i className="fa-solid fa-check"></i></div>
                                <div className="feature-text">
                                    <h3>Gestión Centralizada</h3>
                                    <p>Administra atletas, dojos y licencias WKF desde un único panel ultra seguro.</p>
                                </div>
                            </li>
                            <li className="feature-item">
                                <div className="feature-icon"><i className="fa-solid fa-lock"></i></div>
                                <div className="feature-text">
                                    <h3>Seguridad Nivel Bancario</h3>
                                    <p>Encriptación end-to-end (E2EE) y cumplimiento estricto de normativas GDPR.</p>
                                </div>
                            </li>
                            <li className="feature-item">
                                <div className="feature-icon"><i className="fa-solid fa-bolt"></i></div>
                                <div className="feature-text">
                                    <h3>Alta Disponibilidad</h3>
                                    <p>Infraestructura desplegada en edge con un 99.99% de uptime garantizado.</p>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div className="trust-badges">
                        <span>Certificaciones globales:</span>
                        <span><i className="fa-solid fa-globe"></i> WKF Standard</span>
                        <span><i className="fa-solid fa-shield"></i> ISO 27001</span>
                    </div>
                </section>

                {/* LADO DERECHO: AUTENTICACIÓN EDGE-TO-EDGE */}
                <section className="auth-side">
                    <div className="auth-wrapper">
                        
                        <div className="auth-header">
                            <h2>Iniciar Sesión</h2>
                            <p>Accede a tu entorno de trabajo seguro</p>
                        </div>

                        {/* Formulario */}
                        <form id="enterpriseForm" onSubmit={handleSubmit}>
                            
                            {/* Floating Label Input para Email */}
                            <div className="form-group">
                                {/* El placeholder " " (espacio) es un hack de CSS necesario para la pseudo-clase :placeholder-shown */}
                                <input 
                                    type="email" 
                                    id="email" 
                                    className="form-control bg-[#16161a] border-[#ffffff1f] text-white pt-7 pb-2 px-4 shadow-inner" 
                                    placeholder=" " 
                                    required 
                                    autoComplete="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                                <label htmlFor="email" className="floating-label">Correo Institucional</label>
                            </div>

                            {/* Floating Label Input para Password */}
                            <div className="form-group">
                                <input 
                                    type="password" 
                                    id="password" 
                                    className="form-control bg-[#16161a] border-[#ffffff1f] text-white pt-7 pb-2 px-4 shadow-inner" 
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
