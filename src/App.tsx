
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot, getDoc, DocumentReference } from "firebase/firestore";
import { auth, db, dbDefault } from './firebase';
import Login from './pages/Login';
import Home from './pages/Home';
import Modules from './pages/Modules';
import Surgeries from './pages/Surgeries';
import Lives from './pages/Lives';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Protocols from './pages/Protocols';
import SurgicalPlanning from './pages/SurgicalPlanning';
import ProtocolViewer from './pages/ProtocolViewer';
import InstallPage from './pages/InstallPage';
import InventoryTool from './pages/InventoryTool';
import AcademyHub from './pages/AcademyHub';
import AcademyRegister from './pages/AcademyRegister';
import AdminAcademy from './components/AdminAcademy';
import Layout from './components/Layout';
import IosInstallBanner from './components/IosInstallBanner';
import UsageTracker from './components/UsageTracker';
import NotificationListener from './components/NotificationListener';
import Logo from './components/Logo';
import { AppUser } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPreviewActive, setIsPreviewActive] = useState(sessionStorage.getItem('academy_preview_mode') === 'true');

  useEffect(() => {
    const handlePreviewChange = () => {
      setIsPreviewActive(sessionStorage.getItem('academy_preview_mode') === 'true');
    };
    window.addEventListener('academy_preview_changed', handlePreviewChange);
    return () => {
      window.removeEventListener('academy_preview_changed', handlePreviewChange);
    };
  }, []);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Tentar encontrar o usuário no banco nomeado primeiro
        const userDocRef = doc(db, "users", firebaseUser.uid);
        
        const checkUser = async (docRef: DocumentReference) => {
          try {
            const userDoc = await getDoc(docRef);
            if (userDoc.exists()) {
              const userData = userDoc.data() as AppUser;
              if (userData.status === 'approved' || userData.role === 'admin') {
                // MIGRATION: Se encontrou no banco padrão, copia para o banco nomeado
                if (docRef.firestore === dbDefault) {
                  console.log('[AUTH] Migrando usuário do banco padrão para o banco nomeado...');
                  await setDoc(doc(db, "users", firebaseUser.uid), userData, { merge: true });
                }
                setUser({ ...userData, uid: firebaseUser.uid });
                setLoading(false);
                return true;
              }
            }
          } catch (err) {
            console.error('[AUTH] Erro ao verificar usuário:', err);
          }
          return false;
        };

        // Snapshot listener no banco nomeado (principal)
        unsubscribeSnapshot = onSnapshot(userDocRef, async (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data() as AppUser;
            if (userData.status === 'approved' || userData.role === 'admin') {
              setUser({ ...userData, uid: firebaseUser.uid });
              setLoading(false);
            } else {
              setUser(null);
              setLoading(false);
            }
          } else {
            // Se não existe no nomeado, tenta no padrão
            const foundInDefault = await checkUser(doc(dbDefault, "users", firebaseUser.uid));
            if (!foundInDefault) {
              // AUTO-PROVISIONING PARA SUPER ADMIN se não encontrar em nenhum
              const superAdmins = ["juninhoteixeiraofc@gmail.com", "marcomaxilofacial@gmail.com", "janioteixeiracd@gmail.com"];
              if (superAdmins.includes(firebaseUser.email || '')) {
                console.log('[AUTH] Super Admin detectado sem perfil. Criando no banco nomeado...');
                const masterUser: Partial<AppUser> = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  displayName: firebaseUser.displayName || 'Administrador',
                  role: 'admin',
                  status: 'approved',
                  turma_id: 'admin',
                  createdAt: new Date().toISOString()
                };
                try {
                  await setDoc(doc(db, "users", firebaseUser.uid), masterUser);
                } catch (err) {
                  console.error('[AUTH] Erro ao auto-provisionar:', err);
                }
              } else {
                setUser(null);
              }
              setLoading(false);
            }
          }
        }, (error) => {
          console.error("Erro no listener:", error);
          setLoading(false);
        });
      } else {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const handleLogout = async () => {
    if (user) {
      await setDoc(doc(db, "users", user.uid), { isOnline: false }, { merge: true });
    }
    await auth.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-brand-dark">
        <Logo size="lg" className="mb-8 animate-pulse" />
        <div className="text-brand-gold font-bold tracking-[0.3em] mb-4 text-xs uppercase opacity-50">CTBMF ANDREONI</div>
        <div className="w-12 h-1 bg-brand-gold/20 rounded-full overflow-hidden">
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

  const previewUser = (user && user.role === 'admin' && isPreviewActive) ? {
    ...user,
    role: 'academy' as const,
    academyAccess: true,
    academyPlan: 'experience',
    academyStatus: 'active',
    academyCategory: 'dentist',
    displayName: 'Aluno Simulado (Preview)',
    email: 'aluno.preview@maxilopro.com.br',
  } : null;

  const finalUser = previewUser || user;
  const hasResidencyAccess = finalUser ? (finalUser.role === 'admin' || finalUser.role === 'student') : false;
  const hasAcademyAccess = finalUser ? (finalUser.role === 'admin' || finalUser.role === 'academy' || finalUser.academyAccess === true || finalUser.academyStatus === 'active') : false;

  return (
    <HashRouter>
      <UsageTracker user={user} />
      <NotificationListener user={user} />
      <IosInstallBanner />
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" /> : <Login onLogin={() => {}} />} 
        />
        
        <Route path="/instalar" element={<InstallPage />} />
        <Route
          path="/academy-register" 
          element={user ? <Navigate to="/academy" replace /> : <AcademyRegister />} 
        />
        
        {user ? (
          <Route element={<Layout user={finalUser} onLogout={handleLogout} />}>
            <Route path="/" element={!hasResidencyAccess && hasAcademyAccess ? <Navigate to="/academy" replace /> : <Home user={finalUser} />} />
            <Route path="/academy" element={hasAcademyAccess ? <AcademyHub user={finalUser} /> : <Navigate to="/" replace />} />
            <Route path="/modules" element={hasResidencyAccess ? <Modules user={finalUser} /> : <Navigate to="/academy" replace />} />
            <Route path="/lives" element={hasResidencyAccess ? <Lives user={finalUser} /> : <Navigate to="/academy" replace />} />
            <Route path="/surgeries" element={hasResidencyAccess ? <Surgeries user={finalUser} /> : <Navigate to="/academy" replace />} />
            <Route path="/protocols" element={hasResidencyAccess ? <Protocols user={finalUser} /> : <Navigate to="/academy" replace />} />
            <Route path="/planning" element={hasResidencyAccess ? <SurgicalPlanning user={finalUser} /> : <Navigate to="/academy" replace />} />
            <Route path="/profile" element={<Profile user={finalUser} onLogout={handleLogout} />} />
            
            {user.role === 'admin' && (
              <>
                <Route path="/admin" element={<Admin user={user} />} />
                <Route path="/academy-admin" element={<AdminAcademy user={user} />} />
                <Route path="/inventory-tool" element={<InventoryTool />} />
              </>
            )}
            
            <Route path="/protocol-viewer/:id" element={<ProtocolViewer />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/login" />} />
        )}
      </Routes>
    </HashRouter>
  );
};

export default App;
