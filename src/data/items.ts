import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Item, ItemInput } from '@/lib/types';

export const ITEMS_KEY = ['items'] as const;

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

export function useItems() {
  return useQuery({
    queryKey: ITEMS_KEY,
    queryFn: () => unwrap<Item[]>(supabase.from('items').select('*').order('starts_at', { nullsFirst: false })),
  });
}

/** Aplica uma mudança otimista em ['items'] e devolve o rollback. */
async function optimistic(qc: QueryClient, change: (items: Item[]) => Item[]) {
  await qc.cancelQueries({ queryKey: ITEMS_KEY });
  const previous = qc.getQueryData<Item[]>(ITEMS_KEY);
  if (previous) qc.setQueryData<Item[]>(ITEMS_KEY, change(previous));
  return () => qc.setQueryData(ITEMS_KEY, previous);
}

function useItemMutation<V>(
  fn: (v: V) => Promise<unknown>,
  change?: (items: Item[], v: V) => Item[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onMutate: async (v: V) => (change ? { rollback: await optimistic(qc, (items) => change(items, v)) } : {}),
    onError: (_e, _v, ctx) => (ctx as { rollback?: () => void } | undefined)?.rollback?.(),
    onSettled: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

export function useCreateItem() {
  return useItemMutation((input: ItemInput) =>
    unwrap<Item>(supabase.from('items').insert(input).select().single()),
  );
}

export function useUpdateItem() {
  return useItemMutation(
    ({ id, patch }: { id: string; patch: Partial<ItemInput> }) =>
      unwrap(supabase.from('items').update(patch).eq('id', id).select().single()),
    (items, { id, patch }) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  );
}

export function useDeleteItem() {
  return useItemMutation(
    (id: string) => unwrap(supabase.from('items').delete().eq('id', id)),
    (items, id) => items.filter((i) => i.id !== id),
  );
}

export function useToggleDone() {
  return useItemMutation(
    ({ id, done }: { id: string; done: boolean }) =>
      unwrap(
        supabase
          .from('items')
          .update({ done_at: done ? new Date().toISOString() : null })
          .eq('id', id),
      ),
    (items, { id, done }) =>
      items.map((i) => (i.id === id ? { ...i, done_at: done ? new Date().toISOString() : null } : i)),
  );
}

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message ?? String(e);
  if (msg.includes('limite_itens')) return 'Você atingiu o limite de 2.000 itens.';
  if (msg.includes('limite_dispositivos')) return 'Você atingiu o limite de 10 dispositivos com lembretes.';
  if (e instanceof TypeError || /fetch|network/i.test(msg)) return 'Sem conexão. Tente de novo quando estiver online.';
  return 'Algo deu errado. Tente de novo.';
}
