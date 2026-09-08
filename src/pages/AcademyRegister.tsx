import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import Logo from '../components/Logo';
import {
  User,
  Mail,
  Lock,
  Phone,
  Hash,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

interface InviteData {
  id: string;
  name: string;
  email: string;
  category: 'dentist' | 'student';
  plan: 'access' | 'experience';
  phone: string;
  cro: string;
  inviteCode: string;
  status: string;
}

const AcademyRegister: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Route & Verification state
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteData | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cro, setCro] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Retrieve invite code from URL parameters safely
    const getInviteCode = () => {
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('invite');
      if (code) return code;

      const hashPart = window.location.hash;
      const match = hashPart.match(/[?&]invite=([^&]+)/);
      if (match) return match[1];

      return null;
    };

    const verifyInvite = async () => {
      const code = getInviteCode();
      if (!code) {
        setInviteError('Nenhum código de convite foi fornecido. Solicite um convite válido da coordenação.');
        setLoadingInvite(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'academy_invites'),
          where('inviteCode', '==', code.toUpperCase().trim()),
          limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setInviteError('Código de convite inválido, expirado ou não encontrado.');
          setLoadingInvite(false);
          return;
        }

        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data() as Omit<InviteData, 'id'>;

        if (data.status !== 'pending') {
          setInviteError('Este link de convite já foi utilizado ou foi desativado.');
          setLoadingInvite(false);
          return;
        }

        setInvite({
          id: docSnap.id,
          ...data
        });
        setEmail(data.email || '');
        setCro(data.cro || '');
      } catch (err) {
        console.error('Erro ao verificar convite:', err);
        setInviteError('Ocorreu um erro ao validar seu convite. Verifique sua conexão.');
      } finally {
        setLoadingInvite(false);
      }
    };

    verifyInvite();
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;

    if (!email.trim()) {
      setSubmitError('O campo de E-mail é obrigatório.');
      return;
    }
    if (password.length < 6) {
      setSubmitError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('As senhas digitadas não coincidem.');
      return;
    }
    if (invite.category === 'dentist' && !cro.trim()) {
      setSubmitError('O preenchimento do CRO é obrigatório para Dentistas.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1) Criar usuário no Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2) Criar documento na coleção global "users"
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: invite.name,
        email: email.trim().toLowerCase(),
        role: 'academy',
        status: 'approved', // Auto-aprovado via convite válido
        academyAccess: true,
        academyPlan: invite.plan,
        academyCategory: invite.category,
        academyCRO: cro.trim() || null,
        academyStatus: 'active',
        phone: invite.phone,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(invite.name)}&background=c89b3c&color=fff`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3) Criar documento na coleção "academy_users" para o ecossistema do AdminAcademy
      await setDoc(doc(db, 'academy_users', user.uid), {
        uid: user.uid,
        displayName: invite.name,
        email: email.trim().toLowerCase(),
        academyCategory: invite.category,
        academyPlan: invite.plan,
        academyStatus: 'active',
        academyCRO: cro.trim() || null,
        phone: invite.phone,
        origin: 'whatsapp',
        createdAt: new Date().toISOString()
      });

      // 4) Marcar convite como utilizado no banco de dados
      await updateDoc(doc(db, 'academy_invites', invite.id), {
        status: 'used',
        usedAt: new Date().toISOString(),
        usedBy: user.uid
      });

      // 5) Gravar log de auditoria no sistema do Academy
      await addDoc(collection(db, 'academy_admin_actions'), {
        action: 'Cadastro via Convite',
        target: invite.name,
        details: `Aluno cadastrado com sucesso via convite no plano ${invite.plan === 'experience' ? 'Experience' : 'Access'}`,
        adminName: 'Sistema (Convite)',
        timestamp: new Date().toISOString()
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 5000);
    } catch (err) {
      console.error('Erro ao realizar cadastro do Academy:', err);
      const firebaseError = err as { code?: string };
      if (firebaseError.code === 'auth/email-already-in-use') {
        setSubmitError('Este e-mail já está em uso por outro usuário.');
      } else if (firebaseError.code === 'auth/weak-password') {
        setSubmitError('Senha muito fraca. Escolha uma senha mais forte.');
      } else if (firebaseError.code === 'auth/invalid-email') {
        setSubmitError('Endereço de e-mail inválido.');
      } else {
        setSubmitError('Erro ao processar seu cadastro. Tente novamente ou contate o suporte.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-brand-dark text-white">
        <Logo size="lg" className="mb-8 animate-pulse" />
        <div className="text-brand-gold font-bold tracking-[0.3em] mb-4 text-[10px] uppercase opacity-70">VALIDANDO CONVITE ACADEMY</div>
        <div className="w-16 h-1 bg-brand-gold/15 rounded-full overflow-hidden">
          <div className="w-1/2 h-full bg-brand-gold animate-[loading_1s_infinite]"></div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        <div className="absolute left-[-20%] top-1/2 -translate-y-1/2 w-64 h-[80vh] opacity-20 gold-gradient rounded-full blur-3xl pointer-events-none"></div>
        <div className="w-full max-w-md z-10 bg-white/5 border border-white/10 rounded-[32px] p-8 md:p-10 space-y-6 text-center backdrop-blur-md shadow-2xl">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertCircle size={32} />
          </div>
          <div className="space-y-2">
            <span className="text-[9px] font-black uppercase text-red-400 tracking-[0.2em] block">Acesso Negado</span>
            <h2 className="text-2xl font-black text-white uppercase tracking-wide">Convite Inválido</h2>
            <p className="text-xs text-gray-400 font-medium leading-relaxed pt-2">
              {inviteError}
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-white/5 border border-white/10 text-white rounded-2xl py-4 font-bold hover:bg-white/10 transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
          >
            Ir para o Login <ArrowRight size={14} className="text-brand-gold" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
      <div className="absolute left-[-20%] top-1/2 -translate-y-1/2 w-64 h-[80vh] opacity-20 gold-gradient rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-lg z-10 space-y-8 my-8">
        <div className="flex items-center justify-center space-x-6">
          <Logo size="lg" className="shrink-0" />
          <div className="text-left">
            <h2 className="text-[9px] font-black tracking-[0.3em] text-brand-gold uppercase mb-1">Inscrição Exclusiva</h2>
            <h1 className="text-2xl font-black leading-tight tracking-tight uppercase">
              MAXILO PRO<br />
              <span className="text-brand-gold">ACADEMY</span>
            </h1>
          </div>
        </div>

        {success ? (
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 md:p-10 text-center space-y-6 backdrop-blur-md shadow-2xl animate-fade-in">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-2">
              <span className="text-[9px] font-black uppercase text-emerald-400 tracking-[0.2em] block">Sucesso</span>
              <h2 className="text-2xl font-black text-white uppercase tracking-wide">Cadastro Concluído!</h2>
              <p className="text-xs text-gray-400 font-semibold leading-relaxed pt-2">
                Parabéns, seu perfil no <span className="text-brand-gold font-bold">Maxilo Pro Academy</span> foi ativado instantaneamente.
              </p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pt-1">
                Redirecionando você para a tela de login em alguns instantes...
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full gold-gradient text-brand-dark rounded-2xl py-4 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl"
              >
                Acessar Plataforma Agora <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-10 space-y-6 backdrop-blur-md shadow-2xl animate-fade-in">
            <div className="space-y-1 pb-2 border-b border-white/5">
              <div className="flex items-center gap-1.5 text-brand-gold">
                <ShieldCheck size={14} />
                <span className="text-[8px] font-black uppercase tracking-[0.2em]">Convite Validado com Sucesso</span>
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-wider">Concluir Matrícula</h3>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                Olá, <span className="text-brand-gold font-bold">{invite?.name}</span>! Preencha as credenciais de login abaixo para ativar sua conta.
              </p>
            </div>

            {/* Badges do Plano e Categoria */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Plano Adquirido</p>
                <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${invite?.plan === 'experience' ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/30' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
                  {invite?.plan === 'experience' ? 'Experience (Completo)' : 'Access'}
                </span>
              </div>
              <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Categoria de Registro</p>
                <span className="inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-white border border-white/5">
                  {invite?.category === 'dentist' ? 'Dentista' : 'Estudante / Acadêmico'}
                </span>
              </div>
            </div>

            {submitError && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start text-red-400 text-xs font-semibold">
                <AlertCircle size={16} className="mr-2.5 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3.5">
                {/* Nome (Apenas visual, preenchido via convite) */}
                <div>
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block mb-1.5 ml-1">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      value={invite?.name}
                      disabled
                      type="text"
                      className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* WhatsApp (Visual, preenchido) */}
                <div>
                  <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest block mb-1.5 ml-1">WhatsApp cadastrado</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      value={invite?.phone}
                      disabled
                      type="text"
                      className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* E-mail (Editável se necessário) */}
                <div>
                  <label className="text-[8px] font-black uppercase text-brand-gold tracking-widest block mb-1.5 ml-1">E-mail de Login *</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={16} />
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      type="email"
                      required
                      placeholder="seu.email@exemplo.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-xs font-bold text-white focus:ring-1 focus:ring-brand-gold outline-none transition-all"
                    />
                  </div>
                </div>

                {/* CRO (Apenas se categoria for dentist) */}
                {invite?.category === 'dentist' && (
                  <div>
                    <label className="text-[8px] font-black uppercase text-brand-gold tracking-widest block mb-1.5 ml-1">Inscrição CRO *</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={16} />
                      <input
                        value={cro}
                        onChange={e => setCro(e.target.value)}
                        type="text"
                        required
                        placeholder="CRO-UF e Número (ex: CRO-SP 12345)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-xs font-bold text-white focus:ring-1 focus:ring-brand-gold outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Senha */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[8px] font-black uppercase text-brand-gold tracking-widest block mb-1.5 ml-1">Senha de Acesso *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={16} />
                      <input
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        type="password"
                        required
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-xs font-bold text-white focus:ring-1 focus:ring-brand-gold outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[8px] font-black uppercase text-brand-gold tracking-widest block mb-1.5 ml-1">Confirmar Senha *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={16} />
                      <input
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        type="password"
                        required
                        placeholder="Repita sua senha"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-xs font-bold text-white focus:ring-1 focus:ring-brand-gold outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full gold-gradient text-brand-dark rounded-xl py-4 font-black uppercase text-xs tracking-widest mt-6 flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-95 transition-all shadow-lg"
              >
                {submitting ? (
                  <span>Criando Conta...</span>
                ) : (
                  <>
                    <UserCheck size={16} />
                    <span>Concluir Inscrição e Acessar</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademyRegister;
