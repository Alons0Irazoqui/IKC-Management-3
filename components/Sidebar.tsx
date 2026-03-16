
import React, { memo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAcademy } from '../context/AcademyContext';
import Avatar from './ui/Avatar';

interface SidebarProps {
  role: 'master' | 'student';
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const { academySettings } = useAcademy();

  const masterLinks = [
    { name: 'Dashboard', icon: 'grid_view', path: '/master/dashboard' },
    { name: 'Estudiantes', icon: 'groups', path: '/master/students' },
    { name: 'Calendario', icon: 'calendar_today', path: '/master/schedule' },
    { name: 'Biblioteca', icon: 'video_library', path: '/master/library' },
    { name: 'Finanzas', icon: 'payments', path: '/master/finance' },
    { name: 'Configuración', icon: 'settings', path: '/master/settings' },
  ];

  const studentLinks = [
    { name: 'Mi Progreso', icon: 'dashboard', path: '/student/dashboard' },
    { name: 'Clases', icon: 'class', path: '/student/classes' },
    ...(academySettings.modules.library ? [{ name: 'Biblioteca', icon: 'school', path: '/student/library' }] : []),
    { name: 'Horarios', icon: 'calendar_month', path: '/student/schedule' },
    ...(academySettings.modules.payments ? [{ name: 'Pagos', icon: 'credit_card', path: '/student/payments' }] : []),
    { name: 'Ajustes', icon: 'settings', path: '/student/settings' },
  ];

  const links = role === 'master' ? masterLinks : studentLinks;
  const displayName = currentUser?.name || (role === 'master' ? 'Sensei' : 'Alumno');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 backdrop-blur-[2px] z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          flex flex-col w-full md:w-64 h-full
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRight: '1px solid var(--color-border-subtle)',
        }}
      >
        {/* ── LOGO ── */}
        <div className="flex items-center justify-between px-6 h-16 md:h-14" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl md:text-xl font-black tracking-tighter" style={{ color: 'var(--color-brand)' }}>IKC</span>
            <span className="text-[10px] md:text-[9px] font-semibold uppercase tracking-[0.35em]" style={{ color: 'var(--color-text-muted)' }}>Management</span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
          </button>
        </div>

        {/* ── NAVIGATION ── */}
        <nav className="flex-1 overflow-y-auto py-4 md:py-3 no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {links.map((link) => {
            const isActive = location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={onClose}
                className="flex items-center gap-4 md:gap-3 mx-4 md:mx-3 px-4 md:px-3 py-4 md:py-2.5 transition-all duration-150 relative"
                style={{
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  backgroundColor: isActive ? 'var(--color-bg-raised)' : 'transparent',
                  borderRadius: '8px',
                  borderLeft: isActive ? '2px solid var(--color-brand)' : '2px solid transparent',
                  paddingLeft: isActive ? '14px' : '12px',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.03)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
                  }
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '22px',
                    color: isActive ? 'var(--color-brand)' : 'inherit',
                    flexShrink: 0,
                  }}
                >
                  {link.icon}
                </span>
                <span style={{ fontSize: '16px', fontWeight: isActive ? 600 : 400, letterSpacing: '0.01em' }}
                    className="md:text-[13px]">
                  {link.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* ── USER PROFILE + LOGOUT ── */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-3 px-5 py-4 md:py-3.5">
            <Avatar
              src={currentUser?.avatarUrl}
              name={displayName}
              className="size-9 md:size-7 rounded-full text-[10px] font-bold shrink-0"
            />
            <div className="flex flex-col overflow-hidden flex-1 min-w-0">
              <span className="text-sm md:text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {displayName}
              </span>
              <span className="text-[11px] md:text-[10px] uppercase tracking-wider truncate" style={{ color: 'var(--color-text-muted)' }}>
                {role === 'master' ? 'Administrador' : 'Alumno'}
              </span>
            </div>
            {/* Logout icon button */}
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="shrink-0 p-1.5 rounded-md transition-all"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-brand-glow)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default memo(Sidebar);
