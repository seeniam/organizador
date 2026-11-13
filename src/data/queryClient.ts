import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = 'organizador-cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: WEEK, staleTime: 30_000, retry: 1, networkMode: 'offlineFirst' },
    mutations: { retry: 0 },
  },
});

function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export const persister = createSyncStoragePersister({ storage: safeStorage(), key: CACHE_KEY });

export function clearPersistedCache(): void {
  queryClient.clear();
  try {
    safeStorage()?.removeItem(CACHE_KEY);
  } catch {
    /* sem armazenamento */
  }
}

export const PERSIST_MAX_AGE = WEEK;
