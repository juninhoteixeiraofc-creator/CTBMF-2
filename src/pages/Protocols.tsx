
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db, dbDefault } from '../firebase';
import { AppUser, Protocol } from '../types';
import { FileText, Search, ExternalLink, Star, ChevronLeft, BookOpen, Maximize2 } from 'lucide-react';
import 'react-quill-new/dist/quill.snow.css';

interface ProtocolsProps {
  user: AppUser;
}

const Protocols: React.FC<ProtocolsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);

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
    console.log('[PROTOCOLS] Iniciando busca de protocolos (coleção: protocols)');
    
    const results: Record<string, Protocol[]> = { named: [], default: [] };
    
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
      
      setProtocols(merged);
      addDebugLog('protocols', merged.length);
    };

    const unsubNamed = onSnapshot(collection(db, "protocols"), (snap) => {
      results.named = snap.docs.map(d => ({ id: d.id, ...d.data() } as Protocol));
      updateState();
    }, (err) => {
      console.error('[PROTOCOLS] Erro (Named):', err);
      addDebugLog('protocols', 0, err.message);
    });

    // Busca no banco padrão apenas se for diferente do banco principal
    if (db !== dbDefault) {
      getDocs(collection(dbDefault, "protocols")).then((snap) => {
        results.default = snap.docs.map(d => ({ id: d.id, ...d.data() } as Protocol));
        updateState();
      }).catch((err) => {
        console.warn('[PROTOCOLS] Banco Padrão (Legacy) inacessível para protocolos:', err.message);
      });
    }

    return () => { unsubNamed(); };
  }, []);

  const userLevel = user.residencyLevel || 'R1';
  const isAdmin = user.role === 'admin';

  const filteredProtocols = useMemo(() => {
    return protocols.filter(item => {
      // Access control: 
      // 1. Admins see everything
      // 2. R3 sees everything (hierarchy)
      // 3. Other levels see what is explicitly allowed
      const hasAccess = isAdmin || userLevel === 'R3' || (item.accessLevels && item.accessLevels.includes(userLevel as 'R1' | 'R2' | 'R3'));
      
      if (!hasAccess) return false;

      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (item.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [protocols, searchTerm, userLevel, isAdmin]);

  if (selectedProtocol) {
    return (
      <div className="space-y-6 pb-20 animate-fade-in">
        <button 
          onClick={() => setSelectedProtocol(null)}
          className="flex items-center gap-2 text-brand-gold font-black uppercase text-[10px] tracking-widest hover:translate-x-[-4px] transition-transform"
        >
          <ChevronLeft size={16} />
          Voltar para lista
        </button>

        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-1 gold-gradient rounded-full"></div>
            <span className="text-[9px] font-black text-brand-gold uppercase tracking-widest">Protocolo Institucional</span>
          </div>
          <h2 className="text-2xl font-black text-brand-dark tracking-tight leading-tight">{selectedProtocol.title}</h2>
          <p className="text-xs text-gray-400 font-medium leading-relaxed">{selectedProtocol.description}</p>
        </header>

        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm min-h-[400px] overflow-x-auto">
          <div className="ql-viewer">
            {selectedProtocol.content ? (
              <div 
                className="ql-editor !p-0"
                dangerouslySetInnerHTML={{ __html: selectedProtocol.content }} 
              />
            ) : selectedProtocol.pdfUrl ? (
              <div className="text-center py-20">
                <FileText size={48} className="mx-auto text-brand-gold mb-4" />
                <p className="text-xs font-bold text-brand-dark uppercase tracking-widest">Documento PDF disponível</p>
                <p className="text-[10px] text-gray-400 mt-1">{selectedProtocol.pdfFileName}</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
                  <button 
                    onClick={() => navigate(`/protocol-viewer/${selectedProtocol.id}`)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 gold-gradient text-brand-dark px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
                  >
                    Visualizar no App <Maximize2 size={14} />
                  </button>
                  <a 
                    href={selectedProtocol.pdfUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-600 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Abrir em nova aba <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <BookOpen size={48} className="mx-auto text-gray-100 mb-4" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Este protocolo não possui conteúdo escrito.</p>
                {selectedProtocol.externalLink && (
                  <a 
                    href={selectedProtocol.externalLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 gold-gradient text-brand-dark px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest"
                  >
                    Acessar Link Externo <ExternalLink size={14} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedProtocol.pdfUrl && selectedProtocol.content && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                <FileText size={16} />
              </div>
              <div>
                <span className="block text-[10px] font-black text-emerald-700 uppercase tracking-wider">Anexo PDF disponível</span>
                <span className="block text-[8px] text-emerald-600 font-bold truncate max-w-[200px]">{selectedProtocol.pdfFileName}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => navigate(`/protocol-viewer/${selectedProtocol.id}`)}
                className="text-[10px] font-black text-emerald-600 uppercase underline underline-offset-4"
              >
                Visualizar
              </button>
              <a 
                href={selectedProtocol.pdfUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] font-black text-emerald-600 uppercase underline underline-offset-4"
              >
                Abrir
              </a>
            </div>
          </div>
        )}

        {selectedProtocol.externalLink && (selectedProtocol.content || selectedProtocol.pdfUrl) && (
          <div className="bg-brand-gold/5 border border-brand-gold/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-gold/10 rounded-lg text-brand-gold">
                <ExternalLink size={16} />
              </div>
              <span className="text-[10px] font-bold text-brand-dark uppercase tracking-wider">Link externo complementar</span>
            </div>
            <a 
              href={selectedProtocol.externalLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] font-black text-brand-gold uppercase underline underline-offset-4"
            >
              Abrir Link
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <header>
        <h2 className="text-2xl font-black text-brand-dark tracking-tight">Protocolos</h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Biblioteca Institucional • Nível {userLevel}</p>
      </header>

      {/* Search Bar */}
      <div className="relative group">
        <input 
          type="text" 
          placeholder="Buscar protocolo ou manual..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-gray-100 rounded-2xl py-3 px-12 text-sm focus:ring-2 focus:ring-brand-gold/50 outline-none shadow-sm transition-all font-medium"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-gold transition-colors" size={18} />
      </div>

      {/* Protocols List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-3">
            <div className="h-4 w-1 gold-gradient rounded-full"></div>
            <h3 className="font-black text-brand-dark text-[11px] uppercase tracking-[0.25em]">
              Documentos Disponíveis
            </h3>
          </div>
          <span className="text-[9px] font-bold text-gray-400 uppercase">{filteredProtocols.length} Arquivos</span>
        </div>

        <div className="grid gap-4">
          {filteredProtocols.length > 0 ? (
            filteredProtocols.map((protocol) => (
              <div
                key={protocol.id}
                onClick={() => {
                  if (protocol.type === 'pdf' && protocol.pdfUrl) {
                    navigate(`/protocol-viewer/${protocol.id}`);
                  } else if (protocol.content || protocol.pdfUrl) {
                    setSelectedProtocol(protocol);
                  } else if (protocol.externalLink) {
                    window.open(protocol.externalLink, '_blank');
                  }
                }}
                className={`group bg-white p-5 rounded-3xl border transition-all hover:shadow-xl active:scale-[0.98] relative overflow-hidden cursor-pointer ${
                  protocol.isImportant ? 'border-brand-gold/30 ring-1 ring-brand-gold/10' : 'border-gray-100'
                }`}
              >
                {protocol.isImportant && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-brand-gold text-brand-dark text-[7px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-tighter flex items-center gap-1">
                      <Star size={8} fill="currentColor" />
                      Prioritário
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl shrink-0 text-brand-gold bg-brand-gold/10">
                    <FileText size={20} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex gap-1">
                        {protocol.accessLevels?.map(level => (
                          <span key={level} className="text-[7px] font-bold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded uppercase">
                            {level}
                          </span>
                        ))}
                      </div>
                      {protocol.pdfUrl && (
                        <span className="text-[7px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">PDF</span>
                      )}
                    </div>
                    
                    <h4 className="font-bold text-brand-dark text-sm group-hover:text-brand-gold transition-colors line-clamp-1">
                      {protocol.title}
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                      {protocol.description}
                    </p>
                  </div>

                  <div className="self-center p-2 text-gray-300 group-hover:text-brand-gold transition-colors">
                    {(protocol.content || protocol.pdfUrl) ? <ChevronLeft className="rotate-180" size={18} /> : <ExternalLink size={18} />}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
               <FileText size={48} className="mx-auto text-gray-200 mb-2" />
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhum documento encontrado</p>
            </div>
          )}
        </div>
      </div>
      {/* Diagnostic Overlay - Hidden as requested */}
      {/* 
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

export default Protocols;
