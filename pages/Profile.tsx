
import React from 'react';
import { AppUser } from '../types';
import { LogOut, Settings, Award, Shield, Mail, GraduationCap } from 'lucide-react';

interface ProfileProps {
  user: AppUser;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {
  return (
    <div className="space-y-10 animate-fade-in pb-10">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl relative z-10">
            <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
          </div>
          {/* Decorative halo */}
          <div className="absolute inset-0 bg-brand-gold/20 blur-2xl rounded-full translate-y-4 scale-110"></div>
          <div className="absolute -bottom-2 -right-2 bg-brand-dark text-brand-gold p-2 rounded-2xl border-4 border-white z-20 shadow-lg">
            {user.role === 'admin' ? <Shield size={18} /> : <Award size={18} />}
          </div>
        </div>
        <h2 className="text-2xl font-black text-brand-dark tracking-tight">{user.displayName}</h2>
        <p className="text-brand-gold font-black text-[10px] uppercase tracking-[0.3em] mt-2 px-4 py-1.5 bg-brand-dark rounded-full shadow-lg">
          {user.role === 'admin' ? 'Coordenador / Chefe' : 'Residente CTBMF'}
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Credenciais e Acesso</h3>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 divide-y divide-gray-50 overflow-hidden">
          <div className="p-5 flex items-center justify-between group">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-brand-gold transition-colors"><Mail size={20} /></div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">E-mail Institucional</span>
                 <span className="text-sm font-bold text-brand-dark">{user.email}</span>
              </div>
            </div>
          </div>
          <div className="p-5 flex items-center justify-between group">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-brand-gold transition-colors"><GraduationCap size={20} /></div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Turma Atual</span>
                 <span className="text-sm font-bold text-brand-dark">{user.turma_id === 'general' ? 'Geral (Todos)' : user.turma_id}</span>
              </div>
            </div>
          </div>
          <div className="p-5 flex items-center justify-between group">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-brand-gold transition-colors"><Settings size={20} /></div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Configurações</span>
                 <span className="text-sm font-bold text-brand-dark">Preferências da Conta</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button 
          onClick={onLogout}
          className="w-full bg-red-50 text-red-600 p-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-3 active:scale-[0.98] transition-all border border-red-100 hover:bg-red-100 shadow-lg shadow-red-500/5"
        >
          <LogOut size={18} />
          <span>Encerrar Sessão</span>
        </button>
      </div>

      <div className="text-center space-y-2 opacity-30 group">
        <p className="text-[8px] text-gray-400 uppercase tracking-[0.5em] font-black group-hover:text-brand-gold transition-colors">
          CTBMF ANDREONI • ECOSYSTEM v1.0
        </p>
        <div className="flex justify-center space-x-1">
          <div className="w-1 h-1 bg-brand-gold rounded-full"></div>
          <div className="w-4 h-1 bg-brand-gold rounded-full"></div>
          <div className="w-1 h-1 bg-brand-gold rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
