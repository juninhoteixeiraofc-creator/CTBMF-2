
import React from 'react';
import { mockPosts } from '../services/mockData';
import { AppUser } from '../types';
import { Bell, ChevronRight, Clock } from 'lucide-react';

interface HomeProps {
  user: AppUser;
}

const Home: React.FC<HomeProps> = ({ user }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-brand-dark">Olá, Dr. {user.displayName.split(' ')[0]}</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Residência • {user.turma_id === 'general' ? 'Geral' : user.turma_id}</p>
        </div>
        <div className="bg-brand-dark p-2 rounded-xl relative shadow-lg">
          <Bell size={20} className="text-brand-gold" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-brand-dark rounded-full"></span>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 uppercase text-sm tracking-widest">Avisos Oficiais</h3>
          <button className="text-brand-gold text-[10px] font-black uppercase tracking-widest hover:underline">Ver todos</button>
        </div>
        
        <div className="space-y-4">
          {mockPosts.map((post) => (
            <div key={post.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_4px_15px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full gold-gradient opacity-80"></div>
              <div className="flex items-center text-[10px] text-gray-400 mb-2 space-x-2 font-bold uppercase tracking-tighter">
                <Clock size={12} className="text-brand-gold" />
                <span>{new Date(post.date).toLocaleDateString('pt-BR')}</span>
                <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                <span className="text-brand-dark">{post.authorName}</span>
              </div>
              <h4 className="font-bold text-gray-900 text-lg leading-snug group-hover:text-brand-gold transition-colors">{post.title}</h4>
              <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed font-medium">
                {post.content}
              </p>
              <button className="mt-4 flex items-center text-brand-gold text-[10px] font-black uppercase tracking-[0.2em] group">
                Ler comunicado
                <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="bg-brand-dark rounded-3xl p-6 text-white shadow-2xl overflow-hidden relative border border-brand-gold/20">
        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-gold">Próximo Módulo</span>
          </div>
          <h3 className="font-bold text-xl mb-1 leading-tight">Traumatologia<br/>Bucomaxilo Avançada</h3>
          <p className="text-gray-400 text-xs mt-2 font-medium">Início confirmado: 15 de Outubro</p>
        </div>
        {/* Abstract background shape */}
        <div className="absolute bottom-[-20%] right-[-10%] w-40 h-40 gold-gradient opacity-10 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

export default Home;
