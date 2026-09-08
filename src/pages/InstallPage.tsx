
import React from 'react';
import { Share, PlusSquare, ChevronLeft, Smartphone, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Logo from '../components/Logo';

const InstallPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col animate-fade-in">
      {/* Header */}
      <header className="bg-brand-dark p-6 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 text-brand-gold hover:bg-white/10 rounded-xl transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-white font-black text-lg uppercase tracking-widest">Instalação</h1>
      </header>

      <main className="flex-1 p-6 space-y-8 max-w-md mx-auto w-full">
        {/* App Icon & Title */}
        <div className="text-center space-y-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Logo size="xl" className="drop-shadow-[0_10px_30px_rgba(200,155,60,0.3)]" />
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-brand-dark uppercase tracking-tight leading-none">CTBMF</h2>
              <p className="text-[10px] text-brand-gold font-black uppercase tracking-[0.3em]">Instituto Andreoni</p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-3 text-brand-gold">
            <Smartphone size={20} />
            <h3 className="font-black text-xs uppercase tracking-widest">Instruções para iPhone</h3>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-blue-500 shrink-0 font-black text-xs">
                1
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-brand-dark">Toque em Compartilhar</p>
                <p className="text-xs text-gray-500 font-medium">Localizado na barra inferior do Safari.</p>
                <div className="mt-2 p-2 bg-gray-50 rounded-lg inline-flex items-center gap-2 text-blue-500">
                  <Share size={16} />
                  <span className="text-[10px] font-black uppercase">Compartilhar</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-gray-700 shrink-0 font-black text-xs">
                2
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-brand-dark">Adicionar à Tela de Início</p>
                <p className="text-xs text-gray-500 font-medium">Role a lista para baixo até encontrar esta opção.</p>
                <div className="mt-2 p-2 bg-gray-50 rounded-lg inline-flex items-center gap-2 text-gray-700">
                  <PlusSquare size={16} />
                  <span className="text-[10px] font-black uppercase">Tela de Início</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-brand-gold shrink-0 font-black text-xs">
                3
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-brand-dark">Toque em Adicionar</p>
                <p className="text-xs text-gray-500 font-medium">No canto superior direito da tela.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => navigate('/')}
          className="w-full gold-gradient text-brand-dark py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          <Download size={18} />
          Abrir Aplicativo
        </button>

        <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          Disponível para iOS e Android via Navegador
        </p>
      </main>
    </div>
  );
};

export default InstallPage;
