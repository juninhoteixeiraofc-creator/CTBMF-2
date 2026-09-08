/**
 * Utility functions for video platforms (YouTube, Vimeo, etc.)
 */

export const extractYoutubeId = (url: string): string => {
  if (!url) return "";
  
  // Comprehensive regex for YouTube:
  // - watch?v=ID
  // - youtu.be/ID
  // - youtube.com/embed/ID
  // - youtube.com/live/ID
  // - youtube.com/v/ID
  const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|live\/)|(?:(?:watch)?\?v(?:i)?=|[&]v(i)?=))([^#&?]*).*/;
  const match = url.match(regExp);
  
  let id = "";
  if (match && match[1] && match[1].length === 11) {
    id = match[1];
  } else if (url.length === 11) {
    // If user passed just the ID
    id = url;
  }
  
  console.log(`[VIDEO-UTILS] Extraindo ID de: "${url}" -> ID: ${id || 'FALHA'}`);
  return id;
};

export const detectPlatform = (url: string): 'youtube' | 'vimeo' | 'other' => {
  if (!url) return 'youtube';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  return 'other';
};

export const generateEmbedUrl = (url: string, platform?: string): string => {
  if (!url) return "";
  
  const detectedPlatform = platform || detectPlatform(url);
  
  if (detectedPlatform === 'youtube') {
    const videoId = extractYoutubeId(url);
    if (!videoId) return "";
    
    // Adicionando origin para melhorar compatibilidade com APIs do YouTube
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const embedUrl = `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`;
    
    console.log(`[VIDEO-UTILS] Embed gerado: ${embedUrl}`);
    return embedUrl;
  }
  
  if (detectedPlatform === 'vimeo') {
    // Basic vimeo extraction
    const vimeoMatch = url.match(/(vimeo\.com\/|video\/)(\d+)/);
    const vimeoId = vimeoMatch ? vimeoMatch[2] : url.split('/').pop();
    return `https://player.vimeo.com/video/${vimeoId}?autoplay=1&playsinline=1`;
  }
  
  return url;
};
