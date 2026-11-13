import { useMemo } from 'react';
import { useItems } from '@/data/items';
import { bucketize, filterByCategory } from '@/lib/buckets';
import { dayOf, deviceTimeZone, formatDayHeading } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { useFilter } from '@/ui/filter';
import { EmptyState, ItemList, LoadState, Section } from '@/ui/ItemList';

export default function Upcoming() {
  const now = useNow();
  const tz = deviceTimeZone();
  const { data, isPending, isError } = useItems();
  const [filter] = useFilter();
  const groups = useMemo(
    () => bucketize(filterByCategory(data ?? [], filter), now, tz).upcoming,
    [data, filter, now, tz],
  );
  const today = dayOf(now, tz);

  return (
    <>
      <h1 className="mb-8 font-display text-4xl font-semibold tracking-tight md:text-5xl">Próximos</h1>
      <LoadState isPending={isPending} isError={isError} hasData={!!data} />
      {data && groups.length === 0 && (
        <EmptyState title="Nada pela frente" hint="Itens com data a partir de amanhã aparecem aqui." />
      )}
      <div className="xl:columns-2 xl:gap-10 [&>section]:break-inside-avoid">
        {groups.map((g) => (
          <Section key={g.day} title={formatDayHeading(g.day, today)}>
            <ItemList items={g.items} now={now} tz={tz} />
          </Section>
        ))}
      </div>
    </>
  );
}
