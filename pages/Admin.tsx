
import React, { useState } from 'react';
import { Plus, Trash2, Send, CheckCircle2, LayoutGrid, FilePlus, Users, UserCheck, UserX, ShieldCheck, Clock, ShieldX } from 'lucide-react';
import { ItemType } from '../types';
import { mockTurmas, mockPendingUsers, mockActiveUsers } from '../services/mockData';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'access' | 'posts' | 'materials'>('access');
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingUsers, setPendingUsers] = useState(mockPendingUsers);
  const [activeUsers, setActiveUsers] = useState(mockActiveUsers);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleApproveUser = (user: any) => {
    setPendingUsers(prev => prev.filter(u => u.uid !== user.uid));
    setActiveUsers(prev => [...prev, { ...user, approved: true }]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleDeactivateUser = (id: string) => {
    setActiveUsers(prev => prev.filter(u => u.uid !== id));
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-brand-dark tracking-tight">Coordenação</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Painel de Controle Dr. Andreoni</p>
        </div>
        <div className="bg-brand-gold/10 p-2 rounded-xl">
           <ShieldCheck className="text-brand-gold" size={24} />
        </div>
      </header>

      {/* Menu do Admin - Abas */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl">
        <button 
          onClick={() => setActiveTab('access')}
          className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
            activeTab === 'access' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400'
          }`}
        >
          Acessos
          {pendingUsers.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-white animate-pulse">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'posts' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400'
          }`}
        >
          Avisos
        </button>
        <button 
          onClick={() => setActiveTab('materials')}
          className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'materials' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400'
          }`}
        >
          Materiais
        </button>
      </div>

      {showSuccess && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center text-emerald-700 animate-bounce shadow-sm">
          <CheckCircle2 className="mr-3 text-emerald-500" size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest">Procedimento concluído!</span>
        </div>
      )}

      {/* ABA: GESTÃO DE ACESSOS (A principal solicitada) */}
      {activeTab === 'access' && (
        <div className="space-y-6 animate-fade-in">
          {/* Sessão Pendentes */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
            <h3 className="font-bold text-gray-800 flex items-center uppercase text-sm tracking-widest">
              <Clock className="mr-3 text-brand-gold" size={20} />
              Solicitações Pendentes
            </h3>
            
            <div className="space-y-3">
              {pendingUsers.length > 0 ? (
                pendingUsers.map(user => (
                  <div key={user.uid} className="bg-brand-dark/[0.02] p-4 rounded-2xl border border-gray-100 flex items-center justify-between group hover:border-brand-gold/30 transition-all">
                    <div className="flex items-center space-x-3">
                      <img src={user.photoURL} className="w-11 h-11 rounded-xl border-2 border-white shadow-sm" alt={user.displayName} />
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 leading-tight">{user.displayName}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[8px] font-black bg-brand-gold/10 text-brand-gold px-1.5 py-0.5 rounded-md uppercase tracking-widest">
                            {mockTurmas.find(t => t.id === user.turma_id)?.name.split(' ')[0]}
                          </span>
                          <span className="text-[8px] font-bold text-gray-400">{user.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleApproveUser(user)}
                        title="Liberar Acesso"
                        className="bg-emerald-500 text-white p-2.5 rounded-xl active:scale-90 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <UserCheck size={18} />
                      </button>
                      <button className="bg-red-50 text-red-400 p-2.5 rounded-xl active:scale-90 transition-all hover:bg-red-100">
                        <UserX size={18} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Sem solicitações no momento</p>
                </div>
              )}
            </div>
          </div>

          {/* Sessão Ativos */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
            <h3 className="font-bold text-gray-800 flex items-center uppercase text-sm tracking-widest">
              <Users className="mr-3 text-brand-gold" size={20} />
              Residentes Ativos
            </h3>
            
            <div className="space-y-3">
              {activeUsers.map(user => (
                <div key={user.uid} className="p-4 rounded-2xl border border-gray-50 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex items-center space-x-3">
                    <img src={user.photoURL} className="w-9 h-9 rounded-lg grayscale" alt={user.displayName} />
                    <div>
                      <h4 className="font-bold text-xs text-gray-700">{user.displayName}</h4>
                      <p className="text-[8px] font-medium text-gray-400">{user.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeactivateUser(user.uid)}
                    className="text-gray-300 hover:text-red-400 p-2 transition-colors"
                  >
                    <ShieldX size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA: PUBLICAR AVISOS */}
      {activeTab === 'posts' && (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
            <h3 className="font-bold text-gray-800 flex items-center uppercase text-sm tracking-widest">
              <Plus className="mr-3 text-brand-gold" size={20} />
              Novo Comunicado
            </h3>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Título</label>
              <input type="text" placeholder="Ex: Aviso Importante" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium outline-none" />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Conteúdo</label>
              <textarea rows={4} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium resize-none"></textarea>
            </div>

            <button className="w-full bg-brand-dark text-brand-gold rounded-2xl py-4 font-black uppercase tracking-[0.2em] flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-xl shadow-brand-dark/20 border border-brand-gold/10">
              <Send size={18} />
              <span>Enviar para Alunos</span>
            </button>
          </div>
        </form>
      )}

      {/* ABA: MATERIAIS */}
      {activeTab === 'materials' && (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
            <h3 className="font-bold text-gray-800 flex items-center uppercase text-sm tracking-widest">
              <FilePlus className="mr-3 text-brand-gold" size={20} />
              Novo Material
            </h3>
            
            <div className="space-y-4">
              <input type="text" placeholder="Nome do arquivo ou aula" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium" />
              <div className="grid grid-cols-2 gap-4">
                <select className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium appearance-none">
                  <option>Módulo 1</option>
                  <option>Módulo 2</option>
                </select>
                <select className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium appearance-none">
                  <option value={ItemType.PDF}>PDF</option>
                  <option value={ItemType.VIDEO}>VÍDEO</option>
                </select>
              </div>
              <input type="text" placeholder="Link do Google Drive ou YouTube" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium" />
            </div>

            <button className="w-full gold-gradient text-brand-dark rounded-2xl py-4 font-black uppercase tracking-[0.2em] active:scale-95 transition-all shadow-xl shadow-brand-gold/20">
              Salvar Material
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default Admin;
