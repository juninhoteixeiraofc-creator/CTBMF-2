
import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Send, CheckCircle2, LayoutGrid, FilePlus } from 'lucide-react';
import { ItemType } from '../types';
import { mockTurmas } from '../services/mockData';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'posts' | 'materials'>('posts');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-black text-brand-dark tracking-tight">Coordenação</h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gestão de Conteúdo Acadêmico</p>
      </header>

      <div className="flex bg-gray-100 p-1 rounded-2xl">
        <button 
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'posts' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400'
          }`}
        >
          Avisos
        </button>
        <button 
          onClick={() => setActiveTab('materials')}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'materials' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400'
          }`}
        >
          Materiais
        </button>
      </div>

      {showSuccess && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center text-emerald-700 animate-bounce shadow-sm">
          <CheckCircle2 className="mr-3" size={20} />
          <span className="text-xs font-bold uppercase tracking-widest">Salvo com sucesso na base!</span>
        </div>
      )}

      {activeTab === 'posts' ? (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
            <h3 className="font-bold text-gray-800 flex items-center uppercase text-sm tracking-widest">
              <Plus className="mr-3 text-brand-gold" size={20} />
              Criar Novo Comunicado
            </h3>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Título do Aviso</label>
              <input 
                type="text" 
                placeholder="Ex: Mudança na escala de plantão" 
                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-gold/30 transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mensagem</label>
              <textarea 
                rows={4}
                placeholder="Descreva o comunicado aos alunos..." 
                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-gold/30 transition-all resize-none"
              ></textarea>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Direcionar para</label>
              <div className="relative">
                <select className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-gold/30 appearance-none">
                  <option>Todas as Turmas (Padrão)</option>
                  {mockTurmas.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <LayoutGrid className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={16} />
              </div>
            </div>

            <button className="w-full bg-brand-dark text-brand-gold rounded-2xl py-4 font-black uppercase tracking-[0.2em] flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-xl shadow-brand-dark/20 border border-brand-gold/10">
              <Send size={18} />
              <span>Publicar Agora</span>
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
            <h3 className="font-bold text-gray-800 flex items-center uppercase text-sm tracking-widest">
              <FilePlus className="mr-3 text-brand-gold" size={20} />
              Upload de Material
            </h3>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nome da Aula/Procedimento</label>
              <input type="text" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Módulo</label>
                <select className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium appearance-none">
                  <option>Fundamentos</option>
                  <option>Traumatologia</option>
                  <option>Ortognática</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Formato</label>
                <select className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium appearance-none">
                  <option value={ItemType.PDF}>PDF / DRIVE</option>
                  <option value={ItemType.VIDEO}>VÍDEO / YT</option>
                  <option value={ItemType.PROTOCOL}>PDF / PROTOCOLO</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Público Alvo</label>
              <select className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium appearance-none">
                <option value="all">Geral (Todos)</option>
                {mockTurmas.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">URL de Destino</label>
              <input type="text" placeholder="https://..." className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-medium" />
            </div>

            <button className="w-full gold-gradient text-brand-dark rounded-2xl py-4 font-black uppercase tracking-[0.2em] active:scale-95 transition-all shadow-xl shadow-brand-gold/20">
              Cadastrar Material
            </button>
          </div>
        </form>
      )}

      <div className="bg-brand-dark rounded-3xl p-6 border border-brand-gold/10 text-center shadow-lg relative overflow-hidden">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black relative z-10">
          Operação: <span className="text-brand-gold">Dr. Andreoni (CHEFE)</span>
        </p>
        <div className="absolute top-0 right-0 w-20 h-20 gold-gradient opacity-5 rounded-full blur-xl"></div>
      </div>
    </div>
  );
};

export default Admin;
