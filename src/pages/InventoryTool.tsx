
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, limit, getFirestore } from 'firebase/firestore';
import { ref, listAll, getMetadata } from 'firebase/storage';
import { getApp } from 'firebase/app';
import { db, storage } from '../firebase';
import { Terminal, Database, HardDrive, ShieldCheck, AlertTriangle, Info, ChevronRight, ChevronDown, FileText, Folder, Search, CheckCircle2, RefreshCw } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface CollectionStats {
  name: string;
  count: number;
  sampleFields: string[];
  lastUpdate?: string;
  loading: boolean;
  error?: string;
}

interface StorageItem {
  name: string;
  fullPath: string;
  type: 'file' | 'folder';
  size?: number;
  updated?: string;
}

const COLLECTIONS_TO_CHECK = [
  'users',
  'access_requests',
  'surgical_plans',
  'surgeries',
  'materials',
  'modules',
  'protocols',
  'announcements',
  'lives',
  'notifications',
  'notification_reads',
  'home_highlights',
  'knowledge_base',
  'knowledge_base_ctbmf',
  'chefinho_knowledge',
  'ai_config',
  'chefinho_questions',
  'chefinho_learning',
  'chefinho_history',
  'user_sessions'
];

interface TargetConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

const InventoryTool: React.FC = () => {
  const [stats, setStats] = useState<CollectionStats[]>([]);
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [activeTab, setActiveTab] = useState<'firestore' | 'storage' | 'target' | 'credentials'>('firestore');
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  
  // Target Project State
  const [targetConfig, setTargetConfig] = useState<TargetConfig>({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    firestoreDatabaseId: '(default)'
  });
  const [isTestingTarget, setIsTestingTarget] = useState(false);
  const [targetStats, setTargetStats] = useState<CollectionStats[]>([]);
  const [targetStorageItems, setTargetStorageItems] = useState<StorageItem[]>([]);
  const [loadingTargetStorage, setLoadingTargetStorage] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(`[INVENTORY] ${msg}`);
    setTestLogs(prev => [...prev, msg]);
  };

  useEffect(() => {
    const fetchStats = async () => {
      const initialStats = COLLECTIONS_TO_CHECK.map(name => ({
        name,
        count: 0,
        sampleFields: [],
        loading: true
      }));
      setStats(initialStats);

      for (const colName of COLLECTIONS_TO_CHECK) {
        try {
          const colRef = collection(db, colName);
          const snapshot = await getDocs(colRef);
          
          let sampleFields: string[] = [];
          if (!snapshot.empty) {
            const firstDoc = snapshot.docs[0].data();
            sampleFields = Object.keys(firstDoc);
          }

          setStats(prev => prev.map(s => 
            s.name === colName 
              ? { ...s, count: snapshot.size, sampleFields, loading: false } 
              : s
          ));
        } catch (err: unknown) {
          console.error(`Error fetching stats for ${colName}:`, err);
          const error = err as { message?: string };
          setStats(prev => prev.map(s => 
            s.name === colName 
              ? { ...s, loading: false, error: error.message || 'Permission denied' } 
              : s
          ));
        }
      }
    };

    fetchStats();
    fetchStorage('/');
  }, []);

  const testTargetConnection = async () => {
    if (!targetConfig.apiKey || !targetConfig.projectId) {
      alert('Por favor, preencha ao menos a API Key e o Project ID.');
      return;
    }

    setIsTestingTarget(true);
    setTargetStats([]);
    setTargetStorageItems([]);
    setLoadingTargetStorage(true);
    setTestLogs([]);
    addLog('🚀 Iniciando busca profunda com seu usuário logado...');
    
    try {
      // Como o Project ID é o mesmo, vamos usar o App principal já autenticado
      const mainApp = getApp();
      addLog(`✅ Usando App Principal: ${firebaseConfig.projectId}`);

      const dbsToScan = [
        '(default)',
        'ai-studio-de5e629d-0ab0-4fdb-8c03-f8ec83c06711'
      ];

      const allResults: CollectionStats[] = [];

      for (const dbId of dbsToScan) {
        const currentDbId = dbId === '(default)' ? undefined : dbId;
        addLog(`🔍 Verificando Banco: ${dbId}...`);
        
        try {
          const tempDb = getFirestore(mainApp, currentDbId);
          
          for (const colName of ['materials', 'modules', 'users', 'surgical_plans', 'surgeries']) {
            try {
              const colRef = collection(tempDb, colName);
              // Tenta ler apenas 1 doc para testar permissão e existência
              const snapshot = await getDocs(query(colRef, limit(1)));
              
              if (!snapshot.empty) {
                addLog(`✨ ACHADO! Dados na coleção '${colName}' (Banco: ${dbId})`);
                const fullSnapshot = await getDocs(colRef);
                allResults.push({
                  name: `${dbId} / ${colName}`,
                  count: fullSnapshot.size,
                  sampleFields: Object.keys(snapshot.docs[0].data()),
                  loading: false
                });
              } else {
                // Se estiver vazio mas não der erro, o banco existe mas a coleção está limpa
              }
            } catch (e: unknown) {
              const err = e as { code?: string; message?: string };
              if (err.code === 'permission-denied') {
                addLog(`🚫 Bloqueado: Sem permissão para '${colName}' no banco ${dbId}`);
              } else {
                console.warn(`Erro em ${dbId}/${colName}:`, err.message);
              }
            }
          }
        } catch (e: unknown) {
          const err = e as { message?: string };
          addLog(`❌ Banco ${dbId} não disponível ou inacessível: ${err.message}`);
        }
      }

      if (allResults.length === 0) {
        addLog('⚠️ Nenhum dado visível encontrado. Verifique se você está logado como admin.');
      }

      setTargetStats(allResults);

      // Storage Scan usando o storage principal
      addLog('📂 Verificando Storage Principal...');
      try {
        const storageRef = ref(storage, '/');
        const storageRes = await listAll(storageRef);
        addLog(`✅ Storage: ${storageRes.items.length} arquivos encontrados.`);

        const files = await Promise.all(storageRes.items.map(async (item) => {
          const meta = await getMetadata(item).catch(() => ({ size: 0, updated: '' }));
          const m = meta as { size?: number; updated?: string };
          return {
            name: item.name,
            fullPath: item.fullPath,
            type: 'file' as const,
            size: m.size || 0,
            updated: m.updated || ''
          };
        }));

        setTargetStorageItems(files);
      } catch (err: unknown) {
        const error = err as { message?: string };
        addLog(`❌ Erro no Storage: ${error.message}`);
      }
      
      addLog('🏁 Scan finalizado!');
      setShowSuccess(true);
      setActiveTab('target');

    } catch (err) {
      const error = err as Error;
      addLog(`❌ ERRO GERAL: ${error.message}`);
    } finally {
      setIsTestingTarget(false);
      setLoadingTargetStorage(false);
    }
  };

  const fetchStorage = async (path: string) => {
    setLoadingStorage(true);
    try {
      const storageRef = ref(storage, path);
      const result = await listAll(storageRef);
      
      const folders: StorageItem[] = result.prefixes.map(p => ({
        name: p.name,
        fullPath: p.fullPath,
        type: 'folder'
      }));

      const files: StorageItem[] = await Promise.all(result.items.map(async (item) => {
        try {
          const meta = await getMetadata(item);
          return {
            name: item.name,
            fullPath: item.fullPath,
            type: 'file',
            size: meta.size,
            updated: meta.updated
          };
        } catch {
          return {
            name: item.name,
            fullPath: item.fullPath,
            type: 'file'
          };
        }
      }));

      setStorageItems([...folders, ...files]);
    } catch (err) {
      console.error('Error listing storage:', err);
    } finally {
      setLoadingStorage(false);
    }
  };

  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return 'N/A';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 gold-gradient rounded-xl flex items-center justify-center shadow-lg shadow-brand-gold/20">
              <Terminal className="text-brand-dark" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Inventário de Migração</h1>
              <p className="text-brand-gold/60 text-xs font-mono uppercase tracking-widest">Fase 1: Diagnóstico Isolado</p>
            </div>
          </div>
          <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/10 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <div className="text-[10px] font-mono">
              <span className="text-gray-500">PROJETO ATUAL:</span>
              <span className="ml-2 text-emerald-400">{firebaseConfig.projectId}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
          <button 
            onClick={() => setActiveTab('firestore')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'firestore' ? 'gold-gradient text-brand-dark' : 'text-gray-400 hover:text-white'}`}
          >
            Firestore Atual
          </button>
          <button 
            onClick={() => setActiveTab('storage')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'storage' ? 'gold-gradient text-brand-dark' : 'text-gray-400 hover:text-white'}`}
          >
            Storage Atual
          </button>
          <button 
            onClick={() => setActiveTab('credentials')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'credentials' ? 'gold-gradient text-brand-dark' : 'text-gray-400 hover:text-white'}`}
          >
            Conectar CTBMF
          </button>
          {targetStats.length > 0 && (
            <button 
              onClick={() => setActiveTab('target')}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'target' ? 'bg-emerald-500 text-white' : 'text-emerald-400 hover:text-emerald-300'}`}
            >
              Dados CTBMF (Materiais)
            </button>
          )}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-6">
          {activeTab === 'firestore' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-brand-gold mb-2">
                <Database size={18} />
                <h2 className="text-sm font-black uppercase tracking-widest">Coleções Identificadas</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map((col) => (
                  <div 
                    key={col.name}
                    className={`bg-white/5 border rounded-xl p-4 transition-all ${expandedCollection === col.name ? 'border-brand-gold/50 ring-1 ring-brand-gold/20' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${col.count > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-500'}`}>
                          <FileText size={16} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider">{col.name}</h3>
                          <p className="text-[10px] text-gray-500 font-mono">
                            {col.loading ? 'Calculando...' : `${col.count} documentos`}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setExpandedCollection(expandedCollection === col.name ? null : col.name)}
                        className="text-gray-500 hover:text-white"
                      >
                        {expandedCollection === col.name ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </div>

                    {col.error && (
                      <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-[9px] text-red-400">
                        <AlertTriangle size={12} />
                        <span>{col.error}</span>
                      </div>
                    )}

                    {expandedCollection === col.name && !col.loading && !col.error && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div>
                          <p className="text-[9px] text-brand-gold uppercase font-bold mb-2">Campos Detectados:</p>
                          <div className="flex flex-wrap gap-1">
                            {col.sampleFields.length > 0 ? col.sampleFields.map(field => (
                              <span key={field} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-mono text-gray-300">
                                {field}
                              </span>
                            )) : <span className="text-[9px] text-gray-500 italic">Nenhum dado para analisar</span>}
                          </div>
                        </div>
                        <div className="p-2 bg-brand-gold/5 rounded-lg border border-brand-gold/10">
                          <p className="text-[8px] text-brand-gold/70 leading-tight italic">
                            Dica: Esta coleção parece conter {col.name === 'users' ? 'perfis de alunos e professores' : col.name === 'surgical_plans' ? 'planejamentos cirúrgicos' : 'dados operacionais'}.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-brand-gold mb-2">
                <HardDrive size={18} />
                <h2 className="text-sm font-black uppercase tracking-widest">Arquivos e Pastas (Storage)</h2>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
                    <Folder size={14} />
                    <span>root /</span>
                  </div>
                  <button 
                    onClick={() => fetchStorage('/')}
                    className="text-[10px] uppercase font-bold text-brand-gold hover:underline"
                  >
                    Atualizar
                  </button>
                </div>

                {loadingStorage ? (
                  <div className="p-12 flex flex-col items-center justify-center gap-4">
                    <div className="w-8 h-8 border-2 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin"></div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Escaneando Bucket...</p>
                  </div>
                ) : storageItems.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {storageItems.map((item) => (
                      <div key={item.fullPath} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'folder' ? 'bg-brand-gold/10 text-brand-gold' : 'bg-white/10 text-gray-400'}`}>
                            {item.type === 'folder' ? <Folder size={18} /> : <FileText size={18} />}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold">{item.name}</h4>
                            <p className="text-[9px] text-gray-500 font-mono">{item.fullPath}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold">{item.type === 'folder' ? '--' : formatSize(item.size)}</p>
                          {item.updated && <p className="text-[8px] text-gray-500">{new Date(item.updated).toLocaleDateString()}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <Search size={32} className="mx-auto text-gray-700 mb-4" />
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Nenhum arquivo encontrado na raiz</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'target' && (
            <div className="space-y-8">
              {/* Firestore Target */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Database size={18} />
                    <h2 className="text-sm font-black uppercase tracking-widest">Coleções no Projeto CTBMF</h2>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {targetStats.map((col) => (
                    <div 
                      key={col.name}
                      className={`bg-emerald-500/5 border rounded-xl p-4 transition-all ${expandedCollection === `target-${col.name}` ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-emerald-500/10 hover:border-emerald-500/20'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${col.count > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-500'}`}>
                            <FileText size={16} />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider">{col.name}</h3>
                            <p className="text-[10px] text-emerald-400/60 font-mono">
                              {col.count} documentos
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setExpandedCollection(expandedCollection === `target-${col.name}` ? null : `target-${col.name}`)}
                          className="text-emerald-500/40 hover:text-emerald-400"
                        >
                          {expandedCollection === `target-${col.name}` ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </div>

                      {col.error && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-[9px] text-red-400">
                          <AlertTriangle size={12} />
                          <span>{col.error}</span>
                        </div>
                      )}

                      {expandedCollection === `target-${col.name}` && !col.error && (
                        <div className="mt-4 pt-4 border-t border-emerald-500/10 space-y-3 animate-in fade-in slide-in-from-top-2">
                          <div>
                            <p className="text-[9px] text-emerald-400 uppercase font-bold mb-2">Campos Detectados:</p>
                            <div className="flex flex-wrap gap-1">
                              {col.sampleFields.length > 0 ? col.sampleFields.map(field => (
                                <span key={field} className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[8px] font-mono text-emerald-300/80">
                                  {field}
                                </span>
                              )) : <span className="text-[9px] text-gray-500 italic">Nenhum dado para analisar</span>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Storage Target */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <HardDrive size={18} />
                  <h2 className="text-sm font-black uppercase tracking-widest">Arquivos no Storage CTBMF</h2>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-emerald-500/10 flex items-center justify-between bg-emerald-500/5">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400/60">
                      <Folder size={14} />
                      <span>{targetConfig.storageBucket || 'default'} /</span>
                    </div>
                  </div>

                  {loadingTargetStorage ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-4">
                      <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                      <p className="text-[10px] text-emerald-400/60 uppercase tracking-widest">Escaneando Bucket Alvo...</p>
                    </div>
                  ) : targetStorageItems.length > 0 ? (
                    <div className="divide-y divide-emerald-500/5">
                      {targetStorageItems.map((item) => (
                        <div key={item.fullPath} className="p-4 flex items-center justify-between hover:bg-emerald-500/5 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'folder' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/10 text-gray-400'}`}>
                              {item.type === 'folder' ? <Folder size={18} /> : <FileText size={18} />}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-emerald-100">{item.name}</h4>
                              <p className="text-[9px] text-emerald-500/40 font-mono">{item.fullPath}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-emerald-400">{item.type === 'folder' ? '--' : formatSize(item.size)}</p>
                            {item.updated && <p className="text-[8px] text-emerald-500/40">{new Date(item.updated).toLocaleDateString()}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <Search size={32} className="mx-auto text-emerald-900 mb-4" />
                      <p className="text-xs text-emerald-500/40 uppercase tracking-widest">Nenhum arquivo encontrado no bucket alvo</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'credentials' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-brand-gold mb-2">
                <ShieldCheck size={18} />
                <h2 className="text-sm font-black uppercase tracking-widest">Configuração do Projeto CTBMF (Materiais)</h2>
              </div>

              <div className="bg-brand-gold/10 border border-brand-gold/20 rounded-2xl p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-brand-gold rounded-xl flex items-center justify-center shrink-0">
                    <Info className="text-brand-dark" size={20} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-black uppercase">Conectar ao projeto antigo</h3>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Insira as credenciais do projeto <span className="text-brand-gold font-bold">CTBMF</span> (o que tem os materiais). 
                      Eu usarei essas informações para tentar listar as coleções e confirmar se os dados estão lá.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'apiKey', label: 'API Key', placeholder: 'AIzaSy...' },
                    { key: 'authDomain', label: 'Auth Domain', placeholder: 'ctbmf.firebaseapp.com' },
                    { key: 'projectId', label: 'Project ID', placeholder: 'ctbmf' },
                    { key: 'storageBucket', label: 'Storage Bucket', placeholder: 'ctbmf.appspot.com' },
                    { key: 'messagingSenderId', label: 'Messaging Sender ID', placeholder: '123456789' },
                    { key: 'appId', label: 'App ID', placeholder: '1:123456789:web:abcdef' },
                    { key: 'firestoreDatabaseId', label: 'Firestore Database ID', placeholder: '(default)' }
                  ].map(item => (
                    <div key={item.key} className="space-y-1">
                      <label className="text-[10px] font-black text-brand-gold uppercase">{item.label}</label>
                      <input 
                        type="text"
                        value={targetConfig[item.key as keyof typeof targetConfig] || ''}
                        onChange={(e) => setTargetConfig(prev => ({ ...prev, [item.key]: e.target.value }))}
                        placeholder={item.placeholder}
                        className="w-full bg-brand-dark/50 border border-white/10 p-3 rounded-xl text-xs focus:border-brand-gold outline-none transition-all"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4">
                  <button 
                    onClick={testTargetConnection}
                    disabled={isTestingTarget}
                    className="w-full gold-gradient text-brand-dark font-black uppercase tracking-widest py-4 rounded-xl shadow-lg shadow-brand-gold/20 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isTestingTarget ? (
                      <>
                        <RefreshCw className="animate-spin" size={18} />
                        Testando Conexão...
                      </>
                    ) : (
                      <>
                        <Search size={18} />
                        Testar Conexão e Listar Dados
                      </>
                    )}
                  </button>
                  
                  {testLogs.length > 0 && (
                    <div className="bg-black/40 rounded-xl p-4 font-mono text-[9px] space-y-1 border border-white/5">
                      {testLogs.map((log, i) => (
                        <div key={i} className={log.includes('FALHA') ? 'text-red-400' : 'text-emerald-400'}>
                          <span className="opacity-50 mr-2">[{i}]</span> {log}
                        </div>
                      ))}
                    </div>
                  )}

                  {showSuccess && (
                    <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-emerald-400 animate-in fade-in zoom-in">
                      <CheckCircle2 size={18} />
                      <p className="text-xs font-bold uppercase tracking-wider">Conexão bem-sucedida! Verifique a nova aba.</p>
                    </div>
                  )}

                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="text-red-400 shrink-0" size={16} />
                    <p className="text-[10px] text-red-400 leading-tight">
                      <span className="font-bold uppercase block mb-1">Atenção:</span>
                      Estas credenciais não serão salvas permanentemente. Elas servem apenas para este diagnóstico pontual.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="pt-8 border-t border-white/10 text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em]">
            Ferramenta de Diagnóstico Isolada • CTBMF Andreoni Migration Tool • 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default InventoryTool;
