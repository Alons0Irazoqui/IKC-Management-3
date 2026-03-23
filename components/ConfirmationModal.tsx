
import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'success';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'info',
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

    return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={!isLoading ? onCancel : undefined}
      ></div>

      {/* Modal Content - Dark card, subtle border */}
      <div className="relative bg-[#0e0e11] rounded-3xl shadow-2xl border border-white/5 w-full max-w-md p-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center gap-5">
          <div className={`size-16 rounded-2xl flex items-center justify-center ${
            type === 'danger' ? 'bg-red-500/10 text-red-500' :
            type === 'success' ? 'bg-green-500/10 text-green-500' :
            'bg-blue-500/10 text-blue-500'
          }`}>
            <span className="material-symbols-outlined text-3xl filled">
              {type === 'danger' ? 'warning' : type === 'success' ? 'check_circle' : 'info'}
            </span>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed max-w-xs mx-auto">{message}</p>
          </div>

          <div className="flex gap-3 w-full mt-4">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 py-3.5 rounded-xl bg-white/5 font-bold text-gray-400 hover:bg-white/10 hover:text-white transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 flex justify-center items-center gap-2 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                type === 'danger' ? 'bg-gradient-to-br from-red-600 to-red-700 shadow-red-600/20 hover:from-red-500 hover:to-red-600' :
                type === 'success' ? 'bg-gradient-to-br from-green-600 to-green-700 shadow-green-600/20 hover:from-green-500 hover:to-green-600' :
                'bg-gradient-to-br from-blue-600 to-blue-700 shadow-blue-600/20 hover:from-blue-500 hover:to-blue-600'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Procesando...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
