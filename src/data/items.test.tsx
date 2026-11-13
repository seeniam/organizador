import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemInput } from '@/lib/types';

const calls: { table: string; op: string; arg?: unknown; eq?: [string, unknown] }[] = [];

vi.mock('@/lib/supabase', () => {
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const result = { data: { id: 'new', title: 'x' }, error: null };
    b.insert = (arg: unknown) => (calls.push({ table, op: 'insert', arg }), b);
    b.update = (arg: unknown) => (calls.push({ table, op: 'update', arg }), b);
    b.delete = () => (calls.push({ table, op: 'delete' }), b);
    b.select = () => b;
    b.order = () => Promise.resolve({ data: [], error: null });
    b.eq = (k: string, v: unknown) => {
      calls[calls.length - 1].eq = [k, v];
      return b;
    };
    b.single = () => Promise.resolve(result);
    b.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return b;
  }
  return { supabase: { from: (t: string) => builder(t) } };
});

import { friendlyError, useCreateItem, useToggleDone } from './items';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const W = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { W, spy };
}

const input: ItemInput = {
  kind: 'task',
  category: 'work',
  title: 'Relatório',
  notes: null,
  starts_at: null,
  ends_at: null,
  all_day: false,
  timezone: 'America/Sao_Paulo',
  reminder_minutes: null,
};

beforeEach(() => {
  calls.length = 0;
});

describe('mutations de itens', () => {
  it('useCreateItem insere em items e invalida a lista', async () => {
    const { W, spy } = wrapper();
    const { result } = renderHook(() => useCreateItem(), { wrapper: W });
    await act(() => result.current.mutateAsync(input));
    expect(calls[0]).toMatchObject({ table: 'items', op: 'insert', arg: input });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['items'] }));
  });

  it('useToggleDone envia done_at como ISO ao concluir e null ao reabrir', async () => {
    const { W } = wrapper();
    const { result } = renderHook(() => useToggleDone(), { wrapper: W });
    await act(() => result.current.mutateAsync({ id: 'a', done: true }));
    const done = calls[0].arg as { done_at: string };
    expect(new Date(done.done_at).toISOString()).toBe(done.done_at);
    expect(calls[0].eq).toEqual(['id', 'a']);
    await act(() => result.current.mutateAsync({ id: 'a', done: false }));
    expect(calls[1].arg).toEqual({ done_at: null });
  });
});

describe('friendlyError', () => {
  it('traduz o limite de itens', () => {
    expect(friendlyError({ message: 'limite_itens' })).toBe('Você atingiu o limite de 2.000 itens.');
  });
  it('traduz o limite de dispositivos', () => {
    expect(friendlyError({ message: 'limite_dispositivos' })).toBe(
      'Você atingiu o limite de 10 dispositivos com lembretes.',
    );
  });
  it('erro de rede', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toBe('Sem conexão. Tente de novo quando estiver online.');
  });
});
