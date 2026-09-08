import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  AppUser, 
  AcademyLive, 
  AcademyLibraryItem, 
  AcademyEvent, 
  AcademyAnnouncement, 
  AcademyObservationalRequest 
} from '../types';
import { 
  Crown, 
  Video, 
  BookOpen, 
  Calendar as CalendarIcon, 
  Megaphone, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  Clock,
  ExternalLink,
  ChevronRight,
  Shield,
  Stethoscope,
  Search
} from 'lucide-react';

interface AcademyHubProps {
  user: AppUser;
}

const AcademyHub: React.FC<AcademyHubProps> = ({ user }) => {
  // Tabs: 'home' | 'lessons' | 'library' | 'schedule' | 'experience'
  const [activeTab, setActiveTab] = useState<'home' | 'lessons' | 'library' | 'schedule' | 'experience'>('home');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lists State
  const [lives, setLives] = useState<AcademyLive[]>([]);
  const [library, setLibrary] = useState<AcademyLibraryItem[]>([]);
  const [events, setEvents] = useState<AcademyEvent[]>([]);
  const [announcements, setAnnouncements] = useState<AcademyAnnouncement[]>([]);
  const [myRequests, setMyRequests] = useState<AcademyObservationalRequest[]>([]);

  // Request Form State
  const [cro, setCro] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [preferredCity, setPreferredCity] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Interest Form (for non-eligible members)
  const [interestSubmitted, setInterestSubmitted] = useState(false);

  // Search/Filters in library
  const [libFilter, setLibFilter] = useState<'all' | 'trauma' | 'orthognathic' | 'reconstruction' | 'other'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch collections
  useEffect(() => {
    // 1. Lives & Lessons
    const livesUnsub = onSnapshot(
      query(collection(db, 'academy_lives'), orderBy('date', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademyLive));
        setLives(data);
      }
    );

    // 2. Library
    const libUnsub = onSnapshot(
      query(collection(db, 'academy_library'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademyLibraryItem));
        setLibrary(data);
      }
    );

    // 3. Agenda Events
    const eventsUnsub = onSnapshot(
      query(collection(db, 'academy_events'), orderBy('date', 'asc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademyEvent));
        setEvents(data);
      }
    );

    // 4. Announcements
    const annUnsub = onSnapshot(
      query(collection(db, 'academy_announcements'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademyAnnouncement));
        setAnnouncements(data);
      }
    );

    // 5. My Observational Requests
    const reqsUnsub = onSnapshot(
      query(collection(db, 'academy_observational_requests'), where('uid', '==', user.uid)),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademyObservationalRequest));
        setMyRequests(data);
      }
    );

    return () => {
      livesUnsub();
      libUnsub();
      eventsUnsub();
      annUnsub();
      reqsUnsub();
    };
  }, [user.uid]);

  // Handle submitting visit request
  const handleRequestVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cro || !requestedDate || !preferredCity) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload = {
      uid: user.uid,
      displayName: user.displayName || 'Membro do Academy',
      email: user.email,
      cro,
      requestedDate,
      preferredCity,
      notes,
      status: 'pending',
      createdAt: serverTimestamp(),
      requestedDateString: requestedDate,
      scheduledDateTime: null,
      adminNotes: null
    };

    try {
      await addDoc(collection(db, 'academy_observational_requests'), payload);
      setSuccessMsg('Sua solicitação de interesse foi enviada com sucesso! Analisaremos a disponibilidade e entraremos em contato.');
      setCro('');
      setRequestedDate('');
      setPreferredCity('');
      setNotes('');
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao enviar sua solicitação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit General Interest for Experience Plan
  const handleExpressInterest = async () => {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'academy_observational_requests'), {
        uid: user.uid,
        displayName: user.displayName || 'Membro',
        email: user.email,
        type: 'general_interest_experience',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setInterestSubmitted(true);
      setSuccessMsg('Obrigado! Registramos seu interesse no plano Experience. Nossa equipe comercial entrará em contato em breve.');
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao registrar interesse. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get current active/eligible status
  const isEligibleForExperience = user.academyPlan === 'experience' && user.academyStatus === 'active';

  // Wording/Labels selection: "Aula do Mês" and "Discussões Clínicas"
  const lessons = lives.filter(l => l.isLesson);

  const filteredLibrary = library.filter(item => {
    const matchesCat = libFilter === 'all' || item.category === libFilter;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Academy Premium Hero Banner */}
      <div className="relative bg-brand-dark rounded-[32px] md:rounded-[40px] p-8 md:p-12 text-white border border-brand-gold/20 shadow-xl overflow-hidden">
        {/* Subtle decorative elements */}
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <Crown size={280} className="text-brand-gold" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full space-y-6 md:space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-brand-gold/15 text-brand-gold text-[9px] font-black uppercase tracking-[0.25em] rounded-full mb-4 border border-brand-gold/25">
              <Sparkles size={10} />
              Área Exclusiva Academy
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest leading-none">
              Maxilo Pro Academy
            </h1>
            <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest mt-1.5">
              Educação continuada em Cirurgia e Traumatologia Bucomaxilofacial
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 bg-brand-gold rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                Plano: <span className="text-brand-gold">{user.academyPlan === 'experience' ? 'Experience (Completo)' : 'Access'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 bg-white/35 rounded-full"></span>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                Categoria: <span className="text-brand-gold">{user.academyCategory === 'student' ? 'Acadêmico' : 'Dentista'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex bg-gray-50 p-2 rounded-2xl overflow-x-auto gap-2 border border-gray-100 no-scrollbar">
        {[
          { id: 'home', label: 'Início', icon: Sparkles },
          { id: 'lessons', label: 'Aula do Mês', icon: Video },
          { id: 'library', label: 'Discussões Clínicas', icon: BookOpen },
          { id: 'schedule', label: 'Agenda & Eventos', icon: CalendarIcon },
          { id: 'experience', label: 'Área Experience', icon: Stethoscope },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as 'home' | 'lessons' | 'library' | 'schedule' | 'experience');
              setSuccessMsg(null);
              setErrorMsg(null);
            }}
            className={`flex items-center gap-2.5 shrink-0 py-3.5 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-brand-dark text-brand-gold shadow-md shadow-brand-dark/15' 
                : 'text-gray-400 hover:text-brand-dark'
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Message indicators */}
      {(successMsg || errorMsg) && (
        <div className={`p-5 rounded-2xl flex items-center text-xs font-black uppercase tracking-widest animate-fade-in ${
          errorMsg ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
        }`}>
          {errorMsg ? <AlertCircle className="mr-3" size={16} /> : <CheckCircle2 className="mr-3" size={16} />}
          {errorMsg || successMsg}
        </div>
      )}

      {/* --- TAB: HOME --- */}
      {activeTab === 'home' && (
        <div className="space-y-8 animate-fade-in">
          {/* Latest Announcement */}
          {announcements.length > 0 && (
            <div className="bg-amber-50/40 border border-amber-100 p-6 rounded-[28px] relative overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="bg-amber-500 text-white p-3 rounded-xl">
                  <Megaphone size={18} />
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    Comunicado Oficial Academy
                  </span>
                  <h3 className="font-black text-brand-dark text-sm uppercase tracking-wider mt-1">{announcements[0].title}</h3>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed pt-1 whitespace-pre-line">{announcements[0].content}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider pt-2">
                    {announcements[0].authorName} • {announcements[0].date}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Featured Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Class of the Month shortcut */}
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[8px] font-black uppercase tracking-widest text-brand-gold bg-brand-dark px-3 py-1 rounded-full">
                  Exclusivo Academy
                </span>
                <h3 className="font-black text-brand-dark text-sm uppercase tracking-wider mt-4">Aula do Mês</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Seminários de Alta Performance</p>
                {lessons.length > 0 ? (
                  <div className="mt-4 p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-brand-dark text-brand-gold p-2.5 rounded-xl">
                        <Play size={14} fill="currentColor" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-brand-dark uppercase truncate max-w-[150px]">{lessons[0].title}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{lessons[0].date}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('lessons')}
                      className="text-brand-dark hover:text-brand-gold transition-colors"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 font-medium mt-4">Nenhuma aula publicada este mês.</p>
                )}
              </div>
              <button 
                onClick={() => setActiveTab('lessons')}
                className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-gold bg-brand-dark py-3.5 px-6 rounded-xl hover:bg-brand-dark/95 transition-all w-full justify-center"
              >
                Acessar Aulas Academy
                <ArrowRight size={12} />
              </button>
            </div>

            {/* Experience visit shortcut */}
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[8px] font-black uppercase tracking-widest text-brand-gold bg-brand-dark px-3 py-1 rounded-full">
                  Área Presencial
                </span>
                <h3 className="font-black text-brand-dark text-sm uppercase tracking-wider mt-4">Visita Cirúrgica Observacional</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Área Experience</p>
                <p className="text-xs text-gray-500 font-medium leading-relaxed mt-3">
                  {isEligibleForExperience 
                    ? 'Você possui plano qualificado! Solicite o acompanhamento presencial em cirurgias.' 
                    : 'Acompanhe cirurgias de alta complexidade diretamente no bloco cirúrgico.'}
                </p>
              </div>
              <button 
                onClick={() => setActiveTab('experience')}
                className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-gold bg-brand-dark py-3.5 px-6 rounded-xl hover:bg-brand-dark/95 transition-all w-full justify-center"
              >
                {isEligibleForExperience ? 'Solicitar Visita Presencial' : 'Conhecer Programa Experience'}
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Quick agenda schedule */}
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
            <h3 className="font-black text-brand-dark text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <CalendarIcon size={14} className="text-brand-gold" />
              Eventos da Agenda
            </h3>
            {events.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {events.slice(0, 3).map(event => (
                  <div key={event.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex flex-col items-center justify-center min-w-[50px]">
                        <span className="text-[8px] font-black text-brand-gold uppercase tracking-wider">
                          {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                        </span>
                        <span className="text-sm font-black text-brand-dark">
                          {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit' })}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wide text-brand-dark">{event.title}</h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          {event.time}
                        </p>
                      </div>
                    </div>
                    {event.link && (
                      <a 
                        href={event.link} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="p-2 bg-brand-gold/10 hover:bg-brand-gold text-brand-dark hover:text-white rounded-lg transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 font-medium">Nenhum evento agendado recentemente.</p>
            )}
          </div>
        </div>
      )}

      {/* --- TAB: LESSONS (Aula do Mês) --- */}
      {activeTab === 'lessons' && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-brand-dark text-brand-gold p-3 rounded-2xl">
                <Video size={18} />
              </div>
              <div>
                <h3 className="font-black text-brand-dark text-xs uppercase tracking-widest">Seminários & Aula do Mês</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Treinamentos Científicos Gravados</p>
              </div>
            </div>

            {lessons.length > 0 ? (
              <div className="space-y-8">
                {/* Featured Master Class */}
                <div className="space-y-4">
                  <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-gray-100 shadow-md relative">
                    {lessons[0].embedUrl ? (
                      <iframe
                        src={lessons[0].embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={lessons[0].title}
                      ></iframe>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                        <Video size={40} />
                        <span className="text-xs font-bold uppercase tracking-widest">Vídeo indisponível</span>
                      </div>
                    )}
                  </div>

                  <div className="p-2">
                    <span className="text-[8px] font-black uppercase text-brand-gold bg-brand-dark px-2 py-0.5 rounded-full tracking-widest">
                      Em Destaque
                    </span>
                    <h4 className="font-black text-brand-dark text-base uppercase tracking-wide mt-2">{lessons[0].title}</h4>
                    <p className="text-xs text-gray-400 font-bold uppercase mt-0.5 tracking-wider">
                      Lançamento: {lessons[0].date} • {lessons[0].time}
                    </p>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed pt-2 whitespace-pre-line">{lessons[0].description}</p>
                  </div>
                </div>

                {/* Other Lessons List */}
                {lessons.length > 1 && (
                  <div className="pt-6 border-t border-gray-100">
                    <h4 className="font-black text-brand-dark text-xs uppercase tracking-widest mb-4">Aulas Anteriores</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {lessons.slice(1).map(item => (
                        <div key={item.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex flex-col justify-between">
                          <div>
                            <h5 className="font-black text-brand-dark text-xs uppercase tracking-wide">{item.title}</h5>
                            <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">{item.date}</p>
                            <p className="text-[11px] text-gray-500 font-medium line-clamp-2 mt-1.5">{item.description}</p>
                          </div>
                          {item.videoUrl && (
                            <a 
                              href={item.videoUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="mt-4 flex items-center justify-center gap-2 bg-brand-dark text-brand-gold text-[9px] font-black uppercase tracking-widest py-2 rounded-lg"
                            >
                              Assistir Vídeo Externo
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Video size={36} className="text-gray-300 mx-auto mb-3" />
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Nenhuma aula disponível no momento.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB: LIBRARY (Discussões Clínicas) --- */}
      {activeTab === 'library' && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
            <div className="flex flex-col gap-4 mb-6 pb-6 border-b border-gray-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-dark text-brand-gold p-3 rounded-2xl">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-brand-dark text-xs uppercase tracking-widest">Discussões Clínicas & Casos</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Biblioteca e Materiais Complementares</p>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar materiais..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-gold/10 text-brand-dark"
                  />
                </div>
              </div>
              
              {/* Simple category filter */}
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'trauma', label: 'Trauma' },
                  { id: 'orthognathic', label: 'Ortognática' },
                  { id: 'reconstruction', label: 'Reconstrução' },
                  { id: 'other', label: 'Outros' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setLibFilter(cat.id as 'all' | 'trauma' | 'orthognathic' | 'reconstruction' | 'other')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      libFilter === cat.id 
                        ? 'bg-brand-gold/20 text-brand-dark border border-brand-gold/40 font-black' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Library Grid */}
            {filteredLibrary.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredLibrary.map(item => (
                  <div key={item.id} className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 flex flex-col justify-between shadow-sm hover:border-gray-200 transition-all">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[7px] font-black uppercase tracking-widest bg-brand-gold/15 text-brand-dark border border-brand-gold/25 px-2 py-0.5 rounded">
                          {item.category === 'orthognathic' ? 'Ortognática' : item.category === 'trauma' ? 'Trauma' : item.category === 'reconstruction' ? 'Reconstrução' : 'Outros'}
                        </span>
                        <span className="text-[7px] font-black uppercase tracking-widest bg-gray-200 text-gray-500 px-2 py-0.5 rounded">
                          {item.type.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="font-black text-brand-dark text-xs uppercase tracking-wide mt-3">{item.title}</h4>
                      {item.description && (
                        <p className="text-[11px] text-gray-500 font-medium mt-1.5 line-clamp-3 leading-relaxed">{item.description}</p>
                      )}
                    </div>
                    {item.link && (
                      <a 
                        href={item.link} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="mt-5 flex items-center justify-center gap-2 bg-brand-dark text-brand-gold text-[9px] font-black uppercase tracking-widest py-3 rounded-xl hover:bg-brand-dark/95 transition-all"
                      >
                        Acessar Material / Caso
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen size={36} className="text-gray-300 mx-auto mb-3" />
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Nenhum material encontrado.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB: SCHEDULE --- */}
      {activeTab === 'schedule' && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-brand-dark text-brand-gold p-3 rounded-2xl">
                <CalendarIcon size={18} />
              </div>
              <div>
                <h3 className="font-black text-brand-dark text-xs uppercase tracking-widest">Agenda & Próximos Eventos</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Cronograma Completo do Academy</p>
              </div>
            </div>

            {events.length > 0 ? (
              <div className="space-y-4">
                {events.map(event => (
                  <div key={event.id} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-brand-gold/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col items-center justify-center min-w-[60px] text-center shadow-sm">
                        <span className="text-[8px] font-black text-brand-gold uppercase tracking-wider">
                          {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                        </span>
                        <span className="text-base font-black text-brand-dark">
                          {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit' })}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wide text-brand-dark">{event.title}</h4>
                        {event.description && (
                          <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">{event.description}</p>
                        )}
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-2">
                          <Clock size={10} />
                          {event.time}
                        </p>
                      </div>
                    </div>
                    {event.link && (
                      <a 
                        href={event.link} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="w-full md:w-auto text-center px-4 py-2.5 bg-brand-dark hover:bg-brand-dark/95 text-brand-gold font-black uppercase text-[9px] tracking-widest rounded-xl transition-colors border border-brand-gold/10 flex items-center justify-center gap-2"
                      >
                        Acessar Link
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CalendarIcon size={36} className="text-gray-300 mx-auto mb-3" />
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Nenhum evento agendado recentemente.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB: EXPERIENCE (Observational surgical visits) --- */}
      {activeTab === 'experience' && (
        <div className="space-y-8 animate-fade-in">
          {isEligibleForExperience ? (
            <div className="space-y-8">
              {/* Eligibility details */}
              <div className="bg-brand-dark text-white p-8 md:p-10 rounded-[32px] md:rounded-[40px] border border-brand-gold/20 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                  <Stethoscope size={180} />
                </div>
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-gold/20 text-brand-gold text-[9px] font-black uppercase tracking-wider rounded-full mb-3 border border-brand-gold/30">
                    <CheckCircle2 size={10} />
                    Membro Elegível
                  </div>
                  <h3 className="font-black text-lg md:text-xl uppercase tracking-widest">Programa de Visita Presencial</h3>
                  <p className="text-xs text-gray-300 font-medium leading-relaxed mt-2 max-w-xl">
                    Sendo membro do plano **Experience**, você tem o privilégio exclusivo de solicitar visitas observacionais presenciais no bloco cirúrgico. Acompanhe cirurgias de trauma, reconstruções e ortognáticas de perto.
                  </p>
                  <div className="mt-6 flex flex-col gap-2 max-w-lg text-[11px] text-gray-400 font-bold uppercase tracking-wider bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="flex items-start gap-2">
                      <Shield size={12} className="text-brand-gold shrink-0 mt-0.5" />
                      <span>Todas as visitas são meramente observacionais e dependem de aprovação prévia.</span>
                    </p>
                    <p className="flex items-start gap-2 mt-1.5">
                      <Shield size={12} className="text-brand-gold shrink-0 mt-0.5" />
                      <span>Agendamentos estão sujeitos a requisitos de vacinação, credenciamento hospitalar e disponibilidade de vagas.</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Request Interest Flow Form */}
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
                <div>
                  <h4 className="font-black text-brand-dark text-sm uppercase tracking-wider">Registrar Interesse em Visita Cirúrgica</h4>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Preencha seus dados para análise de datas e hospitais</p>
                </div>

                <form onSubmit={handleRequestVisit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Número de Inscrição CRO *</label>
                      <input
                        type="text"
                        value={cro}
                        onChange={(e) => setCro(e.target.value)}
                        placeholder="CRO-UF XXXXX"
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-brand-dark focus:outline-none focus:border-brand-gold uppercase"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Data ou Período Desejado *</label>
                      <input
                        type="text"
                        value={requestedDate}
                        onChange={(e) => setRequestedDate(e.target.value)}
                        placeholder="Ex: Julho/2026 ou 15/08/2026"
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-brand-dark focus:outline-none focus:border-brand-gold"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Cidade / Hospital de Preferência *</label>
                    <input
                      type="text"
                      value={preferredCity}
                      onChange={(e) => setPreferredCity(e.target.value)}
                      placeholder="Ex: São Paulo / Hospital Andreoni"
                      className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-brand-dark focus:outline-none focus:border-brand-gold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Notas ou Observações adicionais</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Indique sua experiência cirúrgica ou interesses específicos se desejar..."
                      rows={3}
                      className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-brand-dark focus:outline-none focus:border-brand-gold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-brand-dark text-brand-gold text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enviando Solicitação...' : 'Enviar Solicitação de Interesse'}
                  </button>
                </form>
              </div>

              {/* Submitted Requests Log */}
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                <h4 className="font-black text-brand-dark text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Shield size={14} className="text-brand-gold" />
                  Minhas Solicitações Realizadas
                </h4>

                {myRequests.length > 0 ? (
                  <div className="space-y-4">
                    {myRequests.map(req => (
                      <div key={req.id} className="p-5 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[8px] font-black uppercase text-gray-400">CRO: {req.cro}</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-[8px] font-black uppercase text-gray-400">Data Solicitada: {req.requestedDate}</span>
                          </div>
                          <h5 className="font-black text-brand-dark text-xs uppercase tracking-wide">{req.preferredCity}</h5>
                          {req.notes && (
                            <p className="text-[11px] text-gray-500 font-medium">{req.notes}</p>
                          )}
                          {req.adminNotes && (
                            <div className="p-3 bg-amber-50/40 border border-amber-100 rounded-xl text-[10px] font-bold text-amber-700 uppercase mt-2">
                              Nota do Administrador: {req.adminNotes}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col md:items-end justify-between min-w-[120px]">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            req.status === 'approved' 
                              ? 'bg-emerald-50 text-emerald-600' 
                              : req.status === 'rejected'
                                ? 'bg-red-50 text-red-500'
                                : 'bg-amber-50 text-amber-600'
                          }`}>
                            {req.status === 'approved' ? 'Aprovada / Agendada' : req.status === 'rejected' ? 'Cancelada' : 'Pendente de Aprovação'}
                          </span>
                          {req.scheduledDateTime && (
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-2">
                              Data Confirmada: {req.scheduledDateTime}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 font-medium">Nenhuma solicitação de visita presencial enviada ainda.</p>
                )}
              </div>
            </div>
          ) : (
            /* Non eligible member section */
            <div className="bg-white p-8 md:p-12 rounded-[32px] md:rounded-[40px] border border-gray-100 shadow-sm text-center space-y-6">
              <div className="bg-brand-dark text-brand-gold p-4 rounded-3xl inline-block mx-auto">
                <Crown size={32} />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="font-black text-brand-dark text-sm uppercase tracking-widest">Programa de Visitas Cirúrgicas (Experience)</h3>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  Para acessar a Área Experience e participar de visitas cirúrgicas observacionais presenciais, você precisa do plano **Experience**.
                </p>
              </div>

              <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-left max-w-lg mx-auto space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-brand-dark">O que o plano Experience inclui:</h4>
                <div className="space-y-2 text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                  <p className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-brand-gold shrink-0" />
                    Acesso a visitas observacionais presenciais
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-brand-gold shrink-0" />
                    Suporte e acompanhamento por tutores credenciados
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-brand-gold shrink-0" />
                    Todos os materiais exclusivos do plano Access inclusos
                  </p>
                </div>
              </div>

              {!interestSubmitted ? (
                <button
                  onClick={handleExpressInterest}
                  disabled={isSubmitting}
                  className="px-8 py-4 bg-brand-dark text-brand-gold text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-brand-dark/95 transition-all inline-block"
                >
                  {isSubmitting ? 'Registrando Interesse...' : 'Tenho Interesse no Plano Experience'}
                </button>
              ) : (
                <div className="text-emerald-600 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} />
                  Interesse registrado com sucesso! Entraremos em contato.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AcademyHub;
