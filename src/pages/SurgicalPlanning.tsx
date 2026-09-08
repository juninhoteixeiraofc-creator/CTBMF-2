
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  FileText, 
  Send, 
  Save, 
  Trash2, 
  Download,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Hospital,
  User,
  Users,
  Stethoscope,
  Info,
  Paperclip,
  X,
  ClipboardList,
  Edit2
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  setDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, dbLegacy, db } from '../firebase';
import { AppUser, SurgicalPlan, SurgicalPlanStatus, DutyTeam } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { generateSurgicalPlanPDF, generateSurgicalPlanPDFBlob } from '../utils/pdfGenerator';

interface SurgicalPlanningProps {
  user: AppUser;
}

const SurgicalPlanning: React.FC<SurgicalPlanningProps> = ({ user }) => {
  const [plans, setPlans] = useState<SurgicalPlan[]>([]);
  const [libraryPlans, setLibraryPlans] = useState<SurgicalPlan[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'my_plans' | 'approved_library'>('my_plans');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SurgicalPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<SurgicalPlan | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [dutyTeams, setDutyTeams] = useState<DutyTeam[]>([]);

  // Search and Filters for Library
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProcedure, setFilterProcedure] = useState("all");
  const [filterProfessor, setFilterProfessor] = useState("all");
  const [filterResident, setFilterResident] = useState("all");
  const [filterDiagnosis, setFilterDiagnosis] = useState("all");

  // Form state
  const [formData, setFormData] = useState<Partial<SurgicalPlan>>({
    residentName: user?.displayName || '',
    residentLevel: user?.residencyLevel || 'R1',
    surgeryDate: '',
    hospitalUnit: '',
    professorName: '',
    auxiliaryTeam: '',
    patientCode: '',
    procedureName: '',
    diagnosis: '',
    anatomyRegion: '',
    affectedSide: '',
    caseType: '',
    caseSummary: '',
    indication: '',
    anesthesia: '',
    intubation: '',
    positioning: '',
    antisepsis: '',
    surgicalAccess: '',
    surgicalSteps: '',
    fixationMaterials: '',
    criticalStructures: '',
    complications: '',
    postOpCare: '',
    additionalNotes: '',
    attachments: [],
    status: 'draft',
    dutyTeamId: '',
    dutyTeamName: ''
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [debugLogs, setDebugLogs] = useState<{col: string, count: number, error?: string}[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "duty_teams"), (snapshot) => {
      const teams = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as DutyTeam))
        .filter(t => t.active);
      setDutyTeams(teams);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (formData.surgeryDate && dutyTeams.length > 0) {
      // surgeryDate is from datetime-local input, so it's YYYY-MM-DDTHH:mm
      const surgeryDate = new Date(formData.surgeryDate);
      
      const suggestedTeam = dutyTeams.find(team => {
        // team.startDate and team.endDate are YYYY-MM-DD strings
        // To compare correctly, we parse them as Local midnight
        const parseLocal = (s: string) => {
          const [y, m, d] = s.split('-').map(Number);
          return new Date(y, m - 1, d);
        };
        
        const start = parseLocal(team.startDate);
        const end = parseLocal(team.endDate);
        
        // Set end to end of day
        end.setHours(23, 59, 59, 999);
        
        return surgeryDate >= start && surgeryDate <= end;
      });

      if (suggestedTeam && suggestedTeam.id !== formData.dutyTeamId) {
        setFormData(prev => ({
          ...prev,
          dutyTeamId: suggestedTeam.id,
          dutyTeamName: suggestedTeam.teamName
        }));
      }
    }
  }, [formData.surgeryDate, dutyTeams, formData.dutyTeamId]);

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
    const unsub = onSnapshot(collection(db, "duty_teams"), (snapshot) => {
      const teams = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as DutyTeam))
        .filter(t => t.active);
      setDutyTeams(teams);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      console.log(`[PLANNING] Iniciando busca de planos cirúrgicos (coleção: surgical_plans, residentId: ${user.uid})`);
      const q = query(
        collection(dbLegacy, 'surgical_plans'),
        where('residentId', '==', user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`[PLANNING] Snapshot recebido: ${snapshot.size} documentos`);
        addDebugLog('surgical_plans', snapshot.size);
        const plansData = snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data } as SurgicalPlan;
        });
        
        // Sort on the frontend to avoid composite index requirement
        plansData.sort((a, b) => {
          const getTime = (val: unknown) => {
            if (!val) return 0;
            if (typeof val === 'object' && val !== null && 'toMillis' in val) {
              return (val as { toMillis: () => number }).toMillis();
            }
            if (val instanceof Date) return val.getTime();
            if (typeof val === 'string') return new Date(val).getTime();
            return 0;
          };
          return getTime(b.createdAt) - getTime(a.createdAt);
        });

        setPlans(plansData);
        setLoading(false);
        setError(null);
      }, (error: unknown) => {
        const err = error as { code?: string; message?: string };
        console.error("[PLANNING] Erro ao buscar planejamentos:", err);
        addDebugLog('surgical_plans', 0, `${err.code}: ${err.message}`);
        
        if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
          setError("Cota do Firebase excedida. O sistema voltará ao normal em breve. Por favor, tente novamente mais tarde.");
        } else {
          setError(`Não foi possível carregar seus planejamentos: ${err.message || 'Erro desconhecido'}`);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("[PLANNING] Erro no setup de SurgicalPlanning:", err);
      setRenderError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [user]);

  // Library Fetch Logic
  useEffect(() => {
    if (activeSubTab !== 'approved_library') return;
    
    setLoadingLibrary(true);
    const q = query(
      collection(db, 'surgical_plans'),
      where('status', '==', 'approved')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const libraryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SurgicalPlan));
      
      // Sort by surgeryDate descending
      libraryData.sort((a, b) => {
        const dateA = new Date(a.surgeryDate).getTime();
        const dateB = new Date(b.surgeryDate).getTime();
        return dateB - dateA;
      });

      setLibraryPlans(libraryData);
      setLoadingLibrary(false);
    }, (err) => {
      console.error("Erro ao carregar biblioteca:", err);
      setLoadingLibrary(false);
    });

    return () => unsubscribe();
  }, [activeSubTab]);

  const filteredLibrary = libraryPlans.filter(plan => {
    const searchMatch = !searchQuery || 
      plan.procedureName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.residentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.professorName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const procedureMatch = filterProcedure === 'all' || plan.procedureName === filterProcedure;
    const professorMatch = filterProfessor === 'all' || plan.professorName === filterProfessor;
    const residentMatch = filterResident === 'all' || plan.residentName === filterResident;
    const diagnosisMatch = filterDiagnosis === 'all' || plan.diagnosis === filterDiagnosis;

    return searchMatch && procedureMatch && professorMatch && residentMatch && diagnosisMatch;
  });

  const uniqueProcedures = Array.from(new Set(libraryPlans.map(p => p.procedureName))).sort();
  const uniqueProfessors = Array.from(new Set(libraryPlans.map(p => p.professorName))).sort();
  const uniqueResidents = Array.from(new Set(libraryPlans.map(p => p.residentName))).sort();
  const uniqueDiagnoses = Array.from(new Set(libraryPlans.map(p => p.diagnosis))).sort();

  // Wrap the entire render in a try-catch like structure using state
  if (renderError) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-[32px] text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-black text-red-700 uppercase tracking-widest mb-2">Erro Interno</h2>
        <p className="text-red-600 text-sm mb-6">Ocorreu um erro ao abrir a página de Planejamentos.</p>
        <div className="bg-white/50 p-4 rounded-2xl text-left mb-6 overflow-auto max-h-40">
          <code className="text-[10px] text-red-800 break-all">{renderError}</code>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all"
        >
          Recarregar Aplicativo
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Aguardando autenticação...</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizeAttachments = (attachments: (string | Attachment | any)[] | undefined): Attachment[] => {
    if (!Array.isArray(attachments)) return [];
    return attachments
      .map(att => {
        if (typeof att === 'string') {
          return { 
            name: 'Anexo Antigo', 
            url: att, 
            path: '', 
            type: 'image/jpeg', 
            size: 0, 
            uploadedAt: new Date().toISOString() 
          };
        }
        if (att && typeof att === 'object') {
          return {
            name: att.name || att.fileName || 'Anexo',
            url: att.url || att.fileUrl || '',
            path: att.path || '',
            type: att.type || att.fileType || 'application/octet-stream',
            size: att.size || 0,
            uploadedAt: att.uploadedAt || new Date().toISOString()
          };
        }
        return null;
      })
      .filter((att): att is Attachment => att !== null && !!att.url);
  };

  const sanitizeFileName = (name: string) => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with _
      .toLowerCase();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newFiles = Array.from(files);
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadSelectedFiles = async (planningId: string): Promise<Attachment[]> => {
    if (selectedFiles.length === 0) return [];
    if (!user?.uid) throw new Error("Usuário não autenticado.");
    
    setUploadingFiles(true);
    const uploadedAttachments: Attachment[] = [];

    try {
      for (const file of selectedFiles) {
        console.log(`[UPLOAD] Iniciando upload de ${file.name} (${file.size} bytes, tipo: ${file.type})`);
        // Validação de tamanho (10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`Arquivo ${file.name} excede o limite de 10MB.`);
        }
        
        // Validação de tipo
        const allowedTypes = [
          'image/jpeg', 
          'image/png', 
          'application/pdf', 
          'image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Tipo de arquivo ${file.type} não permitido. Use Imagens, PDF ou Word.`);
        }

        const timestamp = Date.now();
        const sanitizedName = sanitizeFileName(file.name);
        const storagePath = `planejamentos/${user.uid}/${planningId}/${timestamp}-${sanitizedName}`;
        console.log(`[UPLOAD] Caminho de destino: ${storagePath}`);
        const storageRef = ref(storage, storagePath);
        
        try {
          await uploadBytes(storageRef, file);
          console.log(`[UPLOAD] Upload concluído para ${file.name}`);
          const downloadURL = await getDownloadURL(storageRef);
          console.log(`[UPLOAD] URL obtida: ${downloadURL}`);
          
          uploadedAttachments.push({
            name: file.name,
            url: downloadURL,
            path: storagePath,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString()
          });
        } catch (uploadErr: unknown) {
          console.error(`[UPLOAD] Erro específico no upload de ${file.name}:`, uploadErr);
          throw uploadErr;
        }
      }
      return uploadedAttachments;
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error("[UPLOAD] Full error object:", error);
      console.error("[UPLOAD] Error code:", error.code);
      console.error("[UPLOAD] Error message:", error.message);
      
      let message = "Erro ao fazer upload dos arquivos.";
      if (error.code === 'storage/unauthorized') {
        message = `Sem permissão para upload no Firebase Storage. (Caminho: planejamentos/${user.uid}/...). Verifique as regras de segurança no Console Firebase.`;
      } else if (error.code === 'storage/quota-exceeded') {
        message = "Cota do Firebase Storage excedida.";
      } else if (error.message) {
        message = error.message;
      }
      throw new Error(message);
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments?.filter((_, i) => i !== index)
    }));
  };

  const validateStep = (step: number) => {
    if (step === 1) {
      return formData.surgeryDate && formData.hospitalUnit && formData.professorName && formData.patientCode;
    }
    if (step === 2) {
      return formData.procedureName && formData.diagnosis && formData.anatomyRegion;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!user || saving || uploadingFiles) return;
    setSaving(true);
    setError(null);
    try {
      // Pre-generate ID if new
      const planningId = editingPlan?.id || doc(collection(dbLegacy, 'surgical_plans')).id;
      
      // Upload files first if any
      const newUploadedAttachments = await uploadSelectedFiles(planningId);
      const currentAttachments = normalizeAttachments(formData.attachments);
      
      const planData = {
        ...formData,
        attachments: [...currentAttachments, ...newUploadedAttachments],
        residentId: user.uid,
        residentName: user.displayName,
        residentLevel: user.residencyLevel || 'R1',
        status: 'draft' as SurgicalPlanStatus,
        updatedAt: serverTimestamp(),
      };

      if (editingPlan) {
        await updateDoc(doc(dbLegacy, 'surgical_plans', planningId), planData);
      } else {
        await setDoc(doc(dbLegacy, 'surgical_plans', planningId), {
          ...planData,
          createdAt: serverTimestamp(),
        });
      }
      setShowSuccess("Rascunho salvo com sucesso.");
      setSelectedFiles([]);
      setTimeout(() => {
        setIsFormOpen(false);
        resetForm();
        setShowSuccess(null);
      }, 2000);
    } catch (error) {
      console.error("Error saving draft:", error);
      setError(error instanceof Error ? error.message : "Erro ao salvar rascunho.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || saving || uploadingFiles) return;
    setSaving(true);
    setError(null);
    try {
      // Pre-generate ID if new
      const planningId = editingPlan?.id || doc(collection(dbLegacy, 'surgical_plans')).id;
      
      // Upload files first if any
      const newUploadedAttachments = await uploadSelectedFiles(planningId);
      const currentAttachments = normalizeAttachments(formData.attachments);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const planData: Partial<SurgicalPlan> & Record<string, any> = {
        ...formData,
        attachments: [...currentAttachments, ...newUploadedAttachments],
        residentId: user.uid,
        residentName: user.displayName,
        residentLevel: user.residencyLevel || 'R1',
        status: 'submitted' as SurgicalPlanStatus,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const planDocRef = doc(dbLegacy, 'surgical_plans', planningId);
      if (editingPlan) {
        await updateDoc(planDocRef, planData);
      } else {
        planData.createdAt = serverTimestamp();
        await setDoc(planDocRef, planData);
      }

      // Generate and upload PDF
      const pdfBlob = generateSurgicalPlanPDFBlob(planData);
      const pdfPath = `surgical_plans/${planningId}/plan.pdf`;
      const pdfStorageRef = ref(storage, pdfPath);
      await uploadBytes(pdfStorageRef, pdfBlob);
      const pdfUrl = await getDownloadURL(pdfStorageRef);

      // Update document with PDF URL
      await updateDoc(planDocRef, { pdfUrl });

      setShowSuccess("Planejamento enviado com sucesso.");
      setSelectedFiles([]);
      setTimeout(() => {
        setIsFormOpen(false);
        resetForm();
        setShowSuccess(null);
      }, 2000);
    } catch (error) {
      console.error("Error submitting plan:", error);
      setError(error instanceof Error ? error.message : "Erro ao enviar planejamento.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      residentName: user.displayName || '',
      residentLevel: user.residencyLevel || 'R1',
      surgeryDate: '',
      hospitalUnit: '',
      professorName: '',
      auxiliaryTeam: '',
      patientCode: '',
      procedureName: '',
      diagnosis: '',
      anatomyRegion: '',
      affectedSide: '',
      caseType: '',
      caseSummary: '',
      indication: '',
      anesthesia: '',
      intubation: '',
      positioning: '',
      antisepsis: '',
      surgicalAccess: '',
      surgicalSteps: '',
      fixationMaterials: '',
      criticalStructures: '',
      complications: '',
      postOpCare: '',
      additionalNotes: '',
      attachments: [],
      status: 'draft',
      dutyTeamId: '',
      dutyTeamName: ''
    });
    setEditingPlan(null);
    setSelectedFiles([]);
    setCurrentStep(1);
  };

  const handleEdit = (plan: SurgicalPlan) => {
    setEditingPlan(plan);
    setFormData({ 
      ...plan,
      dutyTeamId: plan.dutyTeamId || '',
      dutyTeamName: plan.dutyTeamName || ''
    });
    setIsFormOpen(true);
    setCurrentStep(1);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este planejamento?")) {
      try {
        await deleteDoc(doc(dbLegacy, 'surgical_plans', id));
      } catch (error) {
        console.error("Error deleting plan:", error);
      }
    }
  };

  const checkDeadline = (surgeryDate: unknown, submittedAt: unknown) => {
    if (!submittedAt || !surgeryDate) return null;
    
    const getVal = (val: unknown): Date => {
      if (!val) return new Date(0);
      if (typeof val === 'object' && val !== null && 'toDate' in val) {
        return (val as { toDate: () => Date }).toDate();
      }
      return new Date(val as string | number | Date);
    };

    const surgery = getVal(surgeryDate);
    const submitted = getVal(submittedAt);
    
    const diff = surgery.getTime() - submitted.getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours >= 24;
  };

  const formatDate = (dateVal: unknown) => {
    if (!dateVal) return 'N/A';
    
    // Handle YYYY-MM-DD strings directly to avoid TZ issues
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [y, m, d] = dateVal.split('-');
      return `${d}/${m}/${y}`;
    }

    if (typeof dateVal === 'object' && dateVal !== null && 'toDate' in dateVal) {
      return (dateVal as { toDate: () => Date }).toDate().toLocaleDateString('pt-BR');
    }
    const d = new Date(dateVal as string | number | Date);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('pt-BR');
  };

  const formatTime = (dateVal: unknown) => {
    if (!dateVal) return 'N/A';
    if (typeof dateVal === 'object' && dateVal !== null && 'toDate' in dateVal) {
      return (dateVal as { toDate: () => Date }).toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    const d = new Date(dateVal as string | number | Date);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-brand-dark">Planejamentos</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Gestão e Biblioteca de Casos</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1">
            <button 
              onClick={() => setActiveSubTab('my_plans')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'my_plans' ? 'bg-white shadow text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Meus Envios
            </button>
            <button 
              onClick={() => setActiveSubTab('approved_library')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'approved_library' ? 'bg-white shadow text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Biblioteca Aprovados
            </button>
          </div>
          <button 
            onClick={() => { resetForm(); setIsFormOpen(true); }}
            className="bg-brand-dark text-brand-gold p-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Novo Caso</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'approved_library' && (
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Pesquisar por procedimento, diagnóstico, residente..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all placeholder:text-gray-300"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <select value={filterProcedure} onChange={e => setFilterProcedure(e.target.value)} className="bg-gray-50 border-none rounded-xl px-4 py-3 text-[9px] font-black uppercase tracking-widest text-brand-dark outline-none">
                <option value="all">Procedimento</option>
                {uniqueProcedures.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterProfessor} onChange={e => setFilterProfessor(e.target.value)} className="bg-gray-50 border-none rounded-xl px-4 py-3 text-[9px] font-black uppercase tracking-widest text-brand-dark outline-none">
                <option value="all">Professor</option>
                {uniqueProfessors.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterResident} onChange={e => setFilterResident(e.target.value)} className="bg-gray-50 border-none rounded-xl px-4 py-3 text-[9px] font-black uppercase tracking-widest text-brand-dark outline-none">
                <option value="all">Residente</option>
                {uniqueResidents.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={filterDiagnosis} onChange={e => setFilterDiagnosis(e.target.value)} className="bg-gray-50 border-none rounded-xl px-4 py-3 text-[9px] font-black uppercase tracking-widest text-brand-dark outline-none">
                <option value="all">Diagnóstico</option>
                {uniqueDiagnoses.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading || (activeSubTab === 'approved_library' && loadingLibrary) ? (
        <div className="py-20 flex justify-center">
          <div className="w-10 h-10 border-4 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 p-8 rounded-[32px] text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={32} />
          <p className="text-red-600 font-bold text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 text-[10px] font-black uppercase tracking-widest text-red-700 underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {activeSubTab === 'my_plans' ? (
            plans.length === 0 ? (
              <div className="bg-white rounded-[32px] p-12 text-center border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <FileText size={32} />
                </div>
                <p className="text-gray-400 font-medium">Você ainda não enviou nenhum planejamento.</p>
                <button 
                  onClick={() => setIsFormOpen(true)}
                  className="mt-4 text-brand-gold text-[10px] font-black uppercase tracking-widest"
                >
                  Começar agora
                </button>
              </div>
            ) : (
              plans.map((plan) => (
                <motion.div 
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        plan.status === 'approved' ? 'bg-green-50 text-green-500' :
                        plan.status === 'submitted' ? 'bg-blue-50 text-blue-500' :
                        'bg-gray-50 text-gray-400'
                      }`}>
                        {plan.status === 'approved' ? <CheckCircle2 size={24} /> : 
                        plan.status === 'submitted' ? <Clock size={24} /> : 
                        <FileText size={24} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest">{plan.procedureName}</h3>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                            plan.status === 'approved' ? 'bg-green-100 text-green-600' :
                            plan.status === 'submitted' ? 'bg-blue-100 text-blue-600' :
                            plan.status === 'reviewed' ? 'bg-brand-gold/20 text-brand-gold' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {plan.status === 'draft' ? 'Rascunho' : 
                            plan.status === 'submitted' ? 'Enviado' : 
                            plan.status === 'reviewed' ? 'Revisado' : 'Aprovado'}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                          Paciente: {plan.patientCode} • Cirurgia: {formatDate(plan.surgeryDate)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 mr-2">
                        {plan.status !== 'draft' && (
                          checkDeadline(plan.surgeryDate, plan.submittedAt) ? (
                            <span className="flex items-center gap-1 text-[8px] font-black text-green-500 uppercase tracking-widest bg-green-50 px-2 py-1 rounded-lg">
                              <CheckCircle2 size={10} /> No Prazo
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[8px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-lg">
                              <AlertCircle size={10} /> Fora do Prazo
                            </span>
                          )
                        )}
                      </div>

                      <button 
                        onClick={() => handleEdit(plan)}
                        disabled={plan.status === 'approved' || plan.status === 'reviewed'}
                        className="p-3 bg-gray-50 text-gray-400 hover:text-brand-dark hover:bg-gray-100 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-gray-50 disabled:hover:text-gray-400"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>

                      {plan.status === 'draft' && (
                        <button 
                          onClick={() => handleDelete(plan.id)}
                          className="p-3 bg-red-50 text-red-400 hover:bg-red-100 rounded-xl transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}

                      {plan.status !== 'draft' && (
                        <button 
                          onClick={() => generateSurgicalPlanPDF(plan)}
                          className="p-3 bg-brand-dark text-brand-gold hover:scale-105 rounded-xl transition-all flex items-center gap-2"
                          title="Baixar PDF"
                        >
                          <Download size={18} />
                          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">PDF</span>
                        </button>
                      )}

                      <button 
                        onClick={() => setSelectedPlan(plan)}
                        className="p-3 bg-gray-50 text-gray-400 hover:text-brand-dark hover:bg-gray-100 rounded-xl transition-all"
                        title="Visualizar"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )
          ) : (
            filteredLibrary.length === 0 ? (
              <div className="bg-white rounded-[32px] p-12 text-center border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <ClipboardList size={32} />
                </div>
                <p className="text-gray-400 font-medium">Nenhum planejamento aprovado encontrado para estudo.</p>
              </div>
            ) : (
              filteredLibrary.map((plan) => (
                <motion.div 
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[32px] p-6 shadow-md border border-brand-gold/10 hover:border-brand-gold/30 hover:shadow-lg transition-all group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-14 h-14 rounded-2xl bg-brand-gold/5 text-brand-gold flex items-center justify-center border border-brand-gold/10">
                        <CheckCircle2 size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest">{plan.procedureName}</h3>
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest bg-green-100 text-green-600">
                            Aprovado
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">
                            <span className="text-gray-400">Diag:</span> {plan.diagnosis}
                          </p>
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">
                            <span className="text-gray-400">Autor:</span> {plan.residentName}
                          </p>
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">
                            <span className="text-gray-400">Professor:</span> {plan.professorName}
                          </p>
                          <p className="text-[9px] font-bold text-brand-gold uppercase tracking-tight">
                            <span className="text-gray-400 text-brand-gold/50">Equipe:</span> {plan.dutyTeamName || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => generateSurgicalPlanPDF(plan)}
                        className="p-3 bg-white border border-gray-100 text-brand-dark hover:bg-gray-50 rounded-xl transition-all flex items-center gap-2"
                        title="Baixar PDF"
                      >
                        <Download size={18} />
                        <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Baixar PDF</span>
                      </button>

                      <button 
                        onClick={() => setSelectedPlan(plan)}
                        className="px-6 py-3 bg-brand-dark text-brand-gold rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                      >
                        <Eye size={18} />
                        Visualizar
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )
          )}
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-8 bg-brand-dark/90 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh] relative"
            >
              {/* Success Overlay */}
              {showSuccess && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center bg-white/90 backdrop-blur-sm animate-fade-in">
                  <div className="text-center animate-scale-in">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-xl font-black text-brand-dark uppercase tracking-widest mb-2">Sucesso!</h3>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{showSuccess}</p>
                  </div>
                </div>
              )}

              <div className="p-5 md:p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-dark rounded-2xl flex items-center justify-center text-brand-gold shadow-lg">
                    <ClipboardList size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">
                      {editingPlan ? 'Editar Planejamento' : 'Novo Planejamento'}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                      Passo {currentStep} de 3 • {currentStep === 1 ? 'Identificação' : currentStep === 2 ? 'Procedimento' : 'Técnica'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setIsFormOpen(false); resetForm(); }}
                  className="w-10 h-10 bg-white text-gray-400 hover:text-brand-dark rounded-xl flex items-center justify-center transition-all shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8">
                {currentStep === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data da Cirurgia</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={18} />
                        <input 
                          type="datetime-local" 
                          name="surgeryDate"
                          value={formData.surgeryDate}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Equipe de Plantão</label>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={18} />
                        <select 
                          name="dutyTeamId"
                          value={formData.dutyTeamId}
                          onChange={(e) => {
                            const team = dutyTeams.find(t => t.id === e.target.value);
                            setFormData(prev => ({
                              ...prev,
                              dutyTeamId: e.target.value,
                              dutyTeamName: team?.teamName || ''
                            }));
                          }}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all appearance-none"
                        >
                          <option value="">Selecione a Equipe</option>
                          {dutyTeams.map(team => (
                            <option key={team.id} value={team.id}>Equipe {team.teamName} ({team.weekLabel})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Hospital / Unidade</label>
                      <div className="relative">
                        <Hospital className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={18} />
                        <input 
                          type="text" 
                          name="hospitalUnit"
                          placeholder="Ex: Hospital Santa Joana"
                          value={formData.hospitalUnit}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Professor Responsável</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={18} />
                        <input 
                          type="text" 
                          name="professorName"
                          placeholder="Nome do Professor"
                          value={formData.professorName}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Paciente (Iniciais/Código)</label>
                      <div className="relative">
                        <Info className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={18} />
                        <input 
                          type="text" 
                          name="patientCode"
                          placeholder="Ex: J.S.A. ou 12345"
                          value={formData.patientCode}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Equipe Auxiliar</label>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={18} />
                        <input 
                          type="text" 
                          name="auxiliaryTeam"
                          placeholder="Nomes dos auxiliares"
                          value={formData.auxiliaryTeam}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome da Cirurgia</label>
                      <div className="relative">
                        <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold" size={18} />
                        <input 
                          type="text" 
                          name="procedureName"
                          placeholder="Ex: Exérese de Tumor Mandibular"
                          value={formData.procedureName}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Diagnóstico</label>
                      <textarea 
                        name="diagnosis"
                        placeholder="Descreva o diagnóstico"
                        value={formData.diagnosis}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Região Anatômica</label>
                      <input 
                        type="text" 
                        name="anatomyRegion"
                        placeholder="Ex: Mandíbula Lado Direito"
                        value={formData.anatomyRegion}
                        onChange={handleInputChange}
                        className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lado Acometido</label>
                      <select 
                        name="affectedSide"
                        value={formData.affectedSide}
                        onChange={handleInputChange}
                        className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all"
                      >
                        <option value="">Selecione...</option>
                        <option value="Direito">Direito</option>
                        <option value="Esquerdo">Esquerdo</option>
                        <option value="Bilateral">Bilateral</option>
                        <option value="N/A">Não se aplica</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tipo de Caso</label>
                      <select 
                        name="caseType"
                        value={formData.caseType}
                        onChange={handleInputChange}
                        className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all"
                      >
                        <option value="">Selecione...</option>
                        <option value="Eletivo">Eletivo</option>
                        <option value="Urgência">Urgência</option>
                        <option value="Emergência">Emergência</option>
                      </select>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Resumo do Caso</label>
                      <textarea 
                        name="caseSummary"
                        value={formData.caseSummary}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sequência Técnica (Passo a Passo)</label>
                      <textarea 
                        name="surgicalSteps"
                        value={formData.surgicalSteps}
                        onChange={handleInputChange}
                        rows={5}
                        className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Materiais de Fixação / Síntese</label>
                      <textarea 
                        name="fixationMaterials"
                        value={formData.fixationMaterials}
                        onChange={handleInputChange}
                        rows={5}
                        className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anestesia</label>
                      <input name="anesthesia" value={formData.anesthesia} onChange={handleInputChange} className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Via de Intubação</label>
                      <input name="intubation" value={formData.intubation} onChange={handleInputChange} className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Posicionamento</label>
                      <input name="positioning" value={formData.positioning} onChange={handleInputChange} className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Antissepsia</label>
                      <input name="antisepsis" value={formData.antisepsis} onChange={handleInputChange} className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Acesso Cirúrgico</label>
                      <textarea name="surgicalAccess" value={formData.surgicalAccess} onChange={handleInputChange} rows={2} className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all resize-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Estruturas Críticas</label>
                      <input name="criticalStructures" value={formData.criticalStructures} onChange={handleInputChange} className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Possíveis Complicações</label>
                      <input name="complications" value={formData.complications} onChange={handleInputChange} className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cuidados Pós-Operatórios</label>
                      <textarea name="postOpCare" value={formData.postOpCare} onChange={handleInputChange} rows={2} className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all resize-none" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Observações Adicionais</label>
                      <textarea name="additionalNotes" value={formData.additionalNotes} onChange={handleInputChange} rows={2} className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-gold/20 transition-all resize-none" />
                    </div>
                    <div className="md:col-span-2 space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anexos (Exames, Fotos, Referências)</label>
                      
                      {/* Already Uploaded Attachments */}
                      {formData.attachments && formData.attachments.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[8px] font-black text-brand-gold uppercase tracking-widest">Anexos Salvos:</p>
                          <div className="flex flex-wrap gap-4">
                            {normalizeAttachments(formData.attachments).map((att, idx) => (
                              <div key={idx} className="w-24 h-24 rounded-2xl bg-gray-50 border border-gray-100 relative group overflow-hidden">
                                {att.type?.startsWith('image/') ? (
                                  <img 
                                    src={att.url} 
                                    alt={att.name} 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-brand-dark">
                                    <FileText size={24} />
                                  </div>
                                )}
                                <button 
                                  onClick={() => removeAttachment(idx)}
                                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                  <X size={10} />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 p-1 bg-brand-dark/60 backdrop-blur-sm">
                                  <p className="text-[6px] font-bold text-white uppercase truncate">{att.name}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* New Files to Upload */}
                      <div className="flex flex-wrap gap-4">
                        <label className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-brand-gold hover:bg-brand-gold/5 transition-all group">
                          <Paperclip className="text-gray-300 group-hover:text-brand-gold mb-1" size={20} />
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest group-hover:text-brand-gold text-center px-1">
                            {uploadingFiles ? 'Enviando...' : 'Selecionar Arquivos'}
                          </span>
                          <input 
                            type="file" 
                            multiple 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            disabled={uploadingFiles}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          />
                        </label>

                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="w-24 h-24 rounded-2xl bg-brand-gold/5 border border-brand-gold/20 relative group flex flex-col items-center justify-center p-2">
                            <FileText size={24} className="text-brand-gold mb-1" />
                            <p className="text-[7px] font-bold text-brand-dark uppercase truncate w-full text-center">{file.name}</p>
                            <span className="text-[6px] text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                            <button 
                              onClick={() => removeSelectedFile(idx)}
                              className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full shadow-lg"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      {selectedFiles.length > 0 && (
                        <p className="text-[9px] font-bold text-brand-gold uppercase tracking-widest animate-pulse">
                          {selectedFiles.length} arquivo(s) selecionado(s) para upload
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 md:p-8 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center flex-shrink-0">
                <div className="flex gap-2">
                  {currentStep > 1 && (
                    <button 
                      onClick={() => setCurrentStep(prev => prev - 1)}
                      className="px-6 py-4 bg-white text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-gray-100 transition-all flex items-center gap-2"
                    >
                      <ChevronLeft size={16} /> Voltar
                    </button>
                  )}
                  <button 
                    onClick={handleSaveDraft}
                    disabled={saving || uploadingFiles}
                    className="px-6 py-4 bg-white text-brand-dark rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-gray-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save size={16} /> {saving || uploadingFiles ? 'Salvando...' : 'Rascunho'}
                  </button>
                </div>

                <div className="flex gap-2">
                  {currentStep < 3 ? (
                    <button 
                      onClick={() => setCurrentStep(prev => prev + 1)}
                      disabled={!validateStep(currentStep)}
                      className="px-8 py-4 bg-brand-dark text-brand-gold rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-dark/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:scale-100"
                    >
                      Próximo <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button 
                      onClick={handleSubmit}
                      disabled={!validateStep(1) || !validateStep(2) || saving || uploadingFiles}
                      className="px-8 py-4 bg-brand-gold text-brand-dark rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-gold/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Send size={16} /> {saving || uploadingFiles ? 'Enviando...' : (editingPlan ? 'Atualizar' : 'Enviar')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {/* View Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-8 bg-brand-dark/90 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]"
            >
              <div className="p-5 md:p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-dark rounded-2xl flex items-center justify-center text-brand-gold shadow-lg">
                    <Eye size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">Visualizar Planejamento</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        {selectedPlan.procedureName} • {formatDate(selectedPlan.surgeryDate)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPlan(null)}
                  className="w-10 h-10 bg-white text-gray-400 hover:text-brand-dark rounded-xl flex items-center justify-center transition-all shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8">
                {selectedPlan.residentId !== user.uid && (
                  <div className="bg-brand-gold/10 p-4 rounded-2xl flex items-center gap-3 border border-brand-gold/20">
                    <Info className="text-brand-gold" size={20} />
                    <p className="text-[10px] font-bold text-brand-dark uppercase tracking-widest">
                      Você está visualizando um planejamento aprovado da biblioteca acadêmica.
                    </p>
                  </div>
                )}

                <section className="space-y-4">
                  <h4 className="text-xs font-black text-brand-gold uppercase tracking-widest border-b border-brand-gold/20 pb-2">Identificação</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Paciente</p>
                      <p className="text-sm font-bold text-brand-dark">
                        {selectedPlan.residentId === user.uid ? selectedPlan.patientCode : "ID Omitido (Privacidade)"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Hospital</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.hospitalUnit}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Data e Hora</p>
                      <p className="text-sm font-bold text-brand-dark">
                        {formatDate(selectedPlan.surgeryDate)} às {formatTime(selectedPlan.surgeryDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Professor</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.professorName}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Equipe</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.auxiliaryTeam || 'N/A'}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="text-xs font-black text-brand-gold uppercase tracking-widest border-b border-brand-gold/20 pb-2">Procedimento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cirurgia</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.procedureName}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Diagnóstico</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.diagnosis}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Região</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.anatomyRegion}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Lado</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.affectedSide}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tipo de Caso</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.caseType}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="text-xs font-black text-brand-gold uppercase tracking-widest border-b border-brand-gold/20 pb-2">Técnica e Planejamento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Anestesia</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.anesthesia || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Via de Intubação</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.intubation || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Posicionamento</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.positioning || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Antissepsia</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.antisepsis || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Acesso Cirúrgico</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.surgicalAccess || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Resumo do Caso</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl whitespace-pre-wrap">{selectedPlan.caseSummary || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Passo a Passo</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl whitespace-pre-wrap">{selectedPlan.surgicalSteps || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Materiais de Fixação</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl">{selectedPlan.fixationMaterials || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Estruturas Críticas</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.criticalStructures || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Possíveis Complicações</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.complications || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cuidados Pós-Operatórios</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.postOpCare || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Observações Adicionais</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.additionalNotes || 'N/A'}</p>
                    </div>
                  </div>
                </section>

                {selectedPlan.reviewNotes && selectedPlan.residentId === user.uid && (
                  <section className="space-y-4 animate-fade-in">
                    <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-200 pb-2 flex items-center gap-2">
                      <CheckCircle2 size={16} /> Parecer do Professor
                    </h4>
                    <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Feedback de Revisão</p>
                      <p className="text-sm font-medium text-emerald-900 italic whitespace-pre-wrap">"{selectedPlan.reviewNotes}"</p>
                    </div>
                  </section>
                )}

                  {Array.isArray(selectedPlan.attachments) && selectedPlan.attachments.length > 0 && (
                    <section className="space-y-4">
                      <h4 className="text-xs font-black text-brand-gold uppercase tracking-widest border-b border-brand-gold/20 pb-2">Anexos</h4>
                      <div className="flex flex-wrap gap-4">
                        {normalizeAttachments(selectedPlan.attachments).map((att, idx) => (
                          <a 
                            key={idx} 
                            href={att.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-24 h-24 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden hover:border-brand-gold transition-all group relative"
                          >
                            {att.type?.startsWith('image/') ? (
                              <img 
                                src={att.url || null} 
                                alt={att.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-all" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <FileText size={32} className="text-gray-300 group-hover:text-brand-gold transition-all" />
                                <span className="text-[8px] font-black uppercase text-gray-400 px-2 truncate w-20 text-center">{att.name}</span>
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    </section>
                  )}
                  {(!selectedPlan.attachments || selectedPlan.attachments.length === 0) && (
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Nenhum anexo enviado.</p>
                  )}
              </div>

              <div className="p-5 md:p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
                <button 
                  onClick={() => generateSurgicalPlanPDF(selectedPlan)}
                  className="px-6 py-4 bg-brand-gold text-brand-dark rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                >
                  <Download size={18} />
                  Baixar PDF
                </button>
                <button 
                  onClick={() => setSelectedPlan(null)}
                  className="px-8 py-4 bg-brand-dark text-brand-gold rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
    </div>
  );
};

export default SurgicalPlanning;
