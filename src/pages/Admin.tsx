
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserX,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
  Activity,
  Megaphone,
  FilePlus,
  Trash2,
  Plus,
  Send,
  Edit2,
  X,
  Radio,
  Video,
  ShieldCheck,
  BarChart3,
  Clock,
  Bot,
  RotateCcw,
  FileText,
  Layers,
  Database,
  Eye,
  EyeOff,
  Link,
  ClipboardList,
  Download,
  Calendar,
  Save,
  Play
} from "lucide-react";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  Timestamp,
  addDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  writeBatch
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage, dbDefault, dbLegacy } from "../firebase";
import { ItemType, MaterialItem, Post, AppUser, LiveSession, Surgery, Protocol, KnowledgeBaseEntry, Module, ChefinhoKnowledge, AIConfig, HomeHighlight, KnowledgeBaseCTBMF, ChefinhoQuestion, SurgicalPlan, Attachment } from "../types";
import { mockTurmas } from "../services/mockData";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

import { testChefinhoConnection, askChefinho } from "../services/aiService";
import { generateSurgicalPlanPDF } from "../utils/pdfGenerator";
import {
  extractYoutubeId,
  detectPlatform,
  generateEmbedUrl
} from "../utils/videoUtils";
const LAUNCH_DATE = new Date('2026-03-16T08:03:18Z');

type AccessStatus = "pending" | "approved" | "rejected";

interface AccessRequest {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  turma_id: string;
  status: AccessStatus;
  createdAt?: Timestamp;
}


interface AdminProps {
  user: AppUser;
}

const Admin: React.FC<AdminProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'students' | 'announcements' | 'materials' | 'lives' | 'surgeries' | 'protocols' | 'analytics' | 'notifications' | 'highlights' | 'knowledge' | 'chefinho_questions' | 'surgical_plans' | 'team_management' | 'academy'>('students');
  const [teamSubTab, setTeamSubTab] = useState<'fixed_teams' | 'team_shifts' | 'r3_shifts' | 'calendar' | 'text_import'>('text_import');
  const [importText, setImportText] = useState("");
  const [parsedImport, setParsedImport] = useState<{
    teams: { name: string; r2: string[]; r1: string[] }[];
    scales: { start: string; end: string; team: string; r3: string }[];
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const resetTeamShifts = async () => {
    if (!confirm("Isso apagará TODOS os plantões de equipes cadastrados. Tem certeza?")) return;
    setIsImportingScale(true);
    try {
      console.log("[ADMIN] Resetando plantões de equipes...");
      // Forçar recarga para garantir que temos os IDs mais recentes
      const snapshot = await getDocs(collection(db, "team_shifts"));
      const batch = writeBatch(db);
      snapshot.docs.forEach(s => {
        batch.delete(s.ref);
      });
      await batch.commit();
      setShowSuccess("Todos os plantões de equipes foram removidos!");
      await loadTeamManagement();
    } catch (err: unknown) {
      console.error("[ADMIN] Erro ao resetar plantões:", err);
      setErrorMsg("Erro ao resetar: " + (err as Error).message);
    } finally {
      setIsImportingScale(false);
    }
  };

  const resetR3Shifts = async () => {
    if (!confirm("Isso apagará TODOS os plantões de R3 cadastrados. Tem certeza?")) return;
    setIsImportingScale(true);
    try {
      console.log("[ADMIN] Resetando plantões de R3...");
      const snapshot = await getDocs(collection(db, "r3_shifts"));
      const batch = writeBatch(db);
      snapshot.docs.forEach(s => {
        batch.delete(s.ref);
      });
      await batch.commit();
      setShowSuccess("Todos os plantões de R3 foram removidos!");
      await loadTeamManagement();
    } catch (err: unknown) {
      console.error("[ADMIN] Erro ao resetar R3:", err);
      setErrorMsg("Erro ao resetar: " + (err as Error).message);
    } finally {
      setIsImportingScale(false);
    }
  };

  const handleParseText = () => {
    setParseError(null);
    setParsedImport(null);

    if (!importText.trim()) {
      setParseError("Por favor, cole um texto para interpretar.");
      return;
    }

    try {
      const teams: { name: string; r2: string[]; r1: string[] }[] = [];
      const scales: { start: string; end: string; team: string; r3: string }[] = [];

      // Split by "Escalas:" to separate blocks
      const parts = importText.split(/Escalas:/i);
      const teamsPart = parts[0];
      const scalesPart = parts[1] || "";

      // Parse teams
      const teamBlocks = teamsPart.split(/Equipe\s+(\d+|[A-ZÀ-Úa-zà-ú0-9]+)/i);
      // The split above will create entries like: ["", "1", "\nR2: ...", "2", "\nR2: ..."]
      for (let i = 1; i < teamBlocks.length; i += 2) {
        const teamName = `Equipe ${teamBlocks[i]}`;
        const content = teamBlocks[i + 1] || "";
        
        const r2Lines = content.match(/R2:\s*([^\n]+)/gi);
        const r1Lines = content.match(/R1:\s*([^\n]+)/gi);

        const r2Names = r2Lines ? r2Lines.flatMap(line => {
          const names = line.replace(/R2:\s*/i, "").split(/[,/]/);
          return names.map(s => s.trim()).filter(Boolean);
        }) : [];
        
        const r1Names = r1Lines ? r1Lines.flatMap(line => {
          const names = line.replace(/R1:\s*/i, "").split(/[,/]/);
          return names.map(s => s.trim()).filter(Boolean);
        }) : [];

        teams.push({ name: teamName, r2: r2Names, r1: r1Names });
      }

      // Parse scales
      const scaleLines = scalesPart.split("\n").filter(l => l.trim() !== "");
      for (let i = 0; i < scaleLines.length; i++) {
        const line = scaleLines[i];
        // Expected: 01/04/2026 a 07/04/2026 - Equipe 1 - R3: Andréia
        const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/i);
        const teamMatch = line.match(/Equipe\s*(\d+|[A-ZÀ-Úa-zà-ú0-9]+)/i);
        const r3Match = line.match(/R3:\s*([^\n]+)/i);

        if (dateMatch && teamMatch && r3Match) {
          const startParts = dateMatch[1].split("/");
          const endParts = dateMatch[2].split("/");
          
          // Converter DD/MM/YYYY para YYYY-MM-DD
          const startStr = `${startParts[2]}-${startParts[1]}-${startParts[0]}`;
          const endStr = `${endParts[2]}-${endParts[1]}-${endParts[0]}`;

          scales.push({
            start: startStr,
            end: endStr,
            team: `Equipe ${teamMatch[1]}`,
            r3: r3Match[1].trim()
          });
        } else if (line.trim().length > 5) {
           throw new Error(`Linha de escala inválida na linha ${i + 1}: "${line.substring(0, 30)}..."`);
        }
      }

      if (teams.length === 0 && scales.length === 0) {
        throw new Error("Não foi possível identificar equipes ou escalas no texto.");
      }

      setParsedImport({ teams, scales });
      setShowSuccess("Texto interpretado com sucesso! Verifique a prévia abaixo.");
    } catch (err: unknown) {
      const error = err as Error;
      setParseError("Erro na interpretação: " + error.message);
    }
  };

  const handleSaveImportedScale = async () => {
    if (!parsedImport) return;
    if (!confirm("Isso criará novas equipes e plantões baseados na prévia. Os alunos serão buscados pelo nome. Continuar?")) return;

    setIsImportingScale(true);
    setErrorMsg(null);
    setShowSuccess("Salvando escalas e equipes...");

    try {
      const batch = writeBatch(db);
      
      // Step 1: Create/Update Teams
      const createdTeamsMap: Record<string, string> = {}; // Name -> ID

      for (const t of parsedImport.teams) {
        // Encontrar se já existe equipe com esse nome
        let teamId = "";
        const existingTeam = fixedTeams.find(ft => ft.teamName === t.name);
        
        if (existingTeam) {
          teamId = existingTeam.id;
        } else {
          const newDoc = doc(collection(db, "fixed_teams"));
          teamId = newDoc.id;
        }

        createdTeamsMap[t.name] = teamId;

        // Note: Neste modo de importação por texto, o usuário pediu para não alterar composição fixa se possível,
        // mas o "Equipe 1 -> R2/R1" no texto implica definir.
        // Se a equipe existe, manteremos o ID mas atualizaremos os membros se solicitado.
        // Se não existe, criamos.

        batch.set(doc(db, "fixed_teams", teamId), {
          teamName: t.name,
          r2Members: t.r2,
          r1Members: t.r1,
          active: true,
          updatedAt: serverTimestamp(),
          createdAt: existingTeam?.createdAt || serverTimestamp()
        }, { merge: true });
      }

      // Step 2: Create Shifts
      for (const s of parsedImport.scales) {
        const teamId = createdTeamsMap[s.team] || fixedTeams.find(ft => ft.teamName === s.team)?.id;
        
        if (!teamId) {
          console.warn(`Equipe ${s.team} não encontrada para escala ${s.start}`);
          continue;
        }

        // Find R3
        const r3 = students.find(stud => 
          stud.residencyLevel === 'R3' && 
          stud.displayName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
            s.r3.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          )
        );

        if (!r3) {
          console.warn(`R3 ${s.r3} não encontrado no sistema.`);
        }

        // Team Shift
        const tsRef = doc(collection(db, "team_shifts"));
        batch.set(tsRef, {
          teamId,
          teamName: s.team,
          startDate: s.start,
          endDate: s.end,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // R3 Shift
        if (r3) {
          const r3Ref = doc(collection(db, "r3_shifts"));
          batch.set(r3Ref, {
            residentId: r3.uid,
            residentName: r3.displayName,
            teamId,
            teamName: s.team,
            startDate: s.start,
            endDate: s.end,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      await batch.commit();
      setShowSuccess("Escalas e equipes importadas com sucesso!");
      setParsedImport(null);
      setImportText("");
      loadTeamManagement();
      setTeamSubTab('team_shifts');
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg("Erro ao salvar importação: " + error.message);
    } finally {
      setIsImportingScale(false);
    }
  };

  // Team Management State
  const [fixedTeams, setFixedTeams] = useState<FixedTeam[]>([]);
  const [teamShifts, setTeamShifts] = useState<TeamShift[]>([]);
  const [r3Shifts, setR3Shifts] = useState<R3Shift[]>([]);

  // Form States for Fixed Team
  const [ftName, setFtName] = useState("");
  const [ftR2, setFtR2] = useState<string[]>([]);
  const [ftR1, setFtR1] = useState<string[]>([]);
  const [ftExtra, setFtExtra] = useState<string[]>([]);
  const [ftNotes, setFtNotes] = useState("");
  const [editingFixedTeam, setEditingFixedTeam] = useState<FixedTeam | null>(null);

  // Form States for Team Shift
  const [tsTeamId, setTsTeamId] = useState("");
  const [tsStart, setTsStart] = useState("");
  const [tsEnd, setTsEnd] = useState("");
  const [tsNotes, setTsNotes] = useState("");

  // Auto Generate Shift States
  const [agTeamId, setAgTeamId] = useState("");
  const [agStart, setAgStart] = useState("");
  const [agEndLimit, setAgEndLimit] = useState("");

  const [agR3Id, setAgR3Id] = useState("");
  const [agR3Start, setAgR3Start] = useState("");
  const [agR3EndLimit, setAgR3EndLimit] = useState("");

  // Form States for R3 Shift
  const [r3sResId, setR3sResId] = useState("");
  const [r3sTeamId, setR3sTeamId] = useState("");
  const [r3sStart, setR3sStart] = useState("");
  const [r3sEnd, setR3sEnd] = useState("");
  const [r3sNotes, setR3sNotes] = useState("");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [students, setStudents] = useState<AppUser[]>([]);
  const [announcements, setAnnouncements] = useState<Post[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lives, setLives] = useState<LiveSession[]>([]);
  
  const [surgicalPlans, setSurgicalPlans] = useState<SurgicalPlan[]>([]);
  const [isImportingScale, setIsImportingScale] = useState(false);

  // Itens removidos do dashboard admin por estarem em coleções secundárias/legadas
  // ou sem listeners ativos. Para restaurar, siga o padrão de source metadata.
  const [surgeries] = useState<Surgery[]>([]);
  const [protocols] = useState<Protocol[]>([]);
  const [notifications] = useState<Notification[]>([]);
  const [highlights] = useState<HomeHighlight[]>([]);
  const [sessions] = useState<unknown[]>([]);

  const getDutyInfoForDate = useCallback((dateStr: string) => {
    if (!dateStr) return { teamName: "Data não definida", r3Name: "N/A", members: [] };
    
    // Normalizar data (YYYY-MM-DD)
    const targetDate = dateStr.split('T')[0];
    
    const teamShift = teamShifts.find(s => targetDate >= s.startDate && targetDate <= s.endDate);
    const r3Shift = r3Shifts.find(s => targetDate >= s.startDate && targetDate <= s.endDate);
    
    const teamInfo = teamShift ? fixedTeams.find(t => t.id === teamShift.teamId) : null;
    
    return {
      teamName: teamShift?.teamName || "Escala não definida",
      r3Name: r3Shift?.residentName || "R3 não definido",
      members: teamInfo ? [...teamInfo.r2Members, ...teamInfo.r1Members] : []
    };
  }, [teamShifts, r3Shifts, fixedTeams]);

  const [selectedPlan, setSelectedPlan] = useState<SurgicalPlan | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [filterResident, setFilterResident] = useState("all");
  const [filterSurgStatus, setFilterSurgStatus] = useState("all");
  const [filterSurgDate, setFilterSurgDate] = useState("all");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editTurma, setEditTurma] = useState("");
  const [editLevel, setEditLevel] = useState<'R1' | 'R2' | 'R3'>('R1');
  
  // Form States
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  
  const [matTitle, setMatTitle] = useState("");
  const [matDesc, setMatDesc] = useState("");
  const [matLink, setMatLink] = useState("");
  const [matType, setMatType] = useState<ItemType>(ItemType.PDF);
  const [matModule, setMatModule] = useState("");
  const [matImportant, setMatImportant] = useState(false);

  // Module Form States
  const [modName, setModName] = useState("");
  const [modDesc, setModDesc] = useState("");
  const [modAudience, setModAudience] = useState<('R1' | 'R2' | 'R3')[]>(['R1', 'R2', 'R3']);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  const [liveTitle, setLiveTitle] = useState("");
  const [liveDesc, setLiveDesc] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [liveDate, setLiveDate] = useState("");
  const [liveTime, setLiveTime] = useState("");
  const [livePlatform, setLivePlatform] = useState<'youtube' | 'vimeo' | 'other'>('youtube');
  const [liveStatus, setLiveStatus] = useState<'scheduled' | 'live' | 'ended'>('scheduled');
  const [liveVisible, setLiveVisible] = useState(true);
  const [editingLive, setEditingLive] = useState<LiveSession | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [showTestPlayer, setShowTestPlayer] = useState(false);
  const [liveThumbnail, setLiveThumbnail] = useState("");
  const [liveChannel, setLiveChannel] = useState("");

  // Surgery Form States
  const [surgTitle, setSurgTitle] = useState("");
  const [surgDesc, setSurgDesc] = useState("");
  const [surgYoutubeUrl, setSurgYoutubeUrl] = useState("");
  const [surgCategory, setSurgCategory] = useState<"trauma" | "ortognatica" | "estetica" | "atm">("trauma");
  const [surgImportant, setSurgImportant] = useState(false);

  // Protocol Form States
  const [protoTitle, setProtoTitle] = useState("");
  const [protoDesc, setProtoDesc] = useState("");
  const [protoLink, setProtoLink] = useState("");
  const [protoContent, setProtoContent] = useState("");
  const [protoImportant, setProtoImportant] = useState(false);
  const [protoLevels, setProtoLevels] = useState<('R1' | 'R2' | 'R3')[]>(['R1', 'R2', 'R3']);
  const [protoFile, setProtoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [protoError, setProtoError] = useState<string | null>(null);
  const [protoSuccess, setProtoSuccess] = useState<string | null>(null);

  // Notification Form States
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifAudience, setNotifAudience] = useState<'all' | 'R1' | 'R2' | 'R3' | 'admin'>('all');
  const [notifPriority, setNotifPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notifLink, setNotifLink] = useState("");

  // Highlight Form States
  const [highTitle, setHighTitle] = useState("");
  const [highSubtitle, setHighSubtitle] = useState("");
  const [highDateText, setHighDateText] = useState("");
  const [highAudience, setHighAudience] = useState<'all' | 'R1' | 'R2' | 'R3'>('all');
  const [highIsActive, setHighIsActive] = useState(true);
  const [editingHighlight, setEditingHighlight] = useState<HomeHighlight | null>(null);

  // Bulk Import State
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");

  // Knowledge Base State
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [chefinhoKnowledge, setChefinhoKnowledge] = useState<ChefinhoKnowledge[]>([]);
  const [kbQuestion, setKbQuestion] = useState("");
  const [kbAnswer, setKbAnswer] = useState("");
  const [kbKeywords, setKbKeywords] = useState("");
  const [isEditingKb, setIsEditingKb] = useState<string | null>(null);

  // AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [isSavingAiConfig, setIsSavingAiConfig] = useState(false);
  const [aiPromptInput, setAiPromptInput] = useState("");
  const [isImportingInstitutional, setIsImportingInstitutional] = useState(false);

  // Connection Test State
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean, message: string, details?: unknown } | null>(null);
  const [testQuestion, setTestQuestion] = useState("Como tratar uma fratura de mandíbula?");
  const [isTestingFlow, setIsTestingFlow] = useState(false);
  const [flowResult, setFlowResult] = useState<string | null>(null);

  // WhatsApp Import State
  const [importStep, setImportStep] = useState<'idle' | 'reading' | 'parsing' | 'preview' | 'saving' | 'done' | 'error'>('idle');
  const [importFile, setImportFile] = useState<{ name: string, size: number } | null>(null);
  const [importStats, setImportStats] = useState({ total: 0, valid: 0, added: 0 });
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<KnowledgeBaseCTBMF[]>([]);
  const [importBatchProgress, setImportBatchProgress] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingBatch, setPendingBatch] = useState<KnowledgeBaseCTBMF[]>([]);

  // Edit Surgery State
  const [editingSurgery, setEditingSurgery] = useState<Surgery | null>(null);
  const [editSurgTitle, setEditSurgTitle] = useState("");
  const [editSurgDesc, setEditSurgDesc] = useState("");
  const [editSurgYoutubeUrl, setEditSurgYoutubeUrl] = useState("");
  const [editSurgCategory, setEditSurgCategory] = useState<"trauma" | "ortognatica" | "estetica" | "atm">("trauma");
  const [editSurgImportant, setEditSurgImportant] = useState(false);

  // Chefinho Questions State
  const [chefinhoQuestions, setChefinhoQuestions] = useState<ChefinhoQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<ChefinhoQuestion | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterTopic, setFilterTopic] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isTraining, setIsTraining] = useState(false);

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

  const loadRequests = useCallback(async () => {
    try {
      console.log('[ADMIN] Buscando solicitações (coleção: access_requests, status: pending)');
      const q = query(collection(db, "access_requests"), where("status", "==", "pending"));
      const snapshot = await getDocs(q);
      console.log(`[ADMIN] Solicitações recebidas: ${snapshot.size} documentos`);
      
      const data = snapshot.docs.map((d) => ({ 
        id: d.id, 
        ...(d.data() as AccessRequest),
        _sourceDb: 'named' as const,
        _sourceColl: 'access_requests' as const
      }));
      
      data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setRequests(data as unknown as AccessRequest[]);
    } catch (error: unknown) { 
      const err = error as { code?: string; message?: string };
      console.error("[ADMIN] Erro ao carregar solicitações:", err);
      setErrorMsg(`Erro ao carregar solicitações: ${err.message || 'Erro desconhecido'}`); 
    }
  }, []);

  const loadStudents = useCallback(async () => {
    try {
      console.log('[ADMIN] Buscando alunos em ambos os bancos com identificação de origem');
      const qNamed = query(collection(db, "users"), where("status", "==", "approved"));
      const qDefault = query(collection(dbDefault, "users"), where("status", "==", "approved"));
      
      const [snapNamed, snapDefault] = await Promise.all([
        getDocs(qNamed),
        getDocs(qDefault)
      ]);

      console.log(`[ADMIN] Alunos: ${snapNamed.size} (Nomeado), ${snapDefault.size} (Padrão)`);
      
      const studentsNamed = snapNamed.docs.map(d => ({ 
        uid: d.id, 
        ...(d.data() as AppUser),
        _sourceDb: 'named',
        _sourceColl: 'users'
      }));
      
      const studentsDefault = snapDefault.docs.map(d => ({ 
        uid: d.id, 
        ...(d.data() as AppUser),
        _sourceDb: 'default',
        _sourceColl: 'users'
      }));
      
      // Unificar sem duplicatas, priorizando named se houver conflito de ID
      const allStudents = [...studentsNamed];
      studentsDefault.forEach(s => {
        if (!allStudents.some(as => as.uid === s.uid)) {
          allStudents.push(s);
        }
      });

      allStudents.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
      setStudents(allStudents);
    } catch (error: unknown) { 
      const err = error as { code?: string; message?: string };
      console.error("[ADMIN] Erro ao carregar alunos:", err);
      setErrorMsg(`Erro ao carregar alunos: ${err.message || 'Erro desconhecido'}`); 
    }
  }, []);

  const loadKnowledgeBase = useCallback(async () => {
    try {
      const q = query(collection(db, "knowledge_base"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      setKnowledgeEntries(snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        _sourceDb: 'named',
        _sourceColl: 'knowledge_base'
      })));

      const q2 = query(collection(db, "chefinho_knowledge"), orderBy("createdAt", "desc"));
      const snapshot2 = await getDocs(q2);
      setChefinhoKnowledge(snapshot2.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        _sourceDb: 'named',
        _sourceColl: 'chefinho_knowledge'
      } as unknown as ChefinhoKnowledge)));
    } catch (error) {
      console.error("Erro ao carregar base de conhecimento:", error);
    }
  }, []);

  const loadAiConfig = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "ai_config"));
      if (!snapshot.empty) {
        const config = snapshot.docs[0].data() as AIConfig;
        setAiConfig(config);
        setAiPromptInput(config.systemPrompt);
      }
    } catch (error) {
      console.error("Erro ao carregar configuração da IA:", error);
    }
  }, []);

  const triggerNotification = async (title: string, message: string, audience: 'all' | 'R1' | 'R2' | 'R3' | 'admin' = 'all', link?: string) => {
    try {
      await addDoc(collection(db, "notifications"), {
        title,
        message,
        audience,
        link: link || null,
        isActive: true,
        priority: 'medium',
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
    } catch (error) {
      console.error("Erro ao disparar notificação automática:", error);
    }
  };

  const loadChefinhoQuestions = useCallback(async () => {
    try {
      const q = query(collection(db, "chefinho_questions"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      setChefinhoQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChefinhoQuestion)));
    } catch (error) {
      console.error("Erro ao carregar perguntas do Chefinho:", error);
    }
  }, []);

  const loadSurgicalPlans = useCallback(async () => {
    try {
      console.log('[ADMIN] Buscando planejamentos (coleção: surgical_plans)');
      const q = query(collection(dbLegacy, "surgical_plans"));
      const snapshot = await getDocs(q);
      console.log(`[ADMIN] Planejamentos recebidos: ${snapshot.size} documentos`);
      
      const plansData = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        _sourceDb: 'legacy',
        _sourceColl: 'surgical_plans'
      } as SurgicalPlan));
      
      plansData.sort((a, b) => {
        const getTime = (val: unknown) => {
          if (!val) return 0;
          if (typeof val === 'object' && val !== null && 'toMillis' in val) {
            return (val as { toMillis: () => number }).toMillis();
          }
          return new Date(val as string | number | Date).getTime();
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });

      setSurgicalPlans(plansData);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error("[ADMIN] Erro ao carregar planejamentos:", err);
      setErrorMsg(`Erro ao carregar planejamentos: ${err.message || 'Erro desconhecido'}.`);
    }
  }, []);

  const loadTeamManagement = useCallback(async () => {
    try {
      const ftSnapshot = await getDocs(collection(db, "fixed_teams"));
      const teams = ftSnapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        _sourceDb: 'named',
        _sourceColl: 'fixed_teams'
      } as FixedTeam));
      setFixedTeams(teams);

      const tsSnapshot = await getDocs(collection(db, "team_shifts"));
      const shifts = tsSnapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        _sourceDb: 'named',
        _sourceColl: 'team_shifts'
      } as TeamShift));
      
      const r3sSnapshot = await getDocs(collection(db, "r3_shifts"));
      const r3sh = r3sSnapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        _sourceDb: 'named',
        _sourceColl: 'r3_shifts'
      } as R3Shift));

      const sortShifts = <T extends { startDate: string; endDate: string }>(list: T[]): T[] => {
        const now = new Date().toISOString().split('T')[0];
        return [...list].sort((a, b) => {
          // 1. Check if current
          const isA = now >= a.startDate && now <= a.endDate;
          const isB = now >= b.startDate && now <= b.endDate;
          if (isA && !isB) return -1;
          if (!isA && isB) return 1;

          // 2. Future vs Past
          const aFuture = a.startDate >= now;
          const bFuture = b.startDate >= now;
          if (aFuture && !bFuture) return -1;
          if (!aFuture && bFuture) return 1;

          // 3. Chronological
          if (aFuture) return a.startDate.localeCompare(b.startDate); // Future: soonest first
          return b.startDate.localeCompare(a.startDate); // Past: latest first
        });
      };

      setTeamShifts(sortShifts(shifts));
      setR3Shifts(sortShifts(r3sh));
    } catch (err) {
      console.error("Erro ao carregar gestão de equipes:", err);
    }
  }, []);

  const updatePlanStatus = async (planId: string, status: 'reviewed' | 'approved', notes: string) => {
    try {
      await updateDoc(doc(dbLegacy, "surgical_plans", planId), {
        status,
        reviewNotes: notes,
        reviewedBy: user.displayName,
        updatedAt: serverTimestamp()
      });
      setShowSuccess("Planejamento atualizado!");
      loadSurgicalPlans();
      setSelectedPlan(null);
    } catch { setErrorMsg("Erro ao atualizar planejamento."); }
  };

  const toggleImportantQuestion = async (q: ChefinhoQuestion) => {
    try {
      await updateDoc(doc(db, "chefinho_questions", q.id!), {
        isMarkedImportant: !q.isMarkedImportant
      });
      setChefinhoQuestions(prev => prev.map(item => item.id === q.id ? { ...item, isMarkedImportant: !q.isMarkedImportant } : item));
      if (selectedQuestion?.id === q.id) {
        setSelectedQuestion({ ...selectedQuestion, isMarkedImportant: !q.isMarkedImportant });
      }
      setShowSuccess(q.isMarkedImportant ? "Removido dos importantes" : "Marcado como importante");
    } catch { setErrorMsg("Erro ao alterar status."); }
  };

  const saveAdminNotes = async (id: string, notes: string) => {
    setIsSavingNotes(true);
    try {
      await updateDoc(doc(db, "chefinho_questions", id), {
        adminNotes: notes
      });
      setChefinhoQuestions(prev => prev.map(item => item.id === id ? { ...item, adminNotes: notes } : item));
      setShowSuccess("Notas salvas!");
    } catch { setErrorMsg("Erro ao salvar notas."); }
    finally { setIsSavingNotes(false); }
  };

  const handleUseForTraining = async (q: ChefinhoQuestion) => {
    setIsTraining(true);
    try {
      await addDoc(collection(db, "chefinho_learning"), {
        question: q.question,
        answer: q.answer,
        topic: q.topicDetected,
        createdAt: serverTimestamp(),
        originalQuestionId: q.id
      });
      setShowSuccess("Enviado para treinamento!");
    } catch { setErrorMsg("Erro ao enviar para treinamento."); }
    finally { setIsTraining(false); }
  };

  useEffect(() => {
    let active = true;
    
    const loadInitialData = async () => {
      if (!active) return;
      
      try {
        switch(activeTab) {
          case 'students':
            await Promise.all([loadRequests(), loadStudents()]);
            break;
          case 'knowledge':
            await Promise.all([loadKnowledgeBase(), loadAiConfig()]);
            break;
          case 'chefinho_questions':
            await loadChefinhoQuestions();
            break;
          case 'surgical_plans':
            await loadSurgicalPlans();
            break;
          case 'team_management':
            await loadTeamManagement();
            break;
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.error("[ADMIN] Erro no carregamento inicial da aba:", activeTab, error);
      }
    };

    loadInitialData();

    // Listeners controlados
    const unsubscribes: (() => void)[] = [];

    if (activeTab === 'announcements') {
      const unsub = onSnapshot(collection(db, "announcements"), (snapshot) => {
        const data = snapshot.docs.map(d => ({ 
          id: d.id, ...d.data(), _sourceDb: 'named', _sourceColl: 'announcements' 
        } as Post));
        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAnnouncements(data);
      }, (err: unknown) => console.error("Announcements Listener Error:", err));
      unsubscribes.push(unsub);
    } else if (activeTab === 'materials') {
      const unsubMat = onSnapshot(collection(dbLegacy, "materials"), (snapshot) => {
        setMaterials(snapshot.docs.map(d => ({ 
          id: d.id, ...d.data(), _sourceDb: 'legacy', _sourceColl: 'materials' 
        } as MaterialItem)));
      }, (err: unknown) => console.error("Materials Listener Error:", err));
      const unsubMod = onSnapshot(collection(dbLegacy, "modules"), (snapshot) => {
        const mods = snapshot.docs.map(d => ({ 
          id: d.id, ...d.data(), _sourceDb: 'legacy', _sourceColl: 'modules' 
        } as Module));
        setModules(mods);
      }, (err: unknown) => console.error("Modules Listener Error:", err));
      unsubscribes.push(unsubMat, unsubMod);
    } else if (activeTab === 'lives') {
      const unsub = onSnapshot(collection(db, "lives"), (snapshot) => {
        const data = snapshot.docs.map(d => ({ 
          id: d.id, ...d.data(), _sourceDb: 'named', _sourceColl: 'lives' 
        } as LiveSession));
        data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setLives(data);
      }, (err: unknown) => console.error("Lives Listener Error:", err));
      unsubscribes.push(unsub);
    }

    return () => {
      active = false;
      unsubscribes.forEach(fn => {
        try { fn(); } catch { /* ignore */ }
      });
    };
  }, [activeTab, loadAiConfig, loadChefinhoQuestions, loadKnowledgeBase, loadRequests, loadStudents, loadSurgicalPlans, loadTeamManagement]);

  const filteredChefinhoQuestions = useMemo(() => {
    return chefinhoQuestions.filter(q => {
      // Requisito: Apenas mostrar perguntas após a data de lançamento oficial
      if (q.timestamp && typeof q.timestamp.toDate === 'function') {
        if (q.timestamp.toDate() < LAUNCH_DATE) return false;
      }

      const matchesLevel = filterLevel === "all" || q.userLevel === filterLevel;
      const matchesTopic = filterTopic === "all" || q.topicDetected === filterTopic;
      
      let matchesDate = true;
      if (filterDate !== "all" && q.timestamp && typeof q.timestamp.toDate === 'function') {
        const qDate = q.timestamp.toDate();
        const now = new Date();
        if (filterDate === "today") {
          matchesDate = qDate.toDateString() === now.toDateString();
        } else if (filterDate === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = qDate >= weekAgo;
        }
      }
      
      return matchesLevel && matchesTopic && matchesDate;
    });
  }, [chefinhoQuestions, filterLevel, filterTopic, filterDate]);

  const chefinhoStats = useMemo(() => {
    const stats = {
      total: chefinhoQuestions.length,
      byTopic: {} as Record<string, number>,
      byLevel: {} as Record<string, number>
    };
    
    chefinhoQuestions.forEach(q => {
      stats.byTopic[q.topicDetected] = (stats.byTopic[q.topicDetected] || 0) + 1;
      stats.byLevel[q.userLevel] = (stats.byLevel[q.userLevel] || 0) + 1;
    });
    
    return stats;
  }, [chefinhoQuestions]);

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

  const getValidDate = (dateVal: unknown) => {
    if (!dateVal) return new Date(0);
    if (typeof dateVal === 'object' && dateVal !== null && 'toDate' in dateVal) {
      return (dateVal as { toDate: () => Date }).toDate();
    }
    const d = new Date(dateVal as string | number | Date);
    return isNaN(d.getTime()) ? new Date(0) : d;
  };

  const filteredSurgicalPlans = useMemo(() => {
    return surgicalPlans.filter(plan => {
      const matchesResident = filterResident === "all" || plan.residentId === filterResident;
      const matchesStatus = filterSurgStatus === "all" || plan.status === filterSurgStatus;
      
      let matchesDate = true;
      if (filterSurgDate !== "all" && plan.surgeryDate) {
        const surgDate = getValidDate(plan.surgeryDate);
        const now = new Date();
        if (filterSurgDate === "today") {
          matchesDate = surgDate.toDateString() === now.toDateString();
        } else if (filterSurgDate === "week") {
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          matchesDate = surgDate >= now && surgDate <= weekFromNow;
        } else if (filterSurgDate === "past") {
          matchesDate = surgDate < now;
        }
      }
      
      const matchesSearch = searchTerm === "" || 
        plan.residentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.procedureName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.patientCode.toLowerCase().includes(searchTerm.toLowerCase());
        
      return matchesResident && matchesStatus && matchesDate && matchesSearch;
    });
  }, [surgicalPlans, filterResident, filterSurgStatus, filterSurgDate, searchTerm]);

  const approveUser = async (req: AccessRequest) => {
    try {
      const inferredLevel = req.turma_id.startsWith('r1') ? 'R1' : 
                           req.turma_id.startsWith('r2') ? 'R2' : 
                           req.turma_id.startsWith('r3') ? 'R3' : 'R1';

      await setDoc(doc(db, "users", req.uid), { 
        uid: req.uid, 
        displayName: req.displayName, 
        email: req.email, 
        turma_id: req.turma_id, 
        residencyLevel: inferredLevel,
        status: "approved", 
        role: "student", 
        updatedAt: Timestamp.now() 
      }, { merge: true });
      await updateDoc(doc(db, "access_requests", req.id), { status: "approved", decidedAt: Timestamp.now() });
      setShowSuccess("Aprovado com sucesso!");
      loadRequests(); loadStudents();
    } catch { setErrorMsg("Erro ao aprovar."); }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle || !postContent) return;
    try {
      await addDoc(collection(db, "announcements"), {
        title: postTitle,
        content: postContent,
        date: new Date().toISOString(),
        authorName: user.displayName // Nome dinâmico do administrador atual
      });
      setPostTitle(""); setPostContent("");
      setShowSuccess("Aviso publicado!");
      triggerNotification("Novo Aviso", postTitle, "all");
    } catch { setErrorMsg("Erro ao publicar aviso."); }
  };

  const restoreAcidMaterials = async () => {
    const acidData = [
      {
        title: "Protocolo de Ácido Hialurônico em Estética Facial",
        description: "Diretrizes para preenchimento e harmonização facial com ácido hialurônico.",
        type: ItemType.PDF,
        link: "https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        moduleId: matModule || "mod1",
        isImportant: true
      },
      {
        title: "Manejo de Intercorrências com Ácido Hialurônico",
        description: "Uso de hialuronidase e protocolos de emergência em oclusão vascular.",
        type: ItemType.PROTOCOL,
        link: "https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        moduleId: matModule || "mod1",
        isImportant: true
      }
    ];

    if (!confirm("Deseja restaurar as 2 publicações sobre Ácido Hialurônico?")) return;

    try {
      let count = 0;
      for (const acid of acidData) {
        const q = query(collection(dbLegacy, "materials"), where("title", "==", acid.title));
        const existing = await getDocs(q);
        if (existing.empty) {
          await addDoc(collection(dbLegacy, "materials"), {
            ...acid,
            createdAt: serverTimestamp()
          });
          count++;
        }
      }
      setShowSuccess(`${count} materiais sobre Ácido restaurados!`);
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro ao restaurar materiais de ácido.");
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matTitle || !matLink || !matModule) return;
    try {
      await addDoc(collection(dbLegacy, "materials"), {
        title: matTitle,
        description: matDesc,
        link: matLink,
        type: matType,
        moduleId: matModule,
        isImportant: matImportant,
        theme: matType === ItemType.VIDEO ? "Gravações" : ""
      });
      setMatTitle(""); setMatDesc(""); setMatLink(""); setMatImportant(false);
      setShowSuccess("Material cadastrado!");
      triggerNotification("Novo Material", matTitle, "all", matLink);
    } catch { setErrorMsg("Erro ao cadastrar material."); }
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modName) return;
    try {
      if (editingModule) {
        await updateDoc(doc(dbLegacy, "modules", editingModule.id), {
          name: modName,
          description: modDesc,
          audience: modAudience
        });
        setEditingModule(null);
        setShowSuccess("Tema atualizado!");
      } else {
        await addDoc(collection(dbLegacy, "modules"), {
          name: modName,
          description: modDesc,
          audience: modAudience,
          createdAt: serverTimestamp()
        });
        setShowSuccess("Tema criado!");
        triggerNotification("Novo Tema Disponível", modName, "all");
      }
      setModName(""); setModDesc(""); setModAudience(['R1', 'R2', 'R3']);
    } catch { setErrorMsg("Erro ao salvar tema."); }
  };

  const startEditingModule = (mod: Module) => {
    setEditingModule(mod);
    setModName(mod.name);
    setModDesc(mod.description || "");
    setModAudience(mod.audience || ['R1', 'R2', 'R3']);
  };

  const handleAddLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveTitle || !liveUrl) return;

    const videoId = livePlatform === 'youtube' ? extractYoutubeId(liveUrl) : "";
    const embedUrl = generateEmbedUrl(liveUrl, livePlatform);

    console.log(`[ADMIN-LIVE] Salvando Live:`, {
      originalUrl: liveUrl,
      platform: livePlatform,
      videoId,
      embedUrl
    });

    try {
      const liveData = {
        title: liveTitle,
        description: liveDesc,
        liveUrl,
        embedUrl,
        videoId,
        thumbnail: liveThumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ""),
        channelTitle: liveChannel,
        platform: livePlatform,
        status: liveStatus,
        date: liveDate,
        time: liveTime,
        visible: liveVisible,
        updatedAt: serverTimestamp(),
        createdAt: editingLive ? editingLive.createdAt : serverTimestamp()
      };

      if (editingLive) {
        await updateDoc(doc(db, "lives", editingLive.id), liveData);
        setShowSuccess("Live atualizada com sucesso!");
      } else {
        // Se estiver marcando como live agora, encerra as outras
        if (liveStatus === 'live') {
          const activeLivesQuery = query(collection(db, "lives"), where("status", "==", "live"));
          const activeLivesSnapshot = await getDocs(activeLivesQuery);
          const updatePromises = activeLivesSnapshot.docs.map(d => updateDoc(d.ref, { status: "ended" }));
          await Promise.all(updatePromises);
        }

        await addDoc(collection(db, "lives"), liveData);
        setShowSuccess("Live cadastrada com sucesso!");
        
        if (liveStatus === 'live') {
          triggerNotification("🔴 AO VIVO AGORA", liveTitle, "all");
        }
      }

      setLiveTitle(""); 
      setLiveDesc(""); 
      setLiveUrl("");
      setLiveDate("");
      setLiveTime("");
      setLivePlatform('youtube');
      setLiveStatus('scheduled');
      setLiveVisible(true);
      setLiveThumbnail("");
      setLiveChannel("");
      setEditingLive(null);
      setShowTestPlayer(false);
    } catch (error) {
      console.error("Erro ao salvar live:", error);
      setErrorMsg("Erro ao salvar live."); 
    }
  };

  const handleFetchYoutubeMetadata = async () => {
    if (!liveUrl || livePlatform !== 'youtube') return;
    
    setIsFetchingMetadata(true);
    const videoId = extractYoutubeId(liveUrl);

    try {
      console.log(`[ADMIN-LIVE] Buscando metadados para: ${liveUrl}`);
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(liveUrl)}&format=json`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[ADMIN-LIVE] Metadados recebidos:`, data);
        if (!liveTitle) setLiveTitle(data.title);
        setLiveThumbnail(data.thumbnail_url);
        setLiveChannel(data.author_name);
        setShowSuccess("Metadados recuperados com sucesso!");
      } else {
        console.warn(`[ADMIN-LIVE] Falha ao recuperar via oEmbed (Status: ${response.status})`);
        if (videoId) {
          setLiveThumbnail(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
          setShowSuccess("Vídeo identificado, mas metadados detalhados indisponíveis.");
        }
      }
    } catch (err) {
      console.error(`[ADMIN-LIVE] Erro na busca de metadados:`, err);
      if (videoId) {
        setLiveThumbnail(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
      }
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  // Removed redundant local functions: extractYoutubeId, detectPlatform, generateEmbedUrl
  // These are now imported from ../utils/videoUtils

  const handleAddSurgery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surgTitle || !surgYoutubeUrl) return;
    
    const videoId = extractYoutubeId(surgYoutubeUrl);
    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    try {
      await addDoc(collection(db, "surgeries"), {
        title: surgTitle,
        description: surgDesc,
        youtubeVideoId: videoId,
        thumbnail,
        category: surgCategory,
        isImportant: surgImportant,
        createdAt: Timestamp.now()
      });
      setSurgTitle(""); setSurgDesc(""); setSurgYoutubeUrl(""); setSurgImportant(false);
      setShowSuccess("Cirurgia cadastrada com sucesso!");
      triggerNotification("Nova Cirurgia", surgTitle, "all");
    } catch { setErrorMsg("Erro ao cadastrar cirurgia."); }
  };

  const handleUpdateSurgery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSurgery || !editSurgTitle || !editSurgYoutubeUrl) return;

    const videoId = extractYoutubeId(editSurgYoutubeUrl);
    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    try {
      await updateDoc(doc(db, "surgeries", editingSurgery.id!), {
        title: editSurgTitle,
        description: editSurgDesc,
        youtubeVideoId: videoId,
        thumbnail,
        category: editSurgCategory,
        isImportant: editSurgImportant,
        updatedAt: Timestamp.now()
      });
      setShowSuccess("Cirurgia atualizada!");
      setEditingSurgery(null);
    } catch { setErrorMsg("Erro ao atualizar cirurgia."); }
  };

  const startEditingSurgery = (surg: Surgery) => {
    setEditingSurgery(surg);
    setEditSurgTitle(surg.title);
    setEditSurgDesc(surg.description);
    setEditSurgYoutubeUrl(surg.youtubeVideoId); // Assuming ID is stored, but extractYoutubeId handles it
    setEditSurgCategory(surg.category);
    setEditSurgImportant(surg.isImportant);
  };

  const toggleSurgeryImportance = async (surg: Surgery) => {
    try {
      await updateDoc(doc(db, "surgeries", surg.id!), {
        isImportant: !surg.isImportant
      });
      setShowSuccess(surg.isImportant ? "Removido dos destaques" : "Marcado como importante");
    } catch { setErrorMsg("Erro ao alterar destaque."); }
  };

  const handleBulkImport = async () => {
    if (!bulkUrls.trim()) return;
    
    const urls = bulkUrls.split('\n').filter(u => u.trim());
    let count = 0;
    
    try {
      for (const url of urls) {
        const videoId = extractYoutubeId(url.trim());
        if (!videoId) continue;
        
        const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        
        await addDoc(collection(db, "surgeries"), {
          title: `Cirurgia de Trauma - ${videoId}`, // Placeholder title
          description: "Importado via playlist",
          youtubeVideoId: videoId,
          thumbnail,
          category: "trauma",
          isImportant: false,
          createdAt: Timestamp.now()
        });
        count++;
      }
      setShowSuccess(`${count} cirurgias importadas com sucesso!`);
      setBulkUrls("");
      setShowBulkImport(false);
    } catch { setErrorMsg("Erro ao importar playlist."); }
  };

  const syncInstitutionalProtocols = async () => {
    const protocolsData = [
      { 
        title: "Orientações ao R2 Programa Residência", 
        desc: "Guia de conduta e responsabilidades para o residente do segundo ano.",
        content: "<h3>Responsabilidades do R2</h3><p>Supervisão dos R1, auxílio em cirurgias de médio porte, evolução de prontuários complexos.</p>",
        levels: ['R2'],
        important: true
      },
      { 
        title: "Protocolo Relatório Evolutivo", 
        desc: "Padrão de escrita para evolução diária de pacientes internados.",
        content: "<h3>Estrutura do Relatório</h3><p>1. Identificação<br>2. Quadro Clínico Atual<br>3. Exame Físico<br>4. Conduta</p>",
        levels: ['R1', 'R2', 'R3'],
        important: true
      },
      { 
        title: "Protocolo de Preenchimento de Prontuário", 
        desc: "Normas técnicas para documentação legal e clínica no prontuário do paciente.",
        content: "<h3>Regras Gerais</h3><p>Letra legível, sem rasuras, assinatura e carimbo em todas as folhas.</p>",
        levels: ['R1', 'R2', 'R3'],
        important: true
      },
      { 
        title: "Regimento Interno Especialização CTBMF", 
        desc: "Normas e regulamentos da especialização em Cirurgia e Traumatologia Bucomaxilofacial.",
        content: "<h3>Capítulo I - Dos Objetivos</h3><p>A especialização visa a formação técnica e ética do cirurgião...</p>",
        levels: ['R1', 'R2', 'R3'],
        important: true
      },
      { 
        title: "Protocolo de Atendimento ao Trauma Facial (ATLS)", 
        desc: "Diretrizes básicas para o primeiro atendimento ao paciente politraumatizado com foco em face.",
        content: "<h3>1. Avaliação Primária</h3><p>A (Vias Aéreas), B (Respiração), C (Circulação), D (Déficit Neurológico), E (Exposição).</p>",
        levels: ['R1', 'R2', 'R3'],
        important: true
      },
      { 
        title: "Manejo de Infecções Odontogênicas Complexas", 
        desc: "Protocolo de antibioticoterapia e tempos cirúrgicos para abscessos cervicofaciais.",
        content: "<h3>Antibioticoterapia</h3><p>Esquema preferencial: Penicilina G Cristalina + Metronidazol ou Clindamicina.</p>",
        levels: ['R1', 'R2', 'R3'],
        important: true
      }
    ];

    if (!confirm(`Deseja restaurar os ${protocolsData.length} protocolos institucionais solicitados? (O sistema pulará os que já existem)`)) return;

    try {
      let count = 0;
      for (const proto of protocolsData) {
        const q = query(collection(db, "protocols"), where("title", "==", proto.title));
        const existing = await getDocs(q);
        
        if (existing.empty) {
          await addDoc(collection(db, "protocols"), {
            title: proto.title,
            description: proto.desc,
            content: proto.content,
            accessLevels: proto.levels,
            isImportant: proto.important,
            type: 'text',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid
          });
          count++;
        }
      }
      setShowSuccess(`${count} novos protocolos restaurados com sucesso!`);
    } catch (err) { 
      console.error(err);
      setErrorMsg("Erro ao restaurar protocolos."); 
    }
  };

  const syncTraumaPlaylist = async () => {
    const surgeriesData = [
      { id: "PirJH5Q7X4Y", title: "CIRURGIA DE FRATURA DE SINFISE MANDIBULAR", desc: "Redução e fixação de fratura de sínfise mandibular.", cat: "trauma" },
      { id: "r79p6YCsYHc", title: "Fx. Md. - Protocolo Pré-Operatório", desc: "Conferência do paciente, tricotomia, jejum e preparo para o procedimento.", cat: "trauma" },
      { id: "91axE7kT85E", title: "Cirurgia Ortognática - Técnica 360", desc: "Técnica avançada para R2 e R3 - Instituto Andreoni.", cat: "ortognatica" },
      { id: "JXFslTe6228", title: "Reconstrução com Enxertos Ósseos", desc: "Uso de osso autógeno e biomateriais para reabilitação maxilomandibular.", cat: "trauma" },
      { id: "-9LLq2j2Wic", title: "Fx. Bilateral de Mandíbula", desc: "Tratamento cirúrgico de fratura bilateral de mandíbula.", cat: "trauma" },
      { id: "pa09Tx-DFEI", title: "Acessos Cirúrgicos ao Terço Médio", desc: "Demonstração de acessos transconjuntival e subciliar em trauma orbital.", cat: "trauma" },
      { id: "QD_EEfbSOSU", title: "Cirurgia de Trauma Facial - QD_EEfbSOSU", desc: "Procedimento de trauma bucomaxilofacial.", cat: "trauma" },
      { id: "sg78EVdDSiM", title: "Planejamento Virtual em Ortognática", desc: "Discussão clínica sobre guias cirúrgicos e planejamento 3D.", cat: "ortognatica" },
      { id: "Jnu9nQnZSuo", title: "Osteotomia Le Fort I e Sagital", desc: "Técnica passo a passo para correção de deformidades dentofaciais.", cat: "ortognatica" },
      { id: "YRVHxk66xeA", title: "Manejo de Complicações Transoperatórias", desc: "Protocolos de segurança e resolução de intercorrências em cirurgia de grande porte.", cat: "ortognatica" },
      { id: "zt5ZEV1A-lY", title: "Cirurgia de Trauma Facial - zt5ZEV1A-lY", desc: "Procedimento de trauma bucomaxilofacial.", cat: "trauma" },
      { id: "D4l1EuQB8kk", title: "Cirurgia de Trauma Facial - D4l1EuQB8kk", desc: "Procedimento de trauma bucomaxilofacial.", cat: "trauma" },
      { id: "wV3vv7yGbbM", title: "Biópsias e Cirurgia Oral Menor", desc: "Técnicas de exérese e manejo de lesões benignas em ambiente ambulatorial.", cat: "estetica" },
      { id: "b6mr6EjTwF0", title: "Fx. Complexa de Mandíbula", desc: "Planejamento e técnica cirúrgica para fraturas complexas.", cat: "trauma" },
      { id: "R4stAs19HCg", title: "Expansão Cirúrgica de Maxila (ERAM)", desc: "Indicações técnicas e acompanhamento pós-operatório imediato.", cat: "ortognatica" },
      { id: "Loi9VUiYlnc", title: "Cirurgia de Trauma Facial - Loi9VUiYlnc", desc: "Procedimento de trauma bucomaxilofacial.", cat: "trauma" },
      { id: "SRgvNbgJ4vQ", title: "Afundamento de Osso Frontal - Caso 1", desc: "Tratamento cirúrgico de sequela de fratura de parede anterior de seio frontal.", cat: "trauma" },
      { id: "nyf_Qmp4QeE", title: "Afundamento de Osso Frontal - Caso 2", desc: "Tratamento cirúrgico de sequela de fratura de parede anterior de seio frontal.", cat: "trauma" },
      { id: "X6m7y2azIrk", title: "Cirurgia de Trauma Facial - X6m7y2azIrk", desc: "Procedimento de trauma bucomaxilofacial.", cat: "trauma" },
      { id: "P4xbLL7AKsg", title: "Fx. Rebordo Inferior de Órbita", desc: "Reconstrução de rebordo orbitário e assoalho por acesso transconjuntival.", cat: "trauma" },
      { id: "q_oAFQ2POVw", title: "Tratamento de Fraturas Mandibulares", desc: "Acesso e fixação interna rígida em fratura de ângulo e sínfise.", cat: "trauma" }
    ];

    if (!confirm(`Deseja restaurar as ${surgeriesData.length} cirurgias recuperadas? (O sistema pulará as que já existem)`)) return;

    try {
      let count = 0;
      for (const surg of surgeriesData) {
        // Check if already exists in named DB
        const q = query(collection(db, "surgeries"), where("youtubeVideoId", "==", surg.id));
        const existing = await getDocs(q);
        
        if (existing.empty) {
          const thumbnail = `https://img.youtube.com/vi/${surg.id}/hqdefault.jpg`;
          await addDoc(collection(db, "surgeries"), {
            title: surg.title,
            description: surg.desc,
            youtubeVideoId: surg.id,
            thumbnail,
            category: surg.cat || "trauma",
            isImportant: false,
            createdAt: Timestamp.now()
          });
          count++;
        }
      }
      setShowSuccess(`${count} novas cirurgias restauradas com sucesso!`);
    } catch (err) { 
      console.error(err);
      setErrorMsg("Erro ao restaurar cirurgias."); 
    }
  };

  const handleAddProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!protoTitle) {
      setProtoError("O título do protocolo é obrigatório.");
      return;
    }
    if (!protoLink && !protoContent && !protoFile) {
      setProtoError("Adicione um conteúdo, link ou arquivo PDF ao protocolo.");
      return;
    }
    
    setIsSaving(true);
    setProtoError(null);
    setProtoSuccess(null);
    setUploadProgress(0);

    try {
      let pdfUrl = "";
      let pdfFileName = "";

      if (protoFile) {
        // Validation
        if (protoFile.type !== "application/pdf") {
          throw new Error("Apenas arquivos PDF são permitidos.");
        }
        if (protoFile.size > 15 * 1024 * 1024) {
          throw new Error("O arquivo excede o limite de 15MB.");
        }

        // Sanitize filename
        const timestamp = Date.now();
        const sanitizedName = protoFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const storagePath = `protocolos/${timestamp}-${sanitizedName}`;
        const storageRef = ref(storage, storagePath);

        // Upload with progress (switching to uploadBytes for reliability, progress simulated or omitted if not using resumable)
        // Actually, let's keep resumable but fix the promise handling
        const uploadTask = uploadBytesResumable(storageRef, protoFile);

        const uploadPromise = new Promise<string>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Erro no uploadTask:", error);
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              } catch (err) {
                reject(err);
              }
            }
          );
        });

        pdfUrl = await uploadPromise;
        pdfFileName = protoFile.name;
      }

      // Determine type
      let type: 'text' | 'pdf' | 'mixed' = 'text';
      if (pdfUrl && protoContent) type = 'mixed';
      else if (pdfUrl) type = 'pdf';
      else type = 'text';

      await addDoc(collection(db, "protocols"), {
        title: protoTitle,
        description: protoDesc,
        externalLink: protoLink || null,
        content: protoContent || null,
        pdfUrl: pdfUrl || null,
        pdfFileName: pdfFileName || null,
        isImportant: protoImportant,
        accessLevels: protoLevels,
        type,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setProtoTitle(""); 
      setProtoDesc(""); 
      setProtoLink(""); 
      setProtoContent("");
      setProtoImportant(false); 
      setProtoFile(null);
      setUploadProgress(0);
      setProtoSuccess("Protocolo cadastrado com sucesso!");
      triggerNotification("Novo Protocolo", protoTitle, "all");
      
      // Clear success message after 5 seconds
      setTimeout(() => setProtoSuccess(null), 5000);
    } catch (err: unknown) { 
      console.error("Erro ao salvar protocolo:", err);
      const error = err as { message?: string };
      setProtoError(error.message || "Erro ao cadastrar protocolo. Verifique sua conexão."); 
    } finally {
      setIsSaving(false);
    }
  };

  const promoteToAdmin = async (student: AppUser) => {
    if (confirm(`Deseja tornar ${student.displayName} um administrador?`)) {
      try {
        await updateDoc(doc(db, "users", student.uid), {
          role: "admin",
          updatedAt: Timestamp.now()
        });
        setShowSuccess(`${student.displayName} agora é administrador!`);
        loadStudents();
      } catch { setErrorMsg("Erro ao promover aluno."); }
    }
  };

  const deleteItem = async (origin: Record<string, unknown> | null, collectionName?: string, id?: string) => {
    // 1. Identificação robusta dos dados de origem
    const sourceDb = (origin as { _sourceDb?: string })?._sourceDb || 
                    (['materials', 'modules', 'surgical_plans', 'announcements'].includes(collectionName || "") ? 'legacy' : 'named');
    
    const sourceColl = (origin as { _sourceColl?: string })?._sourceColl || collectionName;
    
    // Prioriza uid para usuários, id para o resto
    const docId = (origin as { uid?: string; id?: string })?.[sourceColl === 'users' ? 'uid' : 'id'] || 
                  (origin as { uid?: string; id?: string })?.id || 
                  (origin as { uid?: string; id?: string })?.uid || 
                  id;

    if (!docId || !sourceColl) {
      console.error("[ADMIN] Falha crítica na exclusão: Parâmetros insuficientes", { origin, collectionName, id });
      setErrorMsg(`Erro técnico: Não foi possível localizar o ID do documento na coleção ${sourceColl || 'desconhecida'}.`);
      return;
    }

    const validated = confirm(`⚠️ EXCLUSÃO DEFINITIVA\n\nItem: ${docId}\nColeção: ${sourceColl}\nOrigem: ${sourceDb}\n\nDeseja continuar?`);
    if (!validated) return;

    try {
      let targetDb = db;
      if (sourceDb === 'default') targetDb = dbDefault;
      else if (sourceDb === 'legacy') targetDb = dbLegacy;

      console.log(`[ADMIN] EXECUTANDO DELETE: ${sourceColl}/${docId} no banco ${sourceDb}`);
      const docRef = doc(targetDb, sourceColl, docId);
      
      // Se houver arquivo associado em materiais ou protocolos, tentar apagar (falha silenciosa se não existir)
      const fileUrl = (origin as { pdfUrl?: string; fileUrl?: string })?.pdfUrl || (origin as { pdfUrl?: string; fileUrl?: string })?.fileUrl;
      if (fileUrl && (fileUrl.includes('firebasestorage') || fileUrl.includes('googleapi'))) {
        try {
          const fileRef = ref(storage, fileUrl);
          await deleteObject(fileRef);
          console.log("[ADMIN] Arquivo associado removido do Storage");
        } catch (sErr) {
          console.warn("[ADMIN] Falha ao remover arquivo do Storage (provavelmente já excluído):", sErr);
        }
      }

      await deleteDoc(docRef);
      console.log("[ADMIN] Documento excluído com sucesso");
      
      setShowSuccess(`Item removido!`);
      
      // Disparar recarregamento baseado na coleção
      if (sourceColl === "users") loadStudents();
      else if (sourceColl === "knowledge_base" || sourceColl === "chefinho_knowledge") loadKnowledgeBase();
      else if (sourceColl === "chefinho_questions") loadChefinhoQuestions();
      else if (sourceColl.includes("shift") || sourceColl === "fixed_teams") loadTeamManagement();
      else if (sourceColl === "surgical_plans") loadSurgicalPlans();
      else if (sourceColl === "access_requests") loadRequests();
      else if (sourceColl === "lives") {
        // As lives são carregadas via state direto geralmente ou recarregadas pela aba
        if (typeof loadLives === 'function') loadLives();
      }
    } catch (error: unknown) { 
      const err = error as { code?: string; message?: string };
      console.error("[ADMIN] Erro fatal na exclusão:", err);
      setErrorMsg(`Falha na exclusão: ${err.message || err.code || 'Erro de permissão ou conexão'}.`); 
    }
  };

  const handleAddNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifMessage) return;
    try {
      await addDoc(collection(db, "notifications"), {
        title: notifTitle,
        message: notifMessage,
        audience: notifAudience,
        priority: notifPriority,
        link: notifLink || null,
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      setNotifTitle(""); setNotifMessage(""); setNotifLink("");
      setShowSuccess("Notificação enviada!");
    } catch { setErrorMsg("Erro ao enviar notificação."); }
  };

  const handleAddHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!highTitle || !highSubtitle) return;
    try {
      if (editingHighlight) {
        await updateDoc(doc(db, "home_highlights", editingHighlight.id), {
          title: highTitle,
          subtitle: highSubtitle,
          startDateText: highDateText,
          audience: highAudience,
          isActive: highIsActive,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
        setEditingHighlight(null);
        setShowSuccess("Destaque atualizado!");
      } else {
        await addDoc(collection(db, "home_highlights"), {
          title: highTitle,
          subtitle: highSubtitle,
          startDateText: highDateText,
          audience: highAudience,
          isActive: highIsActive,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
        setShowSuccess("Destaque criado!");
      }
      setHighTitle(""); setHighSubtitle(""); setHighDateText("");
    } catch { setErrorMsg("Erro ao salvar destaque."); }
  };

  const startEditingHighlight = (h: HomeHighlight) => {
    setEditingHighlight(h);
    setHighTitle(h.title);
    setHighSubtitle(h.subtitle);
    setHighDateText(h.startDateText);
    setHighAudience(h.audience);
    setHighIsActive(h.isActive);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editName || !editTurma) return;

    const sourceDb = (editingStudent as unknown as { _sourceDb?: string })._sourceDb || 'named';
    const sourceColl = (editingStudent as unknown as { _sourceColl?: string })._sourceColl || 'users';
    
    console.log(`[ADMIN] EXECUTANDO UPDATE NO BANCO: ${sourceDb}`, {
      id: editingStudent.uid,
      colecao: sourceColl
    });

    const targetDb = sourceDb === 'default' ? dbDefault : db;

    try {
      const userRef = doc(targetDb, sourceColl, editingStudent.uid);
      await updateDoc(userRef, {
        displayName: editName,
        turma_id: editTurma,
        residencyLevel: editLevel,
        updatedAt: serverTimestamp()
      });

      setShowSuccess(`Aluno atualizado com sucesso no banco ${sourceDb}!`);
      setEditingStudent(null);
      setTimeout(loadStudents, 600);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("[ADMIN] Erro ao atualizar aluno:", err);
      // Feedback amigável
      if (err.message?.includes('not-found')) {
        setErrorMsg(`Erro: Registro não encontrado no banco ${sourceDb}. Verifique se ele foi movido.`);
      } else {
        setErrorMsg(`Falha ao salvar no banco ${sourceDb}: ${err.message || 'Erro de permissão'}`);
      }
    }
  };

  const startEditing = (student: AppUser) => {
    setEditingStudent(student);
    setEditName(student.displayName);
    setEditTurma(student.turma_id);
    setEditLevel(student.residencyLevel || 'R1');
  };

  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return students.filter(s => s.displayName.toLowerCase().includes(term));
  }, [students, searchTerm]);

  const handleSaveKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        question: kbQuestion,
        answer: kbAnswer,
        keywords: kbKeywords.split(',').map(k => k.trim()).filter(k => k),
        updatedAt: serverTimestamp()
      };

      if (isEditingKb) {
        await updateDoc(doc(db, "knowledge_base", isEditingKb), data);
        setShowSuccess("Entrada atualizada!");
      } else {
        await addDoc(collection(db, "knowledge_base"), {
          ...data,
          createdAt: serverTimestamp()
        });
        setShowSuccess("Entrada adicionada!");
      }

      setKbQuestion("");
      setKbAnswer("");
      setKbKeywords("");
      setIsEditingKb(null);
      loadKnowledgeBase();
    } catch {
      setErrorMsg("Erro ao salvar entrada");
    }
  };

  const startEditingKb = (entry: KnowledgeBaseEntry) => {
    setKbQuestion(entry.question);
    setKbAnswer(entry.answer);
    setKbKeywords(entry.keywords.join(', '));
    setIsEditingKb(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addImportLog = (msg: string) => {
    setImportLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

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

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const result = await testChefinhoConnection();
      setTestResult(result);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Erro desconhecido";
      setTestResult({ success: false, message: "Erro ao executar teste", details: errorMsg });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAiConfig(true);
    try {
      await setDoc(doc(db, "ai_config", "chefinho"), {
        systemPrompt: aiPromptInput,
        lastUpdated: serverTimestamp(),
        updatedBy: user.uid
      });
      setShowSuccess("Configuração da IA atualizada!");
      loadAiConfig();
    } catch (error) {
      console.error("Erro ao salvar configuração da IA:", error);
      setErrorMsg("Erro ao salvar configuração.");
    } finally {
      setIsSavingAiConfig(false);
    }
  };

  const handleAiIntelligenceImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      setErrorMsg("Formato inválido. Por favor, envie um arquivo .txt");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setAiPromptInput(text);
      setShowSuccess("Inteligência carregada do arquivo! Não esqueça de salvar.");
    };
    reader.readAsText(file);
  };

  const handleImportInstitutionalBase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingInstitutional(true);
    try {
      const text = await file.text();
      
      // Split by topics (assuming topics are separated by headers or specific markers)
      // For "Chefinho- inteligência.txt", we'll use a more sophisticated split
      const sections = text.split(/#{2,3}\s+/).filter(s => s.trim().length > 0);
      
      const batch = [];
      for (const section of sections) {
        const lines = section.split('\n');
        const topic = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();
        
        if (topic && content) {
          // Generate keywords from topic and content
          const keywords = [
            ...topic.toLowerCase().split(/\s+/),
            ...content.toLowerCase().split(/\s+/).slice(0, 10)
          ].filter(w => w.length > 3).slice(0, 10);

          batch.push({
            topic,
            content,
            keywords: Array.from(new Set(keywords)),
            source: "protocolo_servico_andreoni",
            active: true,
            createdAt: serverTimestamp()
          });
        }
      }

      // Save to Firestore
      for (const entry of batch) {
        await addDoc(collection(db, "chefinho_knowledge"), entry);
      }

      setShowSuccess(`${batch.length} tópicos importados com sucesso!`);
      loadKnowledgeBase();
    } catch (error) {
      console.error("Erro na importação institucional:", error);
      setErrorMsg("Erro ao importar base institucional.");
    } finally {
      setIsImportingInstitutional(false);
    }
  };

  const toggleChefinhoKnowledge = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "chefinho_knowledge", id), { active: !currentStatus });
      loadKnowledgeBase();
    } catch (error) {
      console.error("Erro ao alternar status:", error);
    }
  };

  const deleteChefinhoKnowledge = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este tópico?")) return;
    try {
      await deleteDoc(doc(db, "chefinho_knowledge", id));
      loadKnowledgeBase();
    } catch (error) {
      console.error("Erro ao excluir tópico:", error);
    }
  };

  const handleTestFlow = async () => {
    setIsTestingFlow(true);
    setFlowResult(null);
    try {
      const result = await askChefinho(testQuestion, user.uid, 'R3');
      setFlowResult(result);
    } catch (error) {
      console.error("Erro no teste de fluxo:", error);
      setFlowResult("Erro ao testar fluxo.");
    } finally {
      setIsTestingFlow(false);
    }
  };

  const handleWhatsAppImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Validation
    if (!file.name.endsWith('.txt')) {
      setImportError("Formato inválido. Por favor, envie um arquivo .txt");
      setImportStep('error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setImportError("Arquivo muito grande. O limite é 5MB.");
      setImportStep('error');
      return;
    }

    setImportFile({ name: file.name, size: file.size });
    setImportStep('reading');
    setImportLogs([]);
    setImportPreview([]);
    setImportResult(null);
    setImportError(null);
    addImportLog(`Arquivo selecionado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    const reader = new FileReader();
    
    // Safety timeout for reading
    const timeoutId = setTimeout(() => {
      if (importStep === 'reading' || importStep === 'parsing') {
        setImportError("Tempo limite de processamento excedido. O arquivo pode ser muito complexo.");
        setImportStep('error');
        reader.abort();
      }
    }, 30000);

    reader.onload = async (e) => {
      clearTimeout(timeoutId);
      try {
        setImportStep('parsing');
        addImportLog("Lendo conteúdo do arquivo...");
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/);
        addImportLog(`${lines.length} linhas detectadas.`);

        let validCount = 0;
        let addedCount = 0;
        const previewItems: KnowledgeBaseCTBMF[] = [];
        const finalBatch: KnowledgeBaseCTBMF[] = [];

        // Improved Regex for multiple WhatsApp formats
        const messageRegex = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s(\d{1,2}:\d{2}(?::\d{2})?(?:\s[AP]M)?)\]?[\s-]*([^:]+):\s(.+)$/i;

        addImportLog("Iniciando parser de mensagens...");
        
        let currentMessage: { author: string, content: string } | null = null;

        const processCurrentMessage = () => {
          if (currentMessage && isMessageUseful(currentMessage.content)) {
            addedCount++;
            const { topic, keywords } = suggestTopicAndKeywords(currentMessage.content);
            
            const entry: KnowledgeBaseCTBMF = {
              topic,
              keywords,
              content: currentMessage.content.trim(),
              author: currentMessage.author.trim(),
              source: "grupo_estudo_whatsapp",
              timestamp: serverTimestamp(),
              active: true
            };

            finalBatch.push(entry);
            if (previewItems.length < 5) {
              previewItems.push(entry);
            }
            return true;
          }
          return false;
        };

        for (let i = 0; i < lines.length; i++) {
          const trimmedLine = lines[i].trim();
          if (!trimmedLine) continue;

          const match = trimmedLine.match(messageRegex);
          if (match) {
            // Process previous message before starting a new one
            processCurrentMessage();
            
            validCount++;
            const [, , , author, content] = match;
            currentMessage = { 
              author: author.trim(), 
              content: content.trim() 
            };
          } else if (currentMessage) {
            // Continuation of previous message (multi-line)
            currentMessage.content += "\n" + trimmedLine;
          }

          // Safety limit for initial test mode
          if (validCount >= 2000 || addedCount >= 1000) {
            addImportLog("Limite de segurança atingido (Modo Teste: 2000 mensagens ou 1000 úteis).");
            break;
          }
        }

        // Process the very last message
        processCurrentMessage();

        setImportStats({ total: lines.length, valid: validCount, added: addedCount });
        setImportPreview(previewItems);
        setPendingBatch(finalBatch);
        setImportStep('preview');
        addImportLog(`Parser concluído. ${validCount} mensagens reconhecidas, ${addedCount} úteis.`);

      } catch (err) {
        console.error(err);
        setImportError("Erro ao processar o arquivo.");
        setImportStep('error');
      }
    };

    reader.onerror = () => {
      clearTimeout(timeoutId);
      setImportError("Erro ao ler o arquivo.");
      setImportStep('error');
    };

    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (pendingBatch.length === 0) return;

    setImportStep('saving');
    addImportLog(`Iniciando salvamento de ${pendingBatch.length} entradas...`);
    
    try {
      const chunkSize = 20;
      const totalChunks = Math.ceil(pendingBatch.length / chunkSize);
      
      for (let i = 0; i < pendingBatch.length; i += chunkSize) {
        const chunk = pendingBatch.slice(i, i + chunkSize);
        const currentChunkNum = Math.floor(i / chunkSize) + 1;
        
        addImportLog(`Salvando lote ${currentChunkNum} de ${totalChunks}...`);
        
        // Use Promise.all for the chunk
        await Promise.all(chunk.map(entry => addDoc(collection(db, "knowledge_base_ctbmf"), entry)));
        
        setImportBatchProgress(Math.round((currentChunkNum / totalChunks) * 100));
      }

      setImportStep('done');
      setImportResult(`${pendingBatch.length} entradas adicionadas com sucesso!`);
      setShowSuccess("Importação concluída!");
      addImportLog("Processo finalizado com sucesso.");
      loadKnowledgeBase();
    } catch (err) {
      console.error(err);
      setImportError("Erro ao salvar no banco de dados.");
      setImportStep('error');
    }
  };

  const resetImport = () => {
    setImportStep('idle');
    setImportFile(null);
    setImportLogs([]);
    setImportPreview([]);
    setPendingBatch([]);
    setImportError(null);
    setImportBatchProgress(0);
  };

  const isMessageUseful = (content: string): boolean => {
    const cleanContent = content.trim().toLowerCase();
    
    // Ignore short messages
    if (cleanContent.length < 20) return false;
    
    // Ignore common non-useful patterns
    const ignorePatterns = [
      "bom dia", "boa tarde", "boa noite", "kkk", "rsrs", "hahaha", 
      "ok", "vlw", "obrigado", "parabéns", "show", "top",
      "arquivo omitido", "imagem omitida", "vídeo omitido", "figurinha omitida",
      "media omitted", "mídia omitida", "omitted"
    ];
    
    if (ignorePatterns.some(pattern => cleanContent.includes(pattern))) return false;

    // Ignore messages that are just emojis
    const emojiRegex = /^[\u{1F000}-\u{1F9FF}\u{2600}-\u{27BF}]+$/u;
    if (emojiRegex.test(cleanContent.replace(/\s/g, ''))) return false;
    
    // Check for medical/surgical keywords to ensure technical value
    const technicalKeywords = [
      "cirurgia", "acesso", "fratura", "trauma", "ortognática", "atm", "implante",
      "osso", "mandíbula", "maxila", "zigoma", "órbita", "nervoso", "sutura",
      "protocolo", "paciente", "clínico", "exame", "tomografia", "rx", "radiografia",
      "antibiótico", "inflamação", "infecção", "dor", "edema", "parestesia",
      "buco", "maxilo", "facial", "ctbmf", "osteotomia", "fixação", "placa", "parafuso",
      "enxerto", "biópsia", "lesão", "patologia", "maligno", "benigno", "reconstrução",
      "emergência", "urgência", "hemorragia", "sangramento", "drenagem", "abscesso",
      "celulite", "osteomielite", "necrose", "sequestro", "alveolite", "extração",
      "exodontia", "impactado", "incluso", "canino", "molar", "pré-molar", "incisivo",
      "mentonoplastia", "malar", "le fort", "sagital", "disjunção", "expansão",
      "distração", "ancoragem", "miniplaca", "miniparafuso", "carga imediata",
      "sinus", "seio maxilar", "levantamento", "membrana", "prótese", "coroa",
      "faceta", "lente", "clareamento", "estética", "preenchimento", "toxina",
      "botox", "ácido hialurônico", "fios", "bioestimulador", "lipo", "papada",
      "bichectomia", "gengiva", "periodonto", "perda óssea", "reabsorção",
      "condilo", "disco", "estalo", "crepitação", "luxação", "subluxação",
      "trismo", "abertura", "oclusão", "mordida", "classe i", "classe ii", "classe iii",
      "overjet", "overbite", "crossbite", "apinhamento", "diastema", "contenção",
      "aparelho", "alinhador", "invisalign", "itero", "escaneamento", "stl",
      "impressão 3d", "guia cirúrgico", "planejamento virtual", "dolphin",
      "nemotec", "exocad", "3shape", "itero", "cone beam", "tc", "rm", "ressonância",
      "ultrassom", "cintilografia", "pet-ct", "laboratório", "histopatológico",
      "citologia", "punção", "paaf", "agulha", "anestesia", "bloqueio", "infiltração",
      "lidocaína", "articaína", "mepivacaína", "bupivacaína", "vasoconstritor",
      "adrenalina", "noradrenalina", "sedação", "geral", "entubação", "tubo",
      "ventilação", "monitorização", "oxigênio", "saturação", "pressão", "frequência",
      "cardíaco", "pulso", "veia", "acesso venoso", "soro", "medicação", "receita",
      "atestado", "pós-operatório", "pré-operatório", "trans-operatório",
      "complicação", "intercorrência", "sucesso", "falha", "reabilitação",
      "fisioterapia", "fonoaudiologia", "psicologia", "nutrição", "enfermagem",
      "hospital", "centro cirúrgico", "uti", "enfermaria", "quarto", "alta",
      "internação", "prontuário", "termo de consentimento", "tcle", "ética",
      "bioética", "odontologia", "medicina", "saúde", "bem-estar", "sorriso",
      "função", "estética facial", "harmonia", "proporção", "perfil", "frontal",
      "sorriso gengival", "exposição", "lábio", "nariz", "queixo", "pescoço",
      "orelha", "pálpebra", "testa", "supercílio", "rugas", "sulco", "nasogeniano",
      "marionete", "olheiras", "volume", "contorno", "definição", "projeção",
      "retrusão", "protrusão", "assimetria", "desvio", "linha média", "plano oclusal"
    ];
    
    return technicalKeywords.some(kw => cleanContent.includes(kw));
  };

  const suggestTopicAndKeywords = (content: string) => {
    const cleanContent = content.toLowerCase();
    const keywords: string[] = [];
    let topic = "Discussão Clínica";

    const mapping = [
      { kw: "trauma", topic: "Traumatologia Bucomaxilofacial", tags: ["trauma", "fratura", "emergência"] },
      { kw: "fratura", topic: "Traumatologia Bucomaxilofacial", tags: ["fratura", "trauma", "fixação"] },
      { kw: "ortognática", topic: "Cirurgia Ortognática", tags: ["ortognática", "deformidade", "estética"] },
      { kw: "atm", topic: "Disfunção da ATM", tags: ["atm", "articulação", "dor"] },
      { kw: "implante", topic: "Implantodontia", tags: ["implante", "reabilitação", "osso"] },
      { kw: "terceiro molar", topic: "Cirurgia Oral Menor", tags: ["terceiro molar", "siso", "extração"] },
      { kw: "cisto", topic: "Patologia Oral", tags: ["cisto", "patologia", "biópsia"] },
      { kw: "tumor", topic: "Patologia Oral", tags: ["tumor", "oncologia", "patologia"] },
      { kw: "acesso", topic: "Técnica Cirúrgica", tags: ["acesso", "técnica", "cirurgia"] },
      { kw: "patologia", topic: "Patologia Oral", tags: ["patologia", "lesão", "biópsia"] },
      { kw: "estética", topic: "Harmonização Orofacial", tags: ["estética", "hof", "preenchimento"] },
      { kw: "hof", topic: "Harmonização Orofacial", tags: ["hof", "estética", "toxina"] },
      { kw: "protocolo", topic: "Protocolos Clínicos", tags: ["protocolo", "orientação", "conduta"] },
      { kw: "infecção", topic: "Estomatologia / Infecções", tags: ["infecção", "antibiótico", "abscesso"] }
    ];

    for (const item of mapping) {
      if (cleanContent.includes(item.kw)) {
        topic = item.topic;
        item.tags.forEach(t => {
          if (!keywords.includes(t)) keywords.push(t);
        });
      }
    }

    if (keywords.length === 0) {
      keywords.push("ctbmf", "discussão");
    }

    return { topic, keywords };
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const analyticsData = useMemo(() => {
    return [];
  }, []);

  // Fixed Team Handlers
  const handleAddFixedTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ftName || (ftR2.length === 0 && ftR1.length === 0)) {
      setErrorMsg("O nome da equipe e pelo menos um integrante (R2 ou R1) são necessários.");
      return;
    }
    try {
      const data = {
        teamName: ftName,
        r2Members: ftR2,
        r1Members: ftR1,
        extraMembers: ftExtra,
        active: true,
        notes: ftNotes,
        updatedAt: serverTimestamp(),
        createdAt: editingFixedTeam ? editingFixedTeam.createdAt : serverTimestamp()
      };
      if (editingFixedTeam) {
        await updateDoc(doc(db, "fixed_teams", editingFixedTeam.id), data);
        setShowSuccess("Equipe atualizada!");
      } else {
        await addDoc(collection(db, "fixed_teams"), data);
        setShowSuccess("Equipe criada!");
      }
      setFtName("");
      setFtR2([]);
      setFtR1([]);
      setFtExtra([]);
      setFtNotes("");
      setEditingFixedTeam(null);
      loadTeamManagement();
    } catch { setErrorMsg("Erro ao salvar equipe."); }
  };

  // Removidos por serem substituídos pela função unificada deleteItem(item)
  /*
  const deleteFixedTeam = async (id: string) => { ... }
  const deleteTeamShift = async (id: string) => { ... }
  const deleteR3Shift = async (id: string) => { ... }
  */

  // Team Shift Handlers
  const handleAddTeamShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tsTeamId || !tsStart || !tsEnd) return;
    const team = fixedTeams.find(t => t.id === tsTeamId);
    if (!team) return;
    try {
      await addDoc(collection(db, "team_shifts"), {
        teamId: tsTeamId,
        teamName: team.teamName,
        startDate: tsStart,
        endDate: tsEnd,
        active: true,
        notes: tsNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowSuccess("Plantão adicionado!");
      setTsTeamId("");
      setTsStart("");
      setTsEnd("");
      setTsNotes("");
      loadTeamManagement();
    } catch { setErrorMsg("Erro ao salvar plantão."); }
  };

  const handleAutoGenerateShifts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agTeamId || !agStart || !agEndLimit) return;
    setIsImportingScale(true);
    try {
      const activeFixedTeams = fixedTeams.filter(t => t.active);
      if (activeFixedTeams.length === 0) throw new Error("Nenhuma equipe ativa!");

      const startIndex = activeFixedTeams.findIndex(t => t.id === agTeamId);
      if (startIndex === -1) throw new Error("Equipe inicial não encontrada!");

      const currentStart = new Date(agStart + "T12:00:00");
      const limit = new Date(agEndLimit + "T23:59:59");
      let teamIndex = startIndex;
      const batch = writeBatch(db);

      while (currentStart <= limit) {
        const team = activeFixedTeams[teamIndex];
        const end = new Date(currentStart);
        end.setDate(end.getDate() + 6);

        const startStr = currentStart.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const shiftRef = doc(collection(db, "team_shifts"));
        batch.set(shiftRef, {
          teamId: team.id,
          teamName: team.teamName,
          startDate: startStr,
          endDate: endStr,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        currentStart.setDate(currentStart.getDate() + 7);
        teamIndex = (teamIndex + 1) % activeFixedTeams.length;
      }

      await batch.commit();
      setShowSuccess("Plantões gerados com sucesso!");
      loadTeamManagement();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Erro ao gerar plantões.");
    } finally {
      setIsImportingScale(false);
    }
  };

  // R3 Shift Handlers
  const handleAddR3Shift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!r3sResId || !r3sStart || !r3sEnd) return;
    const res = students.find(s => s.uid === r3sResId);
    if (!res) return;
    const team = fixedTeams.find(t => t.id === r3sTeamId);
    try {
      await addDoc(collection(db, "r3_shifts"), {
        residentId: r3sResId,
        residentName: res.displayName,
        teamId: r3sTeamId || "",
        teamName: team?.teamName || "",
        startDate: r3sStart,
        endDate: r3sEnd,
        active: true,
        notes: r3sNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowSuccess("Plantão R3 adicionado!");
      setR3sResId("");
      setR3sTeamId("");
      setR3sStart("");
      setR3sEnd("");
      setR3sNotes("");
      loadTeamManagement();
    } catch { setErrorMsg("Erro ao salvar plantão R3."); }
  };

  const suggestContinuity = (type: 'team' | 'r3') => {
    const list = type === 'team' ? teamShifts : r3Shifts;
    if (list.length === 0) {
      alert("Nenhum plantão existente para basear a continuidade.");
      return;
    }
    
    const mostFuture = [...list].sort((a,b) => b.startDate.localeCompare(a.startDate))[0];
    const lastEnd = new Date(mostFuture.endDate + "T12:00:00");
    const nextStart = new Date(lastEnd);
    nextStart.setDate(nextStart.getDate() + 1);
    const startStr = nextStart.toISOString().split('T')[0];
    
    if (type === 'team') {
      const activeTeams = fixedTeams.filter(t => t.active);
      const lastIdx = activeTeams.findIndex(t => t.id === mostFuture.teamId);
      const nextIdx = (lastIdx + 1) % activeTeams.length;
      setAgStart(startStr);
      setAgTeamId(activeTeams[nextIdx].id);
      setAgEndLimit("2026-12-31");
    } else {
      const activeR3s = students.filter(s => s.residencyLevel === 'R3' && s.status === 'approved');
      const lastIdx = activeR3s.findIndex(s => s.uid === (mostFuture as R3Shift).residentId);
      const nextIdx = (lastIdx + 1) % activeR3s.length;
      setAgR3Start(startStr);
      setAgR3Id(activeR3s[nextIdx].uid);
      setAgR3EndLimit("2026-12-31");
    }
    setShowSuccess("Campos preenchidos com a sugestão de continuidade!");
  };

  const applyOfficialScaleSync = async () => {
    if (!confirm("Isso apagará plantões existentes para o período de Abril/26 a Jan/27 e substituirá pela escala oficial fornecida. Confirmar sincronização?")) return;
    
    setIsImportingScale(true);
    setErrorMsg(null);
    setShowSuccess("Sincronizando escala oficial (Abr/26 - Jan/27)...");

    try {
      const batch = writeBatch(db);
      
      const officialEntries = [
        { team: "1", start: "2026-04-01", end: "2026-04-07", r3: "Andréia" },
        { team: "2", start: "2026-04-08", end: "2026-04-14", r3: "Andrey" },
        { team: "3", start: "2026-04-15", end: "2026-04-21", r3: "Laura" },
        { team: "4", start: "2026-04-22", end: "2026-04-28", r3: "Jéssica" },
        { team: "1", start: "2026-04-29", end: "2026-05-05", r3: "Fran" },
        { team: "2", start: "2026-05-06", end: "2026-05-12", r3: "Jânio" },
        { team: "3", start: "2026-05-13", end: "2026-05-19", r3: "Paulo" },
        { team: "4", start: "2026-05-20", end: "2026-05-26", r3: "Andréia" },
        { team: "1", start: "2026-05-27", end: "2026-06-02", r3: "Andrey" },
        { team: "2", start: "2026-06-03", end: "2026-06-09", r3: "Laura" },
        { team: "3", start: "2026-06-10", end: "2026-06-16", r3: "Jéssica" },
        { team: "4", start: "2026-06-17", end: "2026-06-23", r3: "Fran" },
        { team: "1", start: "2026-06-24", end: "2026-06-30", r3: "Jânio" },
        { team: "2", start: "2026-07-01", end: "2026-07-07", r3: "Paulo" },
        { team: "3", start: "2026-07-08", end: "2026-07-14", r3: "Andréia" },
        { team: "4", start: "2026-07-15", end: "2026-07-21", r3: "Andrey" },
        { team: "1", start: "2026-07-22", end: "2026-07-28", r3: "Laura" },
        { team: "2", start: "2026-07-29", end: "2026-08-04", r3: "Jéssica" },
        { team: "3", start: "2026-08-05", end: "2026-08-11", r3: "Fran" },
        { team: "4", start: "2026-08-12", end: "2026-08-18", r3: "Jânio" },
        { team: "1", start: "2026-08-19", end: "2026-08-25", r3: "Paulo" },
        { team: "2", start: "2026-08-26", end: "2026-09-01", r3: "Andréia" },
        { team: "3", start: "2026-09-02", end: "2026-09-08", r3: "Andrey" },
        { team: "4", start: "2026-09-09", end: "2026-09-15", r3: "Laura" },
        { team: "1", start: "2026-09-16", end: "2026-09-22", r3: "Jéssica" },
        { team: "2", start: "2026-09-23", end: "2026-09-29", r3: "Fran" },
        { team: "3", start: "2026-09-30", end: "2026-10-06", r3: "Jânio" },
        { team: "4", start: "2026-10-07", end: "2026-10-13", r3: "Paulo" },
        { team: "1", start: "2026-10-14", end: "2026-10-20", r3: "Andréia" },
        { team: "2", start: "2026-10-21", end: "2026-10-27", r3: "Andrey" },
        { team: "3", start: "2026-10-28", end: "2026-11-03", r3: "Laura" },
        { team: "4", start: "2026-11-04", end: "2026-11-10", r3: "Jéssica" },
        { team: "1", start: "2026-11-11", end: "2026-11-17", r3: "Fran" },
        { team: "2", start: "2026-11-18", end: "2026-11-24", r3: "Jânio" },
        { team: "3", start: "2026-11-25", end: "2026-12-01", r3: "Paulo" },
        { team: "4", start: "2026-12-02", end: "2026-12-08", r3: "Andréia" },
        { team: "1", start: "2026-12-09", end: "2026-12-15", r3: "Andrey" },
        { team: "2", start: "2026-12-16", end: "2026-12-22", r3: "Laura" },
        { team: "3", start: "2026-12-23", end: "2026-12-29", r3: "Jéssica" },
        { team: "4", start: "2026-12-30", end: "2027-01-05", r3: "Fran" }
      ];

      for (const entry of officialEntries) {
        // Encontrar equipe pelo número contido no nome
        const team = fixedTeams.find(t => t.teamName.includes(entry.team));
        if (!team) {
          console.warn(`Equipe ${entry.team} não encontrada.`);
          continue;
        }

        // Encontrar R3 pelo nome (fuzzy match)
        const resident = students.find(s => 
          s.displayName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
            entry.r3.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          ) && s.residencyLevel === 'R3'
        );

        if (!resident) {
          console.warn(`Residente R3 ${entry.r3} não encontrado.`);
          continue;
        }

        // Criar registros de Team Shift
        const tsRef = doc(collection(db, "team_shifts"));
        batch.set(tsRef, {
          teamId: team.id,
          teamName: team.teamName,
          startDate: entry.start,
          endDate: entry.end,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Criar registros de R3 Shift
        const r3Ref = doc(collection(db, "r3_shifts"));
        batch.set(r3Ref, {
          residentId: resident.uid,
          residentName: resident.displayName,
          teamId: team.id,
          teamName: team.teamName,
          startDate: entry.start,
          endDate: entry.end,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      setShowSuccess("Escala oficial sincronizada com sucesso!");
      loadTeamManagement();
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[ADMIN] Erro ao sincronizar escala:", error);
      setErrorMsg("Erro ao sincronizar escala: " + (error.message || String(error)));
    } finally {
      setIsImportingScale(false);
    }
  };

  const handleAutoGenerateR3Shifts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agR3Id || !agR3Start || !agR3EndLimit) return;
    setIsImportingScale(true);
    try {
      const activeR3s = students.filter(s => s.residencyLevel === 'R3' && s.status === 'approved');
      if (activeR3s.length === 0) throw new Error("Nenhum R3 ativo encontrado!");

      const startIndex = activeR3s.findIndex(s => s.uid === agR3Id);
      if (startIndex === -1) throw new Error("R3 inicial não encontrado!");

      const currentStart = new Date(agR3Start + "T12:00:00");
      const limit = new Date(agR3EndLimit + "T23:59:59");
      let r3Index = startIndex;
      const batch = writeBatch(db);

      while (currentStart <= limit) {
        const r3 = activeR3s[r3Index];
        const end = new Date(currentStart);
        end.setDate(end.getDate() + 6);

        const startStr = currentStart.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const shiftRef = doc(collection(db, "r3_shifts"));
        batch.set(shiftRef, {
          residentId: r3.uid,
          residentName: r3.displayName,
          teamId: "",
          teamName: "",
          startDate: startStr,
          endDate: endStr,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        currentStart.setDate(currentStart.getDate() + 7);
        r3Index = (r3Index + 1) % activeR3s.length;
      }

      await batch.commit();
      setShowSuccess("Escala de R3 gerada com sucesso!");
      loadTeamManagement();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Erro ao gerar escala de R3.");
    } finally {
      setIsImportingScale(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 space-y-10 md:space-y-14 pb-20">
      <header className="flex justify-between items-end border-b border-gray-100 pb-6">
        <div>
          <h2 className="text-3xl font-black text-brand-dark">Coordenação</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Painel Administrativo Firestore</p>
        </div>
      </header>

      {/* Navegação Superior */}
      <div className="flex bg-gray-100 p-2 rounded-2xl overflow-x-auto gap-2 no-scrollbar scroll-smooth">
        <button onClick={() => setActiveTab('students')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'students' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Alunos</button>
        <button onClick={() => setActiveTab('announcements')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'announcements' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Avisos</button>
        <button onClick={() => setActiveTab('materials')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'materials' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Materiais</button>
        <button onClick={() => setActiveTab('lives')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'lives' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Lives</button>
        <button onClick={() => setActiveTab('surgeries')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'surgeries' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Cirurgias</button>
        <button onClick={() => setActiveTab('protocols')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'protocols' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Protocolos</button>
        <button onClick={() => setActiveTab('notifications')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'notifications' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Notificações</button>
        <button onClick={() => setActiveTab('highlights')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'highlights' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Destaques</button>
        <button onClick={() => setActiveTab('analytics')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'analytics' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Analytics</button>
        <button onClick={() => setActiveTab('chefinho_questions')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'chefinho_questions' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Histórico Chefinho</button>
        <button onClick={() => setActiveTab('surgical_plans')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'surgical_plans' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Planejamentos</button>
        <button onClick={() => setActiveTab('knowledge')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'knowledge' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Base Chefinho</button>
        <button onClick={() => setActiveTab('team_management')} className={`shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'team_management' ? 'bg-brand-dark shadow-lg text-brand-gold' : 'text-gray-400 hover:text-gray-600'}`}>Gestão de Equipes</button>
        <button onClick={() => navigate('/academy-admin')} className="shrink-0 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap text-brand-gold bg-brand-dark/10 hover:bg-brand-dark hover:text-brand-gold border border-brand-gold/30">Maxilo Pro Academy ↗</button>
      </div>

      {(errorMsg || showSuccess) && (
        <div className={`p-5 rounded-2xl flex items-center text-xs font-bold uppercase tracking-widest animate-fade-in ${errorMsg ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
          {errorMsg ? <AlertCircle className="mr-3" size={18} /> : <CheckCircle2 className="mr-3" size={18} />}
          {errorMsg || showSuccess}
        </div>
      )}

      {activeTab === 'chefinho_questions' && (
        <div className="space-y-10 animate-fade-in">
          {/* Dashboard Chefinho */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total de Perguntas</p>
              <p className="text-4xl font-black text-brand-dark">{chefinhoStats.total}</p>
            </div>
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tópicos Populares</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(chefinhoStats.byTopic).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([topic, count]) => (
                  <span key={topic} className="px-3 py-1 bg-brand-gold/10 text-brand-gold text-[9px] font-black uppercase rounded-full">
                    {topic.replace('_', ' ')}: {count}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Engajamento por Nível</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(chefinhoStats.byLevel).map(([level, count]) => (
                  <span key={level} className="px-3 py-1 bg-brand-dark/5 text-brand-dark text-[9px] font-black uppercase rounded-full">
                    {level}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-gray-400" />
              <select 
                value={filterLevel} 
                onChange={e => setFilterLevel(e.target.value)}
                className="bg-gray-50 border-none rounded-xl py-2 px-4 text-[10px] font-black uppercase tracking-widest outline-none"
              >
                <option value="all">Todos os Níveis</option>
                <option value="R1">R1</option>
                <option value="R2">R2</option>
                <option value="R3">R3</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Database size={16} className="text-gray-400" />
              <select 
                value={filterTopic} 
                onChange={e => setFilterTopic(e.target.value)}
                className="bg-gray-50 border-none rounded-xl py-2 px-4 text-[10px] font-black uppercase tracking-widest outline-none"
              >
                <option value="all">Todos os Tópicos</option>
                <option value="trauma_mandibular">Trauma Mandibular</option>
                <option value="trauma_orbitario">Trauma Orbitário</option>
                <option value="terco_medio">Terço Médio</option>
                <option value="geral">Geral</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gray-400" />
              <select 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)}
                className="bg-gray-50 border-none rounded-xl py-2 px-4 text-[10px] font-black uppercase tracking-widest outline-none"
              >
                <option value="all">Todo Período</option>
                <option value="today">Hoje</option>
                <option value="week">Última Semana</option>
              </select>
            </div>
          </div>

          {/* Tabela de Perguntas */}
          <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Residente</th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nível</th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pergunta</th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tópico</th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredChefinhoQuestions.map(q => (
                    <tr key={q.id} className={`hover:bg-gray-50/50 transition-colors ${q.isMarkedImportant ? 'bg-brand-gold/5' : ''}`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-brand-dark rounded-full flex items-center justify-center text-[10px] font-black text-brand-gold">
                            {q.userName?.charAt(0) || 'U'}
                          </div>
                          <span className="text-xs font-black text-brand-dark">{q.userName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[9px] font-black uppercase rounded-full">{q.userLevel}</span>
                      </td>
                      <td className="px-8 py-6 max-w-xs">
                        <p className="text-xs text-gray-600 line-clamp-1 italic">"{q.question}"</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-black text-brand-gold uppercase tracking-widest">{q.topicDetected.replace('_', ' ')}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {q.timestamp?.toDate ? q.timestamp.toDate().toLocaleDateString('pt-BR') : 'N/A'}
                        </span>
                      </td>
                      <td className="px-8 py-6 flex gap-2">
                        <button 
                          onClick={() => setSelectedQuestion(q)}
                          className="px-4 py-2 bg-brand-dark text-brand-gold rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all whitespace-nowrap"
                        >
                          Ver Resposta
                        </button>
                        <button 
                          onClick={() => deleteItem(null, "chefinho_questions", q.id)}
                          className="p-2 bg-red-50 text-red-300 hover:text-red-500 rounded-xl transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredChefinhoQuestions.length === 0 && (
                <div className="py-20 text-center">
                  <Bot size={40} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhuma pergunta encontrada</p>
                </div>
              )}
            </div>
          </div>

          {selectedQuestion && (
            <div className="fixed inset-0 bg-brand-dark/90 backdrop-blur-sm z-[150] flex items-center justify-center p-4 md:p-8 animate-fade-in">
              <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-dark rounded-2xl flex items-center justify-center text-brand-gold">
                      <Bot size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">Detalhes da Interação</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        {selectedQuestion.userName} • {selectedQuestion.userLevel} • {selectedQuestion.device}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedQuestion(null)} className="p-3 bg-white text-gray-400 rounded-2xl hover:text-brand-dark transition-colors shadow-sm">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-10 custom-scrollbar">
                  {/* Pergunta e Resposta */}
                  <div className="space-y-8">
                    <div className="bg-gray-50 p-8 rounded-[32px] border border-gray-100 relative">
                      <div className="absolute -top-3 left-8 bg-brand-gold text-brand-dark px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Pergunta</div>
                      <p className="text-sm font-bold text-brand-dark italic leading-relaxed">"{selectedQuestion.question}"</p>
                    </div>

                    <div className="bg-brand-dark p-8 rounded-[32px] border border-brand-gold/20 relative shadow-xl">
                      <div className="absolute -top-3 left-8 bg-brand-dark border border-brand-gold/30 text-brand-gold px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Resposta do Chefinho</div>
                      <div className="text-sm text-white/90 leading-relaxed font-medium whitespace-pre-wrap prose prose-invert prose-sm max-w-none">
                        {selectedQuestion.answer}
                      </div>
                    </div>
                  </div>

                  {/* Notas do Admin */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Notas Administrativas</h4>
                      {selectedQuestion.isMarkedImportant && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-brand-gold uppercase tracking-widest">
                          <ShieldCheck size={12} /> Marcada como Importante
                        </span>
                      )}
                    </div>
                    <textarea 
                      value={selectedQuestion.adminNotes}
                      onChange={e => setSelectedQuestion({ ...selectedQuestion, adminNotes: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-[24px] p-6 text-xs font-bold text-brand-dark min-h-[120px] outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"
                      placeholder="Adicione observações sobre esta pergunta ou conduta do residente..."
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={() => saveAdminNotes(selectedQuestion.id!, selectedQuestion.adminNotes)}
                        disabled={isSavingNotes}
                        className="flex-1 py-4 bg-brand-dark text-brand-gold rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isSavingNotes ? 'Salvando...' : 'Salvar Notas'}
                      </button>
                      <button 
                        onClick={() => toggleImportantQuestion(selectedQuestion)}
                        className={`px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 ${selectedQuestion.isMarkedImportant ? 'bg-red-50 text-red-500' : 'bg-brand-gold text-brand-dark shadow-lg shadow-brand-gold/20'}`}
                      >
                        {selectedQuestion.isMarkedImportant ? 'Remover Destaque' : 'Marcar Importante'}
                      </button>
                    </div>
                  </div>

                  {/* Treinamento */}
                  <div className="bg-emerald-50 p-8 rounded-[32px] border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-1">Melhoria Contínua</h4>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Use esta interação para treinar a base de conhecimento do Chefinho.</p>
                    </div>
                    <button 
                      onClick={() => handleUseForTraining(selectedQuestion)}
                      disabled={isTraining}
                      className="w-full md:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isTraining ? 'Processando...' : 'Usar para Treinamento'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <div className="space-y-10 md:space-y-14 animate-fade-in">
           <div className="space-y-6">
             <div className="flex items-center text-brand-gold px-1 mb-2"><Users size={20} className="mr-3"/><h3 className="font-black uppercase text-sm tracking-widest">Solicitações ({requests.length})</h3></div>
             <div className="grid gap-4">
               {requests.map(req => (
                 <div key={req.id} className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                   <div>
                     <h4 className="font-black text-brand-dark text-base">{req.displayName}</h4>
                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-1">{req.email} • {req.turma_id}</p>
                   </div>
                   <div className="flex gap-3">
                     <button onClick={() => approveUser(req)} className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-colors"><UserCheck size={20}/></button>
                     <button onClick={() => deleteItem(null, "access_requests", req.id)} className="p-4 bg-red-50 text-red-400 rounded-2xl hover:bg-red-100 transition-colors"><UserX size={20}/></button>
                   </div>
                 </div>
               ))}
               {requests.length === 0 && (
                 <div className="text-center py-12 bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nenhuma solicitação pendente</p>
                 </div>
               )}
             </div>
           </div>
           
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center text-brand-dark px-1">
                  <Users size={20} className="mr-3 text-brand-gold"/>
                  <h3 className="font-black uppercase text-sm tracking-widest">Alunos Ativos ({students.length})</h3>
                </div>
                <div className="relative w-full md:w-1/2">
                  <input 
                    type="text" 
                    placeholder="Filtrar por nome..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="bg-white border border-gray-100 rounded-2xl py-4 px-6 text-xs font-bold uppercase outline-none shadow-sm w-full focus:ring-2 focus:ring-brand-gold/20 transition-all"
                  />
                </div>
              </div>

              {editingStudent && (
                <div className="bg-brand-dark p-8 md:p-10 rounded-[40px] border border-brand-gold/30 shadow-2xl animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <button onClick={() => setEditingStudent(null)} className="text-gray-400 hover:text-white transition-colors p-2">
                      <X size={24} />
                    </button>
                  </div>
                  <form onSubmit={handleUpdateStudent} className="space-y-6 relative z-10">
                    <h4 className="text-brand-gold font-black text-xs uppercase tracking-widest">Editar Aluno</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        placeholder="Nome do Aluno" 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-brand-gold"
                      />
                      <select 
                        value={editTurma} 
                        onChange={e => {
                          const val = e.target.value;
                          setEditTurma(val);
                          if (val.startsWith('r1')) setEditLevel('R1');
                          else if (val.startsWith('r2')) setEditLevel('R2');
                          else if (val.startsWith('r3')) setEditLevel('R3');
                        }} 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-black uppercase text-gray-300 outline-none focus:ring-1 focus:ring-brand-gold"
                      >
                        {mockTurmas.map(t => (
                          <option key={t.id} value={t.id} className="bg-brand-dark">{t.name}</option>
                        ))}
                      </select>
                      <select 
                        value={editLevel} 
                        onChange={e => setEditLevel(e.target.value as 'R1' | 'R2' | 'R3')} 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-black uppercase text-gray-300 outline-none focus:ring-1 focus:ring-brand-gold"
                      >
                        <option value="R1" className="bg-brand-dark">Residente R1</option>
                        <option value="R2" className="bg-brand-dark">Residente R2</option>
                        <option value="R3" className="bg-brand-dark">Residente R3</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full gold-gradient text-brand-dark py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-[1.01] transition-transform">
                      Salvar Alterações
                    </button>
                  </form>
                  <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 gold-gradient opacity-5 rounded-full blur-3xl"></div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {filteredStudents.map(s => {
                  // Lógica de exibição visual simplificada solicitada pelo usuário
                  let displayRoleText = s.residencyLevel || s.turma_id;
                  
                  // Marco Andreoni (Coordenador)
                  if (s.email === 'marcomaxilofacial@gmail.com') {
                    displayRoleText = 'COORDENADOR';
                  } 
                  // Janio (R3 • Tech Lead)
                  else if (s.displayName.toLowerCase().includes('janio')) {
                    displayRoleText = 'R3 • Tech Lead';
                  }

                  return (
                    <div key={s.uid} className="bg-white border border-gray-100 rounded-[32px] p-6 md:p-8 shadow-sm flex justify-between items-center group hover:border-brand-gold/20 hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 shadow-inner">
                          <img src={s.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.displayName)}&background=c89b3c&color=fff`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <h4 className="font-black text-brand-dark text-sm md:text-base">
                            {s.displayName}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-brand-gold font-black uppercase tracking-tighter">
                              {displayRoleText}
                            </p>
                            {s.isOnline && (
                              <span className="flex items-center gap-1 text-[8px] text-emerald-500 font-black uppercase">
                                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                                Online
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => promoteToAdmin(s)}
                          className="p-3 bg-gray-50 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                          title="Tornar Admin"
                        >
                          <ShieldCheck size={18}/>
                        </button>
                        <button 
                          onClick={() => startEditing(s)}
                          className="p-3 bg-gray-50 text-gray-400 hover:text-brand-gold hover:bg-brand-gold/5 rounded-xl transition-all"
                          title="Editar"
                        >
                          <Edit2 size={18}/>
                        </button>
                        <button 
                          onClick={() => deleteItem(s as unknown as Record<string, unknown>)}
                          className="p-3 bg-gray-50 text-gray-400 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <div className="col-span-full text-center py-16 bg-gray-50 rounded-[40px] border border-dashed border-gray-200">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nenhum aluno encontrado</p>
                  </div>
                )}
              </div>
            </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="space-y-10 md:space-y-14 animate-fade-in">
          <form onSubmit={handleAddAnnouncement} className="bg-white p-8 md:p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-6">
            <h3 className="font-black text-sm uppercase tracking-widest flex items-center"><Megaphone className="mr-3 text-brand-gold" size={20}/> Novo Aviso</h3>
            <input value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Título do aviso" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
            <textarea value={postContent} onChange={e => setPostContent(e.target.value)} placeholder="Conteúdo da mensagem..." rows={4} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none resize-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
            <button className="w-full gold-gradient text-brand-dark py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg hover:scale-[1.01] transition-transform"><Send size={16}/>Publicar na Home</button>
          </form>

          <div className="space-y-4 md:space-y-6">
            <div className="flex items-center text-brand-dark px-1 mb-2">
              <Megaphone size={20} className="mr-3 text-brand-gold"/>
              <h3 className="font-black uppercase text-sm tracking-widest">Avisos Publicados</h3>
            </div>
            {announcements.map(post => (
              <div key={post.id} className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 flex justify-between items-start shadow-sm hover:shadow-md transition-shadow">
                <div>
                  <h4 className="font-black text-brand-dark text-base">{post.title}</h4>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{post.content}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Clock size={12} className="text-brand-gold" />
                    <p className="text-[10px] text-brand-gold font-black uppercase tracking-widest">Por: {post.authorName}</p>
                  </div>
                </div>
                <button onClick={() => deleteItem(null, "announcements", post.id!)} className="text-red-300 p-3 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="text-center py-16 bg-gray-50 rounded-[40px] border border-dashed border-gray-200">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nenhum aviso publicado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="space-y-10 md:space-y-14 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
            <h2 className="text-2xl font-black uppercase tracking-tighter">Gerenciar Temas & Materiais</h2>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={async () => {
                  if (confirm("Deseja sincronizar todos os materiais do sistema (mock data) para o Firestore? Isso não apagará itens existentes.")) {
                    try {
                      const { mockItems } = await import('../services/mockData');
                      let count = 0;
                      for (const item of mockItems) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, ...itemData } = item;
                        await addDoc(collection(dbLegacy, "materials"), itemData);
                        count++;
                      }
                      setShowSuccess(`${count} materiais sincronizados com sucesso!`);
                    } catch (e) {
                      console.error(e);
                      setErrorMsg("Erro ao sincronizar materiais.");
                    }
                  }
                }}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold bg-brand-gold/10 px-6 py-3 rounded-2xl hover:bg-brand-gold/20 transition-all flex items-center gap-3 shadow-sm"
              >
                <Activity size={14} />
                Sincronizar Mock Data
              </button>
              <button 
                onClick={restoreAcidMaterials}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-6 py-3 rounded-2xl hover:bg-emerald-100 transition-all flex items-center gap-3 shadow-sm"
              >
                <FilePlus size={14} />
                Restaurar Ácidos
              </button>
            </div>
          </div>

          {/* Gerenciar Temas (Módulos) */}
          <form onSubmit={handleAddModule} className="bg-white p-8 md:p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-8">
            <h3 className="font-black text-sm uppercase tracking-widest flex items-center">
              <Layers className="mr-3 text-brand-gold" size={20}/> 
              {editingModule ? 'Editar Tema' : 'Novo Tema'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                value={modName} 
                onChange={e => setModName(e.target.value)} 
                placeholder="Nome do Tema (ex: Trauma, Estética)" 
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"
              />
              <input 
                value={modDesc} 
                onChange={e => setModDesc(e.target.value)} 
                placeholder="Descrição breve" 
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"
              />
            </div>
            
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Público-alvo (Direcionamento)</p>
              <div className="flex gap-6">
                {['R1', 'R2', 'R3'].map((level) => (
                  <label key={level} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={modAudience.includes(level as 'R1' | 'R2' | 'R3')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setModAudience([...modAudience, level as 'R1' | 'R2' | 'R3']);
                        } else {
                          setModAudience(modAudience.filter(l => l !== level));
                        }
                      }}
                      className="w-5 h-5 accent-brand-gold rounded-lg"
                    />
                    <span className="text-xs font-black uppercase text-gray-500 group-hover:text-brand-gold transition-colors">{level}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 gold-gradient text-brand-dark py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg hover:scale-[1.01] transition-transform">
                {editingModule ? <Edit2 size={16}/> : <Plus size={16}/>}
                {editingModule ? 'Atualizar Tema' : 'Criar Tema'}
              </button>
              {editingModule && (
                <button 
                  type="button"
                  onClick={() => {
                    setEditingModule(null);
                    setModName("");
                    setModDesc("");
                    setModAudience(['R1', 'R2', 'R3']);
                  }}
                  className="px-8 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {/* Lista de Temas */}
          <div className="space-y-6">
            <div className="flex items-center text-brand-dark px-1 mb-2">
              <Layers size={20} className="mr-3 text-brand-gold"/>
              <h3 className="font-black uppercase text-sm tracking-widest">Temas Cadastrados</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {modules.map(mod => (
                <div key={mod.id} className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 flex justify-between items-center group hover:border-brand-gold/30 hover:shadow-md transition-all">
                  <div>
                    <h4 className="font-black text-brand-dark text-sm">{mod.name}</h4>
                    <div className="flex gap-2 mt-2">
                      {mod.audience?.map(a => (
                        <span key={a} className="text-[8px] font-black bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded-full uppercase">{a}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditingModule(mod)} className="p-3 bg-gray-50 text-gray-400 hover:text-brand-gold hover:bg-brand-gold/5 rounded-xl transition-all"><Edit2 size={16}/></button>
                    <button onClick={() => deleteItem(null, "modules", mod.id)} className="p-3 bg-gray-50 text-gray-400 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleAddMaterial} className="bg-white p-8 md:p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-8">
            <h3 className="font-black text-sm uppercase tracking-widest flex items-center"><FilePlus className="mr-3 text-brand-gold" size={20}/> Novo Material</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={matTitle} onChange={e => setMatTitle(e.target.value)} placeholder="Título" className="col-span-full w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
              <input value={matDesc} onChange={e => setMatDesc(e.target.value)} placeholder="Descrição breve" className="col-span-full w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
              <input value={matLink} onChange={e => setMatLink(e.target.value)} placeholder="Link (Drive/YouTube)" className="col-span-full w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
              <select value={matType} onChange={e => setMatType(e.target.value as ItemType)} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all">
                <option value={ItemType.PDF}>PDF</option>
                <option value={ItemType.VIDEO}>Vídeo/Aula</option>
                <option value={ItemType.BOOK}>Livro</option>
                <option value={ItemType.PROTOCOL}>Protocolo</option>
              </select>
              <select value={matModule} onChange={e => setMatModule(e.target.value)} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all">
                <option value="">Selecionar Tema...</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={matImportant} onChange={e => setMatImportant(e.target.checked)} className="w-5 h-5 accent-brand-gold rounded-lg"/>
              <span className="text-xs font-black uppercase text-gray-400 group-hover:text-brand-gold transition-colors">Marcar como Destaque</span>
            </label>
            <button className="w-full gold-gradient text-brand-dark py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg hover:scale-[1.01] transition-transform"><Plus size={16}/>Cadastrar Material</button>
          </form>

          <div className="space-y-6">
            <div className="flex items-center text-brand-dark px-1 mb-2">
              <FileText size={20} className="mr-3 text-brand-gold"/>
              <h3 className="font-black uppercase text-sm tracking-widest">Materiais Cadastrados</h3>
            </div>
            <div className="space-y-4 md:space-y-6">
              {materials.map(item => {
                const theme = modules.find(m => m.id === item.moduleId);
                return (
                  <div key={item.id} className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black shadow-inner ${item.type === ItemType.VIDEO ? 'bg-red-50 text-red-500' : 'bg-brand-gold/10 text-brand-gold'}`}>
                        {item.type ? (typeof item.type === 'string' && item.type.length > 0 ? item.type[0].toUpperCase() : '?') : '?'}
                      </div>
                      <div>
                        <h4 className="font-black text-brand-dark text-sm md:text-base">{item.title}</h4>
                        <p className="text-[10px] text-brand-gold uppercase font-black tracking-widest mt-1">{theme?.name || item.moduleId}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteItem(null, "materials", item.id!)} className="text-red-300 p-3 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'lives' && (
        <div className="space-y-10 md:space-y-14 animate-fade-in">
          <form onSubmit={handleAddLive} className="bg-white p-8 md:p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center text-brand-dark">
                <Radio className={`${liveStatus === 'live' ? 'text-red-500 animate-pulse' : 'text-brand-gold'} mr-3`} size={24}/>
                <h3 className="font-black uppercase text-base tracking-widest">
                  {editingLive ? 'Editar Live' : 'Gerenciar Live'}
                </h3>
              </div>
              {editingLive && (
                <button 
                  type="button"
                  onClick={() => {
                    setEditingLive(null);
                    setLiveTitle("");
                    setLiveDesc("");
                    setLiveUrl("");
                    setLiveDate("");
                    setLiveTime("");
                    setLivePlatform('youtube');
                    setLiveStatus('scheduled');
                    setLiveVisible(true);
                    setLiveThumbnail("");
                    setLiveChannel("");
                  }}
                  className="text-[10px] font-black uppercase text-gray-400 hover:text-brand-dark transition-colors"
                >
                  Cancelar Edição
                </button>
              )}
            </div>

            {editingLive && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Editando: {editingLive.title}</span>
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingLive(null);
                    setLiveTitle("");
                    setLiveDesc("");
                    setLiveUrl("");
                    setLiveDate("");
                    setLiveTime("");
                    setLivePlatform('youtube');
                    setLiveStatus('scheduled');
                    setLiveVisible(true);
                    setLiveThumbnail("");
                    setLiveChannel("");
                  }}
                  className="text-[10px] font-black text-blue-600 uppercase"
                >
                  Limpar
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {liveThumbnail && (
                  <div className="relative aspect-video rounded-3xl overflow-hidden shadow-lg border-4 border-white mb-4 group">
                    <img src={liveThumbnail || 'https://images.unsplash.com/photo-1576091160550-217359f4ecf8?auto=format&fit=crop&q=80&w=800'} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="text-white" size={48} />
                    </div>
                    {liveChannel && (
                      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20">
                        <span className="text-white text-[10px] font-black uppercase tracking-widest">{liveChannel}</span>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Título da Live</label>
                  <input value={liveTitle} onChange={e => setLiveTitle(e.target.value)} placeholder="Ex: Cirurgia Ortognática ao Vivo" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Descrição</label>
                  <textarea value={liveDesc} onChange={e => setLiveDesc(e.target.value)} placeholder="Breve resumo da transmissão..." rows={3} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none resize-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Data</label>
                    <input type="date" value={liveDate} onChange={e => setLiveDate(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Hora</label>
                    <input type="time" value={liveTime} onChange={e => setLiveTime(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Status da Transmissão</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['scheduled', 'live', 'ended'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setLiveStatus(s)}
                        className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                          liveStatus === s 
                          ? (s === 'live' ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-brand-dark text-brand-gold border-brand-dark shadow-lg') 
                          : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        {s === 'scheduled' ? 'Agendada' : s === 'live' ? 'Ao Vivo' : 'Encerrada'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Visível no Aplicativo</span>
                  <button 
                    type="button"
                    onClick={() => setLiveVisible(!liveVisible)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${liveVisible ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${liveVisible ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>

              <div className="col-span-full space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Link da Transmissão (URL completa)</label>
                    <div className="relative group">
                      <input 
                        value={liveUrl} 
                        onChange={e => {
                          const url = e.target.value;
                          setLiveUrl(url);
                          const platform = detectPlatform(url);
                          setLivePlatform(platform);
                        }} 
                        placeholder="https://www.youtube.com/watch?v=..." 
                        className="w-full bg-gray-100 border border-gray-200 rounded-2xl p-4 text-xs font-mono outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all pr-32"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {livePlatform === 'youtube' && (
                          <button 
                            type="button"
                            onClick={handleFetchYoutubeMetadata}
                            disabled={isFetchingMetadata || !liveUrl}
                            className="bg-brand-dark text-brand-gold px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50"
                          >
                            {isFetchingMetadata ? '...' : 'Buscar'}
                          </button>
                        )}
                        <div className="p-2 text-gray-400">
                          <Link size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Plataforma</label>
                    <select 
                      value={livePlatform} 
                      onChange={e => setLivePlatform(e.target.value as 'youtube' | 'vimeo' | 'other')}
                      className="w-full bg-gray-100 border border-gray-200 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"
                    >
                      <option value="youtube">YouTube</option>
                      <option value="vimeo">Vimeo</option>
                      <option value="other">Outra / Direta</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <button 
                type="button"
                onClick={() => {
                  const url = generateEmbedUrl(liveUrl, livePlatform);
                  if (url) {
                    setShowTestPlayer(true);
                  } else {
                    setErrorMsg("URL inválida para teste.");
                  }
                }}
                className="flex-1 py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 border-2 border-gray-100 hover:bg-gray-50 transition-all"
              >
                <Eye size={16}/>
                Testar Player Embutido
              </button>
              <button type="submit" className={`flex-[2] py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg hover:scale-[1.01] transition-all ${liveStatus === 'live' ? 'bg-red-600 text-white shadow-red-200' : 'gold-gradient text-brand-dark shadow-brand-gold/20'}`}>
                <Radio size={16}/>
                {editingLive ? 'Salvar Alterações' : (liveStatus === 'live' ? 'Iniciar Transmissão Agora' : 'Agendar Transmissão')}
              </button>
            </div>
          </form>

          {showTestPlayer && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-dark/95 backdrop-blur-sm">
              <div className="bg-white w-full max-w-4xl rounded-[40px] overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
                <div className="bg-brand-dark p-6 flex justify-between items-center">
                  <div className="flex items-center gap-3 text-brand-gold">
                    <div className="bg-brand-gold/10 p-2 rounded-xl">
                      <Play size={18} />
                    </div>
                    <div>
                      <h3 className="font-black uppercase text-[10px] tracking-widest leading-none mb-1 text-gray-400">Ambiente de Teste</h3>
                      <p className="font-black text-white text-xs tracking-tight uppercase">{liveTitle || 'Transmissão sem título'}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowTestPlayer(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all text-white">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  <div className="aspect-video bg-black relative">
                    <iframe 
                      src={generateEmbedUrl(liveUrl, livePlatform) ? `${generateEmbedUrl(liveUrl, livePlatform)}&autoplay=1` : undefined}
                      className="w-full h-full"
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture; web-share"
                      allowFullScreen
                      playsInline
                    />
                  </div>
                  
                  <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-brand-dark uppercase tracking-[0.2em] flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-gold"></div>
                          Diagnóstico Técnico
                        </h4>
                        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-3">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-gray-500 uppercase">Vídeo ID:</span>
                            <span className="font-black text-brand-dark">{extractYoutubeId(liveUrl) || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-gray-500 uppercase">Plataforma:</span>
                            <span className="font-black text-brand-dark uppercase tracking-widest">{livePlatform}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-gray-500 uppercase">Embeddable:</span>
                            <span className={extractYoutubeId(liveUrl) ? "text-emerald-600 font-black" : "text-amber-600 font-black"}>
                              {extractYoutubeId(liveUrl) ? "PROVÁVEL" : "NÃO RECONHECIDO"}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-brand-dark uppercase tracking-[0.2em] flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          Status de Exibição
                        </h4>
                        <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100/50 text-[10px] font-medium text-emerald-800 leading-relaxed">
                          Se o quadro acima carregar o player, a live está configurada corretamente para exibição no App. <br/><br/>
                          <strong>Nota:</strong> Algumas transmissões restringem o embed apenas quando estão "Ao Vivo".
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      <p className="text-gray-400 font-black uppercase tracking-widest text-[9px]">URL Interna do Iframe (Embed):</p>
                      <div className="bg-brand-dark text-brand-gold p-4 rounded-xl font-mono text-[10px] break-all border border-brand-gold/20 shadow-inner">
                        {generateEmbedUrl(liveUrl, livePlatform)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={() => setShowTestPlayer(false)}
                    className="px-10 py-4 bg-brand-dark text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Confirmar e Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center text-brand-dark px-1 mb-2">
              <Radio size={18} className="mr-3 text-brand-gold"/>
              <h4 className="font-black uppercase text-xs tracking-widest">Controle de Transmissões</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {lives.sort((a, b) => {
                if (a.status === 'live') return -1;
                if (b.status === 'live') return 1;
                return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
              }).map(live => (
                <div key={live.id} className={`bg-white p-6 md:p-8 rounded-[32px] border flex justify-between items-center shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden ${!live.visible ? 'opacity-60 bg-gray-50' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${live.status === 'live' ? 'bg-red-50 text-red-500 animate-pulse' : live.status === 'scheduled' ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-400'}`}>
                      <Radio size={24}/>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-brand-dark text-sm md:text-base">{live.title}</h4>
                        {!live.visible && <EyeOff size={14} className="text-gray-400" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${
                          live.status === 'live' ? 'bg-red-500 text-white' : 
                          live.status === 'scheduled' ? 'bg-blue-500 text-white' : 
                          'bg-gray-200 text-gray-500'
                        }`}>
                          {live.status === 'live' ? 'Ao Vivo' : live.status === 'scheduled' ? 'Agendada' : 'Encerrada'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          {live.platform} • {live.date ? `${live.date} ${live.time || ''}` : 'Sem data'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                    <button 
                      onClick={() => {
                        setEditingLive(live);
                        setLiveTitle(live.title);
                        setLiveDesc(live.description || "");
                        setLiveUrl(live.liveUrl || "");
                        setLiveDate(live.date || "");
                        setLiveTime(live.time || "");
                        setLivePlatform(live.platform || 'youtube');
                        setLiveStatus(live.status);
                        setLiveVisible(live.visible !== false);
                        setLiveThumbnail(live.thumbnail || "");
                        setLiveChannel(live.channelTitle || "");
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }} 
                      className="p-3 bg-gray-100 text-gray-500 hover:text-brand-dark rounded-xl transition-all"
                    >
                      <Edit2 size={18}/>
                    </button>
                    <button onClick={() => deleteItem(null, "lives", live.id)} className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={20}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'surgeries' && (
        <div className="space-y-10 md:space-y-14 animate-fade-in">
          <div className="flex flex-wrap justify-end gap-3">
            <button 
              onClick={syncTraumaPlaylist}
              className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-6 py-3 rounded-2xl hover:bg-emerald-100 transition-all flex items-center gap-3 shadow-sm"
            >
              <Video size={16} />
              Restaurar Playlist de Trauma
            </button>
            <button 
              onClick={() => setShowBulkImport(!showBulkImport)}
              className="text-[10px] font-black uppercase tracking-widest text-brand-gold bg-brand-gold/10 px-6 py-3 rounded-2xl hover:bg-brand-gold/20 transition-all flex items-center gap-3 shadow-sm"
            >
              <Plus size={16} />
              Importar Playlist
            </button>
          </div>

          {showBulkImport && (
            <div className="bg-white p-8 md:p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-6 animate-fade-in">
              <div className="flex items-center text-brand-dark mb-2">
                <Megaphone className="mr-3 text-brand-gold" size={20}/>
                <h3 className="font-black uppercase text-sm tracking-widest">Importar Lista de Vídeos</h3>
              </div>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Cole os links ou IDs dos vídeos do YouTube (um por linha):</p>
              <textarea 
                value={bulkUrls} 
                onChange={e => setBulkUrls(e.target.value)} 
                placeholder="https://www.youtube.com/watch?v=...&#10;https://youtu.be/...&#10;videoId123" 
                rows={5} 
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none resize-none focus:ring-2 focus:ring-brand-gold/20 transition-all"
              />
              <div className="flex gap-4">
                <button 
                  onClick={handleBulkImport}
                  className="flex-1 gold-gradient text-brand-dark py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-[1.01] transition-all"
                >
                  Confirmar Importação
                </button>
                <button 
                  onClick={() => setShowBulkImport(false)}
                  className="px-8 bg-gray-100 text-gray-400 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {editingSurgery ? (
            <div className="bg-brand-dark p-8 md:p-10 rounded-[40px] border border-brand-gold/30 shadow-2xl animate-fade-in relative overflow-hidden">
              <div className="absolute top-6 right-6 z-20">
                <button onClick={() => setEditingSurgery(null)} className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdateSurgery} className="space-y-6 relative z-10">
                <div className="flex items-center text-brand-gold mb-2">
                  <Activity className="mr-3" size={20}/>
                  <h4 className="font-black uppercase text-sm tracking-widest">Editar Cirurgia</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 md:col-span-2">
                    <input value={editSurgTitle} onChange={e => setEditSurgTitle(e.target.value)} placeholder="Título da Cirurgia" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all"/>
                    <textarea value={editSurgDesc} onChange={e => setEditSurgDesc(e.target.value)} placeholder="Descrição da Cirurgia" rows={3} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium text-white outline-none resize-none focus:ring-2 focus:ring-brand-gold/40 transition-all"/>
                  </div>
                  <input value={editSurgYoutubeUrl} onChange={e => setEditSurgYoutubeUrl(e.target.value)} placeholder="Link do YouTube ou ID" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all"/>
                  <select value={editSurgCategory} onChange={e => setEditSurgCategory(e.target.value as "trauma" | "ortognatica" | "estetica" | "atm")} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-black uppercase text-gray-300 outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all appearance-none">
                    <option value="trauma" className="bg-brand-dark">Trauma</option>
                    <option value="atm" className="bg-brand-dark">ATM</option>
                    <option value="ortognatica" className="bg-brand-dark">Ortognática</option>
                    <option value="estetica" className="bg-brand-dark">Estética</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={editSurgImportant} onChange={e => setEditSurgImportant(e.target.checked)} className="w-5 h-5 accent-brand-gold rounded-lg"/>
                  <span className="text-xs font-black uppercase text-gray-400 group-hover:text-brand-gold transition-colors">Marcar como Importante</span>
                </label>
                <button type="submit" className="w-full gold-gradient text-brand-dark py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-[1.01] transition-all">Salvar Alterações</button>
              </form>
              <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 gold-gradient opacity-5 rounded-full blur-3xl"></div>
            </div>
          ) : (
            <form onSubmit={handleAddSurgery} className="bg-white p-8 md:p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-6">
              <div className="flex items-center text-brand-dark mb-2">
                <Activity className="mr-3 text-brand-gold" size={20}/>
                <h3 className="font-black uppercase text-sm tracking-widest">Nova Cirurgia</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 md:col-span-2">
                  <input value={surgTitle} onChange={e => setSurgTitle(e.target.value)} placeholder="Título da Cirurgia" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
                  <textarea value={surgDesc} onChange={e => setSurgDesc(e.target.value)} placeholder="Descrição da Cirurgia" rows={3} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none resize-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
                </div>
                <input value={surgYoutubeUrl} onChange={e => setSurgYoutubeUrl(e.target.value)} placeholder="Link do YouTube ou ID" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
                <select value={surgCategory} onChange={e => setSurgCategory(e.target.value as "trauma" | "ortognatica" | "estetica" | "atm")} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all appearance-none">
                  <option value="trauma">Trauma</option>
                  <option value="atm">ATM</option>
                  <option value="ortognatica">Ortognática</option>
                  <option value="estetica">Estética</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={surgImportant} onChange={e => setSurgImportant(e.target.checked)} className="w-5 h-5 accent-brand-gold rounded-lg"/>
                <span className="text-xs font-black uppercase text-gray-400 group-hover:text-brand-gold transition-colors">Marcar como Importante</span>
              </label>
              <button className="w-full gold-gradient text-brand-dark py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg hover:scale-[1.01] transition-all"><Plus size={16}/>Cadastrar Cirurgia</button>
            </form>
          )}

          <div className="space-y-6">
            <div className="flex items-center text-brand-dark px-1 mb-2">
              <Activity size={18} className="mr-3 text-brand-gold"/>
              <h4 className="font-black uppercase text-xs tracking-widest">Cirurgias Cadastradas</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {surgeries.map(surg => (
                <div key={surg.id} className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-14 rounded-xl overflow-hidden bg-gray-100 border border-gray-100 shadow-inner">
                      <img src={surg.thumbnail || `https://img.youtube.com/vi/${surg.youtubeVideoId}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <h4 className="font-black text-brand-dark text-sm md:text-base">{surg.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-brand-gold/10 text-brand-gold">
                          {surg.category}
                        </span>
                        {surg.isImportant && (
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-red-50 text-red-500">
                            Importante
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => toggleSurgeryImportance(surg)}
                      className={`p-3 rounded-xl transition-all ${surg.isImportant ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-400 hover:bg-red-50'}`}
                      title={surg.isImportant ? "Remover Destaque" : "Marcar como Importante"}
                    >
                      <ShieldCheck size={20}/>
                    </button>
                    <button 
                      onClick={() => startEditingSurgery(surg)}
                      className="p-3 text-gray-400 hover:text-brand-gold hover:bg-brand-gold/5 rounded-xl transition-all"
                      title="Editar"
                    >
                      <Edit2 size={20}/>
                    </button>
                    <button 
                      onClick={() => deleteItem(null, "surgeries", surg.id!)}
                      className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={20}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'protocols' && (
        <div className="space-y-10 md:space-y-14 animate-fade-in">
          <div className="flex justify-end">
            <button 
              onClick={syncInstitutionalProtocols}
              className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-6 py-3 rounded-2xl hover:bg-emerald-100 transition-all flex items-center gap-3 shadow-sm"
            >
              <RotateCcw size={16} />
              Restaurar Protocolos Padrão
            </button>
          </div>

          <form onSubmit={handleAddProtocol} className="bg-white p-8 md:p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-8">
            <div className="flex items-center text-brand-dark mb-2">
              <FilePlus className="mr-3 text-brand-gold" size={20}/>
              <h3 className="font-black uppercase text-sm tracking-widest">Novo Protocolo</h3>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <input value={protoTitle} onChange={e => setProtoTitle(e.target.value)} placeholder="Título do Protocolo" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
              <textarea value={protoDesc} onChange={e => setProtoDesc(e.target.value)} placeholder="Descrição breve (aparece na lista)" rows={3} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none resize-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
              
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1">Conteúdo do Protocolo:</p>
                <div className="flex flex-col gap-4">
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden shadow-inner max-h-[400px] overflow-y-auto custom-scrollbar">
                    <ReactQuill 
                      theme="snow"
                      value={protoContent} 
                      onChange={setProtoContent} 
                      placeholder="Escreva aqui todo o texto da regra ou protocolo..." 
                      className="bg-white min-h-[200px]"
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                          [{ 'size': ['small', false, 'large', 'huge'] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'color': [] }, { 'background': [] }],
                          [{ 'script': 'sub'}, { 'script': 'super' }],
                          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                          [{ 'indent': '-1'}, { 'indent': '+1' }],
                          [{ 'align': [] }],
                          ['link', 'blockquote', 'code-block'],
                          ['clean']
                        ],
                        clipboard: {
                          matchVisual: false,
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center gap-4 py-2">
                    <div className="h-[1px] flex-1 bg-gray-100"></div>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Ou link externo</span>
                    <div className="h-[1px] flex-1 bg-gray-100"></div>
                  </div>

                  <input value={protoLink} onChange={e => setProtoLink(e.target.value)} placeholder="Link do Google Drive / PDF Externo" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1">Arquivo PDF do protocolo:</p>
                <div className="bg-gray-50 border border-gray-100 rounded-[32px] p-6 md:p-8 space-y-6 shadow-inner">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex-1 min-w-[200px]">
                      <div className="flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-2xl py-4 px-6 cursor-pointer hover:bg-gray-50 transition-all shadow-sm group">
                        <Plus size={20} className="text-brand-gold group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-black uppercase tracking-widest text-brand-dark">
                          {protoFile ? 'Trocar PDF' : 'Selecionar PDF'}
                        </span>
                      </div>
                      <input 
                        type="file" 
                        accept="application/pdf" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.type !== 'application/pdf') {
                              setErrorMsg("Por favor, selecione apenas arquivos PDF.");
                              return;
                            }
                            setProtoFile(file);
                          }
                        }}
                      />
                    </label>
                    {protoFile && (
                      <button 
                        type="button"
                        onClick={() => setProtoFile(null)}
                        className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors shadow-sm"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                  
                  {protoFile ? (
                    <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="p-3 bg-brand-gold/10 rounded-xl text-brand-gold">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-black text-brand-dark truncate block">
                          {protoFile.name}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {(protoFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Nenhum arquivo selecionado</p>
                    </div>
                  )}

                  {isSaving && uploadProgress > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-brand-gold">
                        <span>Enviando PDF...</span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className="h-full gold-gradient transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1">Níveis com Acesso:</p>
              <div className="flex flex-wrap gap-6">
                {['R1', 'R2', 'R3'].map(level => (
                  <label key={level} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={protoLevels.includes(level as 'R1' | 'R2' | 'R3')} 
                      onChange={e => {
                        if (e.target.checked) setProtoLevels([...protoLevels, level as 'R1' | 'R2' | 'R3']);
                        else setProtoLevels(protoLevels.filter(l => l !== level));
                      }}
                      className="w-5 h-5 accent-brand-gold rounded-lg"
                    />
                    <span className="text-xs font-black uppercase text-gray-500 group-hover:text-brand-dark transition-colors">{level}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={protoImportant} onChange={e => setProtoImportant(e.target.checked)} className="w-5 h-5 accent-brand-gold rounded-lg"/>
              <span className="text-xs font-black uppercase text-gray-400 group-hover:text-brand-gold transition-colors">Marcar como Importante</span>
            </label>
            
            <div className="space-y-4">
              {protoError && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center gap-3 animate-shake">
                  <AlertCircle size={18} />
                  <p className="text-xs font-bold uppercase tracking-widest">{protoError}</p>
                </div>
              )}
              {protoSuccess && (
                <div className="bg-green-50 border border-green-100 text-green-600 p-4 rounded-2xl flex items-center gap-3 animate-fade-in">
                  <CheckCircle2 size={18} />
                  <p className="text-xs font-bold uppercase tracking-widest">{protoSuccess}</p>
                </div>
              )}
            </div>
              
            <button 
              type="submit"
              disabled={isSaving}
              className={`w-full gold-gradient text-brand-dark py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-lg hover:scale-[1.01] transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSaving ? (
                <>
                  <Activity size={18} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Plus size={18}/>
                  Cadastrar Protocolo
                </>
              )}
            </button>
          </form>

          <div className="space-y-6">
            <div className="flex items-center text-brand-dark px-1 mb-2">
              <FileText size={18} className="mr-3 text-brand-gold"/>
              <h4 className="font-black uppercase text-xs tracking-widest">Protocolos Cadastrados</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {protocols.map(proto => (
                <div key={proto.id} className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 text-brand-gold flex items-center justify-center shadow-inner">
                      <FilePlus size={24}/>
                    </div>
                    <div>
                      <h4 className="font-black text-brand-dark text-sm md:text-base">{proto.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex gap-1">
                          {proto.accessLevels?.map(l => (
                            <span key={l} className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-brand-gold/5 text-brand-gold">{l}</span>
                          ))}
                        </div>
                        {proto.pdfUrl && (
                          <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg uppercase tracking-widest">PDF</span>
                        )}
                        {proto.content && (
                          <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg uppercase tracking-widest">Texto</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteItem(null, "protocols", proto.id)} className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-10 md:space-y-14 animate-fade-in">
          <form onSubmit={handleAddNotification} className="bg-white p-8 md:p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-6">
            <div className="flex items-center text-brand-dark mb-2">
              <Megaphone className="mr-3 text-brand-gold" size={20}/>
              <h3 className="font-black uppercase text-sm tracking-widest">Nova Notificação</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="Título da notificação" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
              <select value={notifAudience} onChange={e => setNotifAudience(e.target.value as 'all' | 'R1' | 'R2' | 'R3' | 'admin')} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all appearance-none">
                <option value="all">Todos</option>
                <option value="R1">R1</option>
                <option value="R2">R2</option>
                <option value="R3">R3</option>
                <option value="admin">Administradores</option>
              </select>
            </div>
            <textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)} placeholder="Mensagem da notificação" rows={4} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none resize-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input value={notifLink} onChange={e => setNotifLink(e.target.value)} placeholder="Link opcional (URL)" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
              <select value={notifPriority} onChange={e => setNotifPriority(e.target.value as 'low' | 'medium' | 'high')} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all appearance-none">
                <option value="low">Prioridade Baixa</option>
                <option value="medium">Prioridade Média</option>
                <option value="high">Prioridade Alta</option>
              </select>
            </div>
            <button type="submit" className="w-full gold-gradient text-brand-dark py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-3"><Send size={18}/> Enviar Notificação</button>
          </form>

          <div className="space-y-6">
            <div className="flex items-center text-brand-dark px-1 mb-2">
              <Megaphone size={18} className="mr-3 text-brand-gold"/>
              <h3 className="font-black uppercase text-xs tracking-widest">Histórico de Notificações</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {notifications.map(n => (
                <div key={n.id} className="bg-white border border-gray-100 rounded-[32px] p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-black text-brand-dark text-sm md:text-base truncate">{n.title}</h4>
                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${
                        n.priority === 'high' ? 'bg-red-50 text-red-500' : 
                        n.priority === 'medium' ? 'bg-brand-gold/10 text-brand-gold' : 
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {n.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{n.message}</p>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Público: {n.audience} • {n.createdAt?.toDate?.().toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <button onClick={() => updateDoc(doc(db, "notifications", n.id), { isActive: !n.isActive })} className={`p-3 rounded-xl transition-all ${n.isActive ? 'text-emerald-500 bg-emerald-50' : 'text-gray-400 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-500'}`}>
                      <CheckCircle2 size={20}/>
                    </button>
                    <button onClick={() => deleteItem(null, "notifications", n.id)} className="p-3 text-red-300 bg-red-50 rounded-xl hover:text-red-500 transition-all">
                      <Trash2 size={20}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'highlights' && (
        <div className="space-y-10 md:space-y-14 animate-fade-in">
          <form onSubmit={handleAddHighlight} className="bg-white p-8 md:p-10 rounded-[40px] border border-gray-100 shadow-xl space-y-6">
            <div className="flex items-center text-brand-dark mb-2">
              <Megaphone className="mr-3 text-brand-gold" size={20}/>
              <h3 className="font-black uppercase text-sm tracking-widest">{editingHighlight ? 'Editar Destaque' : 'Novo Destaque (Próximo Tema)'}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input value={highTitle} onChange={e => setHighTitle(e.target.value)} placeholder="Título (ex: Traumatologia...)" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
              <input value={highSubtitle} onChange={e => setHighSubtitle(e.target.value)} placeholder="Subtítulo (ex: Bucomaxilo Avançada)" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input value={highDateText} onChange={e => setHighDateText(e.target.value)} placeholder="Texto de Data (ex: Início: 15 de Outubro)" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"/>
              <select value={highAudience} onChange={e => setHighAudience(e.target.value as 'all' | 'R1' | 'R2' | 'R3')} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all appearance-none">
                <option value="all">Todos</option>
                <option value="R1">R1</option>
                <option value="R2">R2</option>
                <option value="R3">R3</option>
              </select>
            </div>
            <div className="flex items-center space-x-3 p-2">
              <input type="checkbox" id="highActive" checked={highIsActive} onChange={e => setHighIsActive(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-brand-gold focus:ring-brand-gold cursor-pointer"/>
              <label htmlFor="highActive" className="text-xs font-black uppercase text-gray-500 tracking-widest cursor-pointer">Destaque Ativo</label>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button type="submit" className="flex-1 gold-gradient text-brand-dark py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-3"><Plus size={18}/> {editingHighlight ? 'Atualizar Destaque' : 'Criar Destaque'}</button>
              {editingHighlight && <button type="button" onClick={() => { setEditingHighlight(null); setHighTitle(""); setHighSubtitle(""); setHighDateText(""); }} className="px-10 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>}
            </div>
          </form>

          <div className="space-y-6">
            <div className="flex items-center text-brand-dark px-1 mb-2">
              <Megaphone size={18} className="mr-3 text-brand-gold"/>
              <h3 className="font-black uppercase text-xs tracking-widest">Destaques Cadastrados</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {highlights.map(h => (
                <div key={h.id} className="bg-white border border-gray-100 rounded-[32px] p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-brand-dark text-sm md:text-base truncate mb-1">{h.title}</h4>
                    <p className="text-[10px] text-brand-gold font-black uppercase tracking-widest mb-2">{h.subtitle}</p>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Público: {h.audience} • {h.isActive ? 'Ativo' : 'Inativo'}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <button onClick={() => startEditingHighlight(h)} className="p-3 text-brand-gold bg-brand-gold/10 rounded-xl hover:bg-brand-gold/20 transition-all">
                      <Edit2 size={20}/>
                    </button>
                    <button onClick={() => deleteItem(null, "home_highlights", h.id)} className="p-3 text-red-300 bg-red-50 rounded-xl hover:text-red-500 transition-all">
                      <Trash2 size={20}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'analytics' && (
        <div className="space-y-10 md:space-y-14 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 text-brand-gold mb-3">
                <Activity size={20} />
                <span className="text-xs font-black uppercase tracking-widest">Total de Sessões</span>
              </div>
              <div className="text-4xl font-black text-brand-dark">{sessions.length}</div>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 text-emerald-500 mb-3">
                <Clock size={20} />
                <span className="text-xs font-black uppercase tracking-widest">Usuários Ativos</span>
              </div>
              <div className="text-4xl font-black text-brand-dark">
                {new Set(sessions.filter(s => {
                  const lastActive = s.lastActiveAt?.toMillis ? s.lastActiveAt.toMillis() : (s.lastActiveAt || s.startedAt?.toMillis?.() || Date.now());
                  const isGhost = s.isActive && (Date.now() - lastActive > 30 * 60 * 1000);
                  return s.isActive && !isGhost;
                }).map(s => s.userId)).size}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between text-brand-dark px-1 mb-2">
              <div className="flex items-center">
                <BarChart3 size={20} className="mr-3 text-brand-gold"/>
                <h3 className="font-black uppercase text-xs tracking-widest">Ranking de Uso</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {analyticsData.map((stat, index) => (
                <div key={stat.email} className="bg-white border border-gray-100 rounded-[32px] p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="w-10 h-10 shrink-0 rounded-2xl bg-brand-dark text-brand-gold flex items-center justify-center font-black text-sm shadow-lg">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-black text-brand-dark text-sm md:text-base truncate">{stat.name}</h4>
                          {stat.isCurrentlyActive && (
                            <span className="flex items-center gap-1.5 text-[9px] text-emerald-500 font-black uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg shrink-0">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                              Ativo
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1 break-all line-clamp-1" title={stat.email}>
                          {stat.level} • {stat.email}
                        </p>
                      </div>
                    </div>
                    <div className="w-full sm:w-auto flex sm:flex-col justify-between sm:justify-start items-center sm:items-end bg-brand-gold/5 sm:bg-transparent p-4 sm:p-0 rounded-2xl sm:rounded-none border border-brand-gold/10 sm:border-none">
                      <div className="text-[9px] sm:text-[10px] font-black text-brand-gold uppercase tracking-widest">Total Geral</div>
                      <div className="text-lg sm:text-xl font-black text-brand-dark">{formatDuration(stat.total)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t border-gray-50">
                    <div className="text-center">
                      <div className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Hoje</div>
                      <div className="text-xs sm:text-sm font-black text-brand-dark">{formatDuration(stat.today)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Mês</div>
                      <div className="text-xs sm:text-sm font-black text-brand-dark">{formatDuration(stat.month)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Sessões</div>
                      <div className="text-xs sm:text-sm font-black text-brand-dark">{stat.sessions}</div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-gray-50">
                    <div className="flex flex-col gap-2 w-full">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Top Telas:</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stat.screens || {})
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 3)
                          .map(([screen, time]) => (
                            <span key={screen} className="text-[8px] font-black text-brand-dark bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase tracking-widest">
                              {screen.replace('/', '') || 'Home'}: {formatDuration(time)}
                            </span>
                          ))
                        }
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">Última Página:</div>
                      <span className="text-[9px] sm:text-[10px] font-black text-brand-gold bg-brand-gold/5 px-3 py-1 rounded-full uppercase tracking-widest truncate">
                        {stat.lastPage.replace('/', '') || 'Home'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">Dispositivo:</div>
                      <span className="text-[9px] sm:text-[10px] font-black text-gray-500 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-widest">
                        {stat.deviceType}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {analyticsData.length === 0 && (
                <div className="col-span-full text-center py-24 bg-gray-50 rounded-[40px] border border-dashed border-gray-200">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Nenhum dado de uso registrado ainda</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'surgical_plans' && (
        <div className="space-y-10 animate-fade-in">
          {/* Dashboard Planejamentos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Enviados</p>
              <p className="text-4xl font-black text-brand-dark">{surgicalPlans.filter(p => p.status !== 'draft').length}</p>
            </div>
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Aguardando Revisão</p>
              <p className="text-4xl font-black text-brand-gold">{surgicalPlans.filter(p => p.status === 'submitted').length}</p>
            </div>
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Aprovados</p>
              <p className="text-4xl font-black text-emerald-600">{surgicalPlans.filter(p => p.status === 'approved').length}</p>
            </div>
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">No Prazo (&gt;24h)</p>
              <p className="text-4xl font-black text-blue-600">
                {surgicalPlans.filter(p => {
                  if (!p.submittedAt || !p.surgeryDate) return false;
                  const subDate = p.submittedAt.toDate();
                  const surgDate = new Date(p.surgeryDate);
                  const diffHours = (surgDate.getTime() - subDate.getTime()) / (1000 * 60 * 60);
                  return diffHours >= 24;
                }).length}
              </p>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por residente, cirurgia ou paciente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-xl py-3 pl-10 pr-4 text-[10px] font-black uppercase tracking-widest outline-none"
                />
                <Database className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-400" />
              <select 
                value={filterResident} 
                onChange={e => setFilterResident(e.target.value)}
                className="bg-gray-50 border-none rounded-xl py-2 px-4 text-[10px] font-black uppercase tracking-widest outline-none"
              >
                <option value="all">Todos Residentes</option>
                {students.map(s => (
                  <option key={s.uid} value={s.uid}>{s.displayName}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Activity size={16} className="text-gray-400" />
              <select 
                value={filterSurgStatus} 
                onChange={e => setFilterSurgStatus(e.target.value)}
                className="bg-gray-50 border-none rounded-xl py-2 px-4 text-[10px] font-black uppercase tracking-widest outline-none"
              >
                <option value="all">Todos Status</option>
                <option value="submitted">Aguardando Revisão</option>
                <option value="reviewed">Revisado</option>
                <option value="approved">Aprovado</option>
                <option value="draft">Rascunho</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gray-400" />
              <select 
                value={filterSurgDate} 
                onChange={e => setFilterSurgDate(e.target.value)}
                className="bg-gray-50 border-none rounded-xl py-2 px-4 text-[10px] font-black uppercase tracking-widest outline-none"
              >
                <option value="all">Todas Datas</option>
                <option value="today">Hoje</option>
                <option value="week">Próxima Semana</option>
                <option value="past">Passadas</option>
              </select>
            </div>
          </div>

          {/* Lista de Planejamentos */}
          <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Residente</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cirurgia / Data</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Prazo</th>
                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSurgicalPlans.map(plan => {
                    const surgDate = getValidDate(plan.surgeryDate);
                    const subDate = plan.submittedAt?.toDate ? plan.submittedAt.toDate() : (plan.submittedAt ? new Date(plan.submittedAt) : null);
                    const diffHours = subDate ? (surgDate.getTime() - subDate.getTime()) / (1000 * 60 * 60) : null;
                    const onTime = diffHours !== null && diffHours >= 24;

                    return (
                      <tr key={plan.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-6">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-brand-dark/5 flex items-center justify-center text-brand-dark font-black text-xs">
                              {plan.residentName.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-black text-brand-dark uppercase tracking-widest">{plan.residentName}</p>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{plan.residentLevel}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <p className="text-xs font-black text-brand-dark uppercase tracking-widest">{plan.procedureName}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            {formatDate(plan.surgeryDate)} às {formatTime(plan.surgeryDate)}
                          </p>
                          {plan.surgeryDate && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[8px] font-black text-brand-gold uppercase bg-brand-gold/5 px-2 py-0.5 rounded border border-brand-gold/10">
                                {getDutyInfoForDate(plan.surgeryDate).teamName}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-6">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            plan.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                            plan.status === 'reviewed' ? 'bg-blue-50 text-blue-600' :
                            plan.status === 'submitted' ? 'bg-brand-gold/10 text-brand-gold' :
                            'bg-gray-100 text-gray-400'
                          }`}>
                            {plan.status === 'approved' ? 'Aprovado' :
                             plan.status === 'reviewed' ? 'Revisado' :
                             plan.status === 'submitted' ? 'Aguardando' : 'Rascunho'}
                          </span>
                        </td>
                        <td className="p-6">
                          {plan.status !== 'draft' && (
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              onTime ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                            }`}>
                              {onTime ? 'No Prazo' : 'Fora do Prazo'}
                            </span>
                          )}
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => generateSurgicalPlanPDF(plan)}
                              className="p-2 hover:bg-brand-gold hover:text-brand-dark rounded-xl transition-all text-gray-400"
                              title="Baixar PDF"
                            >
                              <Download size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedPlan(plan);
                                setReviewNotes(plan.reviewNotes || "");
                              }}
                              className="p-2 hover:bg-brand-dark hover:text-brand-gold rounded-xl transition-all text-gray-400"
                              title="Visualizar"
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredSurgicalPlans.length === 0 && (
                <div className="text-center py-20">
                  <ClipboardList size={48} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Nenhum planejamento encontrado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Revisão de Planejamento */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-brand-dark/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-scale-in">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-black text-brand-dark uppercase tracking-widest">Revisar Planejamento</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  {selectedPlan.residentName} • {selectedPlan.procedureName}
                </p>
              </div>
              <button onClick={() => setSelectedPlan(null)} className="p-3 hover:bg-gray-200 rounded-2xl transition-all text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Resumo do Caso */}
              <section className="space-y-4">
                <h4 className="text-xs font-black text-brand-gold uppercase tracking-widest border-b border-brand-gold/20 pb-2">Resumo e Identificação</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Paciente (Iniciais/Código)</p>
                    <p className="text-sm font-bold text-brand-dark">{selectedPlan.patientCode}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Escala de Plantão (Automática)</p>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-black text-brand-gold uppercase tracking-widest">
                        Equipe: {getDutyInfoForDate(selectedPlan.surgeryDate).teamName}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        R3: {getDutyInfoForDate(selectedPlan.surgeryDate).r3Name}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Hospital / Unidade</p>
                    <p className="text-sm font-bold text-brand-dark">{selectedPlan.hospitalUnit}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Data e Hora</p>
                    <p className="text-sm font-bold text-brand-dark">
                      {formatDate(selectedPlan.surgeryDate)} às {formatTime(selectedPlan.surgeryDate)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Professor Responsável</p>
                    <p className="text-sm font-bold text-brand-dark">{selectedPlan.professorName}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Diagnóstico</p>
                    <p className="text-sm font-bold text-brand-dark">{selectedPlan.diagnosis}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Procedimento</p>
                    <p className="text-sm font-bold text-brand-dark">{selectedPlan.procedureName}</p>
                  </div>
                </div>
              </section>

              {/* Detalhes Técnicos */}
              <section className="space-y-4">
                <h4 className="text-xs font-black text-brand-gold uppercase tracking-widest border-b border-brand-gold/20 pb-2">Planejamento Técnico</h4>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Anestesia</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.anesthesia || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Via de Intubação</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.intubation || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Posicionamento</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.positioning || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Antissepsia</p>
                      <p className="text-sm font-bold text-brand-dark">{selectedPlan.antisepsis || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Acesso Cirúrgico</p>
                    <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl">{selectedPlan.surgicalAccess || 'N/A'}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Resumo do Caso / História</p>
                    <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl">{selectedPlan.caseSummary || 'N/A'}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Passo a Passo Cirúrgico</p>
                    <div className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl whitespace-pre-wrap">
                      {selectedPlan.surgicalSteps || 'N/A'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Materiais de Fixação</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl">{selectedPlan.fixationMaterials || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Estruturas Críticas</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl">{selectedPlan.criticalStructures || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Complicações</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl">{selectedPlan.complications || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pós-Operatório</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl">{selectedPlan.postOpCare || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Observações Adicionais</p>
                    <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl">{selectedPlan.additionalNotes || 'N/A'}</p>
                  </div>
                </div>
              </section>

              {/* Anexos e PDF */}
              <section className="space-y-4">
                <h4 className="text-xs font-black text-brand-gold uppercase tracking-widest border-b border-brand-gold/20 pb-2">Documentação e Anexos</h4>
                <div className="flex flex-wrap gap-4">
                  {selectedPlan.pdfUrl && (
                    <a 
                      href={selectedPlan.pdfUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-brand-dark text-brand-gold rounded-2xl hover:scale-105 transition-all shadow-lg group"
                    >
                      <div className="p-2 bg-brand-gold/10 rounded-xl group-hover:bg-brand-gold/20 transition-all">
                        <FileText size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest">Visualizar PDF</p>
                        <p className="text-[8px] font-bold opacity-60 uppercase tracking-widest">Documento Oficial</p>
                      </div>
                    </a>
                  )}
                  {normalizeAttachments(selectedPlan.attachments).map((att, idx) => {
                    const fileUrl = att.url;
                    const fileName = att.name || `Anexo ${idx + 1}`;
                    const isImage = att.type?.startsWith('image/');

                    return (
                      <a 
                        key={idx}
                        href={fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden hover:border-brand-gold transition-all group relative"
                      >
                        {isImage ? (
                          <img 
                            src={fileUrl || null} 
                            alt={fileName} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-all" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <FileText size={20} className="text-gray-300 group-hover:text-brand-gold transition-all" />
                            <span className="text-[6px] font-black uppercase tracking-tighter text-gray-400 px-1 truncate w-16 text-center">{fileName}</span>
                          </div>
                        )}
                      </a>
                    );
                  })}
                  {(!selectedPlan.pdfUrl && (!selectedPlan.attachments || selectedPlan.attachments.length === 0)) && (
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Nenhum anexo ou PDF disponível.</p>
                  )}
                </div>
              </section>

              {/* Área de Revisão */}
              <section className="space-y-4 pt-8 border-t border-gray-100">
                <h4 className="text-xs font-black text-brand-dark uppercase tracking-widest">Notas de Revisão</h4>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Adicione observações, correções ou orientações para o residente..."
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-[24px] p-6 text-sm outline-none focus:border-brand-gold transition-all min-h-[150px]"
                />
              </section>
            </div>

            <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-4 justify-between items-center">
              <button
                onClick={() => generateSurgicalPlanPDF(selectedPlan)}
                className="px-6 py-4 bg-brand-gold text-brand-dark rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all flex items-center gap-2"
              >
                <Download size={18} />
                Baixar PDF
              </button>
              <div className="flex gap-4">
                <button
                  onClick={() => updatePlanStatus(selectedPlan.id, 'reviewed', reviewNotes)}
                  className="px-8 py-4 bg-white border-2 border-brand-dark text-brand-dark rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-brand-dark hover:text-brand-gold transition-all"
                >
                  Marcar como Revisado
                </button>
                <button
                  onClick={() => updatePlanStatus(selectedPlan.id, 'approved', reviewNotes)}
                  className="px-8 py-4 bg-brand-dark text-brand-gold rounded-2xl font-black uppercase text-[10px] tracking-widest hover:shadow-xl transition-all flex items-center"
                >
                  <CheckCircle size={18} className="mr-2" />
                  Aprovar Planejamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team_management' && (
        <div className="space-y-10 animate-fade-in">
          {/* Sub-navegação */}
          <div className="flex bg-gray-50 p-2 rounded-2xl gap-2 overflow-x-auto no-scrollbar items-center">
            <div className="flex gap-2 flex-grow">
              <button onClick={() => setTeamSubTab('text_import')} className={`shrink-0 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${teamSubTab === 'text_import' ? 'bg-white shadow text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}>Importar via Texto</button>
              <button onClick={() => setTeamSubTab('fixed_teams')} className={`shrink-0 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${teamSubTab === 'fixed_teams' ? 'bg-white shadow text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}>Gestão de Residentes (R1 e R2)</button>
              <button onClick={() => setTeamSubTab('team_shifts')} className={`shrink-0 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${teamSubTab === 'team_shifts' ? 'bg-white shadow text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}>Escala de Plantão (Equipes)</button>
              <button onClick={() => setTeamSubTab('r3_shifts')} className={`shrink-0 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${teamSubTab === 'r3_shifts' ? 'bg-white shadow text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}>Escala Mensal (R3)</button>
              <button onClick={() => setTeamSubTab('calendar')} className={`shrink-0 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${teamSubTab === 'calendar' ? 'bg-white shadow text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}>Calendário e Agenda</button>
            </div>
            <button 
              onClick={applyOfficialScaleSync}
              disabled={isImportingScale}
              className="shrink-0 py-3 px-5 bg-brand-gold text-brand-dark rounded-xl text-[8px] font-black uppercase tracking-widest shadow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Calendar size={14} />
              Sincronizar Escala Oficial
            </button>
          </div>

          {teamSubTab === 'text_import' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">Importar Escala por Texto</h3>
                  <p className="text-sm text-gray-500">Cole o texto formatado com as equipes e escalas abaixo.</p>
                </div>

                <div className="space-y-4">
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Exemplo:&#10;Equipe 1&#10;R2: Marco&#10;R1: Víctor&#10;R1: Felipo&#10;&#10;Escalas:&#10;01/04/2026 a 07/04/2026 - Equipe 1 - R3: Andréia"
                    className="w-full h-80 p-6 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-brand-gold text-sm font-mono leading-relaxed resize-none"
                  />

                  {parseError && (
                    <div className="p-4 bg-red-50 text-red-500 rounded-xl text-xs font-medium flex items-center gap-2 animate-shake">
                      <AlertCircle size={14} />
                      {parseError}
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button
                      onClick={handleParseText}
                      className="flex-1 py-4 bg-brand-dark text-brand-gold rounded-2xl font-bold text-xs uppercase tracking-widest hover:shadow-xl transition-all"
                    >
                      Interpretar Texto
                    </button>
                    <button
                      onClick={() => { setImportText(""); setParsedImport(null); setParseError(null); }}
                      className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              </div>

              {parsedImport && (
                <div className="space-y-6 animate-slide-up">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-gray-900">Prévia da Importação</h4>
                    <button
                      onClick={handleSaveImportedScale}
                      disabled={isImportingScale}
                      className="py-3 px-8 bg-brand-gold text-brand-dark rounded-xl font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {isImportingScale ? "Salvando..." : "Confirmar e Gerar Escalas"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 space-y-4">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Equipes Detectadas ({parsedImport.teams.length})</h5>
                      <div className="space-y-3">
                        {parsedImport.teams.map((t, idx) => (
                          <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="font-bold text-sm text-brand-dark mb-1">{t.name}</div>
                            <div className="text-[10px] text-gray-500 flex flex-wrap gap-2">
                              {t.r2.length > 0 && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">R2: {t.r2.join(", ")}</span>}
                              {t.r1.length > 0 && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full">R1: {t.r1.join(", ")}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-gray-100 space-y-4">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Escalas Detectadas ({parsedImport.scales.length})</h5>
                      <div className="space-y-3">
                        {parsedImport.scales.map((s, idx) => (
                          <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="font-bold text-sm text-gray-900">{s.team}</div>
                              <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                <Calendar size={10} />
                                {s.start.split('-').reverse().join('/')} a {s.end.split('-').reverse().join('/')}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-black uppercase text-brand-gold bg-brand-dark px-2 py-1 rounded-lg">R3: {s.r3}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {teamSubTab === 'fixed_teams' && (
            <div className="space-y-8 animate-fade-in">
              <form onSubmit={handleAddFixedTeam} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center text-brand-gold">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">Equipes Fixas</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Definir Composição R2 + R1</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome da Equipe</label>
                    <input type="text" value={ftName} onChange={e => setFtName(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all placeholder:text-gray-300" placeholder="Ex: Equipe A (Andresa)" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Residente R2 Líder</label>
                    <select 
                      multiple 
                      value={ftR2} 
                      onChange={e => setFtR2(Array.from(e.target.selectedOptions, option => option.value))}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark outline-none h-32 no-scrollbar"
                    >
                      {students.filter(s => s.residencyLevel === 'R2' && s.status === 'approved').map(s => (
                        <option key={s.uid} value={s.displayName}>{s.displayName}</option>
                      ))}
                    </select>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Segure Ctrl para múltipla seleção</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Residentes R1 Membros</label>
                    <select 
                      multiple 
                      value={ftR1} 
                      onChange={e => setFtR1(Array.from(e.target.selectedOptions, option => option.value))}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark outline-none h-32 no-scrollbar"
                    >
                      {students.filter(s => s.residencyLevel === 'R1' && s.status === 'approved').map(s => (
                        <option key={s.uid} value={s.displayName}>{s.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Membros Extras</label>
                    <select 
                      multiple 
                      value={ftExtra} 
                      onChange={e => setFtExtra(Array.from(e.target.selectedOptions, option => option.value))}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark outline-none h-32 no-scrollbar"
                    >
                      {students.filter(s => s.status === 'approved').map(s => (
                        <option key={s.uid} value={s.displayName}>{s.displayName} ({s.residencyLevel})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notas da Equipe</label>
                  <textarea value={ftNotes} onChange={e => setFtNotes(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark outline-none h-20" placeholder="Ex: Equipe vinculada ao setor X..." />
                </div>

                <button type="submit" className="w-full bg-brand-dark text-brand-gold py-5 rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3">
                  <Plus size={20} />
                  {editingFixedTeam ? 'Atualizar Equipe' : 'Criar Equipe Fixa'}
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fixedTeams.map(team => (
                  <div key={team.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl relative group animate-fade-in overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 flex gap-2">
                      <button onClick={() => {
                        setEditingFixedTeam(team);
                        setFtName(team.teamName);
                        setFtR2(team.r2Members);
                        setFtR1(team.r1Members);
                        setFtExtra(team.extraMembers || []);
                        setFtNotes(team.notes || "");
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }} className="p-2 bg-gray-50 text-gray-400 hover:text-brand-dark rounded-xl transition-all"><Edit2 size={16} /></button>
                      <button onClick={() => deleteItem(team)} className="p-2 bg-red-50 text-red-400 hover:text-red-600 rounded-xl transition-all"><Trash2 size={16} /></button>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-lg font-black text-brand-dark uppercase tracking-tight">{team.teamName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${team.active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{team.active ? 'Ativa' : 'Inativa'}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-[9px] font-black text-brand-gold uppercase tracking-widest mb-2">Residente R2</p>
                        <div className="flex flex-wrap gap-2">
                          {team.r2Members.map((m, i) => (
                            <span key={i} className="px-3 py-1 bg-brand-dark text-brand-gold text-[9px] font-black uppercase rounded-lg shadow-sm">{m}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-brand-gold uppercase tracking-widest mb-2">Residentes R1</p>
                        <div className="flex flex-wrap gap-2">
                          {team.r1Members.map((m, i) => (
                            <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 text-[9px] font-black uppercase rounded-lg border border-gray-100">{m}</span>
                          ))}
                        </div>
                      </div>
                      {team.extraMembers && team.extraMembers.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Extras</p>
                          <div className="flex flex-wrap gap-2">
                            {team.extraMembers.map((m, i) => (
                              <span key={i} className="px-3 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded-lg">{m}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {teamSubTab === 'team_shifts' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Manual Registration */}
                <form onSubmit={handleAddTeamShift} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center text-brand-gold">
                      <Plus size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">Lançar Plantão</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Registro Manual Individual</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Equipe</label>
                    <select value={tsTeamId} onChange={e => setTsTeamId(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark outline-none">
                      <option value="">Selecione a Equipe</option>
                      {fixedTeams.filter(t => t.active).map(t => (
                        <option key={t.id} value={t.id}>{t.teamName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Início (Quarta)</label>
                      <input type="date" value={tsStart} onChange={e => setTsStart(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fim (Terça)</label>
                      <input type="date" value={tsEnd} onChange={e => setTsEnd(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark" />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-brand-dark text-brand-gold py-5 rounded-[24px] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl">
                    <Save size={20} /> Salvar Plantão
                  </button>
                </form>

                {/* Auto Generation */}
                <form onSubmit={handleAutoGenerateShifts} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl space-y-6 relative overflow-hidden">
                  {isImportingScale && (
                   <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center space-y-4">
                      <RotateCcw className="animate-spin text-brand-gold" size={48} />
                      <p className="text-[10px] font-black text-brand-dark uppercase tracking-widest">Gerando escala sequencial...</p>
                   </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center text-brand-gold">
                        <RotateCcw size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">Escala Automática</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Gerar Sequencial de Equipes</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => suggestContinuity('team')}
                      className="px-4 py-2 bg-brand-gold/10 text-brand-gold rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-brand-gold/20 transition-all border border-brand-gold/20"
                    >
                      Sugerir Continuidade
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Equipe Inicial</label>
                    <select value={agTeamId} onChange={e => setAgTeamId(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark outline-none">
                      <option value="">Selecione quem começa</option>
                      {fixedTeams.filter(t => t.active).map(t => (
                        <option key={t.id} value={t.id}>{t.teamName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data de Início</label>
                      <input type="date" value={agStart} onChange={e => setAgStart(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark" />
                      <p className="text-[8px] text-gray-400 uppercase tracking-tight">Recomendado: Quarta-feira</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Até a Data</label>
                      <input type="date" value={agEndLimit} onChange={e => setAgEndLimit(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark" />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-emerald-600 text-white py-5 rounded-[24px] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-700 transition-all">
                    <CheckCircle2 size={20} /> Gerar Ciclo de Escala
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
                <div className="p-6 bg-gray-50 flex items-center justify-between border-b border-gray-100">
                   <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plantões Cadastrados</h4>
                   <button 
                    onClick={resetTeamShifts}
                    className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                   >
                     Resetar Plantões Equipes
                   </button>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-gray-100">
                      <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Período</th>
                      <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Equipe de Plantão</th>
                      <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Membros</th>
                      <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {teamShifts
                    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                    .map(shift => {
                      const team = fixedTeams.find(t => t.id === shift.teamId);
                      return (
                        <tr key={shift.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-6">
                            <p className="text-xs font-black text-brand-dark uppercase tracking-widest">
                              {formatDate(shift.startDate)} — {formatDate(shift.endDate)}
                            </p>
                          </td>
                          <td className="p-6">
                            <span className="px-3 py-1 bg-brand-dark text-brand-gold text-[9px] font-black uppercase rounded-full shadow-sm">
                              {shift.teamName}
                            </span>
                          </td>
                          <td className="p-6">
                            <div className="flex flex-wrap gap-1 max-w-[300px]">
                              {team?.r2Members.map((m, i) => <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[8px] font-black uppercase rounded">{m}</span>)}
                              {team?.r1Members.map((m, i) => <span key={i} className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[8px] font-bold uppercase rounded border border-gray-100">{m}</span>)}
                            </div>
                          </td>
                          <td className="p-6 text-right">
                            <button onClick={() => deleteItem(null, "team_shifts", shift.id)} className="p-2 bg-red-50 text-red-400 hover:text-red-500 rounded-xl transition-all">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {teamSubTab === 'r3_shifts' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Manual R3 */}
                <form onSubmit={handleAddR3Shift} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-brand-gold/10 rounded-2xl flex items-center justify-center text-brand-gold">
                    <UserCheck size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">Escala de R3</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Designar R3 Individual</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Residente R3</label>
                    <select value={r3sResId} onChange={e => setR3sResId(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark outline-none">
                      <option value="">Selecione o R3</option>
                      {students.filter(s => s.residencyLevel === 'R3' && s.status === 'approved').map(s => (
                        <option key={s.uid} value={s.uid}>{s.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Início</label>
                    <input type="date" value={r3sStart} onChange={e => setR3sStart(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fim</label>
                    <input type="date" value={r3sEnd} onChange={e => setR3sEnd(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-brand-dark text-brand-gold py-5 rounded-[24px] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl">
                  <Plus size={20} /> Adicionar Plantão
                </button>
              </form>

              {/* Auto Generator R3 */}
              <form onSubmit={handleAutoGenerateR3Shifts} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl space-y-6 relative overflow-hidden">
                  {isImportingScale && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center space-y-4">
                        <RotateCcw className="animate-spin text-brand-gold" size={48} />
                        <p className="text-[10px] font-black text-brand-dark uppercase tracking-widest">Gerando escala R3...</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                        <RotateCcw size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">Escala Automática R3</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Gerar Rodízio de R3s</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => suggestContinuity('r3')}
                      className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100"
                    >
                      Sugerir Continuidade
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">R3 Inicial</label>
                    <select value={agR3Id} onChange={e => setAgR3Id(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark outline-none">
                      <option value="">Quem começa o rodízio?</option>
                      {students.filter(s => s.residencyLevel === 'R3' && s.status === 'approved').map(s => (
                        <option key={s.uid} value={s.uid}>{s.displayName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Início</label>
                      <input type="date" value={agR3Start} onChange={e => setAgR3Start(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Até a Data</label>
                      <input type="date" value={agR3EndLimit} onChange={e => setAgR3EndLimit(e.target.value)} className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-brand-dark" />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-emerald-600 text-white py-5 rounded-[24px] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-700 transition-all">
                    <CheckCircle2 size={20} /> Gerar Ciclo de R3
                  </button>
                </form>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-gray-900">Plantões R3 Cadastrados</h4>
                <button 
                  onClick={resetR3Shifts}
                  className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                >
                  Resetar Plantões R3
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {r3Shifts
                  .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                  .map(shift => (
                  <div key={shift.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center justify-between group animate-fade-in transition-all hover:shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 flex items-center justify-center text-brand-gold font-black text-xs">
                        {shift.residentName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-black text-brand-dark uppercase tracking-widest">{shift.residentName}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          {formatDate(shift.startDate)} — {formatDate(shift.endDate)}
                        </p>
                        {shift.teamName && (
                          <span className="mt-2 inline-block px-2 py-0.5 bg-brand-dark text-brand-gold text-[8px] font-black uppercase rounded">
                            {shift.teamName}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteItem(null, "r3_shifts", shift.id)} className="p-3 bg-red-50 text-red-400 hover:text-red-500 rounded-2xl transition-all block">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {teamSubTab === 'calendar' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white rounded-[40px] border border-gray-100 shadow-2xl overflow-hidden p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black text-brand-dark uppercase tracking-widest">Linha do Tempo</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Escala Consolidada de Plantões</p>
                  </div>
                  <Calendar size={32} className="text-brand-gold" />
                </div>

                <div className="space-y-12">
                  {/* Agrupar por semanas para visualização */}
                  {Array.from(new Set(teamShifts.map(s => s.startDate))).sort((a, b) => {
                    const now = new Date().toISOString().split('T')[0];
                    const aShift = teamShifts.find(s => s.startDate === a);
                    const bShift = teamShifts.find(s => s.startDate === b);
                    
                    const isA = aShift && now >= aShift.startDate && now <= aShift.endDate;
                    const isB = bShift && now >= bShift.startDate && now <= bShift.endDate;
                    if (isA && !isB) return -1;
                    if (!isA && isB) return 1;
                    
                    const aFuture = a >= now;
                    const bFuture = b >= now;
                    if (aFuture && !bFuture) return -1;
                    if (!aFuture && bFuture) return 1;
                    
                    if (aFuture) return a.localeCompare(b);
                    return b.localeCompare(a);
                  }).map(startDate => {
                    const shiftsOfWeek = teamShifts.filter(s => s.startDate === startDate);
                    const r3sOfWeek = r3Shifts.filter(s => s.startDate === startDate);
                    const now = new Date().toISOString().split('T')[0];
                    const isCurrentWeek = shiftsOfWeek.some(s => now >= s.startDate && now <= s.endDate);
                    
                    return (
                      <div key={startDate} className={`space-y-4 relative pl-8 border-l-2 ${isCurrentWeek ? 'border-brand-gold bg-brand-gold/5 py-4 rounded-r-3xl' : 'border-brand-gold/20'}`}>
                        <div className={`absolute top-4 -left-[9px] w-4 h-4 rounded-full border-4 border-white shadow-sm ${isCurrentWeek ? 'bg-brand-dark animate-pulse scale-125' : 'bg-brand-gold'}`}></div>
                        <div className="flex items-center gap-4 ml-4">
                          <h4 className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full inline-block ${isCurrentWeek ? 'bg-brand-dark text-brand-gold shadow-lg ring-4 ring-brand-gold/20' : 'bg-brand-gold/5 text-brand-gold'}`}>
                            {isCurrentWeek ? '⚡ Semana Atual: ' : 'Semana: '} {formatDate(startDate)} a {formatDate(shiftsOfWeek[0]?.endDate)}
                          </h4>
                          {isCurrentWeek && <span className="bg-brand-gold text-brand-dark px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest animate-bounce">Live Agora</span>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 ml-4">
                          {shiftsOfWeek.map(shift => {
                            const team = fixedTeams.find(t => t.id === shift.teamId);
                            const r3 = r3sOfWeek.find(r => r.teamId === shift.teamId) || r3sOfWeek[0];
                            
                            return (
                              <div key={shift.id} className={`p-6 rounded-[32px] border shadow-sm transition-all hover:shadow-md group ${isCurrentWeek ? 'bg-white border-brand-gold/30' : 'bg-gray-50/50 border-gray-100 hover:bg-white'}`}>
                                <div className="flex items-center justify-between mb-4">
                                  <span className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-full shadow-lg ${isCurrentWeek ? 'bg-brand-gold text-brand-dark' : 'bg-brand-dark text-brand-gold'}`}>
                                    Equipe {shift.teamName}
                                  </span>
                                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-sm ${isCurrentWeek ? 'bg-brand-gold/10 border-brand-gold/20 text-brand-dark' : 'bg-white border-gray-100 text-brand-dark'}`}>
                                    <Activity size={14} className={isCurrentWeek ? 'animate-pulse' : ''} />
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-[9px] font-black text-brand-gold uppercase tracking-widest mb-1">R3 de Plantão</p>
                                    <p className="text-xs font-bold text-brand-dark uppercase">{r3?.residentName || 'NÃO DEFINIDO'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black text-brand-gold uppercase tracking-widest mb-1">Integrantes da Equipe</p>
                                    <div className="flex flex-wrap gap-2">
                                      {team?.r2Members.map((m, i) => <span key={i} className="px-3 py-1 bg-brand-dark/5 text-brand-dark text-[10px] font-black uppercase rounded-lg border border-brand-dark/10">{m} (R2)</span>)}
                                      {team?.r1Members.map((m, i) => <span key={i} className="px-3 py-1 bg-white text-gray-500 text-[10px] font-bold uppercase rounded-lg border border-gray-100 shadow-sm">{m} (R1)</span>)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {shiftsOfWeek.length === 0 && (
                            <div className="col-span-2 py-10 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center space-y-2 opacity-50">
                              <AlertCircle size={24} className="text-gray-300" />
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sem equipes escaladas para este período</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {teamShifts.length === 0 && (
                    <div className="text-center py-20 text-gray-300">
                      <Calendar size={64} className="mx-auto mb-4 opacity-20" />
                      <p className="text-xs font-black uppercase tracking-widest">Aguardando lançamento de plantões</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="space-y-10 md:space-y-14 animate-fade-in">
          {/* AI Intelligence Section */}
          <div className="bg-brand-dark rounded-[40px] p-8 md:p-10 border border-brand-gold/20 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Bot size={180} className="text-brand-gold" />
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center space-x-4">
                  <div className="bg-brand-gold/10 p-4 rounded-[24px]">
                    <ShieldCheck size={32} className="text-brand-gold" />
                  </div>
                  <div>
                    <h3 className="font-black text-white uppercase text-base tracking-widest">Inteligência Base</h3>
                    <p className="text-xs font-bold text-brand-gold/60 uppercase tracking-widest mt-1">System Prompt do Chefinho</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="px-6 py-3 bg-white/5 hover:bg-white/10 text-brand-gold rounded-2xl font-black uppercase text-[10px] tracking-widest cursor-pointer transition-all border border-brand-gold/20 shadow-lg">
                    Importar Prompt (.txt)
                    <input 
                      type="file" 
                      accept=".txt" 
                      onChange={handleAiIntelligenceImport} 
                      className="hidden" 
                    />
                  </label>
                  <label className="px-6 py-3 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold rounded-2xl font-black uppercase text-[10px] tracking-widest cursor-pointer transition-all border border-brand-gold/20 shadow-lg">
                    {isImportingInstitutional ? 'Importando...' : 'Importar Base Institucional'}
                    <input 
                      type="file" 
                      accept=".txt" 
                      onChange={handleImportInstitutionalBase} 
                      className="hidden" 
                      disabled={isImportingInstitutional}
                    />
                  </label>
                </div>
              </div>

              <form onSubmit={handleSaveAiConfig} className="space-y-6">
                <div className="bg-black/30 rounded-[32px] p-6 border border-white/5 shadow-inner">
                  <textarea 
                    value={aiPromptInput}
                    onChange={(e) => setAiPromptInput(e.target.value)}
                    className="w-full bg-transparent border-none text-white text-sm font-medium leading-relaxed min-h-[300px] outline-none resize-none custom-scrollbar"
                    placeholder="Defina aqui a personalidade, conhecimentos e regras do Chefinho..."
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {aiConfig?.lastUpdated?.toMillis ? `Última atualização: ${new Date(aiConfig.lastUpdated.toMillis()).toLocaleString('pt-BR')}` : 'Nunca atualizado'}
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSavingAiConfig || !aiPromptInput}
                    className="w-full sm:w-auto px-10 py-4 bg-brand-gold text-brand-dark rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-brand-gold/20 active:scale-95 transition-all disabled:opacity-50 hover:scale-[1.02]"
                  >
                    {isSavingAiConfig ? 'Salvando...' : 'Salvar Inteligência'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Institutional Knowledge Base List */}
          <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="bg-brand-dark/10 p-4 rounded-[24px]">
                  <Database size={32} className="text-brand-dark" />
                </div>
                <div>
                  <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">Base Institucional</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Coleção chefinho_knowledge ({chefinhoKnowledge.length} tópicos)</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar">
              {chefinhoKnowledge.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                  <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhum tópico institucional carregado</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {chefinhoKnowledge.map((entry) => (
                    <div key={entry.id} className={`p-6 rounded-[32px] border transition-all group hover:shadow-md ${entry.active ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-brand-dark text-sm md:text-base uppercase tracking-widest mb-2">{entry.topic}</h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {entry.keywords.map((kw, idx) => (
                              <span key={idx} className="text-[9px] font-black text-brand-gold bg-brand-gold/5 px-2 py-1 rounded-lg uppercase tracking-widest">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                          <button 
                            onClick={() => toggleChefinhoKnowledge(entry.id!, entry.active)}
                            className={`p-3 rounded-xl transition-all ${entry.active ? 'text-emerald-500 bg-emerald-50' : 'text-gray-400 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-500'}`}
                            title={entry.active ? "Desativar" : "Ativar"}
                          >
                            {entry.active ? <Eye size={20} /> : <EyeOff size={20} />}
                          </button>
                          <button 
                            onClick={() => deleteChefinhoKnowledge(entry.id!)}
                            className="p-3 text-red-300 hover:text-red-500 bg-red-50 rounded-xl transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-4">{entry.content}</p>
                      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fonte: {entry.source}</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {entry.createdAt?.toMillis ? new Date(entry.createdAt.toMillis()).toLocaleDateString('pt-BR') : 'Sem data'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Connection Diagnostic Section */}
          <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="bg-brand-gold/10 p-4 rounded-[24px]">
                  <Activity size={32} className="text-brand-gold" />
                </div>
                <div>
                  <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">Diagnóstico do Chefinho</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Status da API e Base de Dados</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="px-6 py-3 bg-brand-dark text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-dark/20 active:scale-95 transition-all disabled:opacity-50 hover:bg-brand-dark/90"
                >
                  {isTestingConnection ? 'Testando...' : 'Testar API'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100">
                  <h4 className="text-xs font-black text-brand-dark uppercase tracking-widest mb-4">Resumo da Base</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Tópicos Institucionais</p>
                      <p className="text-2xl font-black text-brand-dark">{chefinhoKnowledge.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status do Prompt</p>
                      <p className={`text-xs font-black uppercase tracking-widest ${aiConfig ? 'text-emerald-500' : 'text-red-500'}`}>
                        {aiConfig ? 'Configurado' : 'Padrão'}
                      </p>
                    </div>
                  </div>
                </div>

                {testResult && (
                  <div className={`p-6 rounded-[32px] border ${testResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center space-x-3 mb-3">
                      {testResult.success ? <CheckCircle size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-red-500" />}
                      <p className={`text-xs font-black uppercase tracking-widest ${testResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                        {testResult.message}
                      </p>
                    </div>
                    {testResult.details && (
                      <p className="text-[10px] text-gray-500 font-mono break-all bg-white/50 p-3 rounded-xl">{String(testResult.details)}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100">
                  <h4 className="text-xs font-black text-brand-dark uppercase tracking-widest mb-4">Teste de Fluxo (RAG)</h4>
                  <div className="space-y-4">
                    <input 
                      type="text"
                      value={testQuestion}
                      onChange={(e) => setTestQuestion(e.target.value)}
                      placeholder="Faça uma pergunta para testar..."
                      className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"
                    />
                    <button 
                      onClick={handleTestFlow}
                      disabled={isTestingFlow || !testQuestion}
                      className="w-full py-4 bg-brand-gold text-brand-dark rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-brand-gold/20 active:scale-95 transition-all disabled:opacity-50 hover:scale-[1.01]"
                    >
                      {isTestingFlow ? 'Processando...' : 'Simular Pergunta'}
                    </button>
                  </div>
                </div>

                {flowResult && (
                  <div className="p-6 bg-brand-dark rounded-[32px] border border-brand-gold/20 shadow-xl max-h-[300px] overflow-y-auto custom-scrollbar">
                    <div className="flex items-center space-x-3 mb-4">
                      <Bot size={20} className="text-brand-gold" />
                      <p className="text-xs font-black text-brand-gold uppercase tracking-widest">Resposta do Chefinho</p>
                    </div>
                    <p className="text-sm text-white/90 leading-relaxed font-medium whitespace-pre-wrap">{flowResult}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* WhatsApp Import Section (Robust Version) */}
          <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Plus size={180} className="text-emerald-600" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="bg-emerald-600/10 p-4 rounded-[24px]">
                    <FilePlus size={32} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-brand-dark uppercase text-base tracking-widest">Importador Chefinho</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">WhatsApp Study Group Parser</p>
                  </div>
                </div>
                {importStep !== 'idle' && (
                  <button 
                    onClick={resetImport}
                    className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all shadow-sm"
                    title="Reiniciar"
                  >
                    <RotateCcw size={20} />
                  </button>
                )}
              </div>

              {importStep === 'idle' && (
                <div className="space-y-8">
                  <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-[32px] p-6 md:p-8">
                    <p className="text-sm text-emerald-800 font-medium leading-relaxed">
                      Transforme conversas do WhatsApp em base de conhecimento técnica. 
                      O sistema filtra automaticamente mensagens irrelevantes e foca em discussões clínicas.
                    </p>
                    <ul className="mt-4 space-y-2">
                      <li className="flex items-center gap-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        <CheckCircle2 size={14} /> Apenas arquivos .txt (UTF-8)
                      </li>
                      <li className="flex items-center gap-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        <CheckCircle2 size={14} /> Limite de 5MB por arquivo
                      </li>
                    </ul>
                  </div>

                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-emerald-200 rounded-[40px] bg-emerald-50/30 hover:bg-emerald-50 transition-all cursor-pointer group shadow-inner">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileText size={48} className="text-emerald-400 mb-4 group-hover:scale-110 transition-transform" />
                      <p className="text-sm font-black text-emerald-600 uppercase tracking-widest">Clique para selecionar _chat.txt</p>
                    </div>
                    <input 
                      type="file" 
                      accept=".txt" 
                      onChange={handleWhatsAppImport} 
                      className="hidden" 
                    />
                  </label>
                </div>
              )}

              {(importStep === 'reading' || importStep === 'parsing' || importStep === 'saving') && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Bot size={24} className="text-emerald-600" />
                      </div>
                    </div>
                    <h4 className="mt-4 font-black text-brand-dark uppercase text-xs tracking-widest">
                      {importStep === 'reading' && 'Lendo Arquivo...'}
                      {importStep === 'parsing' && 'Analisando Mensagens...'}
                      {importStep === 'saving' && `Salvando Base (${importBatchProgress}%)`}
                    </h4>
                    {importFile && (
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-1">
                        {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                      Por favor, não feche esta aba
                    </p>
                  </div>

                  {importStep === 'saving' && (
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-full transition-all duration-500" 
                        style={{ width: `${importBatchProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}

              {importStep === 'preview' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Linhas</div>
                      <div className="text-sm font-black text-brand-dark">{importStats.total}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Válidas</div>
                      <div className="text-sm font-black text-emerald-600">{importStats.valid}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Úteis</div>
                      <div className="text-sm font-black text-brand-gold">{importStats.added}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Pré-visualização (Primeiras 5)</h5>
                    <div className="space-y-2">
                      {importPreview.map((item, idx) => (
                        <div key={idx} className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 text-[10px]">
                          <div className="flex justify-between mb-1">
                            <span className="font-black text-brand-gold uppercase">{item.topic}</span>
                            <span className="text-gray-400 font-bold">{item.author}</span>
                          </div>
                          <p className="text-gray-600 line-clamp-2 italic">"{item.content}"</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={confirmImport}
                      className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
                    >
                      Confirmar Importação ({importStats.added})
                    </button>
                    <button 
                      onClick={resetImport}
                      className="px-6 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'done' && (
                <div className="py-10 text-center animate-scale-in">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="font-black text-brand-dark uppercase text-sm tracking-widest">Sucesso!</h4>
                  <p className="text-xs text-gray-500 font-medium mt-2">{importResult}</p>
                  <button 
                    onClick={resetImport}
                    className="mt-6 px-8 py-3 bg-brand-dark text-brand-gold rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg"
                  >
                    Nova Importação
                  </button>
                </div>
              )}

              {importStep === 'error' && (
                <div className="py-10 text-center animate-shake">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} />
                  </div>
                  <h4 className="font-black text-red-600 uppercase text-sm tracking-widest">Erro no Processamento</h4>
                  <p className="text-xs text-gray-500 font-medium mt-2 px-6">{importError || 'Ocorreu um erro inesperado.'}</p>
                  <button 
                    onClick={resetImport}
                    className="mt-6 px-8 py-3 bg-gray-100 text-gray-600 rounded-xl font-black uppercase text-[10px] tracking-widest"
                  >
                    Tentar Novamente
                  </button>
                </div>
              )}

              {/* Debug Logs Window */}
              {importLogs.length > 0 && (
                <div className="mt-6 bg-brand-dark rounded-2xl p-4 font-mono text-[9px] text-emerald-400/80 border border-white/5 shadow-inner max-h-32 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="uppercase font-black tracking-widest text-white/40">System Logs</span>
                  </div>
                  {importLogs.map((log, idx) => (
                    <div key={idx} className="mb-1">{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl">
            <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest mb-4">
              {isEditingKb ? 'Editar Entrada' : 'Nova Entrada na Base de Conhecimento'}
            </h3>
            <form onSubmit={handleSaveKnowledge} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Pergunta / Tópico</label>
                <input 
                  type="text" 
                  value={kbQuestion}
                  onChange={(e) => setKbQuestion(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 text-xs font-bold text-brand-dark"
                  placeholder="Ex: Como realizar acesso de Weber-Ferguson?"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Resposta do Chefinho</label>
                <textarea 
                  value={kbAnswer}
                  onChange={(e) => setKbAnswer(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 text-xs font-bold text-brand-dark min-h-[150px]"
                  placeholder="Descreva a resposta técnica detalhada..."
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Palavras-chave (separadas por vírgula)</label>
                <input 
                  type="text" 
                  value={kbKeywords}
                  onChange={(e) => setKbKeywords(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 text-xs font-bold text-brand-dark"
                  placeholder="Ex: acesso, weber-ferguson, maxilectomia"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 py-4 bg-brand-dark text-brand-gold rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                  {isEditingKb ? 'Salvar Alterações' : 'Adicionar à Base'}
                </button>
                {isEditingKb && (
                  <button type="button" onClick={() => setIsEditingKb(null)} className="px-6 py-4 bg-gray-100 text-gray-400 rounded-xl font-black uppercase text-[10px] tracking-widest">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <h3 className="font-black text-brand-dark uppercase text-sm tracking-widest">Base de Conhecimento Atual</h3>
            <div className="grid gap-4">
              {knowledgeEntries.map(entry => (
                <div key={entry.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-brand-dark text-sm">{entry.question}</h4>
                    <div className="flex gap-2">
                      <button onClick={() => startEditingKb(entry)} className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-brand-gold/10 hover:text-brand-gold transition-all">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete('knowledge_base', entry.id)} className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-3 mb-3 leading-relaxed">{entry.answer}</p>
                  <div className="flex flex-wrap gap-1">
                    {entry.keywords?.map((kw: string, idx: number) => (
                      <span key={idx} className="text-[8px] font-black text-brand-gold bg-brand-gold/5 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {knowledgeEntries.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <Bot size={40} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Base de conhecimento vazia</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Diagnostic Overlay
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

export default Admin;
