import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ItemKind } from '@/lib/types';

export interface EditorParams {
  itemId?: string;
  kind?: ItemKind;
  date?: string;
}

/** Abre o editor escrevendo ?item=<id> ou ?novo=task|event&data=yyyy-MM-dd na URL. */
export function useOpenEditor() {
  const [, setParams] = useSearchParams();
  return useCallback(
    (p: EditorParams) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('item');
        next.delete('novo');
        next.delete('data');
        if (p.itemId) next.set('item', p.itemId);
        else {
          next.set('novo', p.kind ?? 'task');
          if (p.date) next.set('data', p.date);
        }
        return next;
      });
    },
    [setParams],
  );
}

export function useCloseEditor() {
  const [, setParams] = useSearchParams();
  return useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('item');
        next.delete('novo');
        next.delete('data');
        return next;
      },
      { replace: true },
    );
  }, [setParams]);
}
