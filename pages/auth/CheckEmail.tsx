import React from 'react';
import { Link } from 'react-router-dom';

const CheckEmail: React.FC = () => {
    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white font-sans text-slate-900 p-6 selection:bg-red-100 selection:text-red-900">
            <div className="w-full max-w-[400px] bg-white border border-gray-100 rounded-2xl p-8 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-300 shadow-soft">
                <div className="size-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-3xl">mark_email_unread</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Casi listo!</h2>
                <p className="text-sm text-gray-500 mb-8 font-medium">
                    Te has registrado correctamente. Solo falta que confirmes tu correo electrónico. 
                    Por favor, revisa tu bandeja de entrada o la carpeta de spam.
                </p>
                <Link
                    to="/login"
                    className="w-full h-12 bg-white border border-gray-200 hover:bg-gray-50 text-slate-900 font-bold rounded-lg transition-colors flex items-center justify-center text-sm tracking-wide"
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

export default CheckEmail;
