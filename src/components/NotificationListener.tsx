
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser, Notification as AppNotification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ExternalLink } from 'lucide-react';

interface NotificationListenerProps {
  user: AppUser | null;
}

const NotificationListener: React.FC<NotificationListenerProps> = ({ user }) => {
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [startTime] = useState(() => Date.now());

  const showNotification = (notif: AppNotification) => {
    setActiveToast(notif);
    
    // Browser Notification (Push-like)
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(notif.title, {
          body: notif.message,
          icon: '/favicon.ico'
        });
      } catch (e) {
        console.error("Erro ao disparar notificação do navegador:", e);
      }
    }

    // Auto hide after 8 seconds
    setTimeout(() => {
      setActiveToast(prev => prev?.id === notif.id ? null : prev);
    }, 8000);
  };

  useEffect(() => {
    if (!user) return;

    // Listen for new notifications
    const q = query(
      collection(db, "notifications"),
      where("isActive", "==", true),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;

      const data = snapshot.docs[0].data();
      const notif = { id: snapshot.docs[0].id, ...data } as AppNotification;
      
      // Check if it's a new notification (created after the app started)
      // Firestore serverTimestamp might be null initially on local update, so we handle that
      const createdAt = notif.createdAt?.toMillis ? notif.createdAt.toMillis() : (notif.createdAt || Date.now());
      
      if (createdAt > startTime) {
        // Check audience
        const isAudience = notif.audience === 'all' || 
                           notif.audience === user.residencyLevel || 
                           (user.role === 'admin' && notif.audience === 'admin');
        
        if (isAudience) {
          // Check if we already showed this in this session
          const lastShown = sessionStorage.getItem('last_notif_shown');
          if (lastShown !== notif.id) {
            showNotification(notif);
            sessionStorage.setItem('last_notif_shown', notif.id);
          }
        }
      }
    }, (error) => {
      console.error("Erro no listener de notificações:", error);
    });

    return () => unsubscribe();
  }, [user, startTime]);

  const requestPermission = () => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(err => console.error("Erro ao solicitar permissão de notificação:", err));
    }
  };

  useEffect(() => {
    requestPermission();
  }, []);

  return (
    <AnimatePresence>
      {activeToast && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 20, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className="fixed top-0 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none"
        >
          <div className="bg-brand-dark border border-brand-gold/30 rounded-2xl shadow-2xl p-4 flex items-start space-x-4 max-w-md w-full pointer-events-auto backdrop-blur-md">
            <div className="bg-brand-gold/10 p-2 rounded-xl flex-shrink-0">
              <Bell className="text-brand-gold" size={20} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h4 className="text-white font-black text-sm uppercase tracking-widest truncate">{activeToast.title}</h4>
              <p className="text-gray-400 text-xs mt-1 line-clamp-2 font-medium">{activeToast.message}</p>
              {activeToast.link && (
                <a 
                  href={activeToast.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-brand-gold text-[10px] font-black uppercase tracking-widest mt-2 hover:underline"
                >
                  Ver mais <ExternalLink size={10} className="ml-1" />
                </a>
              )}
            </div>
            <button 
              onClick={() => setActiveToast(null)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationListener;
