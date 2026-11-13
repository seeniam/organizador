import { useSyncExternalStore } from 'react';
import type { Filter } from '@/lib/types';

const KEY = 'organizador-filtro';
const listeners = new Set<() => void>();

function read(): Filter {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'work' || v === 'leisure' ? v : 'all';
  } catch {
    return 'all';
  }
}

let current: Filter = read();

function setFilter(f: Filter) {
  current = f;
  try {
    localStorage.setItem(KEY, f);
  } catch {
    /* sem armazenamento */
  }
  listeners.forEach((l) => l());
}

export function useFilter(): [Filter, (f: Filter) => void] {
  const f = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
  return [f, setFilter];
}

/** Só para testes. */
export function resetFilterForTests() {
  current = read();
}
