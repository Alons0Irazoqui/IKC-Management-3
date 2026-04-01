
import React from 'react';
import { Student } from '../../types';

interface EmergencyCardProps {
  student: Student;
}

const EmergencyCard: React.FC<EmergencyCardProps> = ({ student }) => {
  const { guardian } = student;

  return (
    <div className="rounded-3xl border shadow-xl overflow-hidden" style={{backgroundColor:'var(--color-bg-surface)',borderColor:'var(--color-border-subtle)'}}>
      <div className="px-8 py-6 border-b flex justify-between items-center" style={{borderColor:'var(--color-border-subtle)',backgroundColor:'var(--color-bg-app)'}}>
        <h3 className="text-xl md:text-lg font-bold tracking-tight flex items-center gap-3" style={{color:'var(--color-text-primary)'}}>
          <span className="material-symbols-outlined text-[#EF4444] filled">emergency_home</span>
          Información de Emergencia
        </h3>
        <span className="text-xs md:text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border" 
              style={{backgroundColor:'var(--color-bg-surface)',borderColor:'var(--color-border-subtle)',color:'var(--color-text-muted)'}}>
          {guardian.relationship}
        </span>
      </div>
      
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Contacto Principal */}
        <div className="space-y-6">
          <h4 className="text-xs md:text-[10px] font-black uppercase tracking-[0.2em]" style={{color:'var(--color-text-muted)'}}>DATOS DEL RESPONSABLE</h4>
          
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl flex items-center justify-center shrink-0 border" style={{backgroundColor:'var(--color-bg-app)',borderColor:'var(--color-border-subtle)',color:'var(--color-text-primary)'}}>
              <span className="material-symbols-outlined">person</span>
            </div>
            <div>
              <p className="font-bold text-lg" style={{color:'var(--color-text-primary)'}}>{guardian.fullName}</p>
              <p className="text-base md:text-sm" style={{color:'var(--color-text-muted)'}}>{guardian.email}</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl flex items-center justify-center shrink-0 border" style={{backgroundColor:'var(--color-bg-app)',borderColor:'var(--color-border-subtle)',color:'#34D399'}}>
              <span className="material-symbols-outlined">phone_iphone</span>
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="font-bold text-base md:text-sm" style={{color:'var(--color-text-primary)'}}>Principal: {guardian.phones.main}</p>
              {guardian.phones.secondary && (
                <p className="text-sm md:text-xs flex items-center gap-2" style={{color:'var(--color-text-muted)'}}>
                  <span className="material-symbols-outlined text-[14px]">call</span> {guardian.phones.secondary}
                </p>
              )}
              {guardian.phones.tertiary && (
                <p className="text-sm md:text-xs flex items-center gap-2" style={{color:'var(--color-text-muted)'}}>
                  <span className="material-symbols-outlined text-[14px]">call</span> {guardian.phones.tertiary}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Dirección */}
        <div className="space-y-6">
          <h4 className="text-xs md:text-[10px] font-black uppercase tracking-[0.2em]" style={{color:'var(--color-text-muted)'}}>DOMICILIO REGISTRADO</h4>
          
          <div className="flex items-start gap-4 p-5 rounded-2xl border" style={{backgroundColor:'var(--color-bg-app)',borderColor:'var(--color-border-subtle)'}}>
            <div className="mt-0.5" style={{color:'var(--color-text-muted)'}}>
               <span className="material-symbols-outlined">location_on</span>
            </div>
            <div className="text-base md:text-sm space-y-1">
              <p className="font-bold leading-snug" style={{color:'var(--color-text-primary)'}}>
                {guardian.address.street} {guardian.address.exteriorNumber}
                {guardian.address.interiorNumber ? ` Int. ${guardian.address.interiorNumber}` : ''}
              </p>
              <p style={{color:'var(--color-text-secondary)'}}>Col. {guardian.address.colony}</p>
              <p style={{color:'var(--color-text-muted)'}}>
                CP: {guardian.address.zipCode} 
                {guardian.address.city ? `, ${guardian.address.city}` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyCard;
