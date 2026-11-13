import type { ReactNode } from 'react';
import { friendlyError, useCreateItem, useDeleteItem, useToggleDone } from '@/data/items';
import type { Item, ItemInput } from '@/lib/types';
import { ItemRow } from './ItemRow';
import { useToast } from './Toast';

export function toInput(i: Item): ItemInput {
  return {
    kind: i.kind,
    category: i.category,
    title: i.title,
    notes: i.notes,
    starts_at: i.starts_at,
    ends_at: i.ends_at,
    all_day: i.all_day,
    timezone: i.timezone,
    reminder_minutes: i.reminder_minutes,
  };
}

/** Ações de concluir/excluir com "Desfazer". */
export function useItemActions() {
  const toggle = useToggleDone();
  const remove = useDeleteItem();
  const create = useCreateItem();
  const toast = useToast();
  const onError = (e: unknown) => toast.show(friendlyError(e));

  return {
    toggle(item: Item, done: boolean) {
      toggle.mutate(
        { id: item.id, done },
        {
          onError,
          onSuccess: () =>
            done &&
            toast.show('Tarefa concluída', {
              label: 'Desfazer',
              onClick: () => toggle.mutate({ id: item.id, done: false }, { onError }),
            }),
        },
      );
    },
    remove(item: Item, after?: () => void) {
      remove.mutate(item.id, {
        onError,
        onSuccess: () => {
          after?.();
          toast.show('Item excluído', {
            label: 'Desfazer',
            onClick: () => create.mutate(toInput(item), { onError }),
          });
        },
      });
    },
  };
}

export function ItemList({
  items,
  now,
  tz,
  dateLabel,
}: {
  items: Item[];
  now: Date;
  tz: string;
  dateLabel?: (i: Item) => string | undefined;
}) {
  const actions = useItemActions();
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => (
        <ItemRow
          key={i.id}
          item={i}
          now={now}
          tz={tz}
          showDate={dateLabel?.(i)}
          onToggle={(done) => actions.toggle(i, done)}
          onDelete={() => actions.remove(i)}
        />
      ))}
    </ul>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  const id = `sec-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id={id} className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-line px-6 py-12 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-1 text-muted">{hint}</p>
    </div>
  );
}

export function LoadState({ isPending, isError, hasData }: { isPending: boolean; isError: boolean; hasData: boolean }) {
  if (hasData) return null;
  if (isPending)
    return (
      <div role="status" aria-label="Carregando" className="grid place-items-center py-16">
        <span className="spinner" />
      </div>
    );
  if (isError)
    return <EmptyState title="Não foi possível carregar seus itens" hint="Confira sua conexão e recarregue a página." />;
  return null;
}
