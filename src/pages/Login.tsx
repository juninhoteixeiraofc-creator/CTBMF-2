import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { mockTurmas } from '../services/mockData';
import { AppUser } from '../types';
import Logo from '../components/Logo';
import {
  UserPlus,
  LogIn,
  ChevronLeft,
  ArrowRight,
  Mail,
  User,
  Lock,
  AlertCircle
} from 'lucide-react';

interface LoginProps {
  onLogin: (user: AppUser) => void;
}

const Login: React.FC<LoginProps> = () => {
  const [view, setView] = useState<'initial' | 'login' | 'register'>('initial');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [turma, setTurma] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !name || !turma) {
      setError("Preencha todos os campos");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const inferredLevel = turma.startsWith('r1') ? 'R1' : 
                           turma.startsWith('r2') ? 'R2' : 
                           turma.startsWith('r3') ? 'R3' : 'R1';

      // 1) Criar/atualizar perfil do usuário em users/{uid}
      const setDocPromise = setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          displayName: name,
          email: user.email,
          role: "student",
          status: "pending",
          turma_id: turma,
          residencyLevel: inferredLevel,
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=c89b3c&color=fff`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 10000)
      );

      try {
        await Promise.race([setDocPromise, timeoutPromise]);
      } catch (err: unknown) {
        const error = err as { message?: string };
        if (error.message === 'timeout') {
          setError("Tempo de resposta excedido ao criar perfil. Verifique sua conexão ou se o banco de dados está ativo.");
          setLoading(false);
          return;
        }
        throw err;
      }

      // 2) Criar solicitação em access_requests/{autoId}
      await addDoc(collection(db, "access_requests"), {
        uid: user.uid,
        displayName: name,
        email: user.email,
        turma_id: turma,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      alert("Solicitação enviada! Aguarde a aprovação do coordenador para acessar o portal.");
      setView('initial');

      // opcional: desloga até aprovar (mais didático)
      await auth.signOut();
    } catch (err: unknown) {
      console.error("Erro no cadastro:", err);
      const firebaseError = err as { code?: string };

      if (firebaseError?.code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso.");
      } else if (firebaseError?.code === "auth/weak-password") {
        setError("Senha muito fraca. Use pelo menos 6 caracteres.");
      } else if (firebaseError?.code === "auth/invalid-email") {
        setError("E-mail inválido.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      let userDoc = await getDoc(userDocRef);
      
      // Se não encontrar no banco nomeado, tenta no padrão
      if (!userDoc.exists()) {
        console.log('[LOGIN] Usuário não encontrado no banco nomeado, tentando banco padrão...');
        const userDocDefault = await getDoc(doc(dbDefault, "users", user.uid));
        if (userDocDefault.exists()) {
          userDoc = userDocDefault;
        }
      }

      if (!userDoc.exists()) {
        setError("Seu perfil ainda não foi criado no sistema. Solicite matrícula novamente.");
        await auth.signOut();
        return;
      }

      const userData = userDoc.data() as AppUser;

      if (userData.status === 'pending') {
        setError("Seu acesso ainda está pendente de aprovação pela coordenação.");
        await auth.signOut();
        return;
      }

      if (userData.status === 'blocked') {
        setError("Este acesso foi desativado. Entre em contato com o suporte.");
        await auth.signOut();
        return;
      }

    } catch (err: unknown) {
      console.error("Erro no login:", err);
      const error = err as { code?: string };
      
      if (error?.code === 'auth/user-not-found' || 
          error?.code === 'auth/wrong-password' || 
          error?.code === 'auth/invalid-credential') {
        setError("E-mail ou senha inválidos.");
      } else {
        setError("Erro ao autenticar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderInitial = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3">
        <button
          onClick={() => { setError(null); setView('register'); }}
          className="w-full gold-gradient text-brand-dark rounded-2xl py-4 px-6 flex items-center justify-center space-x-3 font-black shadow-2xl active:scale-95 transition-all uppercase text-xs tracking-widest"
        >
          <UserPlus size={18} />
          <span>Solicitar Matrícula</span>
        </button>

        <button
          onClick={() => { setError(null); setView('login'); }}
          className="w-full bg-white/5 border border-white/10 text-white rounded-2xl py-4 px-6 flex items-center justify-center space-x-3 font-bold active:scale-95 transition-all uppercase text-[10px] tracking-widest"
        >
          <LogIn size={16} className="text-brand-gold" />
          <span>Entrar no Portal</span>
        </button>
      </div>

      <div className="pt-6 border-t border-white/5 text-center">
        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-black">
          Acesso exclusivo para residentes do Instituto Andreoni
        </p>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={() => setView('initial')}
        className="flex items-center text-brand-gold text-[10px] font-black uppercase tracking-[0.2em] mb-4"
      >
        <ChevronLeft size={16} className="mr-1" /> Voltar
      </button>

      <form onSubmit={handleRegister} className="space-y-4">
        <h3 className="text-xl font-bold">Nova Matrícula</h3>
        <p className="text-xs text-gray-400 font-medium leading-relaxed">
          Preencha os dados abaixo. Seu acesso será liberado após conferência da coordenação.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center text-red-400 text-[10px] font-bold uppercase tracking-wider">
            <AlertCircle size={14} className="mr-2 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={16} />
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              type="text"
              placeholder="Nome Completo"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-white focus:ring-1 focus:ring-brand-gold outline-none transition-all"
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={16} />
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="E-mail"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-white focus:ring-1 focus:ring-brand-gold outline-none transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={16} />
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="Senha de acesso (mín. 6)"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-white focus:ring-1 focus:ring-brand-gold outline-none transition-all"
            />
          </div>

          <select
            value={turma}
            onChange={e => setTurma(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold focus:ring-1 focus:ring-brand-gold outline-none appearance-none text-gray-300"
          >
            <option value="">Selecione sua Turma</option>
            {mockTurmas.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full gold-gradient text-brand-dark rounded-xl py-4 font-black uppercase text-xs tracking-widest mt-4 flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {loading ? <span>Enviando...</span> : (
            <>
              <span>Solicitar Acesso</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </div>
  );

  const renderLogin = () => (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={() => setView('initial')}
        className="flex items-center text-brand-gold text-[10px] font-black uppercase tracking-[0.2em] mb-4"
      >
        <ChevronLeft size={16} className="mr-1" /> Voltar
      </button>

      <form onSubmit={handleLogin} className="space-y-4">
        <h3 className="text-xl font-bold">Acesso ao Portal</h3>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center text-red-400 text-[10px] font-bold uppercase tracking-wider">
            <AlertCircle size={14} className="mr-2 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3 pt-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={16} />
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="E-mail institucional"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-brand-gold"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={16} />
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="Sua senha"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-brand-gold"
            />
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full gold-gradient text-brand-dark rounded-xl py-4 font-black uppercase text-xs tracking-widest mt-4"
        >
          {loading ? "Autenticando..." : "Entrar no Ecossistema"}
        </button>

        <p className="text-center text-[9px] text-gray-500 font-bold uppercase tracking-widest pt-2">
          Esqueceu sua senha? Entre em contato com a TI
        </p>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-8 text-white relative overflow-hidden">
      <div className="absolute left-[-20%] top-1/2 -translate-y-1/2 w-64 h-[80vh] opacity-20 gold-gradient rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-sm z-10 space-y-10">
        <div className="space-y-6">
          <div className="flex items-center justify-center space-x-6">
            <Logo size="lg" className="shrink-0" />
            <div className="text-left">
              <h2 className="text-[10px] font-light tracking-[0.3em] opacity-80 uppercase mb-2">Especialização em</h2>
              <h1 className="text-3xl font-bold leading-[1.1] tracking-tight">
                CIRURGIA E<br />
                TRAUMATOLOGIA<br />
                <span className="text-brand-gold">BUCO<br />MAXILO<br />FACIAL</span>
              </h1>
            </div>
          </div>
          
          <div className="space-y-4 text-center">
            <div className="h-px w-full gold-gradient opacity-30"></div>
            <p className="text-sm font-medium tracking-[0.4em] text-brand-gold uppercase">Instituto Andreoni</p>
          </div>
        </div>

        {view === 'initial' && renderInitial()}
        {view === 'register' && renderRegister()}
        {view === 'login' && renderLogin()}

        <div className="flex flex-col items-center gap-4 pt-8">
          <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest">
            Plataforma Exclusiva • CTBMF 2025
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;