
import React from 'react';
import { mockUser } from '../services/mockData';
import { AppUser } from '../types';

interface LoginProps {
  onLogin: (user: AppUser) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-8 text-white relative overflow-hidden">
      {/* Decorative element resembling the face silhouette from logo */}
      <div className="absolute left-[-20%] top-1/2 -translate-y-1/2 w-64 h-[80vh] opacity-20 gold-gradient rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-sm z-10 space-y-12">
        <div className="text-left space-y-4">
          <div className="flex items-start space-x-6">
            {/* Logo Silhouette approximation */}
            <div className="w-24 h-32 gold-gradient rounded-r-full rounded-tl-full relative">
              <div className="absolute inset-0 bg-brand-dark scale-75 rounded-r-full rounded-tl-full -translate-x-2"></div>
            </div>
            <div className="flex-1 pt-2">
              <h2 className="text-xs font-light tracking-[0.3em] opacity-80 uppercase mb-2">Especialização em</h2>
              <h1 className="text-3xl font-bold leading-none tracking-tight">
                CIRURGIA E<br />
                TRAUMATOLOGIA<br />
                <span className="text-brand-gold">BUCO<br />MAXILO<br />FACIAL</span>
              </h1>
            </div>
          </div>
          <div className="h-px w-20 gold-gradient mt-8 opacity-50"></div>
          <p className="text-sm font-medium tracking-widest text-brand-gold uppercase">Instituto Andreoni</p>
        </div>

        <div className="space-y-4 pt-4">
          <button
            onClick={() => onLogin(mockUser)}
            className="w-full gold-gradient text-brand-dark rounded-xl py-4 px-6 flex items-center justify-center space-x-3 font-bold shadow-2xl active:scale-95 transition-transform"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 brightness-0" alt="Google" />
            <span>Entrar com Google</span>
          </button>
          
          <button
            onClick={() => onLogin({ ...mockUser, role: 'student', displayName: 'Aluno Exemplo' })}
            className="w-full bg-transparent text-white border border-brand-gold/30 rounded-xl py-4 px-6 font-semibold active:scale-95 transition-transform hover:bg-white/5"
          >
            Acesso do Aluno
          </button>
        </div>

        <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest pt-8">
          Plataforma Exclusiva • CTBMF 2025
        </p>
      </div>
    </div>
  );
};

export default Login;
