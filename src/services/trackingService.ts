
import { addDoc, collection, doc, updateDoc, serverTimestamp, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser } from '../types';

export interface ScreenSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  residencyLevel: string;
  screen: string;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  durationSeconds: number;
  deviceType: string;
  isActive: boolean;
  dateKey: string;
  monthKey: string;
}

class TrackingService {
  private currentSessionId: string | null = null;
  private currentScreen: string | null = null;
  private sessionStartTime: number | null = null;
  private user: AppUser | null = null;
  private isProcessing: boolean = false;

  setUser(user: AppUser | null) {
    this.user = user;
  }

  async startScreenSession(screen: string) {
    if (!this.user || this.isProcessing) return;
    
    // Se já houver uma sessão para a mesma tela, não faz nada
    if (this.currentSessionId && this.currentScreen === screen) return;

    // Se houver uma sessão para outra tela, encerra ela primeiro
    if (this.currentSessionId) {
      await this.endScreenSession();
    }

    this.isProcessing = true;
    this.currentScreen = screen;
    this.sessionStartTime = Date.now();

    try {
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];
      const monthKey = dateKey.substring(0, 7);
      const deviceType = this.getDeviceType();

      const docRef = await addDoc(collection(db, 'user_sessions'), {
        userId: this.user.uid,
        userName: this.user.displayName,
        userEmail: this.user.email,
        residencyLevel: this.user.residencyLevel || 'Não informado',
        screen: this.getFriendlyScreenName(screen),
        startedAt: serverTimestamp(),
        endedAt: null,
        durationSeconds: 0,
        deviceType,
        isActive: true,
        dateKey,
        monthKey,
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      this.currentSessionId = docRef.id;
      console.log(`[Tracking] Started session for ${screen}: ${this.currentSessionId}`);
    } catch (error) {
      console.error('[Tracking] Error starting screen session:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async endScreenSession() {
    if (!this.currentSessionId || !this.sessionStartTime || this.isProcessing) return;
    
    const sessionId = this.currentSessionId;
    const startTime = this.sessionStartTime;
    
    this.isProcessing = true;
    this.currentSessionId = null;
    this.sessionStartTime = null;
    this.currentScreen = null;

    try {
      const now = Date.now();
      const durationSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
      
      await updateDoc(doc(db, 'user_sessions', sessionId), {
        endedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        durationSeconds,
        isActive: false
      });
      
      console.log(`[Tracking] Ended session ${sessionId}. Duration: ${durationSeconds}s`);
    } catch (error) {
      console.error('[Tracking] Error ending screen session:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Método para limpar sessões que ficaram abertas (ex: crash ou fechamento abrupto)
  async cleanupStaleSessions(userId: string) {
    try {
      const sessionsRef = collection(db, 'user_sessions');
      const q = query(
        sessionsRef, 
        where('userId', '==', userId), 
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.update(doc.ref, {
            isActive: false,
            endedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            note: 'Closed by cleanup'
          });
        });
        await batch.commit();
        console.log(`[Tracking] Cleaned up ${snapshot.size} stale sessions for user ${userId}`);
      }
    } catch (error) {
      console.error('[Tracking] Error cleaning up stale sessions:', error);
    }
  }

  async setUserOnlineStatus(isOnline: boolean) {
    if (!this.user) return;
    try {
      await updateDoc(doc(db, 'users', this.user.uid), {
        isOnline,
        lastActiveAt: serverTimestamp()
      });
      console.log(`[Tracking] User ${this.user.uid} is now ${isOnline ? 'online' : 'offline'}`);
    } catch (error) {
      console.error('[Tracking] Error updating online status:', error);
    }
  }

  private getFriendlyScreenName(path: string): string {
    if (path === '/') return 'Home';
    if (path.startsWith('/modules')) return 'Materiais';
    if (path.startsWith('/surgeries')) return 'Cirurgias';
    if (path.startsWith('/protocols')) return 'Protocolos';
    if (path.startsWith('/protocol-viewer')) return 'Visualizador de Protocolo';
    if (path.startsWith('/profile')) return 'Perfil';
    if (path.startsWith('/admin')) return 'Admin';
    return path;
  }

  private getDeviceType(): string {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
    return 'desktop';
  }
}

export const trackingService = new TrackingService();
