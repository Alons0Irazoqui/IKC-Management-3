import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../src/supabaseClient';

const EmailConfirmed: React.FC = () => {

    useEffect(() => {
        // Enforce logout to ensure user has to login manually
        const forceLogout = async () => {
            await supabase.auth.signOut();
        };
        forceLogout();
    }, []);

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white font-sans text-slate-900 p-6 selection:bg-red-100 selection:text-red-900">
            <div className="w-full max-w-[400px] bg-white border border-gray-100 rounded-2xl p-8 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="size-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Correo Confirmado!</h2>
                <p className="text-sm text-gray-500 mb-8 font-medium">
                    Tu correo electrónico ha sido confirmado correctamente. Ya puedes acceder a tu cuenta.
                </p>
                <Link
                    to="/login"
                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center text-sm tracking-wide"
                >
                    Volver a Inicio de Sesión
                </Link>
            </div>
            
            <div className="fixed bottom-6 text-[10px] font-bold text-gray-300 tracking-wider uppercase select-none">
                Secure System v2.0
            </div>
        </div>
    );
};

export default EmailConfirmed;
