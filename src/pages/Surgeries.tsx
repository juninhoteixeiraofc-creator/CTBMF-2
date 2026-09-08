
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db, dbDefault } from '../firebase';
import { AppUser, Surgery } from '../types';
import { PlayCircle, Search, Video, Star, X, Lock } from 'lucide-react';

interface SurgeriesProps {
  user: AppUser;
}

const Surgeries: React.FC<SurgeriesProps> = ({ user }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Surgery | null>(null);
  const [activeCategory, setActiveCategory] = useState<'trauma' | 'ortognatica' | 'estetica' | 'atm'>('trauma');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [debugLogs, setDebugLogs] = useState<{col: string, count: number, error?: string}[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addDebugLog = (col: string, count: number, error?: string) => {
    /*
    setDebugLogs(prev => {
      const filtered = prev.filter(l => l.col !== col);
      return [...filtered, { col, count, error }];
    });
    */
  };

  useEffect(() => {
    console.log('[SURGERIES] Iniciando busca de cirurgias (coleção: surgeries)');
    
    const results: Record<string, Surgery[]> = { named: [], default: [] };
    
    const updateState = () => {
      const merged = [...results.named];
      results.default.forEach(item => {
        if (!merged.some(m => m.id === item.id)) merged.push(item);
      });
      
      // Sort in memory
      merged.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return dateB - dateA;
      });
      
      setSurgeries(merged);
      addDebugLog('surgeries', merged.length);
    };

    const unsubNamed = onSnapshot(collection(db, "surgeries"), (snap) => {
      results.named = snap.docs.map(d => ({ id: d.id, ...d.data() } as Surgery));
      updateState();
    }, (err) => {
      console.error('[SURGERIES] Erro (Named):', err);
      addDebugLog('surgeries', 0, err.message);
    });

    // Busca única no banco padrão apenas se for diferente do banco principal (migração)
    if (db !== dbDefault) {
      getDocs(collection(dbDefault, "surgeries")).then((snap) => {
        results.default = snap.docs.map(d => ({ id: d.id, ...d.data() } as Surgery));
        updateState();
      }).catch((err) => {
        // Silencia erro de permissão no banco default para usuários normais
        console.warn('[SURGERIES] Banco Default (Legacy) inacessível ou vazio:', err.message);
      });
    }

    return () => { unsubNamed(); };
  }, []);

  const getYoutubeId = (url: string) => {
    if (!url) return null;
    if (url.length === 11) return url; // Already an ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const categories = [
    { id: 'trauma', label: 'Trauma', minLevel: 'R1' },
    { id: 'atm', label: 'ATM', minLevel: 'R3' },
    { id: 'ortognatica', label: 'Ortognática', minLevel: 'R2' },
    { id: 'estetica', label: 'Estética', minLevel: 'R2' },
  ] as const;

  const userLevel = user.residencyLevel || 'R1';

  const hasAccess = (category: string) => {
    if (user.role === 'admin') return true;
    if (userLevel === 'R3') return true;
    if (userLevel === 'R2') return ['trauma', 'ortognatica', 'estetica'].includes(category);
    if (userLevel === 'R1') return category === 'trauma';
    return false;
  };

  const filteredVideos = useMemo(() => {
    return surgeries.filter(item => 
      item.category === activeCategory &&
      (item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
       (item.description || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [surgeries, activeCategory, searchTerm]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-black text-brand-dark tracking-tight">Cirurgias</h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acervo Clínico em Vídeo • Nível {userLevel}</p>
      </header>

      {/* Video Player Overlay */}
      {selectedVideo && (
        <div className="fixed inset-0 z-[100] bg-brand-dark/95 backdrop-blur-xl flex flex-col animate-fade-in">
          <div className="p-4 flex items-center justify-between border-b border-white/10">
            <div className="flex flex-col">
              <h3 className="text-white font-bold text-sm line-clamp-1">{selectedVideo.title}</h3>
              <span className="text-[10px] text-brand-gold font-black uppercase tracking-widest">Reproduzindo agora</span>
            </div>
            <button 
              onClick={() => setSelectedVideo(null)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <iframe
                src={`https://www.youtube.com/embed/${getYoutubeId(selectedVideo.youtubeVideoId)}?autoplay=1`}
                title={selectedVideo.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>

          <div className="p-6 bg-white/5 border-t border-white/10">
            <p className="text-gray-400 text-xs font-medium leading-relaxed max-w-2xl mx-auto text-center">
              {selectedVideo.description}
            </p>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
        {categories.map((cat) => {
          const locked = !hasAccess(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => !locked && setActiveCategory(cat.id)}
              className={`flex-1 min-w-[100px] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2 ${
                activeCategory === cat.id 
                  ? 'bg-brand-dark shadow-lg text-brand-gold' 
                  : locked ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>{cat.label}</span>
              {locked && <Lock size={10} />}
            </button>
          );
        })}
      </div>

      <div className="relative group">
        <input 
          type="text" 
          placeholder="Buscar cirurgia ou tema..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-gray-100 rounded-2xl py-3 px-12 text-sm focus:ring-2 focus:ring-brand-gold/50 outline-none shadow-sm transition-all font-medium"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-gold transition-colors" size={18} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-3">
            <div className="h-4 w-1 gold-gradient rounded-full"></div>
            <h3 className="font-black text-brand-dark text-[11px] uppercase tracking-[0.25em]">
              {categories.find(c => c.id === activeCategory)?.label}
            </h3>
          </div>
          <span className="text-[9px] font-bold text-gray-400 uppercase">{filteredVideos.length} Vídeos</span>
        </div>
        
        <div className="grid gap-6">
          {filteredVideos.length > 0 ? (
            filteredVideos.map(video => {
              const thumbnailUrl = video.thumbnail || `https://img.youtube.com/vi/${video.youtubeVideoId}/hqdefault.jpg`;

              return (
                <button
                  key={video.id}
                  onClick={() => setSelectedVideo(video)}
                  className={`group text-left block bg-white rounded-3xl border overflow-hidden shadow-sm active:scale-[0.98] transition-all hover:shadow-xl w-full ${
                    video.isImportant ? 'border-brand-gold/30 ring-1 ring-brand-gold/10' : 'border-gray-100'
                  }`}
                >
                  <div className="aspect-video bg-brand-dark relative">
                    <img 
                      src={thumbnailUrl} 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                      alt={video.title} 
                    />
                    <div className="absolute inset-0 bg-brand-dark/20 group-hover:bg-transparent transition-colors"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white/10 backdrop-blur-md p-4 rounded-full border border-white/20 shadow-2xl group-hover:scale-110 transition-transform">
                        <PlayCircle className="text-white" size={32} />
                      </div>
                    </div>
                    {video.isImportant && (
                      <div className="absolute top-3 right-3 bg-brand-gold text-brand-dark text-[8px] font-black px-2 py-1 rounded-lg flex items-center space-x-1 tracking-widest uppercase shadow-lg">
                        <Star size={10} fill="currentColor" />
                        <span>Destaque</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h4 className="font-bold text-brand-dark text-lg leading-snug group-hover:text-brand-gold transition-colors">{video.title}</h4>
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2 font-medium">{video.description}</p>
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acesso restrito</p>
                      <span className="text-[9px] font-black text-brand-gold uppercase tracking-[0.2em]">{video.category}</span>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
               <Video size={48} className="mx-auto text-gray-200 mb-2" />
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhuma cirurgia nesta categoria</p>
            </div>
          )}
        </div>
      </div>
      {/* Diagnostic Overlay
      <div className="fixed bottom-20 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {debugLogs.map(log => (
          <div key={log.col} className="bg-black/80 backdrop-blur-md text-[10px] text-white p-2 rounded-lg border border-white/10 shadow-xl pointer-events-auto">
            <span className="font-bold text-brand-gold">{log.col}:</span> {log.count} docs
            {log.error && <div className="text-red-400 mt-1 font-mono">{log.error}</div>}
          </div>
        ))}
      </div>
      */}
    </div>
  );
};

export default Surgeries;
