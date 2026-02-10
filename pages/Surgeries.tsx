
import React, { useState } from 'react';
import { mockItems } from '../services/mockData';
import { ItemType } from '../types';
import { PlayCircle, Youtube, Search, Video } from 'lucide-react';

const Surgeries: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Função auxiliar para extrair o ID do vídeo do YouTube
  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  
  const surgeryVideos = mockItems.filter(item => 
    item.type === ItemType.VIDEO && 
    (item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
     (item.theme || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-black text-brand-dark tracking-tight">Cirurgias</h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acervo Clínico em Vídeo</p>
      </header>

      <div className="relative group">
        <input 
          type="text" 
          placeholder="Buscar cirurgia..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-gray-100 rounded-2xl py-3 px-12 text-sm focus:ring-2 focus:ring-brand-gold/50 outline-none shadow-sm transition-all font-medium"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-gold transition-colors" size={18} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-3 px-1">
          <div className="h-4 w-1 gold-gradient rounded-full"></div>
          <h3 className="font-black text-brand-dark text-[11px] uppercase tracking-[0.25em]">Gravações de cirurgias realizadas</h3>
        </div>
        
        <div className="grid gap-6">
          {surgeryVideos.length > 0 ? (
            surgeryVideos.map(video => {
              const youtubeId = getYoutubeId(video.link);
              const thumbnailUrl = youtubeId 
                ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` 
                : `https://picsum.photos/seed/${video.id}/400/225`;

              return (
                <a
                  key={video.id}
                  href={video.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm active:scale-[0.98] transition-all hover:shadow-xl hover:border-brand-gold/20"
                >
                  <div className="aspect-video bg-brand-dark relative">
                    <img 
                      src={thumbnailUrl} 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                      alt={video.title} 
                      onError={(e) => {
                        // Fallback caso a imagem HQ não exista
                        const target = e.target as HTMLImageElement;
                        if (youtubeId && !target.src.includes('mqdefault')) {
                           target.src = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-brand-dark/20 group-hover:bg-transparent transition-colors"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white/10 backdrop-blur-md p-4 rounded-full border border-white/20 shadow-2xl group-hover:scale-110 transition-transform">
                        <PlayCircle className="text-white" size={32} />
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 bg-brand-dark/60 backdrop-blur-sm text-brand-gold text-[9px] font-black px-2 py-1 rounded-lg border border-brand-gold/20 flex items-center space-x-1 tracking-widest uppercase">
                      <Video size={10} />
                      <span>HD VIDEO</span>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded flex items-center space-x-1 tracking-tighter shadow-lg">
                      <Youtube size={12} />
                      <span>YOUTUBE</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h4 className="font-bold text-brand-dark text-lg leading-snug group-hover:text-brand-gold transition-colors">{video.title}</h4>
                    <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-widest">Acesso restrito ao corpo discente</p>
                  </div>
                </a>
              );
            })
          ) : (
            <div className="text-center py-20">
               <div className="text-gray-200 mb-2 flex justify-center"><Video size={48} /></div>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhuma cirurgia encontrada</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Surgeries;
