import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
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
  Users, 
  MapPin, 
  Trash2, 
  Check, 
  Edit2, 
  AlertCircle, 
  Search, 
  UserCheck,
  LayoutDashboard,
  ArrowLeft,
  BarChart3,
  Star,
  Plus,
  Share2,
  Clock,
  Smartphone,
  Info
} from 'lucide-react';
import { extractYoutubeId, generateEmbedUrl } from '../utils/videoUtils';

// Firestore Error Handler helper according to Firebase skill requirements
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error in AdminAcademy: ', JSON.stringify(errInfo));
}

interface AcademyUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  academyCategory?: 'dentist' | 'student';
  academyPlan?: 'access' | 'experience';
  academyStatus?: 'active' | 'inactive';
  academyCRO?: string;
  phone?: string;
  origin?: 'manual' | 'whatsapp' | 'platform';
  createdAt?: string;
  updatedAt?: string;
}

interface AcademyInvite {
  id: string;
  name: string;
  email?: string;
  category: 'dentist' | 'student';
  plan: 'access' | 'experience';
  phone: string;
  cro?: string;
  inviteCode: string;
  status: 'pending' | 'completed';
  createdAt: string;
}

interface AcademyAdminAction {
  id: string;
  action: string;
  target: string;
  details: string;
  adminName: string;
  timestamp: string;
}

interface AdminAcademyProps {
  user: AppUser;
}

const AdminAcademy: React.FC<AdminAcademyProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'users' | 'lives' | 'library' | 'events' | 'announcements' | 'requests'>('dashboard');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lists State
  const [academyUsers, setAcademyUsers] = useState<AcademyUser[]>([]);
  const [academyInvites, setAcademyInvites] = useState<AcademyInvite[]>([]);
  const [academyAdminActions, setAcademyAdminActions] = useState<AcademyAdminAction[]>([]);

  // Modals Visibility
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AcademyUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ uid: string; isInvite: boolean; name: string } | null>(null);

  // Manual Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCategory, setRegCategory] = useState<'dentist' | 'student'>('dentist');
  const [regPlan, setRegPlan] = useState<'access' | 'experience'>('access');
  const [regStatus, setRegStatus] = useState<'active' | 'inactive'>('active');
  const [regCro, setRegCro] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // WhatsApp Invite Form State
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invCategory, setInvCategory] = useState<'dentist' | 'student'>('dentist');
  const [invPlan, setInvPlan] = useState<'access' | 'experience'>('access');
  const [invPhone, setInvPhone] = useState('');
  const [invCro, setInvCro] = useState('');
  const [inviteLinkUrl, setInviteLinkUrl] = useState('');

  // Edit User Form State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCategory, setEditCategory] = useState<'dentist' | 'student'>('dentist');
  const [editPlan, setEditPlan] = useState<'access' | 'experience'>('access');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editCro, setEditCro] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [lives, setLives] = useState<AcademyLive[]>([]);
  const [library, setLibrary] = useState<AcademyLibraryItem[]>([]);
  const [events, setEvents] = useState<AcademyEvent[]>([]);
  const [announcements, setAnnouncements] = useState<AcademyAnnouncement[]>([]);
  const [obsRequests, setObsRequests] = useState<AcademyObservationalRequest[]>([]);

  // Editing State
  const [editingLive, setEditingLive] = useState<AcademyLive | null>(null);
  const [editingLib, setEditingLib] = useState<AcademyLibraryItem | null>(null);
  const [editingEvent, setEditingEvent] = useState<AcademyEvent | null>(null);
  const [editingAnn, setEditingAnn] = useState<AcademyAnnouncement | null>(null);
  const [editingRequest, setEditingRequest] = useState<AcademyObservationalRequest | null>(null);

  // Forms Input State
  // Lives Form
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDesc, setLiveDesc] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [liveDate, setLiveDate] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const [livePlatform, setLivePlatform] = useState<'youtube' | 'vimeo' | 'other'>('youtube');
  const [liveStatus, setLiveStatus] = useState<'scheduled' | 'live' | 'ended'>('scheduled');
  const [isLesson, setIsLesson] = useState(false);

  // Library Form
  const [libTitle, setLibTitle] = useState('');
  const [libDesc, setLibDesc] = useState('');
  const [libCat, setLibCat] = useState<'trauma' | 'ortognatica' | 'estetica' | 'atm' | 'outros'>('trauma');
  const [libType, setLibType] = useState<'pdf' | 'video' | 'book' | 'protocol'>('pdf');
  const [libLink, setLibLink] = useState('');

  // Events Form
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLink, setEventLink] = useState('');

  // Announcements Form
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');

  // Request review form
  const [reqNotes, setReqNotes] = useState('');
  const [reqDateTime, setReqDateTime] = useState('');

  // Filter Search
  const [userSearch, setUserSearch] = useState('');

  // Subscribe to all Academy Collections
  useEffect(() => {
    // 1. Academy Users
    const usersUnsub = onSnapshot(
      query(collection(db, 'academy_users')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        setAcademyUsers(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'academy_users')
    );

    // 1b. Academy Invites
    const invitesUnsub = onSnapshot(
      query(collection(db, 'academy_invites')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAcademyInvites(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'academy_invites')
    );

    // 1c. Academy Admin Actions
    const actionsUnsub = onSnapshot(
      query(collection(db, 'academy_admin_actions')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAcademyAdminActions(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'academy_admin_actions')
    );

    // 2. Lives & Lessons
    const livesUnsub = onSnapshot(
      query(collection(db, 'academy_lives'), orderBy('date', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademyLive));
        setLives(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'academy_lives')
    );

    // 3. Library Items
    const libUnsub = onSnapshot(
      query(collection(db, 'academy_library'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademyLibraryItem));
        setLibrary(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'academy_library')
    );

    // 4. Agenda Events
    const eventsUnsub = onSnapshot(
      query(collection(db, 'academy_events'), orderBy('date', 'asc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademyEvent));
        setEvents(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'academy_events')
    );

    // 5. Announcements
    const annUnsub = onSnapshot(
      query(collection(db, 'academy_announcements'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademyAnnouncement));
        setAnnouncements(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'academy_announcements')
    );

    // 6. Observational Requests
    const reqsUnsub = onSnapshot(
      query(collection(db, 'academy_observational_requests'), orderBy('requestedDate', 'asc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademyObservationalRequest));
        setObsRequests(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'academy_observational_requests')
    );

    return () => {
      usersUnsub();
      invitesUnsub();
      actionsUnsub();
      livesUnsub();
      libUnsub();
      eventsUnsub();
      annUnsub();
      reqsUnsub();
    };
  }, []);

  // Helper trigger messages
  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const flashError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  // Helper for admin audit logs
  const logAdminAction = async (action: string, target: string, details: string) => {
    try {
      await addDoc(collection(db, 'academy_admin_actions'), {
        action,
        target,
        details,
        adminName: user.displayName || user.email || 'Admin',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  };

  // User Actions

  const handleDeleteUser = (userId: string, isInvite: boolean = false) => {
    let targetName = userId;
    if (isInvite) {
      const inv = academyInvites.find(i => i.id === userId);
      if (inv) targetName = inv.name;
    } else {
      const usr = academyUsers.find(u => u.uid === userId);
      if (usr) targetName = usr.displayName;
    }
    setDeleteTarget({ uid: userId, isInvite, name: targetName });
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    const { uid, isInvite, name } = deleteTarget;
    try {
      const targetCollection = isInvite ? 'academy_invites' : 'academy_users';
      const docRef = doc(db, targetCollection, uid);
      
      await deleteDoc(docRef);
      
      await logAdminAction(
        isInvite ? 'Exclusão de Convite' : 'Exclusão de Aluno',
        name,
        `Removido do ecossistema de dados`
      );
      
      flashSuccess(`${isInvite ? 'Convite' : 'Aluno'} excluído com sucesso.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${isInvite ? 'academy_invites' : 'academy_users'}/${uid}`);
      flashError('Erro ao excluir do banco.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSaveManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail) {
      flashError('Nome e E-mail são obrigatórios!');
      return;
    }
    try {
      const payload = {
        displayName: regName,
        email: regEmail,
        academyCategory: regCategory,
        academyPlan: regPlan,
        academyStatus: regStatus,
        academyCRO: regCro,
        phone: regPhone,
        origin: 'manual',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'academy_users'), payload);
      
      await logAdminAction(
        'Cadastro Manual',
        regName,
        `Aluno registrado manualmente no plano ${regPlan} (${regCategory})`
      );
      
      // Reset & close
      setRegName('');
      setRegEmail('');
      setRegCategory('dentist');
      setRegPlan('access');
      setRegStatus('active');
      setRegCro('');
      setRegPhone('');
      setIsRegModalOpen(false);
      
      flashSuccess('Aluno cadastrado manualmente com sucesso!');
    } catch (error) {
      console.error(error);
      flashError('Erro ao cadastrar aluno manualmente.');
    }
  };

  const handleGenerateWhatsAppInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName || !invPhone) {
      flashError('Nome e Telefone WhatsApp são obrigatórios!');
      return;
    }
    try {
      const inviteCode = Math.random().toString(36).substring(2, 11).toUpperCase();
      const payload = {
        name: invName,
        email: invEmail || '',
        category: invCategory,
        plan: invPlan,
        phone: invPhone,
        cro: invCro || '',
        inviteCode,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'academy_invites'), payload);
      
      await logAdminAction(
        'Convite Criado',
        invName,
        `Convite WhatsApp para o plano ${invPlan} (${invCategory})`
      );
      
      // Build WhatsApp share message
      const text = `Olá, *${invName}*! %0A%0AVocê foi selecionado e convidado para fazer parte do *Maxilo Pro Academy* como aluno do plano *${invPlan === 'experience' ? 'Experience (Completo)' : 'Access'}*.%0A%0AAcesse a plataforma para concluir seu cadastro exclusivo:%0A👉 https://app.andreonimaxilofacial.com.br/%23/academy-register?invite=${inviteCode}%0A%0ASeja muito bem-vindo!`;
      
      const cleanPhone = invPhone.replace(/\D/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${text}`;
      
      setInviteLinkUrl(waUrl);
    } catch (error) {
      console.error(error);
      flashError('Erro ao gerar convite.');
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const userRef = doc(db, 'academy_users', selectedUser.uid);
      await updateDoc(userRef, {
        displayName: editName,
        email: editEmail,
        academyCategory: editCategory,
        academyPlan: editPlan,
        academyStatus: editStatus,
        academyCRO: editCro,
        phone: editPhone,
        updatedAt: new Date().toISOString()
      });
      
      await logAdminAction(
        'Edição de Aluno',
        editName,
        `Dados cadastrais atualizados via formulário`
      );
      
      setIsEditModalOpen(false);
      setSelectedUser(null);
      flashSuccess('Cadastro atualizado com sucesso!');
    } catch (error) {
      console.error(error);
      flashError('Erro ao salvar edições.');
    }
  };

  // Lives Actions
  const handleSaveLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveTitle || !liveUrl || !liveDate || !liveTime) {
      flashError('Por favor preencha todos os campos obrigatórios.');
      return;
    }

    const payload = {
      title: liveTitle,
      description: liveDesc,
      videoUrl: liveUrl,
      embedUrl: generateEmbedUrl(liveUrl, livePlatform) || '',
      platform: livePlatform,
      status: liveStatus,
      date: liveDate,
      time: liveTime,
      isLesson,
      createdAt: editingLive ? editingLive.createdAt : serverTimestamp()
    };

    try {
      if (editingLive) {
        await updateDoc(doc(db, 'academy_lives', editingLive.id), payload);
        flashSuccess('Transmissão atualizada com sucesso!');
        setEditingLive(null);
      } else {
        await addDoc(collection(db, 'academy_lives'), payload);
        flashSuccess('Transmissão adicionada!');
      }
      // Reset
      setLiveTitle('');
      setLiveDesc('');
      setLiveUrl('');
      setLiveDate('');
      setLiveTime('');
      setLivePlatform('youtube');
      setLiveStatus('scheduled');
      setIsLesson(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'academy_lives');
      flashError('Erro ao salvar transmissão.');
    }
  };

  const startEditLive = (item: AcademyLive) => {
    setEditingLive(item);
    setLiveTitle(item.title);
    setLiveDesc(item.description);
    setLiveUrl(item.videoUrl);
    setLiveDate(item.date);
    setLiveTime(item.time);
    setLivePlatform(item.platform);
    setLiveStatus(item.status);
    setIsLesson(item.isLesson);
  };

  const handleDeleteLive = async (id: string) => {
    if (!confirm('Excluir esta transmissão do Academy?')) return;
    try {
      await deleteDoc(doc(db, 'academy_lives', id));
      flashSuccess('Transmissão excluída.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `academy_lives/${id}`);
    }
  };

  // Library Actions
  const handleSaveLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!libTitle || !libLink) {
      flashError('Título e link do material são obrigatórios.');
      return;
    }

    const payload = {
      title: libTitle,
      description: libDesc,
      category: libCat,
      type: libType,
      link: libLink,
      createdAt: editingLib ? editingLib.createdAt : serverTimestamp()
    };

    try {
      if (editingLib) {
        await updateDoc(doc(db, 'academy_library', editingLib.id), payload);
        flashSuccess('Material atualizado!');
        setEditingLib(null);
      } else {
        await addDoc(collection(db, 'academy_library'), payload);
        flashSuccess('Material adicionado!');
      }
      setLibTitle('');
      setLibDesc('');
      setLibCat('trauma');
      setLibType('pdf');
      setLibLink('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'academy_library');
    }
  };

  const startEditLib = (item: AcademyLibraryItem) => {
    setEditingLib(item);
    setLibTitle(item.title);
    setLibDesc(item.description || '');
    setLibCat(item.category);
    setLibType(item.type);
    setLibLink(item.link);
  };

  const handleDeleteLib = async (id: string) => {
    if (!confirm('Excluir material da biblioteca?')) return;
    try {
      await deleteDoc(doc(db, 'academy_library', id));
      flashSuccess('Material excluído!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `academy_library/${id}`);
    }
  };

  // Agenda Events Actions
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle || !eventDate || !eventTime) return;

    const payload = {
      title: eventTitle,
      description: eventDesc,
      date: eventDate,
      time: eventTime,
      link: eventLink,
      createdAt: editingEvent ? editingEvent.createdAt : serverTimestamp()
    };

    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'academy_events', editingEvent.id), payload);
        flashSuccess('Evento atualizado!');
        setEditingEvent(null);
      } else {
        await addDoc(collection(db, 'academy_events'), payload);
        flashSuccess('Evento adicionado!');
      }
      setEventTitle('');
      setEventDesc('');
      setEventDate('');
      setEventTime('');
      setEventLink('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'academy_events');
    }
  };

  const startEditEvent = (item: AcademyEvent) => {
    setEditingEvent(item);
    setEventTitle(item.title);
    setEventDesc(item.description);
    setEventDate(item.date);
    setEventTime(item.time);
    setEventLink(item.link || '');
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Remover evento do calendário?')) return;
    try {
      await deleteDoc(doc(db, 'academy_events', id));
      flashSuccess('Evento excluído.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `academy_events/${id}`);
    }
  };

  // Announcements Actions
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annContent) return;

    const payload = {
      title: annTitle,
      content: annContent,
      authorName: user.displayName,
      date: new Date().toISOString().split('T')[0],
      createdAt: editingAnn ? editingAnn.createdAt : serverTimestamp()
    };

    try {
      if (editingAnn) {
        await updateDoc(doc(db, 'academy_announcements', editingAnn.id), payload);
        flashSuccess('Aviso atualizado!');
        setEditingAnn(null);
      } else {
        await addDoc(collection(db, 'academy_announcements'), payload);
        flashSuccess('Aviso lançado!');
      }
      setAnnTitle('');
      setAnnContent('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'academy_announcements');
    }
  };

  const startEditAnn = (item: AcademyAnnouncement) => {
    setEditingAnn(item);
    setAnnTitle(item.title);
    setAnnContent(item.content);
  };

  const handleDeleteAnn = async (id: string) => {
    if (!confirm('Remover comunicado?')) return;
    try {
      await deleteDoc(doc(db, 'academy_announcements', id));
      flashSuccess('Comunicado removido.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `academy_announcements/${id}`);
    }
  };

  // Review Observational Visit Request
  const handleReviewRequest = async (status: 'approved' | 'rejected') => {
    if (!editingRequest) return;
    try {
      await updateDoc(doc(db, 'academy_observational_requests', editingRequest.id), {
        status,
        adminNotes: reqNotes,
        scheduledDateTime: reqDateTime || null
      });
      flashSuccess('Solicitação analisada e status atualizado!');
      setEditingRequest(null);
      setReqNotes('');
      setReqDateTime('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `academy_observational_requests/${editingRequest.id}`);
    }
  };

  // Filter subscribers safely client-side
  const academySubscribers = academyUsers;

  // Combine registered academy users and pending invites
  const combinedRoster = [
    ...academyUsers.map(u => ({ ...u, isRegistered: true })),
    ...academyInvites.filter(i => i.status === 'pending').map(i => ({
      uid: i.id,
      displayName: i.name,
      email: i.email || 'Sem e-mail',
      academyCategory: i.category,
      academyPlan: i.plan,
      academyStatus: 'inactive',
      cro: i.cro || '',
      phone: i.phone || '',
      origin: 'whatsapp',
      isRegistered: false,
      createdAt: i.createdAt
    }))
  ];

  // Filter users lists
  const filteredUsers = combinedRoster.filter(u => {
    const search = userSearch.toLowerCase();
    return (u.displayName || '').toLowerCase().includes(search) || 
           (u.email || '').toLowerCase().includes(search) ||
           (u.phone || '').toLowerCase().includes(search);
  });

  const activeCount = academyUsers.filter(u => u.academyStatus === 'active').length;
  const accessPlanCount = academyUsers.filter(u => u.academyPlan === 'access').length;
  const expPlanCount = academyUsers.filter(u => u.academyPlan === 'experience').length;
  const dentistCount = academyUsers.filter(u => u.academyCategory === 'dentist').length;
  const studentCount = academyUsers.filter(u => u.academyCategory === 'student').length;
  const pendingRequestsCount = obsRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Academy Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-brand-dark p-8 md:p-10 rounded-[32px] md:rounded-[40px] border border-brand-gold/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Crown size={180} className="text-brand-gold" />
        </div>
        <div className="relative z-10">
          <span className="text-[9px] font-black uppercase text-brand-gold tracking-[0.25em] block mb-2">Maxilo Pro Academy</span>
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest leading-none">Painel de Administração</h2>
          <p className="text-[10px] md:text-xs text-gray-400 font-bold mt-1.5 uppercase tracking-wide">Plataforma Exclusiva de Ensino e Educação Continuada</p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2.5">
          <button 
            onClick={() => {
              sessionStorage.setItem('academy_preview_mode', 'true');
              window.dispatchEvent(new Event('academy_preview_changed'));
              navigate('/academy');
            }}
            className="flex items-center gap-2 px-5 py-3 bg-brand-gold hover:bg-brand-gold/90 text-brand-dark rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-md"
          >
            <UserCheck size={14} />
            Ver como Aluno
          </button>
          <button 
            onClick={() => {
              sessionStorage.setItem('workspace_context', 'residency');
              sessionStorage.removeItem('academy_preview_mode');
              window.dispatchEvent(new Event('academy_preview_changed'));
              navigate('/admin');
            }}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 text-brand-gold rounded-xl font-black uppercase text-[10px] tracking-widest border border-brand-gold/20 transition-all active:scale-95 shadow-md"
          >
            <ArrowLeft size={12} />
            Voltar p/ Residência
          </button>
        </div>
      </div>

      {/* Upper sub tabs */}
      <div className="flex bg-gray-50 p-2 rounded-2xl overflow-x-auto gap-2 border border-gray-100">
        {[
          { id: 'dashboard', label: 'Métricas', icon: LayoutDashboard },
          { id: 'users', label: 'Alunos & Planos', icon: Users },
          { id: 'lives', label: 'Gerenciar Lives', icon: Video },
          { id: 'library', label: 'Biblioteca', icon: BookOpen },
          { id: 'events', label: 'Calendário/Agenda', icon: CalendarIcon },
          { id: 'announcements', label: 'Avisos Academy', icon: Megaphone },
          { id: 'requests', label: 'Visitas Experiência', icon: MapPin },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveSubTab(tab.id as 'dashboard' | 'users' | 'lives' | 'library' | 'events' | 'announcements' | 'requests');
              setSuccessMsg(null);
              setErrorMsg(null);
            }}
            className={`flex items-center gap-2 shrink-0 py-3.5 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeSubTab === tab.id 
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
          {errorMsg ? <AlertCircle className="mr-3" size={16} /> : <Check className="mr-3" size={16} />}
          {errorMsg || successMsg}
        </div>
      )}

      {/* --- SUBTAB: DASHBOARD --- */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-8 animate-fade-in">
          {/* Summary Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {/* Card 1: Subscribers */}
            <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="bg-brand-gold/10 p-3 rounded-xl text-brand-gold">
                  <Users size={18} />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Ativos: {activeCount}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total Alunos</p>
                <p className="text-2xl font-black text-brand-dark mt-1">{academySubscribers.length}</p>
              </div>
            </div>

            {/* Card 2: Plan Breakdown */}
            <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="bg-brand-gold/10 p-3 rounded-xl text-brand-gold">
                  <Crown size={18} />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-brand-gold">Planos</span>
              </div>
              <div className="mt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Experience / Access</p>
                <p className="text-xl font-black text-brand-dark mt-1">
                  {expPlanCount} <span className="text-gray-300 font-normal">/</span> {accessPlanCount}
                </p>
              </div>
            </div>

            {/* Card 3: Library Materials */}
            <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="bg-brand-gold/10 p-3 rounded-xl text-brand-gold">
                  <BookOpen size={18} />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Biblioteca</span>
              </div>
              <div className="mt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Materiais Digitais</p>
                <p className="text-2xl font-black text-brand-dark mt-1">{library.length}</p>
              </div>
            </div>

            {/* Card 4: Upcoming Lives */}
            <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="bg-brand-gold/10 p-3 rounded-xl text-brand-gold">
                  <Video size={18} />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  Transmissões
                </span>
              </div>
              <div className="mt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Aulas & Lives</p>
                <p className="text-2xl font-black text-brand-dark mt-1">{lives.length}</p>
              </div>
            </div>
          </div>

          {/* Details sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left side: Subscribers demographics */}
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <h3 className="font-black text-brand-dark text-xs uppercase tracking-widest flex items-center gap-2 mb-6">
                <BarChart3 size={16} className="text-brand-gold" />
                Composição do Academy
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-gray-400 mb-1.5">
                    <span>Dentistas ({dentistCount})</span>
                    <span>{academySubscribers.length ? Math.round((dentistCount / academySubscribers.length) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-gold rounded-full" style={{ width: `${academySubscribers.length ? (dentistCount / academySubscribers.length) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-gray-400 mb-1.5">
                    <span>Acadêmicos ({studentCount})</span>
                    <span>{academySubscribers.length ? Math.round((studentCount / academySubscribers.length) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-dark rounded-full" style={{ width: `${academySubscribers.length ? (studentCount / academySubscribers.length) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <span>Plano Experience Elegível Visita</span>
                  <span className="text-brand-gold">{expPlanCount} Membros</span>
                </div>
              </div>
            </div>

            {/* Right side: Action overview */}
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-black text-brand-dark text-xs uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Star size={16} className="text-brand-gold" />
                  Próximos Passos & Operações
                </h3>
                <p className="text-xs text-gray-400 font-bold leading-relaxed">
                  Utilize as abas acima para realizar a gestão completa do Maxilo Pro Academy. Publique novos materiais didáticos na Biblioteca, agende transmissões ao vivo de cirurgias ou libere Aulas do Mês, e analise as solicitações de Visitas de Experiência feitas pelos alunos do plano premium.
                </p>
              </div>

              {pendingRequestsCount > 0 && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-500 text-white p-2 rounded-xl">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Atenção!</p>
                      <p className="text-[9px] font-bold text-amber-600 uppercase mt-0.5">Há {pendingRequestsCount} solicitação(ões) de visita pendente(s).</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveSubTab('requests')}
                    className="px-3.5 py-1.5 bg-brand-dark text-brand-gold font-black uppercase text-[8px] tracking-widest rounded-lg"
                  >
                    Analisar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB: USERS --- */}
      {activeSubTab === 'users' && (
        <div className="space-y-8">
          {/* Top Panel with Search and Actions */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
            <div className="space-y-1">
              <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest flex items-center gap-2">
                <Crown size={18} className="text-brand-gold animate-pulse" />
                Gerenciamento de Assinantes Academy
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Aprove, mude planos e acompanhe convites do ecossistema.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full xl:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Buscar nome, e-mail ou WhatsApp..."
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-gold/20"
                />
              </div>

              <button
                onClick={() => setIsRegModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-brand-dark border border-brand-gold/30 hover:border-brand-gold text-brand-gold rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all active:scale-95 shadow-md shrink-0"
              >
                <Plus size={14} />
                Reg. Manual
              </button>

              <button
                onClick={() => {
                  setInviteLinkUrl('');
                  setIsInviteModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all active:scale-95 shadow-md shrink-0"
              >
                <Smartphone size={14} />
                WhatsApp Invite
              </button>
            </div>
          </div>

          {/* Combined Roster of Registered and Invited students */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h4 className="font-black text-brand-dark uppercase text-xs tracking-widest">
                Alunos Ativos e Convites ({filteredUsers.length})
              </h4>
              <span className="text-[9px] text-gray-400 font-bold uppercase">
                Atualizado em tempo real
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredUsers.map(subscriber => {
                const isReg = subscriber.isRegistered;
                return (
                  <div 
                    key={subscriber.uid} 
                    className={`bg-white p-6 rounded-[32px] border ${isReg ? 'border-gray-100 hover:border-brand-gold/20' : 'border-amber-200/60 bg-amber-50/20'} shadow-sm flex flex-col justify-between gap-5 transition-all duration-300 relative overflow-hidden`}
                  >
                    {!isReg && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500/10 to-transparent w-24 h-24 rounded-bl-full pointer-events-none" />
                    )}

                    {/* Card Header details */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border ${subscriber.academyPlan === 'experience' ? 'border-brand-gold ring-2 ring-brand-gold/20' : 'border-gray-200'} flex-shrink-0 relative`}>
                          <img 
                            src={subscriber.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(subscriber.displayName)}&background=${subscriber.academyPlan === 'experience' ? 'dfb76c' : '1e1e1e'}&color=fff`} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-brand-dark text-sm leading-tight">{subscriber.displayName}</h4>
                            {subscriber.academyPlan === 'experience' && (
                              <Crown size={12} className="text-brand-gold flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold mt-0.5">{subscriber.email}</p>
                          {subscriber.phone && (
                            <p className="text-[9px] text-gray-500 font-semibold mt-1 flex items-center gap-1">
                              <Smartphone size={10} className="text-emerald-500" />
                              {subscriber.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Top Right deletion actions */}
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            setSelectedUser(subscriber);
                            setEditName(subscriber.displayName);
                            setEditEmail(subscriber.email);
                            setEditCategory(subscriber.academyCategory || 'dentist');
                            setEditPlan(subscriber.academyPlan || 'access');
                            setEditStatus(subscriber.academyStatus || 'active');
                            setEditCro(subscriber.cro || '');
                            setEditPhone(subscriber.phone || '');
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-brand-gold rounded-lg hover:bg-gray-50 transition-colors"
                          title="Editar Cadastro"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(subscriber.uid, !isReg)}
                          className="p-2 text-red-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Roster Badges Row */}
                    <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-gray-50">
                      {/* Origin badge */}
                      <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-md border ${
                        subscriber.origin === 'whatsapp' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : subscriber.origin === 'manual'
                          ? 'bg-sky-50 text-sky-700 border-sky-100'
                          : 'bg-purple-50 text-purple-700 border-purple-100'
                      }`}>
                        Origem: {subscriber.origin || 'Plataforma'}
                      </span>

                      {/* Level Badge */}
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-md border ${
                        subscriber.academyCategory === 'student'
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                      }`}>
                        {subscriber.academyCategory === 'student' ? 'Acadêmico' : 'Dentista'}
                      </span>

                      {/* Plan Badge */}
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-md border ${
                        subscriber.academyPlan === 'experience'
                          ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/20'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        Plano: {subscriber.academyPlan || 'Access'}
                      </span>

                      {/* Status / Invite Badge */}
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-md border ${
                        !isReg 
                          ? 'bg-amber-50 text-amber-700 border-amber-100' 
                          : subscriber.academyStatus === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-gray-50 text-gray-400 border-gray-100'
                      }`}>
                        {!isReg ? 'Convite Pendente' : subscriber.academyStatus === 'active' ? 'Ativo' : 'Inativo'}
                      </span>

                      {/* CRO Tooltip badge if present */}
                      {subscriber.cro && (
                        <span className="text-[8px] font-black uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-100 px-2 py-1 rounded-md">
                          CRO: {subscriber.cro}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="col-span-2 bg-gray-50 rounded-[32px] p-12 text-center border border-dashed border-gray-200">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nenhum cadastrado ou convite correspondente encontrado</p>
                </div>
              )}
            </div>
          </div>

          {/* Premium Audit Logs History Panel */}
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-50 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-brand-dark text-brand-gold p-2 rounded-xl">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="font-black text-brand-dark uppercase text-xs tracking-widest">Log de Auditoria & Ações do Admin</h4>
                  <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Histórico completo de alterações cadastrais e convites</p>
                </div>
              </div>
              <span className="text-[8px] font-black uppercase tracking-wider bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                {academyAdminActions.length} Registros
              </span>
            </div>

            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto pr-2 space-y-3">
              {academyAdminActions.slice(0, 15).map(log => (
                <div key={log.id} className="pt-3 flex items-start justify-between gap-4 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="bg-gray-50 p-2 rounded-lg text-gray-400 mt-0.5 flex-shrink-0">
                      <Info size={12} />
                    </div>
                    <div>
                      <p className="font-black text-brand-dark uppercase text-[10px] tracking-wider">
                        {log.action} <span className="text-gray-300 mx-1">|</span> <span className="text-brand-gold normal-case font-bold">{log.target}</span>
                      </p>
                      <p className="text-[9px] text-gray-500 font-medium mt-0.5">{log.details}</p>
                      <p className="text-[8px] text-gray-400 font-bold uppercase mt-1">
                        Executado por: <span className="text-gray-600">{log.adminName}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[8px] font-black uppercase text-gray-400 whitespace-nowrap mt-1">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : 'Agora'}
                  </span>
                </div>
              ))}

              {academyAdminActions.length === 0 && (
                <div className="text-center py-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Nenhum registro de alteração cadastrado no momento.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB: LIVES & VIDEOS --- */}
      {activeSubTab === 'lives' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-dark">
              {editingLive ? 'Editar Vídeo' : 'Cadastrar Vídeo/Live'}
            </h3>
            
            <form onSubmit={handleSaveLive} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Título</label>
                <input 
                  type="text" 
                  value={liveTitle} 
                  onChange={e => setLiveTitle(e.target.value)}
                  placeholder="Título do Replay ou Live"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Descrição</label>
                <textarea 
                  value={liveDesc} 
                  onChange={e => setLiveDesc(e.target.value)}
                  placeholder="Resumo técnico do caso..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-medium outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Link do Vídeo (YouTube/Vimeo)</label>
                <input 
                  type="text" 
                  value={liveUrl} 
                  onChange={e => setLiveUrl(e.target.value)}
                  placeholder="Link completo"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Data</label>
                  <input 
                    type="date" 
                    value={liveDate} 
                    onChange={e => setLiveDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Hora</label>
                  <input 
                    type="time" 
                    value={liveTime} 
                    onChange={e => setLiveTime(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Plataforma</label>
                  <select 
                    value={livePlatform} 
                    onChange={e => setLivePlatform(e.target.value as 'youtube' | 'vimeo' | 'other')}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="vimeo">Vimeo</option>
                    <option value="other">Outra</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Status</label>
                  <select 
                    value={liveStatus} 
                    onChange={e => setLiveStatus(e.target.value as 'scheduled' | 'live' | 'ended')}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                  >
                    <option value="scheduled">Agendado</option>
                    <option value="live">Ao Vivo</option>
                    <option value="ended">Encerrado</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group pt-2">
                <input 
                  type="checkbox" 
                  checked={isLesson} 
                  onChange={e => setIsLesson(e.target.checked)} 
                  className="w-4 h-4 accent-brand-gold rounded"
                />
                <span className="text-[9px] font-black uppercase text-gray-400 group-hover:text-brand-dark transition-colors">Aula Magna do Mês</span>
              </label>

              <button 
                type="submit" 
                className="w-full bg-brand-dark text-brand-gold py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-dark/10"
              >
                {editingLive ? 'Salvar Edição' : 'Cadastrar Transmissão'}
              </button>

              {editingLive && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingLive(null);
                    setLiveTitle('');
                    setLiveDesc('');
                    setLiveUrl('');
                    setLiveDate('');
                    setLiveTime('');
                  }}
                  className="w-full bg-gray-100 text-gray-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest"
                >
                  Cancelar Edição
                </button>
              )}
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-dark">Transmissões Cadastradas</h3>
            <div className="grid grid-cols-1 gap-4">
              {lives.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 flex items-center justify-between shadow-sm group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-brand-gold">
                      {extractYoutubeId(item.videoUrl) ? (
                        <img src={`https://img.youtube.com/vi/${extractYoutubeId(item.videoUrl)}/mqdefault.jpg`} className="w-full h-full object-cover" />
                      ) : (
                        <Video size={18} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-brand-dark truncate">{item.title}</h4>
                      <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase">
                        {item.date.split('-').reverse().join('/')} • {item.time}h • {item.isLesson ? 'AULA MAGNA' : 'REPLAY CIRÚRGICO'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => startEditLive(item)}
                      className="p-2.5 text-gray-400 hover:text-brand-gold bg-gray-50 rounded-lg"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteLive(item.id)}
                      className="p-2.5 text-red-300 hover:text-red-500 bg-red-50/50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {lives.length === 0 && (
                <div className="py-12 bg-gray-50 text-center rounded-[32px] border border-dashed border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Nenhuma live ou replay cirúrgico cadastrado
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB: LIBRARY --- */}
      {activeSubTab === 'library' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-dark">
              {editingLib ? 'Editar Material' : 'Novo Material Biblioteca'}
            </h3>
            
            <form onSubmit={handleSaveLibrary} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Título do Material</label>
                <input 
                  type="text" 
                  value={libTitle} 
                  onChange={e => setLibTitle(e.target.value)}
                  placeholder="Título"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Descrição</label>
                <textarea 
                  value={libDesc} 
                  onChange={e => setLibDesc(e.target.value)}
                  placeholder="Breve descrição ou escopo do material..."
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-medium outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Categoria</label>
                  <select 
                    value={libCat} 
                    onChange={e => setLibCat(e.target.value as 'trauma' | 'ortognatica' | 'estetica' | 'atm' | 'outros')}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                  >
                    <option value="trauma">Trauma</option>
                    <option value="ortognatica">Ortognática</option>
                    <option value="estetica">Estética</option>
                    <option value="atm">ATM</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Tipo</label>
                  <select 
                    value={libType} 
                    onChange={e => setLibType(e.target.value as 'pdf' | 'book' | 'video' | 'protocol')}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                  >
                    <option value="pdf">PDF</option>
                    <option value="book">Livro</option>
                    <option value="video">Vídeo</option>
                    <option value="protocol">Diretriz</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Link (Drive ou Externo)</label>
                <input 
                  type="text" 
                  value={libLink} 
                  onChange={e => setLibLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  required
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-brand-dark text-brand-gold py-4 rounded-xl font-black uppercase text-[10px] tracking-widest"
              >
                Salvar Material
              </button>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-dark">Biblioteca</h3>
            <div className="grid grid-cols-1 gap-4">
              {library.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 flex items-center justify-between shadow-sm">
                  <div>
                    <h4 className="font-bold text-xs text-brand-dark">{item.title}</h4>
                    <p className="text-[9px] text-brand-gold font-black mt-1 uppercase">
                      {item.type} • {item.category}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditLib(item)} className="p-2 text-gray-400 hover:text-brand-gold bg-gray-50 rounded-lg"><Edit2 size={14}/></button>
                    <button onClick={() => handleDeleteLib(item.id)} className="p-2 text-red-300 hover:text-red-500 bg-red-50/50 rounded-lg"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB: EVENTS --- */}
      {activeSubTab === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-dark">Novo Evento</h3>
            <form onSubmit={handleSaveEvent} className="space-y-4">
              <input type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Título do Evento" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none" required/>
              <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder="Resumo" rows={2} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-medium outline-none resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none" required/>
                <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none" required/>
              </div>
              <input type="text" value={eventLink} onChange={e => setEventLink(e.target.value)} placeholder="Link do Evento (Opcional)" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-medium outline-none" />
              <button type="submit" className="w-full bg-brand-dark text-brand-gold py-4 rounded-xl font-black uppercase text-[10px] tracking-widest">Salvar Evento</button>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-dark">Próximos Eventos</h3>
            <div className="grid grid-cols-1 gap-4">
              {events.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 flex items-center justify-between shadow-sm">
                  <div>
                    <h4 className="font-bold text-xs text-brand-dark">{item.title}</h4>
                    <p className="text-[9px] text-gray-400 font-bold mt-1">Data: {item.date.split('-').reverse().join('/')} às {item.time}h</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditEvent(item)} className="p-2 text-gray-400 hover:text-brand-gold bg-gray-50 rounded-lg"><Edit2 size={14}/></button>
                    <button onClick={() => handleDeleteEvent(item.id)} className="p-2 text-red-300 hover:text-red-500 bg-red-50/50 rounded-lg"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB: ANNOUNCEMENTS --- */}
      {activeSubTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-dark">Novo Aviso</h3>
            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <input type="text" value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Título" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none" required/>
              <textarea value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Mensagem" rows={4} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-medium outline-none resize-none" required/>
              <button type="submit" className="w-full bg-brand-dark text-brand-gold py-4 rounded-xl font-black uppercase text-[10px] tracking-widest">Lançar Comunicado</button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-dark">Comunicados Ativos</h3>
            <div className="grid grid-cols-1 gap-4">
              {announcements.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 flex items-center justify-between shadow-sm">
                  <div>
                    <h4 className="font-bold text-xs text-brand-dark">{item.title}</h4>
                    <p className="text-[9px] text-gray-400 mt-1 line-clamp-1 font-medium">{item.content}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditAnn(item)} className="p-2 text-gray-400 hover:text-brand-gold bg-gray-50 rounded-lg"><Edit2 size={14}/></button>
                    <button onClick={() => handleDeleteAnn(item.id)} className="p-2 text-red-300 hover:text-red-500 bg-red-50/50 rounded-lg"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB: REQUESTS --- */}
      {activeSubTab === 'requests' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Review Modal Panel (Only on selection) */}
          <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-dark flex items-center gap-2">
              <UserCheck size={16} className="text-brand-gold" />
              Análise de Solicitação
            </h3>
            
            {editingRequest ? (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-2xl p-4 text-xs font-bold space-y-1 border border-gray-100">
                  <p className="text-[9px] text-gray-400 uppercase">Solicitante</p>
                  <p className="text-brand-dark font-black">{editingRequest.userName}</p>
                  <p className="text-gray-500 text-[10px]">{editingRequest.userEmail}</p>
                  <p className="text-[9px] text-gray-400 uppercase pt-2">Data Sugerida</p>
                  <p className="text-brand-dark">{editingRequest.requestedDate.split('-').reverse().join('/')}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Data & Hora Agendada Oficial</label>
                  <input 
                    type="text" 
                    value={reqDateTime} 
                    onChange={e => setReqDateTime(e.target.value)}
                    placeholder="Ex: 14/10/2026 às 08:30"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Notas / Feedback do Prof. Andreoni</label>
                  <textarea 
                    value={reqNotes} 
                    onChange={e => setReqNotes(e.target.value)}
                    placeholder="Instruções para o dia da cirurgia..."
                    rows={4}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-medium outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => handleReviewRequest('approved')}
                    className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md"
                  >
                    Aprovar Visita
                  </button>
                  <button 
                    onClick={() => handleReviewRequest('rejected')}
                    className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md"
                  >
                    Não Viável
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 opacity-55 text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                Selecione uma solicitação da lista <br/> ao lado para analisar.
              </div>
            )}
          </div>

          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-black text-xs uppercase tracking-widest text-brand-dark">Lista de Solicitações</h3>
            <div className="grid grid-cols-1 gap-4">
              {obsRequests.map(req => (
                <button
                  key={req.id}
                  onClick={() => {
                    setEditingRequest(req);
                    setReqNotes(req.adminNotes || '');
                    setReqDateTime(req.scheduledDateTime || '');
                  }}
                  className={`bg-white p-5 rounded-3xl border text-left flex items-start justify-between shadow-sm transition-all ${
                    editingRequest?.id === req.id ? 'border-brand-gold shadow-md' : 'border-gray-100 hover:border-brand-gold/20'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h4 className="font-black text-brand-dark text-xs">{req.userName}</h4>
                      <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${
                        req.status === 'approved' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : req.status === 'rejected'
                          ? 'bg-red-50 text-red-600 border border-red-100'
                          : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        {req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">Data sugerida: {req.requestedDate.split('-').reverse().join('/')}</p>
                    <p className="text-[10px] text-gray-500 line-clamp-1 font-medium">{req.justification}</p>
                  </div>
                </button>
              ))}

              {obsRequests.length === 0 && (
                <div className="py-12 bg-gray-50 text-center rounded-[32px] border border-dashed border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Nenhuma solicitação de visita enviada até o momento
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: REGISTRO MANUAL --- */}
      {isRegModalOpen && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-2xl w-full max-w-md p-8 relative overflow-hidden">
            <button 
              onClick={() => setIsRegModalOpen(false)}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
            >
              <span className="font-bold text-sm">✕</span>
            </button>
            
            <div className="mb-6">
              <span className="text-[8px] font-black uppercase text-brand-gold tracking-[0.2em] block mb-1">Maxilo Pro Academy</span>
              <h3 className="text-lg font-black text-brand-dark uppercase tracking-wider">Registrar Aluno (Manual)</h3>
              <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">Cadastre diretamente na coleção de alunos externos.</p>
            </div>

            <form onSubmit={handleSaveManualRegister} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Nome Completo</label>
                <input 
                  type="text" 
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="Nome do Aluno"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">E-mail</label>
                <input 
                  type="email" 
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="email@dominio.com"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Nível</label>
                  <select 
                    value={regCategory}
                    onChange={e => setRegCategory(e.target.value as 'dentist' | 'student')}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                  >
                    <option value="dentist">Dentista</option>
                    <option value="student">Estudante</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Plano</label>
                  <select 
                    value={regPlan}
                    onChange={e => setRegPlan(e.target.value as 'access' | 'experience')}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                  >
                    <option value="access">Access</option>
                    <option value="experience">Experience</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">CRO (Opcional)</label>
                  <input 
                    type="text" 
                    value={regCro}
                    onChange={e => setRegCro(e.target.value)}
                    placeholder="CRO-UF"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">WhatsApp (Opcional)</label>
                  <input 
                    type="text" 
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value)}
                    placeholder="5511999999999"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Status do Acesso</label>
                <select 
                  value={regStatus}
                  onChange={e => setRegStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                >
                  <option value="active">Ativo (Acesso Liberado)</option>
                  <option value="inactive">Inativo (Acesso Bloqueado)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setIsRegModalOpen(false)}
                  className="w-1/2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="w-1/2 px-4 py-3 bg-brand-gold hover:bg-brand-gold/90 text-brand-dark rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shadow-md"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CONVITE WHATSAPP --- */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-2xl w-full max-w-md p-8 relative overflow-hidden">
            <button 
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
            >
              <span className="font-bold text-sm">✕</span>
            </button>
            
            <div className="mb-6">
              <span className="text-[8px] font-black uppercase text-emerald-500 tracking-[0.2em] block mb-1">WhatsApp Invite Flow</span>
              <h3 className="text-lg font-black text-brand-dark uppercase tracking-wider">Convidar via WhatsApp</h3>
              <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">Crie pré-convites e gere links compartilháveis.</p>
            </div>

            {inviteLinkUrl ? (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-2">
                  <p className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">✓ Convite gerado no banco!</p>
                  <p className="text-xs text-emerald-600 font-bold">O código de convite pré-salvo foi criado. Clique no botão abaixo para enviar a mensagem diretamente no WhatsApp do aluno.</p>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest mb-1.5 block">Prévia da Mensagem</p>
                  <p className="text-[10px] text-gray-600 font-mono whitespace-pre-wrap leading-relaxed">{decodeURIComponent(inviteLinkUrl.split('text=')[1] || '')}</p>
                </div>

                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setInviteLinkUrl('');
                      setInvName('');
                      setInvPhone('');
                    }}
                    className="w-1/2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
                  >
                    Novo Convite
                  </button>
                  <a 
                    href={inviteLinkUrl}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="w-1/2 text-center px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shadow-md inline-block flex items-center justify-center gap-1.5"
                  >
                    <Share2 size={12} />
                    Enviar WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGenerateWhatsAppInvite} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Nome Completo</label>
                  <input 
                    type="text" 
                    value={invName}
                    onChange={e => setInvName(e.target.value)}
                    placeholder="Nome do Aluno"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-emerald-600 tracking-widest block">WhatsApp (c/ DDD e código do país)</label>
                  <input 
                    type="tel" 
                    value={invPhone}
                    onChange={e => setInvPhone(e.target.value)}
                    placeholder="Ex: 5511999999999"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                    required
                  />
                  <span className="text-[8px] text-gray-400 font-bold block">Sempre inicie com o DDI do país. No Brasil, insira 55 no início.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">E-mail (Opcional)</label>
                  <input 
                    type="email" 
                    value={invEmail}
                    onChange={e => setInvEmail(e.target.value)}
                    placeholder="email@dominio.com"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Nível</label>
                    <select 
                      value={invCategory}
                      onChange={e => setInvCategory(e.target.value as 'dentist' | 'student')}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                    >
                      <option value="dentist">Dentista</option>
                      <option value="student">Estudante</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Plano</label>
                    <select 
                      value={invPlan}
                      onChange={e => setInvPlan(e.target.value as 'access' | 'experience')}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                    >
                      <option value="access">Access</option>
                      <option value="experience">Experience</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">CRO (Opcional)</label>
                  <input 
                    type="text" 
                    value={invCro}
                    onChange={e => setInvCro(e.target.value)}
                    placeholder="CRO-UF"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  />
                </div>

                <div className="pt-4 flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="w-1/2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
                  >
                    Fechar
                  </button>
                  <button 
                    type="submit"
                    className="w-1/2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shadow-md"
                  >
                    Gerar Convite
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: EDITAR ALUNO --- */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-2xl w-full max-w-md p-8 relative overflow-hidden">
            <button 
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedUser(null);
              }}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
            >
              <span className="font-bold text-sm">✕</span>
            </button>
            
            <div className="mb-6">
              <span className="text-[8px] font-black uppercase text-brand-gold tracking-[0.2em] block mb-1">Painel Cadastral</span>
              <h3 className="text-lg font-black text-brand-dark uppercase tracking-wider">Editar Informações</h3>
              <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">Atualize dados cadastrais do assinante.</p>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Nome Completo</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Nome do Aluno"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">E-mail</label>
                <input 
                  type="email" 
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="email@dominio.com"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Nível</label>
                  <select 
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value as 'dentist' | 'student')}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                  >
                    <option value="dentist">Dentista</option>
                    <option value="student">Estudante</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Plano</label>
                  <select 
                    value={editPlan}
                    onChange={e => setEditPlan(e.target.value as 'access' | 'experience')}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                  >
                    <option value="access">Access</option>
                    <option value="experience">Experience</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">CRO (Opcional)</label>
                  <input 
                    type="text" 
                    value={editCro}
                    onChange={e => setEditCro(e.target.value)}
                    placeholder="CRO-UF"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">WhatsApp (Opcional)</label>
                  <input 
                    type="text" 
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="5511999999999"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block">Status</label>
                <select 
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black uppercase outline-none"
                >
                  <option value="active">Ativo (Liberado)</option>
                  <option value="inactive">Inativo (Bloqueado)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedUser(null);
                  }}
                  className="w-1/2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="w-1/2 px-4 py-3 bg-brand-gold hover:bg-brand-gold/90 text-brand-dark rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shadow-md"
                >
                  Salvar Edição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CONFIRMAR EXCLUSÃO --- */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-2xl w-full max-w-sm p-8 relative overflow-hidden">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <Trash2 size={24} />
              </div>
              <div>
                <span className="text-[8px] font-black uppercase text-red-500 tracking-[0.2em] block mb-1">Atenção</span>
                <h3 className="text-lg font-black text-brand-dark uppercase tracking-wider">Confirmar Exclusão</h3>
                <p className="text-[10px] text-gray-500 font-bold mt-1.5 uppercase leading-relaxed">
                  Tem certeza que deseja excluir permanentemente o {deleteTarget.isInvite ? 'convite' : 'cadastro'} de <span className="text-red-600 font-black">{deleteTarget.name}</span>?
                </p>
                <p className="text-[9px] text-red-400 font-bold mt-1 uppercase">
                  Esta ação não poderá ser desfeita e removerá todos os dados do banco.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="w-1/2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={confirmDeleteUser}
                  className="w-1/2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shadow-md active:scale-95"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAcademy;
