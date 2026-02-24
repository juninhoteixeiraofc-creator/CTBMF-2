
import React, { useState } from 'react';
import { mockTurmas } from '../services/mockData';
import { AppUser } from '../types';
import { ChevronLeft, Mail, GraduationCap, User, Send, Fingerprint } from 'lucide-react';

interface RegisterProps {
  onRegister: (user: AppUser) => void;
  onBack: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegister, onBack }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    idNumber: '', // Novo campo: CRM ou CPF
    turma_id: 'r1-2026'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simula envio de e-mail para espectbmfpatobranco@gmail.com
    setTimeout(() => {
      const newUser: AppUser = {
        uid: `u-${Date.now()}`,
        email: formData.email,
        displayName: formData.name,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=c89b3c&color=fff`,
        role: 'student',
        turma_id: formData.turma_id,
        approved: false 
      };

      console.log('NOTIFICAÇÃO ENVIADA PARA: espectbmfpatobranco@gmail.com');
      console.log('DADOS DO CANDIDATO:', { ...formData, timestamp: new Date() });
      
      onRegister(newUser);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center p-8 text-white relative overflow-hidden">
      <div className="absolute right-[-20%] top-0 w-64 h-64 opacity-10 gold-gradient rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="w-full max-w-sm z-10 space-y-8 mt-12">
        <button 
          onClick={onBack}
          className="flex items-center text-brand-gold text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
        >
          <ChevronLeft size={16} className="mr-1" />
          Voltar para Login
        </button>

        <div className="text-left">
          <h1 className="text-3xl font-black tracking-tight leading-tight">Solicitar<br/><span className="text-brand-gold">Matrícula</span></h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Cadastro de Residente CTBMF</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Nome Completo</label>
              <div className="relative">
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Nome do Dr(a)."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-11 text-sm outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all"
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">E-mail</label>
              <div className="relative">
                <input 
                  required
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="seu@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-11 text-sm outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all"
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Identificação (CRM ou CPF)</label>
              <div className="relative">
                <input 
                  required
                  type="text" 
                  value={formData.idNumber}
                  onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                  placeholder="000.000.000-00"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-11 text-sm outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all"
                />
                <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Nível de Residência</label>
              <div className="relative">
                <select 
                  value={formData.turma_id}
                  onChange={(e) => setFormData({...formData, turma_id: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-11 text-sm outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all appearance-none"
                >
                  {mockTurmas.map(turma => (
                    <option key={turma.id} value={turma.id} className="bg-brand-dark">{turma.name}</option>
                  ))}
                </select>
                <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
            <p className="text-[9px] text-gray-400 font-medium leading-relaxed">
              * A aprovação será realizada manualmente pela coordenação. <br/>
              Notificaremos o e-mail: <strong>espectbmfpatobranco@gmail.com</strong>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full gold-gradient text-brand-dark rounded-xl py-4 font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center space-x-2 ${loading ? 'opacity-70 grayscale' : ''}`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-brand-dark border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Send size={18} />
                <span>Enviar Solicitação</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
