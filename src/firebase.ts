import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

interface FirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

const config = firebaseConfig as FirebaseConfig;

const app = getApps().length ? getApp() : initializeApp(config);

console.log('[FIREBASE DEBUG] projectId:', config.projectId);
console.log('[FIREBASE DEBUG] Database:', config.firestoreDatabaseId || '(default)');

export const auth = getAuth(app);

// Banco de Dados Nomeado (Novo/Atual)
export const db = getFirestore(app, config.firestoreDatabaseId || "(default)");
export const isNamedDefault = !config.firestoreDatabaseId || config.firestoreDatabaseId === "(default)";

// Banco de Dados Padrão (Onde podem estar os dados antigos)
export const dbDefault = getFirestore(app, "(default)");

// Teste de conexão conforme diretrizes
async function testConnections() {
  const testPath = 'connection_test/ping';
  
  // Teste no banco nomeado
  try {
    await getDocFromServer(doc(db, testPath));
    console.log('[FIREBASE] Conexão OK no banco:', config.firestoreDatabaseId || '(default)');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('[FIREBASE] ERRO: Banco nomeado offline. Verifique se o ID existe:', config.firestoreDatabaseId);
    }
  }

  // Teste no banco padrão
  try {
    await getDocFromServer(doc(dbDefault, testPath));
    console.log('[FIREBASE] Conexão OK no banco: (default)');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('[FIREBASE] ERRO: Banco padrão offline.');
    }
  }
}

testConnections();

// dbLegacy agora tenta ser inteligente
export const dbLegacy = db;

export const storage = getStorage(app);

export default app;
