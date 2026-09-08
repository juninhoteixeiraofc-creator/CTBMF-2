import React, { useState, useRef, useEffect } from 'react';
import { AppUser } from '../types';
import { mockTurmas } from '../services/mockData';
import { LogOut, Settings, Award, Shield, Mail, GraduationCap, Camera, Check, X, MapPin, Phone, CreditCard } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';

interface ProfileProps {
  user: AppUser;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.displayName);
  const [editPhotoURL, setEditPhotoURL] = useState(user.photoURL || '');
  const [editCity, setEditCity] = useState(user.city || '');
  const [editAddress, setEditAddress] = useState(user.address || '');
  const [editCro, setEditCro] = useState(user.cro || '');
  const [editCep, setEditCep] = useState(user.cep || '');
  const [editPhone, setEditPhone] = useState(user.phone || '');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar estados de edição quando o usuário mudar
  useEffect(() => {
    if (!isEditing) {
      const syncProfile = () => {
        setEditName(user.displayName);
        setEditPhotoURL(user.photoURL || '');
        setEditCity(user.city || '');
        setEditAddress(user.address || '');
        setEditCro(user.cro || '');
        setEditCep(user.cep || '');
        setEditPhone(user.phone || '');
        setSelectedFile(null);
      };
      
      // Usar requestAnimationFrame ou setTimeout para evitar o erro de cascading renders no linter
      const frame = requestAnimationFrame(syncProfile);
      return () => cancelAnimationFrame(frame);
    }
  }, [user, isEditing]);

  const userTurma = mockTurmas.find(t => t.id === user.turma_id)?.name || (user.role === 'academy' ? 'Maxilo Pro Academy' : 'Acesso Administrativo');
  const displayLevel = user.role === 'academy' 
    ? `Plano ${user.academyPlan === 'experience' ? 'Experience' : 'Access'}` 
    : (user.residencyLevel ? `Residente ${user.residencyLevel}` : userTurma);

  const getSafeFileName = (name: string) => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/\s+/g, "_") // Troca espaços por underscore
      .replace(/[^a-z0-9._-]/gi, "") // Apenas letras, números, ponto, traço e underscore
      .toLowerCase();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 3. Validação de tipo (jpg, jpeg, png, webp)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Selecione uma imagem válida (JPG, PNG ou WEBP).' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 4. Validação de tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'A imagem deve ter no máximo 5MB.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditPhotoURL(reader.result as string);
    };
    reader.readAsDataURL(file);
    setSelectedFile(file);
    setMessage(null);
    
    console.log("Arquivo selecionado:", {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
    });
  };

  const handleSave = async () => {
    // 2. Verificar usuário autenticado
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("Erro: Usuário não autenticado no Firebase Auth.");
      setMessage({ type: 'error', text: 'Usuário não autenticado. Faça login novamente.' });
      return;
    }

    if (!editName.trim()) {
      setMessage({ type: 'error', text: 'O nome não pode estar vazio.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    // 10. Logs de diagnóstico
    console.log("Iniciando processo de salvamento:", {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: editName
    });

    try {
      let finalPhotoURL = editPhotoURL;

      // 7. Upload real para o Firebase Storage
      if (selectedFile) {
        const timestamp = Date.now();
        
        // 6. Caminho obrigatório: avatars/{uid}/{timestamp}-{safeFileName}
        const storagePath = `avatars/${currentUser.uid}/${timestamp}-${getSafeFileName(selectedFile.name)}`;
        const storageRef = ref(storage, storagePath);
        
        console.log("Realizando upload para o Storage:", storagePath);
        
        const uploadResult = await uploadBytes(storageRef, selectedFile);
        console.log("Upload concluído com sucesso:", uploadResult.metadata.fullPath);
        
        finalPhotoURL = await getDownloadURL(storageRef);
        console.log("URL de download obtida:", finalPhotoURL);
      }

      // 8. Atualizar Firestore
      console.log("Atualizando Firestore para o UID:", currentUser.uid);
      const userDocRef = doc(db, "users", currentUser.uid);
      
      await updateDoc(userDocRef, {
        displayName: editName,
        photoURL: finalPhotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(editName)}&background=c89b3c&color=fff`,
        city: editCity,
        address: editAddress,
        cro: editCro,
        cep: editCep,
        phone: editPhone,
        updatedAt: new Date().toISOString()
      });
      
      console.log("Firestore atualizado com sucesso.");
      setMessage({ type: 'success', text: 'Foto atualizada com sucesso!' });
      
      setTimeout(() => {
        setIsEditing(false);
        setSelectedFile(null);
        setLoading(false);
      }, 800);
      
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error = err as any;
      
      // 10. Erro detalhado no console
      console.error("ERRO NO PROCESSO DE PERFIL:");
      console.error("Code:", error.code);
      console.error("Message:", error.message);
      if (error.serverResponse) console.error("Server Response:", error.serverResponse);

      // 11. Mensagens amigáveis
      let userFriendlyMessage = 'Erro ao enviar imagem para o Storage.';
      
      if (error.code === 'storage/unauthorized') {
        userFriendlyMessage = 'Você não tem permissão para enviar esta imagem.';
      } else if (error.code === 'storage/quota-exceeded') {
        userFriendlyMessage = 'Limite de armazenamento excedido no servidor.';
      } else if (error.code === 'storage/retry-limit-exceeded') {
        userFriendlyMessage = 'Erro de conexão persistente. Tente novamente.';
      } else if (error.code === 'permission-denied') {
        userFriendlyMessage = 'Erro de permissão no banco de dados.';
      }

      setMessage({ type: 'error', text: userFriendlyMessage });
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-10">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div 
            className={`w-28 h-28 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl relative z-10 bg-gray-100 ${isEditing ? 'cursor-pointer' : ''} ${loading ? 'opacity-50' : ''}`}
            onClick={() => isEditing && !loading && fileInputRef.current?.click()}
          >
            <img 
              src={isEditing ? (editPhotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(editName)}&background=c89b3c&color=fff`) : (user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=c89b3c&color=fff`)} 
              alt={user.displayName} 
              className="w-full h-full object-cover" 
            />
            {isEditing && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white p-2">
                <Camera size={24} />
                <span className="text-[8px] font-black uppercase mt-1 text-center">
                  {loading ? 'Enviando...' : (selectedFile ? 'Imagem Selecionada' : 'Trocar Foto')}
                </span>
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/jpeg,image/png,image/webp"
          />
          <div className="absolute inset-0 bg-brand-gold/20 blur-2xl rounded-full translate-y-4 scale-110"></div>
          <div className="absolute -bottom-2 -right-2 bg-brand-dark text-brand-gold p-2 rounded-2xl border-4 border-white z-20 shadow-lg">
            {user.role === 'admin' ? <Shield size={18} /> : <Award size={18} />}
          </div>
        </div>

        {selectedFile && isEditing && (
          <p className="text-[9px] font-bold text-brand-gold uppercase tracking-widest mb-4 animate-pulse">
            Arquivo: {selectedFile.name}
          </p>
        )}
        
        {isEditing ? (
          <div className="w-full max-w-xs space-y-3">
            <div className="relative">
              <input 
                type="text" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome Completo"
                disabled={loading}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-center font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold outline-none disabled:opacity-50"
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <button 
                onClick={handleSave}
                disabled={loading}
                className="bg-brand-gold text-brand-dark px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-90 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border-2 border-brand-dark border-t-transparent rounded-full animate-spin"></div> : <Check size={16} />}
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                disabled={loading}
                className="bg-gray-100 text-gray-400 px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-90 transition-transform flex items-center gap-2 disabled:opacity-50"
              >
                <X size={16} />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-black text-brand-dark tracking-tight">{user.displayName}</h2>
            <p className="text-brand-gold font-black text-[10px] uppercase tracking-[0.3em] mt-2 px-4 py-1.5 bg-brand-dark rounded-full shadow-lg">
              {user.email === 'marcomaxilofacial@gmail.com' ? 'COORDENADOR' : user.role === 'academy' ? `ACADEMY • ${user.academyPlan === 'experience' ? 'EXPERIENCE' : 'ACCESS'}` : user.displayName.toLowerCase().includes('janio') ? 'R3 • Tech Lead' : user.role === 'admin' ? 'Administrador' : 'Residente CTBMF'}
            </p>
          </>
        )}
      </div>

      {message && (
        <div className={`mx-4 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center animate-bounce ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Informações Pessoais</h3>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 divide-y divide-gray-50 overflow-hidden">
            
            {/* CRO */}
            <div className="p-5 flex items-center justify-between group">
              <div className="flex items-center space-x-4 w-full">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-brand-gold transition-colors"><CreditCard size={20} /></div>
                <div className="flex flex-col flex-1">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Número do CRO</span>
                   {isEditing ? (
                     <input 
                       value={editCro} 
                       onChange={e => setEditCro(e.target.value)} 
                       placeholder="Ex: 12345-SP" 
                       disabled={loading}
                       className="text-sm font-bold text-brand-dark outline-none bg-gray-50 rounded-lg px-2 py-1 mt-1 disabled:opacity-50"
                     />
                   ) : (
                     <span className="text-sm font-bold text-brand-dark">{user.cro || 'Não informado'}</span>
                   )}
                </div>
              </div>
            </div>

            {/* Telefone */}
            <div className="p-5 flex items-center justify-between group">
              <div className="flex items-center space-x-4 w-full">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-brand-gold transition-colors"><Phone size={20} /></div>
                <div className="flex flex-col flex-1">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Telefone de Contato</span>
                   {isEditing ? (
                     <input 
                       value={editPhone} 
                       onChange={e => setEditPhone(e.target.value)} 
                       placeholder="(00) 00000-0000" 
                       disabled={loading}
                       className="text-sm font-bold text-brand-dark outline-none bg-gray-50 rounded-lg px-2 py-1 mt-1 disabled:opacity-50"
                     />
                   ) : (
                     <span className="text-sm font-bold text-brand-dark">{user.phone || 'Não informado'}</span>
                   )}
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="p-5 flex items-center justify-between group">
              <div className="flex items-center space-x-4 w-full">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-brand-gold transition-colors"><MapPin size={20} /></div>
                <div className="flex flex-col flex-1">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Endereço Residencial</span>
                   {isEditing ? (
                     <div className="space-y-2 mt-1">
                       <input 
                         value={editAddress} 
                         onChange={e => setEditAddress(e.target.value)} 
                         placeholder="Rua, Número, Complemento" 
                         disabled={loading}
                         className="w-full text-sm font-bold text-brand-dark outline-none bg-gray-50 rounded-lg px-2 py-1 disabled:opacity-50"
                       />
                       <div className="flex gap-2">
                         <input 
                           value={editCity} 
                           onChange={e => setEditCity(e.target.value)} 
                           placeholder="Cidade" 
                           disabled={loading}
                           className="flex-1 text-sm font-bold text-brand-dark outline-none bg-gray-50 rounded-lg px-2 py-1 disabled:opacity-50"
                         />
                         <input 
                           value={editCep} 
                           onChange={e => setEditCep(e.target.value)} 
                           placeholder="CEP" 
                           disabled={loading}
                           className="w-24 text-sm font-bold text-brand-dark outline-none bg-gray-50 rounded-lg px-2 py-1 disabled:opacity-50"
                         />
                       </div>
                     </div>
                   ) : (
                     <span className="text-sm font-bold text-brand-dark">
                       {user.address ? `${user.address}, ${user.city} - ${user.cep}` : 'Não informado'}
                     </span>
                   )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Credenciais e Acesso</h3>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 divide-y divide-gray-50 overflow-hidden">
            <div className="p-5 flex items-center justify-between group">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-brand-gold transition-colors"><Mail size={20} /></div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">E-mail Institucional</span>
                   <span className="text-sm font-bold text-brand-dark">{user.email}</span>
                </div>
              </div>
            </div>
            <div className="p-5 flex items-center justify-between group">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-brand-gold transition-colors"><GraduationCap size={20} /></div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                     {user.role === 'academy' ? 'Plano de Assinatura' : 'Nível de Residência'}
                   </span>
                   <span className="text-sm font-bold text-brand-dark">{displayLevel}</span>
                </div>
              </div>
            </div>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="w-full p-5 flex items-center justify-between group text-left"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-brand-gold transition-colors"><Settings size={20} /></div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Configurações</span>
                     <span className="text-sm font-bold text-brand-dark">Editar Perfil</span>
                  </div>
                </div>
                <Settings size={16} className="text-gray-300 group-hover:text-brand-gold transition-colors" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button 
          onClick={onLogout}
          className="w-full bg-red-50 text-red-600 p-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-3 active:scale-[0.98] transition-all border border-red-100 hover:bg-red-100 shadow-lg shadow-red-500/5"
        >
          <LogOut size={18} />
          <span>Encerrar Sessão</span>
        </button>
      </div>

      <div className="text-center space-y-2 opacity-30 group">
        <p className="text-[8px] text-gray-400 uppercase tracking-[0.5em] font-black group-hover:text-brand-gold transition-colors">
          CTBMF ANDREONI • ECOSYSTEM v1.0
        </p>
        <div className="flex justify-center space-x-1">
          <div className="w-1 h-1 bg-brand-gold rounded-full"></div>
          <div className="w-4 h-1 bg-brand-gold rounded-full"></div>
          <div className="w-1 h-1 bg-brand-gold rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
