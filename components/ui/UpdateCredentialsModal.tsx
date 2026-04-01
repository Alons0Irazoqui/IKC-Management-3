import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { PulseService } from '../../services/pulseService';
import { Student } from '../../types';

interface UpdateCredentialsModalProps {
    isOpen: boolean;
    student: Student | null;
    onClose: () => void;
}

const UpdateCredentialsModal: React.FC<UpdateCredentialsModalProps> = ({ isOpen, student, onClose }) => {
    const { updateStudentProfile } = useStore();
    const { addToast } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && student) {
            setEmail(student.email || '');
            setPassword('');
        }
    }, [isOpen, student]);

    if (!isOpen || !student) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await PulseService.updateStudentCredentials(student.id, email, password);
            if (email && email !== student.email) {
                // Sincronizar localmente si cambió
                await updateStudentProfile(student.id, { email });
            }
            addToast('Claves de acceso actualizadas correctamente', 'success');
            onClose();
        } catch (error: any) {
            console.error(error);
            addToast(error.message || 'Error al actualizar credenciales', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-[#0e0e11] rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-white/5">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Accesos del Alumno</h2>
                        <p className="text-sm text-gray-400 mt-1 truncate">
                            {student.name}
                        </p>
                    </div>
                    <button onClick={onClose} disabled={isSaving} className="text-gray-500 hover:text-white disabled:opacity-50">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <label className="block">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nuevo Correo Electrónico</span>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="mt-1 block w-full rounded-xl bg-[#16161a] border-white/5 text-white p-3 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder-gray-500"
                            placeholder="correo@ejemplo.com"
                        />
                    </label>

                    <label className="block">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nueva Contraseña</span>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-xl bg-[#16161a] border-white/5 text-white p-3 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder-gray-500"
                            placeholder="Dejar vacía para mantener la actual"
                        />
                    </label>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full md:w-auto px-8 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover shadow-lg transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Actualizando...
                                </>
                            ) : (
                                'Actualizar Claves'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UpdateCredentialsModal;
