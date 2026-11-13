import { useMemo, useState } from 'react';
import { useItems } from '@/data/items';
import { bucketize, filterByCategory } from '@/lib/buckets';
import { dayOf, deviceTimeZone, formatDayHeading } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { useFilter } from '@/ui/filter';
import { EmptyState, ItemList, LoadState, Section } from '@/ui/ItemList';

const PAGE = 30;

export default function History() {
  const now = useNow();
  const tz = deviceTimeZone();
  const { data, isPending, isError } = useItems();
  const [filter] = useFilter();
  const [shown, setShown] = useState(PAGE);
  const groups = useMemo(
    () => bucketize(filterByCategory(data ?? [], filter), now, tz).history,
    [data, filter, now, tz],
  );
  const today = dayOf(now, tz);

  return (
    <>
      <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Histórico</h1>
      <p className="mt-2 mb-8 text-muted">Tarefas concluídas e compromissos que já passaram.</p>
      <LoadState isPending={isPending} isError={isError} hasData={!!data} />
      {data && groups.length === 0 && (
        <EmptyState title="Nada no histórico ainda" hint="Quando você concluir uma tarefa, ela aparece aqui." />
      )}
      {groups.slice(0, shown).map((g) => (
        <Section key={g.day} title={formatDayHeading(g.day, today)}>
          <ItemList items={g.items} now={now} tz={tz} />
        </Section>
      ))}
      {groups.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="w-full rounded-xl border border-line bg-surface py-3 font-bold"
        >
          Mostrar dias anteriores
        </button>
      )}
    </>
  );
}
