
import React, { useState } from 'react';
import { mockModules, mockItems } from '../services/mockData';
import { FileText, ChevronRight, Book, ClipboardList, ExternalLink, GraduationCap } from 'lucide-react';
import { ItemType } from '../types';

const Modules: React.FC = () => {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  const getTypeIcon = (type: ItemType) => {
    switch (type) {
      case ItemType.PDF: return <FileText className="text-red-500" size={18} />;
      case ItemType.BOOK: return <Book className="text-brand-gold" size={18} />;
      case ItemType.PROTOCOL: return <ClipboardList className="text-emerald-500" size={18} />;
      default: return <FileText size={18} />;
    }
  };

  const currentModuleItems = mockItems.filter(item => 
    item.moduleId === selectedModuleId && item.type !== ItemType.VIDEO
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <h2 className="text-2xl font-black text-brand-dark tracking-tight">Acadêmico</h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Módulos e Bibliografia</p>
      </div>

      {!selectedModuleId ? (
        <div className="grid gap-4">
          {mockModules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setSelectedModuleId(mod.id)}
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all text-left group"
            >
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <GraduationCap size={14} className="text-brand-gold" />
                  <span className="text-[9px] font-black text-brand-gold uppercase tracking-[0.2em]">Módulo</span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg group-hover:text-brand-gold transition-colors">{mod.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1 font-medium">{mod.description}</p>
                <div className="mt-4 flex items-center space-x-2">
                   <div className="flex -space-x-1">
                     {[1,2,3].map(i => <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-gray-100"></div>)}
                   </div>
                   <span className="text-[10px] font-bold text-gray-400 uppercase">
                     {mockItems.filter(i => i.moduleId === mod.id && i.type !== ItemType.VIDEO).length} Materiais
                   </span>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-300 group-hover:text-brand-gold transition-colors" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <button 
            onClick={() => setSelectedModuleId(null)}
            className="text-brand-gold font-bold text-xs uppercase tracking-widest flex items-center mb-4 active:scale-95 transition-transform"
          >
            <ChevronRight size={18} className="rotate-180 mr-1" />
            Módulos
          </button>
          
          <div className="bg-brand-dark p-6 rounded-3xl text-white mb-6 shadow-xl border border-brand-gold/20 relative overflow-hidden">
            <h3 className="text-xl font-bold z-10 relative">{mockModules.find(m => m.id === selectedModuleId)?.name}</h3>
            <p className="text-[10px] text-brand-gold font-black uppercase tracking-widest mt-1 z-10 relative opacity-80">Materiais de Estudo</p>
            <div className="absolute top-[-50%] right-[-10%] w-32 h-32 gold-gradient opacity-10 rounded-full blur-2xl"></div>
          </div>

          <div className="space-y-3">
            {currentModuleItems.length > 0 ? (
              currentModuleItems.map(item => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-gold/30 transition-all active:scale-[0.98]"
                >
                  <div className="p-3 rounded-xl bg-gray-50 mr-4 border border-gray-100">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-sm leading-tight">{item.title}</h4>
                    <p className="text-[9px] font-bold text-brand-gold uppercase tracking-widest mt-1">{item.type}</p>
                  </div>
                  <ExternalLink size={16} className="text-gray-300" />
                </a>
              ))
            ) : (
              <div className="py-20 text-center space-y-2">
                <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Book size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Nenhum material encontrado</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Modules;
