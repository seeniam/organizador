import { useMemo } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { useItems } from '@/data/items';
import { bucketize, filterByCategory } from '@/lib/buckets';
import { deviceTimeZone } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { EnableRemindersCard } from '@/ui/EnableRemindersCard';
import { useFilter } from '@/ui/filter';
import { EmptyState, ItemList, LoadState, Section } from '@/ui/ItemList';

export default function Today({ now: nowProp, tz: tzProp }: { now?: Date; tz?: string }) {
  const liveNow = useNow();
  const now = nowProp ?? liveNow;
  const tz = tzProp ?? deviceTimeZone();
  const { data, isPending, isError } = useItems();
  const [filter] = useFilter();

  const b = useMemo(() => bucketize(filterByCategory(data ?? [], filter), now, tz), [data, filter, now, tz]);
  const dayItems = [...b.overdue, ...b.today];
  const work = dayItems.filter((i) => i.category === 'work').length;
  const leisure = dayItems.length - work;
  const weekday = formatInTimeZone(now, tz, 'EEEE', { locale: ptBR });
  const date = formatInTimeZone(now, tz, "d 'de' MMMM", { locale: ptBR });
  const empty = !b.overdue.length && !b.today.length && !b.noDate.length;

  return (
    <>
      <header className="mb-8">
        <p className="text-muted first-letter:uppercase">{weekday}</p>
        <h1 className="font-display text-5xl leading-none font-semibold tracking-tight md:text-6xl">{date}</h1>
        {dayItems.length > 0 && (
          <div className="mt-5 max-w-md">
            <div
              role="img"
              aria-label={`Hoje: ${work} profissional e ${leisure} de lazer`}
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-sunken"
            >
              {work > 0 && <span className="bg-work" style={{ flexGrow: work }} />}
              {leisure > 0 && <span className="bg-leisure" style={{ flexGrow: leisure }} />}
            </div>
            <p className="mt-2 flex gap-4 text-sm text-muted">
              <span>
                <b className="text-work">{work}</b> profissional
              </span>
              <span>
                <b className="text-leisure">{leisure}</b> lazer
              </span>
            </p>
          </div>
        )}
      </header>

      <EnableRemindersCard />

      <LoadState isPending={isPending} isError={isError} hasData={!!data} />
      {data && empty && (
        <EmptyState title="Nada para hoje" hint="Use o botão + para criar uma tarefa ou um compromisso." />
      )}

      <div className="xl:grid xl:grid-cols-2 xl:gap-x-10">
        <div>
          {b.overdue.length > 0 && (
            <Section title="Atrasadas">
              <ItemList items={b.overdue} now={now} tz={tz} />
            </Section>
          )}
          {b.today.length > 0 && (
            <Section title="Hoje">
              <ItemList items={b.today} now={now} tz={tz} />
            </Section>
          )}
        </div>
        {b.noDate.length > 0 && (
          <Section title="Sem data">
            <ItemList items={b.noDate} now={now} tz={tz} />
          </Section>
        )}
      </div>
    </>
  );
}
