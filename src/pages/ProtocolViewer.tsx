import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Protocol } from '../types';
import { ChevronLeft, ExternalLink, Download, Loader2, FileText, AlertCircle, Eye } from 'lucide-react';
import { motion } from 'motion/react';

const ProtocolViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProtocol = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const docRef = doc(db, 'protocols', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProtocol({ id: docSnap.id, ...docSnap.data() } as Protocol);
        } else {
          setError("Protocolo não encontrado.");
        }
      } catch (err) {
        console.error("Error fetching protocol:", err);
        setError("Erro ao carregar as informações do protocolo.");
      } finally {
        setLoading(false);
      }
    };

    fetchProtocol();
  }, [id]);

  const handleOpenExternal = () => {
    if (protocol?.pdfUrl) {
      // Use a direct link if possible, or the stored URL
      const url = protocol.pdfUrl;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Auto-open on load (optional, but might be blocked)
  useEffect(() => {
    if (protocol?.pdfUrl && !loading) {
      // We don't auto-open to avoid popup blockers, 
      // but we make the button very prominent.
    }
  }, [protocol, loading]);

  const handleDownload = async () => {
    if (!protocol?.pdfUrl) return;
    try {
      const response = await fetch(protocol.pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = protocol.pdfFileName || `${protocol.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(protocol.pdfUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-brand-dark">
        <Loader2 size={48} className="text-brand-gold animate-spin mb-4" />
        <p className="text-[10px] font-black text-brand-gold uppercase tracking-[0.3em] animate-pulse">Preparando Documento</p>
      </div>
    );
  }

  if (error || !protocol || !protocol.pdfUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-brand-dark p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <AlertCircle size={40} className="text-red-500" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">Ops! Algo deu errado</h2>
        <p className="text-gray-400 text-sm mb-8 max-w-xs mx-auto">{error || "Não conseguimos localizar o arquivo PDF deste protocolo."}</p>
        <button 
          onClick={() => navigate('/protocols')}
          className="gold-gradient text-brand-dark px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
        >
          Voltar aos Protocolos
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-brand-dark overflow-hidden">
      {/* Header Fixo com Suporte a Safe Area iOS */}
      <header 
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        className="bg-brand-dark/95 backdrop-blur-md border-b border-brand-gold/20 px-4 pb-4 md:px-6 md:pb-6 flex items-center justify-between shadow-2xl z-20"
      >
        <div className="flex items-center gap-3 md:gap-5 min-w-0">
          <button 
            onClick={() => navigate('/protocols')}
            className="p-2.5 bg-white/5 text-brand-gold hover:bg-white/10 rounded-2xl transition-all shrink-0 active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0">
            <h2 className="text-white font-black text-sm md:text-base truncate leading-tight">{protocol.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-brand-gold/60 text-[8px] md:text-[9px] font-black uppercase tracking-widest truncate">
                {protocol.pdfFileName || 'Documento PDF'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={handleDownload}
            className="p-2.5 bg-white/5 text-brand-gold hover:bg-white/10 rounded-2xl transition-all active:scale-90"
            title="Baixar PDF"
          >
            <Download size={20} />
          </button>
          <button 
            onClick={handleOpenExternal}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-gold text-brand-dark rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-gold/20 active:scale-95 transition-all"
          >
            <span className="hidden md:inline">Visualizar</span>
            <Eye size={16} />
          </button>
        </div>
      </header>

      {/* Área Principal - Visualização Nativa */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-neutral-900/50 overflow-y-auto scrollbar-hide">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-12 text-center backdrop-blur-xl shadow-2xl"
        >
          <div className="w-24 h-24 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-brand-gold/20 shadow-inner">
            <FileText size={48} className="text-brand-gold" />
          </div>
          
          <h3 className="text-white font-black text-2xl mb-4 leading-tight tracking-tight">
            Protocolo Disponível
          </h3>
          
          <p className="text-gray-400 text-sm mb-10 leading-relaxed px-4">
            Para garantir compatibilidade total com seu dispositivo (iOS/Safari), o documento será aberto no visualizador nativo do seu navegador.
          </p>

          <div className="space-y-4">
            <button 
              onClick={handleOpenExternal}
              className="w-full gold-gradient text-brand-dark py-6 rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-brand-gold/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
            >
              Abrir Protocolo 
              <ExternalLink size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </button>
            
            <div className="pt-4 flex items-center gap-4">
              <button 
                onClick={handleDownload}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border border-white/5"
              >
                <Download size={14} /> Baixar
              </button>
              
              <button 
                onClick={() => navigate('/protocols')}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border border-white/5"
              >
                <ChevronLeft size={14} /> Voltar
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ProtocolViewer;
