
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Modules from './pages/Modules';
import Surgeries from './pages/Surgeries';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Layout from './components/Layout';
import { AppUser } from './types';
import { mockUser } from './services/mockData';
import { Clock, ShieldAlert, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const savedUser = localStorage.getItem('ctbmf_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: AppUser) => {
    setUser(userData);
    localStorage.setItem('ctbmf_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('ctbmf_user');
    setView('login');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-brand-dark">
        <div className="text-brand-gold animate-pulse text-xl font-bold tracking-widest">CTBMF ANDREONI</div>
      </div>
    );
  }

  // Pending Approval View
  if (user && !user.approved) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-8 text-center space-y-8">
        <div className="w-24 h-24 bg-brand-gold/10 rounded-full flex items-center justify-center animate-pulse">
           <Clock size={48} className="text-brand-gold" />
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-white">Solicitação Enviada!</h2>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
            <p className="text-sm text-gray-400 leading-relaxed">
              Dr(a). <strong>{user.displayName}</strong>, sua solicitação de cadastro foi encaminhada com sucesso.
            </p>
            <p className="text-[11px] text-brand-gold font-bold uppercase tracking-widest">
              Aguardando liberação do administrador
            </p>
            <div className="flex items-start space-x-3 text-left p-3 bg-brand-gold/5 rounded-xl border border-brand-gold/20 mt-4">
              <ShieldAlert size={16} className="text-brand-gold shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-300">
                A coordenação recebeu uma notificação em <strong>espectbmfpatobranco@gmail.com</strong>. Você receberá um aviso assim que seu perfil for validado.
              </p>
            </div>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center space-x-2 text-xs font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
        >
          <LogOut size={16} />
          <span>Sair da conta</span>
        </button>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
            user ? <Navigate to="/" /> : 
            view === 'register' ? 
              <Register onRegister={handleLogin} onBack={() => setView('login')} /> : 
              <Login onLogin={handleLogin} onGoToRegister={() => setView('register')} />
          } 
        />
        
        {user ? (
          <Route element={<Layout user={user} onLogout={handleLogout} />}>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/surgeries" element={<Surgeries />} />
            <Route path="/profile" element={<Profile user={user} onLogout={handleLogout} />} />
            
            {user.role === 'admin' && (
              <Route path="/admin" element={<Admin />} />
            )}
            
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/login" />} />
        )}
      </Routes>
    </HashRouter>
  );
};

export default App;
