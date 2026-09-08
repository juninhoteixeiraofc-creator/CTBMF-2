
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackingService } from '../services/trackingService';
import { AppUser } from '../types';

interface UsageTrackerProps {
  user: AppUser | null;
}

const UsageTracker: React.FC<UsageTrackerProps> = ({ user }) => {
  const location = useLocation();

  // Sincronizar dados do usuário com o serviço
  useEffect(() => {
    trackingService.setUser(user);
  }, [user]);

  // Gerenciar status online (offline após 40s em background)
  useEffect(() => {
    if (!user?.uid) return;

    // Marcar como online apenas quando o usuário entra ou muda de usuário
    // Usamos o ID para evitar loops infinitos caso o objeto user mude por causa do snapshot
    trackingService.cleanupStaleSessions(user.uid);
    trackingService.setUserOnlineStatus(true);

    let offlineTimer: NodeJS.Timeout | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[UsageTracker] App in background - starting 40s timer for offline status');
        offlineTimer = setTimeout(() => {
          trackingService.setUserOnlineStatus(false);
        }, 40000);
      } else {
        console.log('[UsageTracker] App in foreground - marking as online');
        if (offlineTimer) {
          clearTimeout(offlineTimer);
          offlineTimer = null;
        }
        trackingService.setUserOnlineStatus(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (offlineTimer) clearTimeout(offlineTimer);
      // Ao desmontar ou trocar de usuário, marcar o usuário anterior como offline
      trackingService.setUserOnlineStatus(false);
    };
  }, [user?.uid]); // Depender apenas do UID para evitar loops com o snapshot do usuário

  // Gerenciar sessões por tela (opcional, mantendo desativado se o usuário preferir economizar cota)
  useEffect(() => {
    /*
    if (!user) return;
    trackingService.startScreenSession(location.pathname);
    return () => {
      trackingService.endScreenSession();
    };
    */
    return () => {};
  }, [location.pathname, user]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      trackingService.setUserOnlineStatus(false);
    };

    const handlePageHide = () => {
      trackingService.setUserOnlineStatus(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  return null;
};

export default UsageTracker;
