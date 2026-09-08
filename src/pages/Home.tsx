
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, setDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, dbDefault, isNamedDefault } from '../firebase';
import { mockTurmas } from '../services/mockData';
import { AppUser, Post, LiveSession, Notification, HomeHighlight, ChatMessage, FixedTeam, TeamShift, R3Shift } from '../types';
import { generateEmbedUrl } from '../utils/videoUtils';
import { Bell, ChevronRight, Clock, GraduationCap, Megaphone, Radio, Play, X, MessageSquare, Send, Bot, User as UserIcon, Loader2, Sparkles, RotateCcw, ExternalLink, Copy, Calendar, AlertCircle } from 'lucide-react';
import { askChefinho, askGemini } from '../services/aiService';
import Markdown from 'react-markdown';

interface HomeProps {
  user: AppUser;
}

const Home: React.FC<HomeProps> = ({ user }) => {
  const [announcements, setAnnouncements] = useState<Post[]>([]);
  const [activeLive, setActiveLive] = useState<LiveSession | null>(null);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [playerState, setPlayerState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const playerTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [nextModule, setNextModule] = useState<HomeHighlight | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Post | null>(null);
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  // Duty State
  const [teamShifts, setTeamShifts] = useState<TeamShift[]>([]);
  const [r3Shifts, setR3Shifts] = useState<R3Shift[]>([]);
  const [fixedTeams, setFixedTeams] = useState<FixedTeam[]>([]);
  const [dutyLoading, setDutyLoading] = useState(true);

  // Chefinho State
  const [chefinhoQuestion, setChefinhoQuestion] = useState("");
  const [showChefinhoModal, setShowChefinhoModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (showChefinhoModal) {
      scrollToBottom();
    }
  }, [chatMessages, showChefinhoModal]);

  const handleAskChefinho = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chefinhoQuestion.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chefinhoQuestion,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChefinhoQuestion("");
    setShowChefinhoModal(true);
    setIsTyping(true);

    try {
      const answer = await askChefinho(userMsg.content, user.uid, user.residencyLevel || 'R1', user.displayName);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Home: Error in handleAskChefinho:", error);
      const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ **Erro de Conexão**\n\nNão consegui falar com o Chefinho agora. \n\n**Detalhe:** ${errorMsg}\n\nPor favor, verifique sua conexão ou tente novamente.`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Monitor Live Modal to manage player states
  useEffect(() => {
    if (showLiveModal && activeLive) {
      console.log(`[PLAYER] Iniciando carregamento da live: ${activeLive.title}`);
      
      // Use microtask to avoid synchronous setState in effect (prevents cascading render lint error)
      Promise.resolve().then(() => {
        setPlayerState('loading');
      });
      
      // Cleanup previous timeout if exists
      if (playerTimeoutRef.current) clearTimeout(playerTimeoutRef.current);
      
      // Set a 7-second verification timeout
      // If the player doesn't signal "ready" via onLoad in 7 seconds, we offer the fallback
      playerTimeoutRef.current = setTimeout(() => {
        setPlayerState(prev => {
          if (prev === 'loading') {
            console.warn('[PLAYER] Verificação de timeout atingida. Ativando fallback visual.');
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
  }, [showLiveModal, activeLive]);

  const handleRetry = () => {
    const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      setChefinhoQuestion(lastUserMsg.content);
    }
  };

  const handleAskGemini = async (question: string) => {
    setIsTyping(true);
    try {
      const answer = await askGemini(question);
      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: answer,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const userTurma = mockTurmas.find(t => t.id === user.turma_id)?.name || 'Especialização Geral';

  // Determine display role/level
  let displayRole = user.residencyLevel || userTurma;
  if (user.email === 'marcomaxilofacial@gmail.com') {
    displayRole = 'COORDENADOR';
  } else if (user.displayName.toLowerCase().includes('janio')) {
    displayRole = 'R3 • Tech Lead';
  }

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
    console.log('[HOME] Iniciando busca de dados (anúncios, lives, notificações, destaques)...');
    
    // Função para unificar snapshots de múltiplos bancos
    const handleMultiSnapshot = <T extends { id: string }>(
      colName: string, 
      setter: (data: T[]) => void, 
      filterFn?: (item: T) => boolean, 
      sortFn?: (a: T, b: T) => number
    ) => {
      const results: Record<string, T[]> = { named: [], default: [] };
      
      const updateState = () => {
        const merged = [...results.named];
        results.default.forEach(item => {
          if (!merged.some(m => m.id === item.id)) merged.push(item);
        });
        
        let finalData = merged;
        if (filterFn) finalData = finalData.filter(filterFn);
        if (sortFn) finalData.sort(sortFn);
        
        setter(finalData);
        addDebugLog(colName, finalData.length);
      };

      const unsubNamed = onSnapshot(collection(db, colName), (snap) => {
        results.named = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateState();
      }, (error: unknown) => {
        const err = error as { code?: string; message?: string };
        console.error(`[HOME] Erro ${colName} (Named):`, err);
        
        if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
          addDebugLog(colName, 0, "Cota excedida");
        } else {
          addDebugLog(colName, 0, err.message);
        }
      });

      // Busca única no banco padrão apenas se for diferente do banco nomeado
      // Isso evita redundância e erros desnecessários se o banco padrão não estiver configurado
      if (!isNamedDefault) {
        getDocs(collection(dbDefault, colName)).then((snap) => {
          results.default = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          updateState();
        }).catch((err) => {
          // Silencia erros de permissão no banco padrão se já temos dados no banco nomeado
          // ou se for apenas um erro de configuração de legado
          if (err.code === 'permission-denied') {
            console.warn(`[HOME] Banco padrão (Default) sem acesso para ${colName}. Usando apenas banco nomeado.`);
          } else {
            console.error(`[HOME] Erro ${colName} (Default):`, err);
          }
        });
      }

      return () => { unsubNamed(); };
    };

    // Announcements
    const unsubAnnouncements = handleMultiSnapshot('announcements', setAnnouncements, undefined, (a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });

    // Lives
    const unsubLives = handleMultiSnapshot<LiveSession>('lives', (data) => {
      const live = data.find((l) => l.status === 'live' && l.visible !== false);
      setActiveLive(live || null);
    });

    // Notifications
    const unsubNotifications = handleMultiSnapshot('notifications', setNotifications, (n) => {
      if (!n.isActive) return false;
      return n.audience === 'all' || n.audience === user.residencyLevel || (user.role === 'admin' && n.audience === 'admin');
    }, (a, b) => {
      const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
      const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
      return dateB - dateA;
    });

    // Read notifications
    const unsubReads = onSnapshot(query(collection(db, "notification_reads"), where("userId", "==", user.uid)), (snap) => {
      setReadNotifications(snap.docs.map(doc => doc.data().notificationId));
    });

    // Highlights
    const unsubHighlights = handleMultiSnapshot<HomeHighlight>('home_highlights', (data) => {
      const active = data.find((h) => h.isActive && (h.audience === 'all' || h.audience === user.residencyLevel));
      setNextModule(active || null);
    });

    // Scales / Duty
    console.log('[HOME] Carregando escalas para detecção de plantão atual...');
    const unsubFixedTeams = handleMultiSnapshot<FixedTeam>('fixed_teams', setFixedTeams);
    const unsubTeamShifts = handleMultiSnapshot<TeamShift>('team_shifts', (shifts) => {
      setTeamShifts(shifts);
      setDutyLoading(false);
    });
    const unsubR3Shifts = handleMultiSnapshot<R3Shift>('r3_shifts', setR3Shifts);

    return () => {
      unsubAnnouncements();
      unsubLives();
      unsubNotifications();
      unsubReads();
      unsubHighlights();
      unsubFixedTeams();
      unsubTeamShifts();
      unsubR3Shifts();
    };
  }, [user.uid, user.residencyLevel, user.role]);

  const todayStr = new Date().toISOString().split('T')[0];
  const currentTeamShift = teamShifts.find(s => s.active && s.startDate <= todayStr && s.endDate >= todayStr);
  const currentR3Shift = r3Shifts.find(s => s.active && s.startDate <= todayStr && s.endDate >= todayStr);
  const currentTeamDetails = fixedTeams.find(t => t.id === currentTeamShift?.teamId);

  const unreadCount = notifications.filter(n => !readNotifications.includes(n.id)).length;

  const markAsRead = async (notifId: string) => {
    if (!readNotifications.includes(notifId)) {
      try {
        await setDoc(doc(db, "notification_reads", `${user.uid}_${notifId}`), {
          userId: user.uid,
          notificationId: notifId,
          readAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.link) {
      window.open(notif.link, '_blank');
    }
  };

  return (
    <>
      <div className="space-y-8 md:space-y-12">
      <div className="flex items-center justify-between">
        <div className="animate-fade-in">
          <h2 className="text-2xl md:text-4xl font-black text-brand-dark transition-all">Olá, Dr. {user.displayName.split(' ')[0]}</h2>
          <div className="flex items-center space-x-1 md:space-x-2 mt-1 md:mt-2">
             <GraduationCap size={14} className="text-brand-gold md:scale-125" />
             <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">{displayRole}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowNotificationsModal(true)}
          className="bg-brand-dark p-2 md:p-3 rounded-xl md:rounded-2xl relative shadow-lg active:scale-95 transition-all hover:shadow-brand-gold/10"
        >
          <Bell size={20} className="text-brand-gold md:scale-110" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 md:-top-2 md:-right-2 w-5 h-5 md:w-6 md:h-6 bg-red-500 border-2 border-brand-dark rounded-full flex items-center justify-center text-[10px] md:text-xs font-black text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Grid Layout for Tablet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* Left Column - Main Content */}
        <div className="lg:col-span-7 space-y-6 md:space-y-8">
          
          {/* Plantão Atual Section */}
          <section className="animate-fade-in delay-100">
            {dutyLoading ? (
              <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm animate-pulse">
                <div className="h-4 w-32 bg-gray-100 rounded mb-4"></div>
                <div className="h-8 w-64 bg-gray-100 rounded"></div>
              </div>
            ) : (currentTeamShift || currentR3Shift) ? (
              <div className="bg-white rounded-[40px] p-6 md:p-8 border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.04)] relative overflow-hidden group">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-dark/5 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2"></div>
                
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="bg-brand-dark p-3 rounded-2xl shadow-xl shadow-brand-dark/20 text-brand-gold">
                        <Clock size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-[10px] font-black text-brand-dark uppercase tracking-[0.2em]">Plantão Atual</h3>
                          <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-100 animate-pulse">Hoje</span>
                        </div>
                        <p className="text-xs font-bold text-gray-400">
                          {currentTeamShift ? `${new Date(currentTeamShift.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${new Date(currentTeamShift.endDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowFullSchedule(true)}
                      className="bg-gray-50 text-brand-dark hover:bg-brand-dark hover:text-brand-gold px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm border border-gray-100 flex items-center gap-2"
                    >
                      <Calendar size={14} />
                      Ver Escala
                    </button>
                  </div>

                  {/* Residents Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* R3 Section */}
                    {currentR3Shift && (
                      <div className="bg-brand-dark p-5 rounded-[28px] border border-brand-gold/10 relative overflow-hidden group/r3 shadow-xl">
                        <div className="absolute -right-4 -top-4 opacity-10 group-hover/r3:rotate-12 transition-transform">
                          <GraduationCap size={80} className="text-brand-gold" />
                        </div>
                        <span className="text-[8px] font-black text-brand-gold uppercase tracking-[0.3em] block mb-2 opacity-80">R3 de Plantão</span>
                        <h4 className="text-sm md:text-base font-black text-white leading-tight">{currentR3Shift.residentName}</h4>
                      </div>
                    )}

                    {/* R2 Section */}
                    {currentTeamDetails?.r2Members && currentTeamDetails.r2Members.length > 0 && (
                      <div className="bg-gray-50 p-5 rounded-[28px] border border-gray-100 flex flex-col justify-center">
                        <span className="text-[8px] font-black text-brand-gold uppercase tracking-[0.3em] block mb-2">R2 de Plantão</span>
                        <div className="space-y-1">
                          {currentTeamDetails.r2Members.map(m => (
                            <p key={m} className="text-sm font-bold text-brand-dark line-clamp-1">{m}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* R1 Section */}
                    {currentTeamDetails?.r1Members && currentTeamDetails.r1Members.length > 0 && (
                      <div className="bg-white p-5 rounded-[28px] border border-dashed border-gray-200 flex flex-col justify-center">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.3em] block mb-2">R1 de Plantão</span>
                        <div className="space-y-1">
                          {currentTeamDetails.r1Members.map(m => (
                            <p key={m} className="text-xs md:text-sm font-bold text-gray-500 line-clamp-1">{m}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[32px] p-6 border border-dashed border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-gray-50 p-3 rounded-2xl">
                    <Calendar size={20} className="text-gray-300" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Escala Indisponível</h4>
                    <p className="text-[9px] text-gray-400">Nenhum plantão para hoje</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowFullSchedule(true)}
                  className="text-brand-dark text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-50 px-4 py-2 rounded-xl transition-colors"
                >
                  <Calendar size={12} />
                  Abrir Calendário
                </button>
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="font-bold text-gray-800 uppercase text-sm md:text-base tracking-widest">Avisos Oficiais</h3>
              <span className="text-[10px] md:text-xs font-black text-brand-gold bg-brand-gold/10 px-3 py-1.5 rounded-full uppercase tracking-widest">Tempo Real</span>
            </div>
            
            <div className="space-y-4 md:space-y-6">
              {announcements.length > 0 ? announcements.map((post) => (
                <div 
                  key={post.id} 
                  onClick={() => setSelectedAnnouncement(post)}
                  className="bg-white border border-gray-100 rounded-2xl md:rounded-[32px] p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-xl hover:translate-y-[-2px] transition-all relative overflow-hidden group cursor-pointer"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full gold-gradient opacity-80"></div>
                  <div className="flex items-center text-[10px] md:text-xs text-gray-400 mb-3 space-x-2 font-bold uppercase tracking-tighter">
                    <Clock size={14} className="text-brand-gold" />
                    <span>{new Date(post.date).toLocaleDateString('pt-BR')}</span>
                    <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                    <span className="text-brand-dark">{post.authorName}</span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-lg md:text-2xl leading-tight group-hover:text-brand-gold transition-colors">{post.title}</h4>
                  <p className="text-sm md:text-base text-gray-500 mt-3 line-clamp-2 leading-relaxed font-medium">
                    {post.content}
                  </p>
                  <div className="mt-5 md:mt-6 flex items-center text-brand-gold text-[10px] md:text-xs font-black uppercase tracking-[0.2em] group">
                    Ler comunicado completo
                    <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )) : (
                <div className="py-16 text-center bg-white rounded-[32px] border border-dashed border-gray-200">
                  <Megaphone size={40} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">Nenhum aviso no momento</p>
                </div>
              )}
            </div>
          </section>

          {activeLive && (
            <div className="animate-fade-in">
              <button 
                onClick={() => setShowLiveModal(true)}
                className="w-full bg-red-600 rounded-[32px] p-6 md:p-8 text-white shadow-2xl shadow-red-500/20 relative overflow-hidden group active:scale-[0.98] transition-all border border-white/10"
              >
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center space-x-4 md:space-x-6">
                    <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl md:rounded-3xl border border-white/20">
                      <Radio size={28} className="animate-pulse" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-white/90">Ao Vivo Agora</span>
                      </div>
                      <h3 className="font-bold text-xl md:text-2xl leading-tight">{activeLive.title}</h3>
                      <p className="text-white/70 text-xs font-medium mt-1 line-clamp-1">{activeLive.description}</p>
                    </div>
                  </div>
                  <div className="bg-white text-red-600 p-3 rounded-full shadow-lg group-hover:scale-110 transition-transform">
                    <Play size={24} fill="currentColor" />
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar / Secondary Content */}
        <div className="lg:col-span-5 space-y-6 md:space-y-8">
          
          {/* Next Module Highlight */}
          {nextModule && (
            <div className="bg-brand-dark rounded-[32px] p-8 text-white shadow-2xl overflow-hidden relative border border-brand-gold/20 animate-fade-in group hover:border-brand-gold/40 transition-colors">
              <div className="relative z-10">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse"></span>
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-brand-gold">Próximo Tema</span>
                </div>
                <h3 className="font-bold text-2xl md:text-3xl mb-2 leading-tight whitespace-pre-line group-hover:text-brand-gold transition-colors">{nextModule.title}</h3>
                <p className="text-brand-gold/80 text-xs font-black uppercase tracking-widest mt-2">{nextModule.subtitle}</p>
                <div className="mt-6 flex items-center space-x-2 text-gray-400">
                  <Clock size={14} className="text-brand-gold" />
                  <p className="text-xs md:text-sm font-medium">{nextModule.startDateText}</p>
                </div>
              </div>
              <div className="absolute bottom-[-20%] right-[-10%] w-56 h-56 gold-gradient opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity"></div>
            </div>
          )}

          {/* Chefinho Card */}
          <section className="animate-fade-in">
            <div className="bg-white rounded-[32px] p-6 md:p-10 border border-gray-100 shadow-2xl relative overflow-hidden group">
              {/* Watermark background */}
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all group-hover:scale-110 pointer-events-none">
                <Bot size={150} className="text-brand-gold" />
              </div>
              
              <div className="relative z-10 space-y-5 md:space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row items-center md:items-end gap-5 md:gap-8">
                  
                  {/* Avatar - Mobile Portrait Layout (Integrated with Title) */}
                  <div className="flex md:hidden items-center w-full gap-4">
                    <div className="flex-shrink-0 relative">
                      <div className="absolute inset-0 bg-brand-gold/5 blur-2xl rounded-full"></div>
                      <img 
                        src="https://lh3.googleusercontent.com/d/18raBQPiuO-pKACm4S66YYNf1GBy0BCL3" 
                        alt="Chefinho" 
                        className="h-20 w-auto object-contain relative z-10 drop-shadow-md"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="bg-brand-gold/10 p-1.5 rounded-lg">
                          <MessageSquare size={14} className="text-brand-gold" />
                        </div>
                        <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest">Pergunte ao Chefinho</h3>
                      </div>
                      <p className="text-[11px] text-gray-500 font-bold leading-tight">
                        Seu assistente para protocolos, técnicas cirúrgicas e rotinas do Instituto Andreoni.
                      </p>
                    </div>
                  </div>

                  {/* Avatar - Tablet/Landscape Layout (Large Character) */}
                  <div className="hidden md:block flex-shrink-0 relative">
                    <div className="absolute inset-0 bg-brand-gold/5 blur-3xl rounded-full"></div>
                    <img 
                      src="https://lh3.googleusercontent.com/d/18raBQPiuO-pKACm4S66YYNf1GBy0BCL3" 
                      alt="Chefinho Full Body" 
                      className="h-[210px] w-auto object-contain relative z-10 drop-shadow-[0_20px_30px_rgba(0,0,0,0.1)] hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Text Content - Tablet/Landscape Layout */}
                  <div className="hidden md:block flex-1 pb-2">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="bg-brand-gold/10 p-2.5 rounded-2xl shadow-sm">
                        <MessageSquare size={22} className="text-brand-gold" />
                      </div>
                      <h3 className="font-black text-brand-dark uppercase text-lg tracking-widest">Pergunte ao Chefinho</h3>
                    </div>
                    
                    <p className="text-base text-gray-500 font-medium leading-relaxed max-w-xl">
                      Olá! Sou o seu assistente especializado. Tire suas dúvidas sobre protocolos, técnicas cirúrgicas e orientações do Instituto Andreoni em segundos.
                    </p>
                  </div>
                </div>

                {/* Input Field - Spans full width */}
                <form onSubmit={handleAskChefinho} className="relative">
                  <input 
                    type="text" 
                    value={chefinhoQuestion}
                    onChange={(e) => setChefinhoQuestion(e.target.value)}
                    placeholder="Qual sua dúvida hoje, Doutor?"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl md:rounded-[24px] py-4 md:py-7 pl-5 md:pl-6 pr-16 md:pr-20 text-xs md:text-base font-bold text-brand-dark outline-none focus:ring-4 focus:ring-brand-gold/10 transition-all shadow-inner"
                  />
                  <button 
                    type="submit"
                    disabled={!chefinhoQuestion.trim()}
                    className="absolute right-2 md:right-3 top-2 md:top-3 bottom-2 md:bottom-3 bg-brand-dark text-brand-gold px-5 md:px-8 rounded-xl md:rounded-2xl flex items-center justify-center hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-xl"
                  >
                    <Send size={18} className="md:scale-125" />
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
      </div>

      {/* Chefinho Chat Modal */}
      {showChefinhoModal && (
        <div className="fixed inset-0 z-[120] bg-brand-dark/80 backdrop-blur-md flex flex-col animate-fade-in">
          <div className="p-4 flex items-center justify-between border-b border-white/10 bg-brand-dark/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl overflow-hidden bg-brand-gold flex items-center justify-center shadow-lg shadow-brand-gold/20">
                <img 
                  src="https://lh3.googleusercontent.com/d/18raBQPiuO-pKACm4S66YYNf1GBy0BCL3" 
                  alt="Chefinho" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="text-white font-black text-sm tracking-widest uppercase">Chefinho AI</h3>
                <div className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest">Online e Pronto</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowChefinhoModal(false)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-gray-50/30">
            {chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                <Bot size={60} className="text-brand-gold" />
                <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Inicie uma conversa</p>
              </div>
            )}
            
            {chatMessages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-scale-in`}
              >
                <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                  <div className={`w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 shadow-md ${
                    msg.role === 'user' ? 'bg-brand-gold text-brand-dark' : 'bg-brand-dark border border-brand-gold/20'
                  }`}>
                    {msg.role === 'user' ? (
                      <UserIcon size={14} />
                    ) : (
                      <img 
                        src="https://lh3.googleusercontent.com/d/18raBQPiuO-pKACm4S66YYNf1GBy0BCL3" 
                        alt="Chefinho" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-brand-gold text-brand-dark rounded-br-none' 
                      : 'bg-white text-brand-dark border border-gray-100 rounded-bl-none'
                  }`}>
                    <div className="prose prose-sm max-w-none">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                    {msg.role === 'assistant' && msg.content.includes("Erro de Conexão") && (
                      <button 
                        onClick={handleRetry}
                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-md"
                      >
                        <RotateCcw size={14} />
                        Tentar Novamente
                      </button>
                    )}
                    {msg.role === 'assistant' && msg.content.includes("Gostaria que eu consultasse a inteligência artificial externa?") && (
                      <button 
                        onClick={() => {
                          const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
                          if (lastUserMsg) handleAskGemini(lastUserMsg.content);
                        }}
                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-brand-dark text-brand-gold rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-md"
                      >
                        <Sparkles size={14} />
                        Consultar IA do Chefinho
                      </button>
                    )}
                    <span className={`text-[8px] font-black uppercase mt-2 block opacity-40 ${
                      msg.role === 'user' ? 'text-brand-dark text-right' : 'text-gray-400'
                    }`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-lg overflow-hidden bg-brand-dark border border-brand-gold/20 flex items-center justify-center shadow-md">
                    <img 
                      src="https://lh3.googleusercontent.com/d/18raBQPiuO-pKACm4S66YYNf1GBy0BCL3" 
                      alt="Chefinho" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="bg-white p-4 rounded-2xl rounded-bl-none border border-gray-100 shadow-sm flex items-center space-x-2">
                    <Loader2 size={16} className="text-brand-gold animate-spin" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chefinho está pensando...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-brand-dark/50 backdrop-blur-xl border-t border-white/10 safe-bottom">
            <form onSubmit={handleAskChefinho} className="relative">
              <input 
                type="text" 
                value={chefinhoQuestion}
                onChange={(e) => setChefinhoQuestion(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-brand-gold/30 transition-all"
              />
              <button 
                type="submit"
                disabled={!chefinhoQuestion.trim() || isTyping}
                className="absolute right-2 top-2 bottom-2 bg-brand-gold text-brand-dark px-4 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-[130] bg-brand-dark/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center space-x-3">
                <div className="bg-brand-gold/10 p-2 rounded-xl">
                  <Megaphone size={20} className="text-brand-gold" />
                </div>
                <div>
                  <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest">Comunicado</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Detalhes do aviso</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAnnouncement(null)}
                className="p-2 bg-gray-100 text-gray-400 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center text-[10px] text-gray-400 mb-4 space-x-2 font-bold uppercase tracking-tighter">
                <Clock size={12} className="text-brand-gold" />
                <span>{new Date(selectedAnnouncement.date).toLocaleDateString('pt-BR')}</span>
                <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                <span className="text-brand-dark">{selectedAnnouncement.authorName}</span>
              </div>
              
              <h4 className="font-black text-brand-dark text-xl leading-tight mb-4">{selectedAnnouncement.title}</h4>
              
              <div className="prose prose-sm max-w-none text-gray-600 font-medium leading-relaxed">
                <Markdown>{selectedAnnouncement.content}</Markdown>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button 
                onClick={() => setSelectedAnnouncement(null)}
                className="w-full py-4 bg-brand-dark text-brand-gold rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Notifications Modal */}
      {showNotificationsModal && (
        <div className="fixed inset-0 z-[140] bg-brand-dark/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center space-x-3">
                <div className="bg-brand-gold/10 p-2 rounded-xl">
                  <Bell size={20} className="text-brand-gold" />
                </div>
                <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest">Notificações</h3>
              </div>
              <button 
                onClick={() => setShowNotificationsModal(false)}
                className="p-2 bg-gray-100 text-gray-400 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length > 0 ? notifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    readNotifications.includes(notif.id) 
                      ? 'bg-gray-50 border-gray-100 opacity-60' 
                      : 'bg-white border-brand-gold/20 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-brand-dark text-sm">{notif.title}</h4>
                    {!readNotifications.includes(notif.id) && (
                      <span className="w-2 h-2 bg-brand-gold rounded-full"></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{notif.content}</p>
                  <span className="text-[10px] text-gray-400 mt-2 block font-bold">
                    {new Date(notif.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )) : (
                <div className="py-12 text-center">
                  <Bell size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sem novas notificações</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Modal */}
      {showLiveModal && activeLive && (
        <div className="fixed inset-0 z-[150] bg-brand-dark/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-10 animate-fade-in">
          <div className="bg-white w-full max-w-6xl rounded-[40px] overflow-hidden shadow-2xl animate-scale-in flex flex-col h-full max-h-[90vh] relative border border-white/20">
            {/* Header Control */}
            <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between bg-white z-20">
              <div className="flex items-center space-x-4">
                <div className="bg-red-500/10 p-3 rounded-2xl">
                  <Radio size={24} className="text-red-600 animate-pulse" />
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">Transmissão em Tempo Real</span>
                  </div>
                  <h3 className="font-bold text-lg md:text-xl text-brand-dark leading-tight">{activeLive.title}</h3>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => {
                    const url = activeLive.liveUrl || activeLive.url;
                    if (url) window.open(url, '_blank');
                  }}
                  className="hidden md:flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all border border-gray-200 shadow-sm"
                >
                  <ExternalLink size={14} />
                  Abrir no Navegador
                </button>
                <button 
                  onClick={() => setShowLiveModal(false)}
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
                      src={generateEmbedUrl(activeLive.liveUrl || activeLive.url) || undefined}
                      className={`w-full h-full border-0 absolute inset-0 transition-opacity duration-1000 ${playerState === 'ready' ? 'opacity-100' : 'opacity-0'}`}
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture; web-share"
                      allowFullScreen
                      playsInline
                      onLoad={() => {
                        console.log('[PLAYER] Iframe disparou onLoad');
                        setPlayerState('ready');
                        if (playerTimeoutRef.current) clearTimeout(playerTimeoutRef.current);
                      }}
                      title={activeLive.title}
                    ></iframe>
                    
                    {playerState === 'loading' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand-dark space-y-4">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin"></div>
                          <Radio size={24} className="absolute inset-0 m-auto text-brand-gold animate-pulse" />
                        </div>
                        <div className="text-center">
                          <p className="text-brand-gold font-black uppercase text-[10px] tracking-[0.3em] mb-1">Conectando ao Stream</p>
                          <p className="text-gray-500 text-[8px] font-bold uppercase tracking-widest">Preparando ambiente seguro...</p>
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
                            const url = activeLive.liveUrl || activeLive.url;
                            if (url) window.open(url, '_blank');
                          }}
                          className="w-full bg-brand-gold text-brand-dark py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-brand-gold/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                          <ExternalLink size={16} />
                          Assistir no YouTube
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
                  {activeLive.channelTitle && (
                    <div className="mb-2">
                      <span className="text-[10px] font-black text-brand-gold uppercase tracking-widest bg-brand-dark px-3 py-1 rounded-xl">{activeLive.channelTitle}</span>
                    </div>
                  )}
                  <p className="text-gray-500 text-sm md:text-base font-medium leading-relaxed italic">
                    "{activeLive.description || "Sem descrição disponível para esta transmissão."}"
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => {
                      if (activeLive.liveUrl) window.open(activeLive.liveUrl, '_blank');
                    }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-[0.98] transition-all hover:bg-red-700"
                  >
                    <Play size={16} fill="currentColor" />
                    Abrir Stream Direto
                  </button>
                  <button 
                    onClick={() => {
                      if (activeLive.liveUrl) {
                        navigator.clipboard.writeText(activeLive.liveUrl);
                        setShowSuccess("Link copiado para a área de transferência!");
                      }
                    }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-brand-dark text-brand-gold rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-black/10 active:scale-[0.98] transition-all hover:bg-gray-900 border border-brand-gold/20"
                  >
                    <Copy size={16} />
                    Copiar Link
                  </button>
                </div>
              </div>
            </div>
            
            {/* Troubleshooting info */}
            <div className="bg-amber-50 px-8 py-3 border-t border-amber-100 text-center">
              <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest">
                Problemas com a imagem? Use o botão "Abrir Stream Direto" acima para assistir nativamente na plataforma.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Full Schedule / Scale Experience Modal */}
      {showFullSchedule && (
        <div className="fixed inset-0 z-[160] bg-brand-dark/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl animate-scale-in flex flex-col h-full max-h-[85vh] border border-white/20">
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <div className="bg-brand-gold/10 p-3 rounded-2xl">
                  <Calendar size={22} className="text-brand-gold" />
                </div>
                <div>
                  <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest">Escala Geral de Plantões</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Calendário Atualizado {new Date().getFullYear()}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFullSchedule(false)}
                className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:text-brand-dark active:scale-95 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content - Chronological Scale */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
              {[...teamShifts]
                .filter(s => s.active && s.endDate >= todayStr) // Future or current only
                .sort((a, b) => a.startDate.localeCompare(b.startDate))
                .map((shift, idx) => {
                  const isCurrent = shift.startDate <= todayStr && shift.endDate >= todayStr;
                  const team = fixedTeams.find(t => t.id === shift.teamId);
                  const r3 = r3Shifts.find(r => r.active && r.startDate === shift.startDate);

                  return (
                    <div key={shift.id} className={`relative flex gap-6 ${idx === 0 ? '' : 'pt-2'}`}>
                      {/* Timeline Line */}
                      <div className="hidden sm:flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                          isCurrent ? 'bg-brand-gold text-brand-dark scale-110' : 'bg-gray-100 text-gray-400'
                        }`}>
                          <Calendar size={18} />
                        </div>
                        <div className="flex-1 w-0.5 bg-gray-100 mt-2 mb-[-8px]"></div>
                      </div>

                      {/* Shift Card */}
                      <div className={`flex-1 p-6 rounded-3xl border transition-all ${
                        isCurrent 
                          ? 'bg-brand-dark border-brand-gold/30 shadow-xl shadow-brand-dark/20' 
                          : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'
                      }`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {isCurrent && (
                                <span className="bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full animate-pulse">Plantão Atual</span>
                              )}
                              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isCurrent ? 'text-brand-gold' : 'text-gray-400'}`}>
                                {new Date(shift.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} - {new Date(shift.endDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                              </span>
                            </div>
                            <h4 className={`text-lg font-black uppercase ${isCurrent ? 'text-white' : 'text-brand-dark'}`}>
                              {shift.teamName}
                            </h4>
                          </div>

                          <div className={`p-4 rounded-2xl flex items-center gap-4 ${isCurrent ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${
                              isCurrent ? 'bg-brand-gold text-brand-dark' : 'bg-brand-dark text-brand-gold'
                            }`}>
                              R3
                            </div>
                            <div className="xs:min-w-[120px]">
                              <span className={`text-[8px] font-black uppercase tracking-widest block ${isCurrent ? 'text-gray-400' : 'text-gray-400'}`}>Em serviço</span>
                              <p className={`text-xs font-black line-clamp-1 ${isCurrent ? 'text-white' : 'text-brand-dark'}`}>
                                {r3?.residentName || 'A definir'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Members Detail */}
                        <div className={`mt-6 pt-6 border-t border-dashed grid grid-cols-2 gap-6 ${
                          isCurrent ? 'border-white/10' : 'border-gray-200'
                        }`}>
                          <div className="space-y-2">
                            <span className={`text-[8px] font-black uppercase tracking-[0.2em] block ${isCurrent ? 'text-brand-gold' : 'text-gray-400'}`}>Residentes R2</span>
                            {team?.r2Members?.map(m => (
                              <p key={m} className={`text-[10px] font-bold ${isCurrent ? 'text-gray-300' : 'text-gray-600'}`}>{m}</p>
                            ))}
                            {!team?.r2Members && <p className="text-[10px] italic text-gray-500">Geral</p>}
                          </div>
                          <div className="space-y-2">
                            <span className={`text-[8px] font-black uppercase tracking-[0.2em] block ${isCurrent ? 'text-brand-gold' : 'text-gray-400'}`}>Residentes R1</span>
                            {team?.r1Members?.map(m => (
                              <p key={m} className={`text-[10px] font-bold ${isCurrent ? 'text-gray-300' : 'text-gray-600'}`}>{m}</p>
                            ))}
                             {!team?.r1Members && <p className="text-[10px] italic text-gray-500">Geral</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              
              {[...teamShifts].filter(s => s.active && s.endDate >= todayStr).length === 0 && (
                <div className="py-20 text-center">
                   <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Calendar size={32} className="text-gray-200" />
                   </div>
                   <p className="text-sm font-black text-gray-300 uppercase tracking-widest">Nenhuma escala futura encontrada</p>
                </div>
              )}
            </div>

            {/* Bottom Note */}
            <div className="p-6 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-3 text-gray-400">
                <Clock size={16} />
                <p className="text-[10px] font-bold uppercase tracking-widest">Escala válida para o internato e residência do CTBMF Andreoni</p>
              </div>
            </div>
          </div>
        </div>
      )}
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
    </>
  );
};

export default Home;
