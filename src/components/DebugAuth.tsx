
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { Terminal, Lock, Mail, AlertCircle, CheckCircle, UserPlus, Info } from 'lucide-react';

interface FirebaseConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

const config = firebaseConfig as FirebaseConfig;

const DebugAuth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<{ success: boolean; code?: string; message?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    setLoading(true);
    setResult(null);
    console.log('[DEBUG AUTH] Testando login direto...');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setResult({ success: true, message: `Autenticado com sucesso! UID: ${userCredential.user.uid}` });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      setResult({ success: false, code: error.code, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testCreate = async () => {
    if (!email || !password) {
      setResult({ success: false, message: "Preencha e-mail e senha para criar o teste." });
      return;
    }
    setLoading(true);
    setResult(null);
    console.log('[DEBUG AUTH] Tentando criar usuário de teste...');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setResult({ success: true, message: `Usuário CRIADO e Autenticado! UID: ${userCredential.user.uid}` });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      setResult({ success: false, code: error.code, message: `Erro ao criar: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-brand-dark border border-brand-gold/30 rounded-2xl shadow-2xl max-w-md w-full space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between text-brand-gold border-b border-brand-gold/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Terminal size={18} />
          <span className="font-black uppercase tracking-widest">Auth Diagnostics</span>
        </div>
        <div className="flex items-center gap-1 text-[8px] opacity-50">
          <Info size={10} />
          <span>v1.2</span>
        </div>
      </div>

      <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-1">
        <p className="text-brand-gold font-bold text-[9px] uppercase tracking-widest">Configuração Ativa:</p>
        <p className="text-white text-[10px] break-all">Project ID: <span className="text-emerald-400">{config.projectId}</span></p>
        <p className="text-white text-[10px] break-all">Database ID: <span className="text-emerald-400">{config.firestoreDatabaseId || '(default)'}</span></p>
        <p className="text-gray-500 text-[8px]">Verifique se este ID é o mesmo que você vê no seu console Firebase.</p>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gold/50" size={14} />
          <input
            type="email"
            placeholder="Email de teste"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-3 text-white outline-none focus:border-brand-gold/50"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gold/50" size={14} />
          <input
            type="password"
            placeholder="Senha de teste"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-3 text-white outline-none focus:border-brand-gold/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={testLogin}
            disabled={loading}
            className="gold-gradient text-brand-dark font-black py-3 rounded-lg uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 text-[10px]"
          >
            {loading ? '...' : 'Tentar Login'}
          </button>
          <button
            onClick={testCreate}
            disabled={loading}
            className="bg-white/10 hover:bg-white/20 text-white font-black py-3 rounded-lg uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 text-[10px] flex items-center justify-center gap-2"
          >
            <UserPlus size={14} />
            {loading ? '...' : 'Criar Novo'}
          </button>
        </div>
      </div>

      {result && (
        <div className={`p-3 rounded-lg border ${result.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          <div className="flex items-start gap-2">
            {result.success ? <CheckCircle size={14} className="mt-0.5" /> : <AlertCircle size={14} className="mt-0.5" />}
            <div className="space-y-1">
              <p className="font-bold">{result.success ? 'SUCESSO' : 'FALHA'}</p>
              {result.code && <p className="opacity-70 font-black">Code: {result.code}</p>}
              <p className="text-[10px] leading-tight">{result.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="pt-2 text-[8px] text-gray-500 uppercase tracking-tighter leading-tight">
        Se "Criar Novo" funcionar e o usuário aparecer no console, a conexão está OK.<br/>
        Se der erro ao criar, o problema é na configuração do Firebase.
      </div>
    </div>
  );
};

export default DebugAuth;
