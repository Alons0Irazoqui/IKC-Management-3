
import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useLocation } from 'react-router-dom';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const role = location.pathname.includes('/master') ? 'master' : 'student';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    // MAIN CONTAINER: Flex container. Sidebar handled internally.
    <div className="flex h-screen w-full overflow-hidden font-sans" style={{backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-primary)'}}>
      <Sidebar 
        role={role} 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      {/* CONTENT AREA with Premium Enterprise Background */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-0 md:z-10" style={{backgroundColor: 'var(--color-bg-app)'}}>
        
        {/* Grid pattern — ultra-subtle, fades to edges */}
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: 'linear-gradient(var(--bg-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--bg-grid-line) 1px, transparent 1px)',
          backgroundSize: 'var(--bg-grid-size)',
          zIndex: 0,
          pointerEvents: 'none',
          maskImage: 'radial-gradient(ellipse 65% 60% at 50% 40%, black 0%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 65% 60% at 50% 40%, black 0%, transparent 100%)'
        }} />

        {/* Ambient glow — soft, off-center, not overpowering */}
        <div style={{
          position: 'fixed',
          top: '-10%',
          right: '0%',
          width: '45vw',
          height: '45vw',
          background: 'radial-gradient(circle, rgba(225,29,72,0.10) 0%, transparent 70%)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 sticky top-0 z-30" style={{backgroundColor: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)'}}>
            <div className="flex flex-col leading-none">
                 <span className="font-black text-xl tracking-tighter" style={{color: 'var(--color-brand)'}}>IKC</span>
                 <span className="text-[9px] font-medium uppercase tracking-[0.25em] mt-0.5" style={{color: 'var(--color-text-muted)'}}>Management</span>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2.5 rounded-full transition-colors focus:outline-none"
              style={{color: 'var(--color-text-primary)', backgroundColor: 'var(--color-bg-raised)'}}
            >
                <span className="material-symbols-outlined text-xl">menu</span>
            </button>
        </header>

        {/* 
            SCROLL CANVAS
        */}
        <main className="flex-1 overflow-y-auto relative w-full scroll-smooth">
            {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
