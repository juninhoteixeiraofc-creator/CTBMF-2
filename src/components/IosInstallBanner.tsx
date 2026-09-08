
import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Compass, ExternalLink, Info } from 'lucide-react';
import Logo from './Logo';

const IosInstallBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [isSafari, setIsSafari] = useState(true);
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    // 1. Detectar se é iOS (iPhone/iPad/iPod)
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // 2. Detectar se já está instalado (Modo Standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone);

    // 3. Detectar se é Safari real (e não Chrome, Firefox ou In-App)
    const ua = navigator.userAgent;
    const isChrome = ua.includes('CriOS');
    const isFirefox = ua.includes('FxiOS');
    const isSafariBrowser = ua.includes('Safari') && !isChrome && !isFirefox;
    
    // 4. Detectar se é navegador interno (WhatsApp, Instagram, etc)
    // Geralmente navegadores internos não têm a string "Safari" ou têm identificadores específicos
    const isInAppBrowser = isIos && (!isSafariBrowser || ua.includes('FBAN') || ua.includes('FBAV') || ua.includes('Instagram'));

    // 5. Verificar se o usuário já fechou o banner hoje
    const lastDismissed = localStorage.getItem('ios-install-banner-dismissed');
    const isDismissed = lastDismissed && (Date.now() - parseInt(lastDismissed)) < 24 * 60 * 60 * 1000; // 24h

    // Debug mode via URL: ?install=true
    const isDebug = window.location.href.includes('install=true');

    if ((isIos && !isStandalone && !isDismissed) || isDebug) {
      const timer = setTimeout(() => {
        setIsSafari(isSafariBrowser);
        setIsInApp(isInAppBrowser);
        setShowBanner(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('ios-install-banner-dismissed', Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="bg-white/95 backdrop-blur-md rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 p-6 relative overflow-hidden">
        {/* Botão Fechar */}
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 rounded-full"
        >
          <X size={16} />
        </button>

        {!isSafari || isInApp ? (
          /* ESTADO 1: iOS mas NÃO é Safari (WhatsApp, Instagram, etc) */
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
                <Compass size={32} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-brand-dark leading-tight">Abra no Safari para instalar</h3>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  Navegadores internos não permitem a instalação de aplicativos.
                </p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3 border border-blue-100">
              <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 font-bold leading-relaxed">
                Para instalar o app na tela do seu iPhone, toque no botão abaixo ou copie o link e abra-o no navegador <span className="underline">Safari</span>.
              </p>
            </div>

            <button 
              onClick={() => {
                // Tentar forçar abertura no Safari ou apenas instruir
                alert("Toque no ícone de 'Bússola' ou 'Abrir no Navegador' no canto da tela para abrir no Safari.");
              }}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <ExternalLink size={18} />
              Abrir no Safari
            </button>
          </div>
        ) : (
          /* ESTADO 2: iOS + Safari (Pronto para instalar) */
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Logo size="sm" />
              <div className="flex-1">
                <h3 className="text-lg font-black text-brand-dark leading-tight">Instalar App Bucomaxilo</h3>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  Tenha acesso rápido e offline direto da sua tela de início.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
                  <Share size={18} />
                </div>
                <p className="text-xs font-bold text-gray-700">
                  1. Toque no botão <span className="text-blue-600">Compartilhar</span>
                </p>
              </div>

              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-gray-700 shadow-sm">
                  <PlusSquare size={18} />
                </div>
                <p className="text-xs font-bold text-gray-700">
                  2. Toque em <span className="text-brand-dark">"Adicionar à Tela de Início"</span>
                </p>
              </div>

              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="w-8 h-8 bg-brand-gold rounded-xl flex items-center justify-center text-brand-dark font-black text-sm shadow-sm">
                  +
                </div>
                <p className="text-xs font-bold text-gray-700">
                  3. Toque em <span className="text-brand-dark">"Adicionar"</span> no topo
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Barra de destaque inferior */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 gold-gradient opacity-50"></div>
      </div>
    </div>
  );
};

export default IosInstallBanner;
