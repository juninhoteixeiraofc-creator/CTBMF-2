
import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, Video, User, ShieldCheck } from 'lucide-react';
import { AppUser } from '../types';

interface LayoutProps {
  user: AppUser;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user }) => {
  const location = useLocation();

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/modules', icon: BookOpen, label: 'Módulos' },
    { to: '/surgeries', icon: Video, label: 'Cirurgias' },
    { to: '/profile', icon: User, label: 'Perfil' },
  ];

  if (user.role === 'admin') {
    navItems.splice(3, 0, { to: '/admin', icon: ShieldCheck, label: 'Admin' });
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-white shadow-xl relative overflow-hidden border-x border-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur-md border-b border-brand-gold/20 safe-top">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">CTBMF</h1>
            <span className="text-[10px] text-brand-gold font-bold uppercase tracking-widest">Instituto Andreoni</span>
          </div>
          <div className="w-9 h-9 rounded-xl overflow-hidden border-2 border-brand-gold/50 shadow-lg">
            <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 px-5 pt-6 bg-gray-50/50">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-brand-dark shadow-[0_-10px_20px_rgba(0,0,0,0.1)] safe-bottom rounded-t-3xl border-t border-brand-gold/10">
        <div className="flex justify-around items-center h-16 px-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 
                `flex flex-col items-center justify-center space-y-1 w-full h-full transition-all duration-300 ${
                  isActive ? 'text-brand-gold translate-y-[-2px]' : 'text-gray-500'
                }`
              }
            >
              {/* Fix: Using function as children to access isActive property provided by NavLink */}
              {({ isActive }) => (
                <React.Fragment>
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-[9px] font-bold uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>
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
