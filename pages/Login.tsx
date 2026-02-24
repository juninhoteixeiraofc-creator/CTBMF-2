
import React, { useState } from 'react';
import { mockUser, mockTurmas } from '../services/mockData';
import { AppUser } from '../types';
import { UserPlus, ShieldCheck, GraduationCap, Chrome } from 'lucide-react';

interface LoginProps {
  onLogin: (user: AppUser) => void;
  onGoToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onGoToRegister }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSimulatedAuth = (role: 'student' | 'admin', turmaId?: string) => {
    setIsAuthenticating(true);
    
    // Simula o delay do Google Auth / Firebase Redirect
    setTimeout(() => {
      const userToLogin = role === 'admin' 
        ? mockUser 
        : { 
            ...mockUser, 
            role: 'student' as const, 
            displayName: `Residente ${mockTurmas.find(t => t.id === turmaId)?.name.split('-')[0]}`,
            turma_id: turmaId || 'r1-2026',
            approved: true
          };
      
      onLogin(userToLogin);
      setIsAuthenticating(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-8 text-white relative overflow-hidden">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute left-[-20%] top-1/2 -translate-y-1/2 w-64 h-[80vh] opacity-20 gold-gradient rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute right-[-10%] top-0 w-40 h-40 opacity-10 gold-gradient rounded-full blur-2xl pointer-events-none"></div>

      {/* Overlay de Autenticação */}
      {isAuthenticating && (
        <div className="fixed inset-0 z-[100] bg-brand-dark/90 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
          <p className="text-brand-gold font-black text-[10px] uppercase tracking-[0.3em]">Autenticando com Google...</p>
        </div>
      )}

      <div className="w-full max-w-sm z-10 space-y-12">
        {/* Cabeçalho */}
        <div className="text-left space-y-4">
          <div className="flex items-start space-x-6">
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

        {/* Seção de Acesso Principal */}
        <div className="space-y-4">
          <p className="text-[10px] font-black text-brand-gold uppercase tracking-[0.4em] text-center mb-6 opacity-80">Acesso via Google Sign-In</p>
          
          {/* Botões dos Residentes - Mesma cor e destaque */}
          <div className="space-y-3">
            {mockTurmas.map(turma => (
              <button
                key={turma.id}
                disabled={isAuthenticating}
                onClick={() => handleSimulatedAuth('student', turma.id)}
                className="w-full gold-gradient text-brand-dark rounded-2xl py-4.5 px-6 flex items-center justify-center space-x-3 font-black shadow-2xl active:scale-95 transition-all group overflow-hidden relative h-16"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none"></div>
                <div className="flex items-center space-x-3 z-10">
                   <Chrome size={18} />
                   <span className="text-xs uppercase tracking-widest">{turma.name}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="py-2"></div>

          {/* Botão do Coordenador - Diferenciado por ícone mas mesmo peso */}
          <button
            disabled={isAuthenticating}
            onClick={() => handleSimulatedAuth('admin')}
            className="w-full bg-brand-slate border border-brand-gold/50 text-brand-gold rounded-2xl py-4.5 px-6 flex items-center justify-center space-x-3 font-black shadow-xl active:scale-95 transition-all h-16"
          >
            <ShieldCheck size={20} />
            <span className="text-xs uppercase tracking-widest">Acesso Coordenador</span>
          </button>

          {/* Botão de Registro - Menor e discreto em baixo */}
          <div className="pt-6 flex flex-col items-center">
            <button
              disabled={isAuthenticating}
              onClick={onGoToRegister}
              className="group flex items-center space-x-2 text-gray-500 hover:text-white transition-colors py-2 px-4 rounded-full active:scale-95"
            >
              <UserPlus size={14} className="text-brand-gold opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Não tem conta? Solicite matrícula</span>
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-[9px] text-gray-700 text-center uppercase tracking-[0.3em] pt-4 font-bold opacity-40">
          CTBMF Ecosystem • Powered by Andreoni
        </p>
      </div>
    </div>
  );
};

export default Login;
