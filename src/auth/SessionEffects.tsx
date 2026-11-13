import { useEffect } from 'react';
import { clearPersistedCache } from '@/data/queryClient';
import { syncDeviceSubscription } from '@/lib/push';
import { useAuth } from './AuthProvider';

const LAST_USER_KEY = 'organizador-ultimo-usuario';

/** Efeitos que dependem de quem está logado neste aparelho. */
export function SessionEffects() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    try {
      const last = localStorage.getItem(LAST_USER_KEY);
      if (last && last !== userId) clearPersistedCache();
      localStorage.setItem(LAST_USER_KEY, userId);
    } catch {
      /* sem armazenamento */
    }
    if (navigator.onLine) {
      syncDeviceSubscription().catch(() => {
        // a inscrição pode pertencer a outra conta com chaves diferentes; o card oferece reativar
      });
    }
  }, [userId]);

  return null;
}
