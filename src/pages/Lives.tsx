
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { LiveSession, AppUser } from '../types';
import { generateEmbedUrl } from '../utils/videoUtils';
import { Radio, Play, X, Calendar, Clock, ExternalLink, Copy, AlertCircle, Search } from 'lucide-react';

interface LivesProps {
  user: AppUser;
}

const Lives: React.FC<LivesProps> = () => {
  const [lives, setLives] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLive, setSelectedLive] = useState<LiveSession | null>(null);
  const [playerState, setPlayerState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const playerTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "lives"),
      where("visible", "!=", false),
      orderBy("visible"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const livesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LiveSession[];
      
      // Secondary sort manually because Firestore composite keys are tricky with "!="
      const sorted = livesData.sort((a, b) => {
        // Priority 1: Live now
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        
        // Priority 2: Scheduled
        if (a.status === 'scheduled' && b.status !== 'scheduled' && b.status !== 'live') return -1;
        if (b.status === 'scheduled' && a.status !== 'scheduled' && a.status !== 'live') return 1;
        
        // Priority 3: Creation date (already mostly handled by query but ensuring)
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      });

      setLives(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar lives:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLives = lives.filter(live => 
    live.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    live.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Monitor Live Selection to manage player states
  useEffect(() => {
    if (selectedLive) {
      console.log(`[LIVES-PLAYER] Iniciando carregamento da live: ${selectedLive.title}`);
      
      // Use microtask to avoid synchronous setState in effect
      Promise.resolve().then(() => {
        setPlayerState('loading');
      });
      
      // Cleanup previous timeout if exists
      if (playerTimeoutRef.current) clearTimeout(playerTimeoutRef.current);
      
      // Set a 7-second verification timeout
      playerTimeoutRef.current = setTimeout(() => {
        setPlayerState(prev => {
          if (prev === 'loading') {
            console.warn('[LIVES-PLAYER] Verificação de timeout atingida. Ativando fallback visual.');
            return 'fallback';
          }
          return prev;
        });
      }, 7000);
    } else {
      if (playerTimeoutRef.current) clearTimeout(playerTimeoutRef.current);
    }
    
    return () => {
      if (playerTimeoutRef.current) clearTimeout(playerTimeoutRef.current);
    };
  }, [selectedLive]);

  const liveNow = filteredLives.filter(l => l.status === 'live');
  const upcoming = filteredLives.filter(l => l.status === 'scheduled');
  const past = filteredLives.filter(l => l.status === 'ended' || l.status === 'replay');

  return (
    <div className="space-y-10 animate-fade-in pb-10">
      {/* Header Section */}
      <header className="relative py-12 md:py-20 rounded-[40px] md:rounded-[60px] overflow-hidden">
        <div className="absolute inset-0 bg-brand-dark z-0">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-red-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
        </div>
        
        <div className="relative z-10 px-8 md:px-12">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-brand-gold/10 p-2.5 rounded-xl border border-brand-gold/20">
              <Radio size={24} className="text-brand-gold" />
            </div>
            <span className="text-[10px] md:text-sm font-black text-brand-gold uppercase tracking-[0.4em]">Transmissões</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6 tracking-tighter">
            Cirurgias <br/><span className="text-brand-gold">Ao Vivo.</span>
          </h2>
          <p className="text-gray-400 max-w-xl text-base md:text-lg font-medium leading-relaxed">
            Acompanhe procedimentos reais em tempo real e interaja com a equipe técnica diretamente do aplicativo.
          </p>
        </div>
      </header>

      {/* Search Bar */}
      <div className="relative -mt-8 mx-8 z-20">
        <div className="bg-white rounded-3xl p-2 shadow-2xl flex items-center border border-gray-100">
          <div className="flex-1 flex items-center px-4">
            <Search className="text-gray-400 mr-3" size={20} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título ou descrição..." 
              className="w-full py-4 text-sm font-bold bg-transparent border-none outline-none text-brand-dark placeholder-gray-300"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-6">
          <div className="w-16 h-16 border-4 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin"></div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Sincronizando sinal...</p>
        </div>
      ) : (
        <div className="space-y-16 px-2">
          {/* AO VIVO AGORA */}
          {liveNow.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center space-x-3">
                  <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></span>
                  <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest">Ao Vivo Agora</h3>
                </div>
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">{liveNow.length} Ativa(s)</span>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {liveNow.map(live => (
                  <div key={live.id} className="group relative bg-brand-dark rounded-[40px] overflow-hidden border border-brand-gold/20 shadow-2xl hover:border-brand-gold/40 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent z-10"></div>
                    <div className="relative aspect-video md:aspect-[21/9] overflow-hidden">
                      <img 
                        src={live.thumbnail || `https://img.youtube.com/vi/${live.videoId || (live.liveUrl || "").split('v=')[1]?.split('&')[0] || ''}/maxresdefault.jpg`} 
                        alt={live.title}
                        className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute inset-0 z-20 p-8 md:p-12 flex flex-col justify-center">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="bg-red-600 px-3 py-1 rounded-full flex items-center space-x-2">
                          <Radio size={14} className="text-white animate-pulse" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Now</span>
                        </div>
                      </div>
                      <h4 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tighter">{live.title}</h4>
                      <p className="text-gray-300 max-w-xl text-sm md:text-base font-medium line-clamp-2 mb-8">{live.description}</p>
                      <button 
                        onClick={() => setSelectedLive(live)}
                        className="w-fit bg-brand-gold text-brand-dark font-black uppercase text-[10px] md:text-sm tracking-widest px-10 py-5 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                      >
                        <Play size={20} fill="currentColor" />
                        Assistir Transmissão
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* AGENDADAS */}
          {upcoming.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center space-x-3 px-2">
                <Calendar className="text-blue-500" size={20} />
                <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest">Próximas Lives</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {upcoming.map(live => (
                  <div key={live.id} className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-xl hover:shadow-2xl transition-all group border-b-4 border-b-blue-500/20">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center space-x-3 text-blue-600">
                        <Clock size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Agendado</span>
                      </div>
                      <div className="bg-gray-50 px-3 py-1 rounded-full text-[10px] font-black text-gray-400 border border-gray-100 tracking-tighter uppercase">{live.platform}</div>
                    </div>
                    <h4 className="text-xl md:text-2xl font-black text-brand-dark mb-3 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{live.title}</h4>
                    <p className="text-gray-500 text-sm font-medium line-clamp-2 mb-6">{live.description}</p>
                    <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-50">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Data & Hora</span>
                        <span className="text-brand-dark font-black text-sm">{live.date || 'Em breve'} • {live.time || ''}</span>
                      </div>
                      <button 
                         onClick={() => setSelectedLive(live)}
                         className="p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      >
                       <Calendar size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ENCERRADAS / REPLAYS */}
          <section className="space-y-6">
            <div className="flex items-center space-x-3 px-2">
              <Play className="text-brand-gold" size={20} />
              <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest">Transmissões Anteriores</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {past.map(live => (
                <div key={live.id} className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden">
                    <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 bg-gray-100">
                     <img 
                        src={live.thumbnail || `https://img.youtube.com/vi/${live.videoId || (live.liveUrl || "").split('v=')[1]?.split('&')[0] || ''}/hqdefault.jpg`} 
                        alt={live.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                         <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-2xl">
                           <Play size={20} className="text-brand-dark ml-1" fill="currentColor" />
                         </div>
                      </div>
                   </div>
                   <h4 className="text-lg font-black text-brand-dark mb-2 line-clamp-1 group-hover:text-brand-gold transition-colors">{live.title}</h4>
                   <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-[0.05em]">
                     <span>{live.date || 'Concluída'}</span>
                     <span className="bg-gray-100 px-2 py-1 rounded text-[9px]">Gravado</span>
                   </div>
                   <button 
                     onClick={() => setSelectedLive(live)}
                     className="w-full mt-5 py-3 rounded-xl border border-gray-100 text-[10px] font-black uppercase text-gray-400 hover:bg-brand-dark hover:text-brand-gold hover:border-brand-dark transition-all tracking-widest"
                   >
                     Assistir Replay
                   </button>
                </div>
              ))}
              
              {past.length === 0 && !loading && (
                <div className="col-span-full py-16 text-center bg-white rounded-[40px] border border-dashed border-gray-200">
                  <Play size={40} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhum replay disponível</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* No Results Fallback */}
      {!loading && filteredLives.length === 0 && (
         <div className="py-24 text-center px-8">
            <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} className="text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-brand-dark mb-3">Nenhum resultado</h3>
            <p className="text-gray-500 font-medium max-w-xs mx-auto">Não encontramos nenhuma transmissão com os termos indicados no momento.</p>
            <button onClick={() => setSearchTerm("")} className="mt-8 text-xs font-black uppercase tracking-widest text-brand-gold bg-brand-dark px-10 py-4 rounded-xl shadow-xl">Limpar Filtros</button>
         </div>
      )}

      {/* Live Modal Section (Unified with Home.tsx style) */}
      {selectedLive && (
        <div className="fixed inset-0 z-[150] bg-brand-dark/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-10 animate-fade-in">
          <div className="bg-white w-full max-w-6xl rounded-[40px] overflow-hidden shadow-2xl animate-scale-in flex flex-col h-full max-h-[90vh] relative border border-white/20">
            {/* Header Control */}
            <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between bg-white z-20">
              <div className="flex items-center space-x-4">
                <div className={`${selectedLive.status === 'live' ? 'bg-red-500/10' : 'bg-brand-gold/10'} p-3 rounded-2xl`}>
                  <Radio size={24} className={`${selectedLive.status === 'live' ? 'text-red-600 animate-pulse' : 'text-brand-gold'}`} />
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-2 mb-0.5">
                    <span className={`w-2 h-2 rounded-full ${selectedLive.status === 'live' ? 'bg-red-600 animate-pulse' : 'bg-brand-gold'}`}></span>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${selectedLive.status === 'live' ? 'text-red-600' : 'text-brand-gold'}`}>
                      {selectedLive.status === 'live' ? 'Transmissão em Tempo Real' : selectedLive.status === 'scheduled' ? 'Evento Agendado' : 'Acesso ao Replay'}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg md:text-xl text-brand-dark leading-tight">{selectedLive.title}</h3>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => {
                    const url = selectedLive.liveUrl || selectedLive.url;
                    if (url) window.open(url, '_blank');
                  }}
                  className="hidden md:flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all border border-gray-200 shadow-sm"
                >
                  <ExternalLink size={14} />
                  Abrir no Navegador
                </button>
                <button 
                  onClick={() => setSelectedLive(null)}
                  className="p-3 bg-brand-dark text-brand-gold rounded-2xl hover:scale-105 transition-all shadow-lg active:scale-95"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Video / Embed Area */}
            <div className="flex-1 bg-black relative group overflow-hidden flex flex-col">
              <div className="flex-1 relative">
                {playerState !== 'fallback' ? (
                  <>
                    <iframe 
                      src={generateEmbedUrl(selectedLive.liveUrl || selectedLive.url) || undefined}
                      className={`w-full h-full border-0 absolute inset-0 transition-opacity duration-1000 ${playerState === 'ready' ? 'opacity-100' : 'opacity-0'}`}
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture; web-share"
                      allowFullScreen
                      playsInline
                      onLoad={() => {
                        console.log('[LIVES-PLAYER] Iframe disparou onLoad');
                        setPlayerState('ready');
                        if (playerTimeoutRef.current) clearTimeout(playerTimeoutRef.current);
                      }}
                      title={selectedLive.title}
                    ></iframe>
                    
                    {playerState === 'loading' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand-dark space-y-4">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin"></div>
                          <Radio size={24} className="absolute inset-0 m-auto text-brand-gold animate-pulse" />
                        </div>
                        <div className="text-center">
                          <p className="text-brand-gold font-black uppercase text-[10px] tracking-[0.3em] mb-1">Conectando ao Stream</p>
                          <p className="text-gray-500 text-[8px] font-bold uppercase tracking-widest">Sincronizando com a plataforma hospitalar...</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 bg-brand-dark flex items-center justify-center p-6 md:p-12">
                    <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[32px] p-8 md:p-10 text-center backdrop-blur-sm shadow-2xl relative overflow-hidden group">
                      <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-gold/5 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
                      
                      <div className="w-20 h-20 bg-brand-gold/10 rounded-[28px] flex items-center justify-center mx-auto mb-6 text-brand-gold shadow-inner border border-brand-gold/20">
                        <AlertCircle size={40} className="animate-pulse" />
                      </div>
                      
                      <h4 className="text-xl font-black text-white mb-3 uppercase tracking-tight">Reprodução Restrita</h4>
                      <p className="text-gray-400 text-sm font-medium leading-relaxed mb-8">
                        Esta transmissão não permite a reprodução direta dentro do aplicativo por restrições de direitos da plataforma.
                      </p>
                      
                      <div className="space-y-4">
                        <button 
                          onClick={() => {
                            const url = selectedLive.liveUrl || selectedLive.url;
                            if (url) window.open(url, '_blank');
                          }}
                          className="w-full bg-brand-gold text-brand-dark py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-brand-gold/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                          <ExternalLink size={16} />
                          Abrir no YouTube
                        </button>
                        
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                          A transmissão abrirá nativamente no seu dispositivo
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
              </div>
              
              {/* Fallback Info Message */}
              {playerState === 'ready' && (
                <div className="bg-brand-dark/20 border-t border-white/5 py-2 px-6 flex items-center justify-center gap-3">
                  <AlertCircle size={14} className="text-brand-gold" />
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Se o vídeo não iniciar, clique em "Abrir Stream Direto" abaixo
                  </p>
                </div>
              )}
            </div>
            
            {/* Mobile Fallbacks / Details */}
            <div className="p-6 md:p-8 bg-gray-50/50 backdrop-blur-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  {selectedLive.channelTitle && (
                    <div className="mb-2">
                      <span className="text-[10px] font-black text-brand-gold uppercase tracking-widest bg-brand-dark px-3 py-1 rounded-xl">{selectedLive.channelTitle}</span>
                    </div>
                  )}
                  <p className="text-gray-500 text-sm md:text-base font-medium leading-relaxed italic">
                    "{selectedLive.description || "Sem descrição disponível para esta transmissão."}"
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => {
                      if (selectedLive.liveUrl) window.open(selectedLive.liveUrl, '_blank');
                    }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-200 active:scale-[0.98] transition-all hover:bg-red-700"
                  >
                    <ExternalLink size={16} />
                    Abrir Stream Direto
                  </button>
                  <button 
                    onClick={() => {
                      if (selectedLive.liveUrl) {
                        navigator.clipboard.writeText(selectedLive.liveUrl);
                        setShowSuccess("Link copiado!");
                        setTimeout(() => setShowSuccess(null), 2000);
                      }
                    }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-white text-brand-dark border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all hover:border-brand-gold"
                  >
                    {showSuccess ? <span className="text-emerald-500">Copiado!</span> : <><Copy size={16} /> Copiar Link</>}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-amber-50 px-8 py-3 border-t border-amber-100 text-center">
              <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest flex items-center justify-center gap-2">
                <AlertCircle size={12} />
                Se o vídeo não carregar ou as legendas forem necessárias, use "Abrir no Navegador".
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lives;
