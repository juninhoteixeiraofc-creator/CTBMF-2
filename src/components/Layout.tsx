
import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, Video, User, ShieldCheck, FileText, ClipboardList, Radio } from 'lucide-react';
import { AppUser } from '../types';
import Logo from './Logo';

interface LayoutProps {
  user: AppUser;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user }) => {
  const location = useLocation();
  const isViewer = location.pathname.startsWith('/protocol-viewer/');
  
  const isAcademyRoute = location.pathname.startsWith('/academy');
  const isAcademyAdminRoute = location.pathname.startsWith('/academy-admin');
  const hasResidencyAccess = user.role === 'admin' || user.role === 'student';

  React.useEffect(() => {
    if (location.pathname.startsWith('/academy')) {
      sessionStorage.setItem('workspace_context', 'academy');
    } else if (
      location.pathname === '/' || 
      location.pathname.startsWith('/modules') || 
      location.pathname.startsWith('/lives') || 
      location.pathname.startsWith('/surgeries') || 
      location.pathname.startsWith('/protocols') || 
      location.pathname.startsWith('/planning') ||
      location.pathname.startsWith('/profile') ||
      location.pathname.startsWith('/admin')
    ) {
      sessionStorage.setItem('workspace_context', 'residency');
    }
  }, [location.pathname]);

  const workspaceContext = sessionStorage.getItem('workspace_context') || 'residency';
  // A standard residency student should NEVER be treated as in Academy context (fully separated)
  const isAcademyContext = user.role !== 'student' && (isAcademyRoute || isAcademyAdminRoute || workspaceContext === 'academy');

  let navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/modules', icon: BookOpen, label: 'Materiais' },
    { to: '/lives', icon: Radio, label: 'Lives' },
    { to: '/surgeries', icon: Video, label: 'Cirurgias' },
    { to: '/protocols', icon: FileText, label: 'Protocolos' },
    { to: '/planning', icon: ClipboardList, label: 'Planejamento' },
    { to: '/profile', icon: User, label: 'Perfil' },
  ];

  if (user.role === 'admin') {
    navItems.splice(3, 0, { to: '/admin', icon: ShieldCheck, label: 'Admin' });
  }

  // Rewrite nav items if in Academy domains or if in Academy workspace context
  if (isAcademyAdminRoute) {
    navItems = [
      { to: '/academy-admin', icon: ShieldCheck, label: 'Acad. Admin' },
      { to: '/admin', icon: ClipboardList, label: 'Residência' },
      { to: '/profile', icon: User, label: 'Perfil' },
    ];
  } else if (isAcademyContext) {
    const isPreview = sessionStorage.getItem('academy_preview_mode') === 'true';
    if (!hasResidencyAccess || isPreview) {
      navItems = [
        { to: '/academy', icon: Home, label: 'Academy' },
        { to: '/profile', icon: User, label: 'Perfil' },
      ];
    } else {
      navItems = [
        { to: '/academy', icon: Home, label: 'Academy' },
        ...(user.role === 'admin' ? [{ to: '/academy-admin', icon: ShieldCheck, label: 'Acad. Admin' }] : []),
        { to: '/profile', icon: User, label: 'Perfil' },
      ];
    }
  } else if (!hasResidencyAccess) {
    // Fallback if they are not admin/student and somehow in Residency
    navItems = [
      { to: '/academy', icon: Home, label: 'Academy' },
      { to: '/profile', icon: User, label: 'Perfil' },
    ];
  }

  return (
    <div className={`${isViewer ? 'h-screen' : 'min-h-screen'} flex flex-col w-full max-w-md md:max-w-3xl lg:max-w-5xl mx-auto bg-white shadow-2xl relative overflow-hidden md:border-x border-gray-100 transition-all duration-500`}>
      {/* Simulation Banner */}
      {sessionStorage.getItem('academy_preview_mode') === 'true' && (
        <div className="bg-gradient-to-r from-brand-gold via-brand-gold to-[#a17a26] text-brand-dark px-4 py-2.5 flex items-center justify-between shadow-lg z-[110] relative text-center border-b border-brand-dark/10">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-dark opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-dark"></span>
            </span>
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">
              Visualização de Aluno (Modo Preview)
            </span>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('academy_preview_mode');
              window.dispatchEvent(new Event('academy_preview_changed'));
              window.location.hash = '/academy-admin';
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-brand-dark text-brand-gold hover:text-white rounded-lg font-black uppercase text-[8px] md:text-[9px] tracking-widest transition-all active:scale-95"
          >
            Voltar p/ Admin
          </button>
        </div>
      )}

      {/* Header */}
      {!isViewer && (
        <header className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur-md border-b border-brand-gold/20 safe-top">
          <div className="px-6 md:px-10 py-3 md:py-5 flex items-center justify-between">
            <div className="flex items-center space-x-3 md:space-x-5">
              <Logo size="sm" className="md:scale-125 origin-left transition-transform" />
              <div className="flex flex-col">
                <h1 className="text-sm md:text-lg font-black text-white tracking-widest leading-none">CTBMF</h1>
                <span className="text-[8px] md:text-[10px] text-brand-gold font-black uppercase tracking-[0.2em] mt-0.5 md:mt-1">Instituto Andreoni</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-right mr-2">
                <p className="text-[10px] font-black text-brand-gold uppercase tracking-widest leading-none">Bem-vindo,</p>
                <p className="text-sm font-bold text-white mt-1">{user.displayName}</p>
              </div>
              <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl overflow-hidden border-2 border-brand-gold/50 shadow-lg group active:scale-95 transition-all">
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=c89b3c&color=fff`} alt={user.displayName} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${isViewer ? 'overflow-hidden p-0 pt-0 pb-16 md:pb-20' : 'overflow-y-auto pb-32 md:pb-40 px-5 md:px-10 pt-6 md:pt-10'} bg-gray-50/50`}>
        <div className={isViewer ? "h-full w-full" : "max-w-4xl mx-auto"}>
          <Outlet />
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md md:max-w-3xl lg:max-w-5xl bg-brand-dark shadow-[0_-10px_30px_rgba(0,0,0,0.2)] rounded-t-[32px] md:rounded-t-[40px] border-t border-brand-gold/10 z-[100]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
        <div className={`grid ${navItems.length === 8 ? 'grid-cols-8' : navItems.length === 7 ? 'grid-cols-7' : navItems.length === 3 ? 'grid-cols-3' : navItems.length === 2 ? 'grid-cols-2' : 'grid-cols-6'} items-center h-16 md:h-20 px-1 md:px-10`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 
                `flex flex-col items-center justify-center space-y-1 md:space-y-2 w-full h-full transition-all duration-300 ${
                  isActive ? 'text-brand-gold translate-y-[-2px] md:translate-y-[-4px]' : 'text-gray-500 hover:text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <React.Fragment>
                  <item.icon 
                    size={isActive ? 20 : 18} 
                    className="md:scale-125 transition-transform" 
                    strokeWidth={isActive ? 2.5 : 2} 
                  />
                  <span className={`text-[7px] md:text-[11px] font-bold uppercase tracking-tighter md:tracking-widest text-center px-0 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                    {item.label}
                  </span>
                </React.Fragment>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
