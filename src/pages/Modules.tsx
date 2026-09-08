
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, QuerySnapshot } from 'firebase/firestore';
import { db, dbDefault } from '../firebase';
import { mockModules, mockItems } from '../services/mockData';
import { FileText, ChevronRight, Book, ClipboardList, ExternalLink, GraduationCap, Star, PlayCircle, Video as VideoIcon, BookOpen } from 'lucide-react';
import { ItemType, MaterialItem, Module, AppUser } from '../types';

interface ModulesProps {
  user: AppUser;
}

const Modules: React.FC<ModulesProps> = ({ user }) => {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [modules, setModules] = useState<Module[]>([]);

  useEffect(() => {
    console.log('[MODULES] Iniciando busca híbrida de materiais');
    
    // Função para processar snapshots de múltiplos bancos
    const handleSnapshot = (snapshot: { docs: { id: string, data: () => unknown }[], size: number }, source: string) => {
      console.log(`[MODULES] Materiais de ${source}: ${snapshot.size}`);
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MaterialItem));
      
      setMaterials(prev => {
        const otherItems = prev.filter(p => !items.some(i => i.title === p.title));
        const merged = [...otherItems, ...items];
        
        // Se ainda estiver vazio após tentar os bancos, usa o mock
        if (merged.length === 0) return mockItems;
        return merged;
      });
    };

    const unsubNamed = onSnapshot(collection(db, "materials"), 
      (snap) => handleSnapshot(snap, 'Banco Nomeado'),
      (err) => console.error('Erro Banco Nomeado:', err)
    );

    // Busca única no banco padrão apenas se diferente do principal
    if (db !== dbDefault) {
      getDocs(collection(dbDefault, "materials")).then((snap) => {
        handleSnapshot(snap as QuerySnapshot, 'Banco Padrão');
      }).catch((err) => {
        console.warn('Banco Padrão (Legacy) inacessível para materiais:', err.message);
      });
    }

    // Modules unificados
    const resultsModules: Record<string, Module[]> = { named: [], default: [] };
    const updateModules = () => {
      const merged = [...resultsModules.named];
      resultsModules.default.forEach(item => {
        if (!merged.some(m => m.id === item.id)) merged.push(item);
      });
      
      if (merged.length === 0) {
        setModules(mockModules);
      } else {
        setModules(merged);
      }
    };

    const unsubModulesNamed = onSnapshot(collection(db, "modules"), (snapshot) => {
      resultsModules.named = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
      updateModules();
    }, (error) => {
      console.error('[MODULES] Erro módulos (Named):', error);
    });

    // Busca única no banco padrão apenas se diferente do principal
    if (db !== dbDefault) {
      getDocs(collection(dbDefault, "modules")).then((snapshot) => {
        resultsModules.default = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
        updateModules();
      }).catch((error) => {
        console.warn('[MODULES] Banco Padrão (Legacy) inacessível para módulos:', error.message);
      });
    }

    return () => {
      unsubNamed();
      unsubModulesNamed();
    };
  }, []);

  const getTypeIcon = (type: ItemType) => {
    switch (type) {
      case ItemType.PDF: return <FileText className="text-red-500" size={18} />;
      case ItemType.BOOK: return <Book className="text-brand-gold" size={18} />;
      case ItemType.PROTOCOL: return <ClipboardList className="text-emerald-500" size={18} />;
      case ItemType.VIDEO: return <PlayCircle className="text-red-600" size={18} />;
      default: return <FileText size={18} />;
    }
  };

  const currentModuleItems = materials.filter(item => 
    item.moduleId === selectedModuleId
  );

  const studyMaterials = currentModuleItems.filter(item => item.type !== ItemType.VIDEO);
  const videoLessons = currentModuleItems.filter(item => item.type === ItemType.VIDEO);

  // Filter modules by audience
  const filteredModules = modules.filter(mod => {
    if (user.role === 'admin') return true;
    if (!mod.audience || mod.audience.length === 0) return true; // Show to all if no audience specified
    return mod.audience.includes(user.residencyLevel as 'R1' | 'R2' | 'R3');
  });

  const selectedModule = modules.find(m => m.id === selectedModuleId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <h2 className="text-2xl font-black text-brand-dark tracking-tight">Materiais</h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Temas e Bibliografia</p>
      </div>

      {/* Google Drive Library Section */}
      <div className="animate-fade-in space-y-4">
        
        <a 
          href="https://drive.google.com/drive/folders/13_FHMarqnKHWyUBD_s9ehayDnm0egxK_?usp=drive_link"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-brand-dark rounded-3xl p-5 text-white shadow-xl shadow-brand-gold/5 relative overflow-hidden group active:scale-[0.98] transition-all border border-brand-gold/20 flex items-center justify-between"
        >
          <div className="relative z-10 flex items-center space-x-4">
            <div className="bg-brand-gold/20 backdrop-blur-md p-3 rounded-2xl border border-brand-gold/20">
              <Book size={24} className="text-brand-gold" />
            </div>
            <div className="text-left">
              <div className="flex items-center space-x-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">Biblioteca Digital</span>
              </div>
              <h3 className="font-bold text-lg leading-tight">Acessar Livros</h3>
              <p className="text-white/70 text-[10px] font-medium mt-1">Google Drive • Acervo Completo</p>
            </div>
          </div>
          <div className="bg-brand-gold text-brand-dark p-2 rounded-full shadow-lg group-hover:scale-110 transition-transform">
            <ExternalLink size={18} />
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        </a>
      </div>

      {!selectedModuleId ? (
        <div className="grid gap-4">
          {filteredModules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setSelectedModuleId(mod.id)}
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all text-left group"
            >
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <GraduationCap size={14} className="text-brand-gold" />
                  <span className="text-[9px] font-black text-brand-gold uppercase tracking-[0.2em]">Tema</span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg group-hover:text-brand-gold transition-colors">{mod.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1 font-medium">{mod.description}</p>
                <div className="mt-4 flex items-center space-x-2">
                   <span className="text-[10px] font-bold text-gray-400 uppercase">
                     {materials.filter(i => i.moduleId === mod.id).length} Materiais Disponíveis
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
            Temas
          </button>
          
          <div className="bg-brand-dark p-6 rounded-3xl text-white mb-6 shadow-xl border border-brand-gold/20 relative overflow-hidden">
            <h3 className="text-xl font-bold z-10 relative">{selectedModule?.name}</h3>
            <p className="text-[10px] text-brand-gold font-black uppercase tracking-widest mt-1 z-10 relative opacity-80">Materiais de Estudo</p>
            <div className="absolute top-[-50%] right-[-10%] w-32 h-32 gold-gradient opacity-10 rounded-full blur-2xl"></div>
          </div>

          <div className="space-y-6">
            {/* Study Materials Section */}
            {studyMaterials.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 px-1">
                  <BookOpen size={14} className="text-brand-gold" />
                  <h4 className="text-[10px] font-black text-brand-dark uppercase tracking-[0.2em]">Bibliografia e Apostilas</h4>
                </div>
                {studyMaterials.map(item => (
                  <a
                    key={item.id}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-start p-4 bg-white rounded-2xl border transition-all active:scale-[0.98] ${
                      item.isImportant 
                        ? 'border-brand-gold/40 shadow-[0_4px_20px_rgba(200,155,60,0.1)] ring-1 ring-brand-gold/10' 
                        : 'border-gray-100 shadow-sm'
                    }`}
                  >
                    <div className={`p-3 rounded-xl mr-4 border ${item.isImportant ? 'bg-brand-gold/5 border-brand-gold/20' : 'bg-gray-50 border-gray-100'}`}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-gray-900 text-sm leading-tight">{item.title}</h4>
                        {item.isImportant && (
                          <span className="flex items-center space-x-0.5 bg-brand-gold/10 px-1.5 py-0.5 rounded text-[8px] font-black text-brand-gold uppercase tracking-tighter">
                            <Star size={8} fill="currentColor" />
                            <span>Foco</span>
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed font-medium">
                          {item.description}
                        </p>
                      )}
                      <p className="text-[9px] font-black text-brand-gold uppercase tracking-widest mt-2">{item.type}</p>
                    </div>
                    <ExternalLink size={14} className="text-gray-300 mt-1" />
                  </a>
                ))}
              </div>
            )}

            {/* Video Lessons Section */}
            {videoLessons.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 px-1">
                  <VideoIcon size={14} className="text-red-600" />
                  <h4 className="text-[10px] font-black text-brand-dark uppercase tracking-[0.2em]">Aulas Gravadas</h4>
                </div>
                {videoLessons.map(item => (
                  <a
                    key={item.id}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-start p-4 bg-white rounded-2xl border transition-all active:scale-[0.98] ${
                      item.isImportant 
                        ? 'border-brand-gold/40 shadow-[0_4px_20px_rgba(200,155,60,0.1)] ring-1 ring-brand-gold/10' 
                        : 'border-gray-100 shadow-sm'
                    }`}
                  >
                    <div className={`p-3 rounded-xl mr-4 border ${item.isImportant ? 'bg-brand-gold/5 border-brand-gold/20' : 'bg-gray-50 border-gray-100'}`}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-gray-900 text-sm leading-tight">{item.title}</h4>
                        {item.isImportant && (
                          <span className="flex items-center space-x-0.5 bg-brand-gold/10 px-1.5 py-0.5 rounded text-[8px] font-black text-brand-gold uppercase tracking-tighter">
                            <Star size={8} fill="currentColor" />
                            <span>Destaque</span>
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed font-medium">
                          {item.description}
                        </p>
                      )}
                      <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mt-2">Vídeo Aula</p>
                    </div>
                    <ExternalLink size={14} className="text-gray-300 mt-1" />
                  </a>
                ))}
              </div>
            )}

            {currentModuleItems.length === 0 && (
              <div className="py-20 text-center space-y-2">
                <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Book size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Nenhum material cadastrado</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Modules;
