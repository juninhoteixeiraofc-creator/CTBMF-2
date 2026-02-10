
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Modules from './pages/Modules';
import Surgeries from './pages/Surgeries';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Layout from './components/Layout';
import { AppUser } from './types';
import { mockUser } from './services/mockData';

const App: React.FC = () => {
  // Simulate auth state. In real app, use Firebase Auth observer.
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for persisted "session" for this demo
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
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-brand-dark">
        <div className="text-brand-gold animate-pulse text-xl font-bold tracking-widest">CTBMF ANDREONI</div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} 
        />
        
        {user ? (
          <Route element={<Layout user={user} onLogout={handleLogout} />}>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/surgeries" element={<Surgeries />} />
            <Route path="/profile" element={<Profile user={user} onLogout={handleLogout} />} />
            
            {/* Admin Protected Route */}
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
