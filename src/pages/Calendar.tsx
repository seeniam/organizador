import clsx from 'clsx';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useItems } from '@/data/items';
import { daysWithItems, filterByCategory, itemsOnDay } from '@/lib/buckets';
import { dayOf, deviceTimeZone, formatDayHeading, formatMonthHeading } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { useFilter } from '@/ui/filter';
import { IconChevron } from '@/ui/icons';
import { EmptyState, ItemList, LoadState, Section } from '@/ui/ItemList';

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

export default function Calendar() {
  const now = useNow();
  const tz = deviceTimeZone();
  const today = dayOf(now, tz);
  const [params, setParams] = useSearchParams();
  const selected = params.get('dia') ?? today;
  const month = params.get('mes') ?? selected.slice(0, 7);
  const { data, isPending, isError } = useItems();
  const [filter] = useFilter();
  const items = useMemo(() => filterByCategory(data ?? [], filter), [data, filter]);
  const marks = useMemo(() => daysWithItems(items, month, tz), [items, month, tz]);
  const dayList = useMemo(() => itemsOnDay(items, selected, tz), [items, selected, tz]);

  const first = parseISO(`${month}-01`);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(first), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(first), { weekStartsOn: 1 }),
  }).map((d) => format(d, 'yyyy-MM-dd'));

  function set(next: Record<string, string>) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(next)) p.set(k, v);
        return p;
      },
      { replace: true },
    );
  }
  const shiftMonth = (n: number) => set({ mes: format(addMonths(first, n), 'yyyy-MM') });

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-10">
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{formatMonthHeading(month)}</h1>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => shiftMonth(-1)}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-sunken"
            >
              <IconChevron className="rotate-180" />
            </button>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => shiftMonth(1)}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-sunken"
            >
              <IconChevron />
            </button>
          </div>
        </div>

        <div role="grid" aria-label={formatMonthHeading(month)} className="rounded-2xl bg-surface p-2 md:p-3">
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((w) => (
              <span role="columnheader" key={w} className="py-2 text-center text-xs font-bold text-muted">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const inMonth = d.startsWith(month);
              const cats = marks.get(d) ?? [];
              const isSel = d === selected;
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  aria-selected={isSel}
                  aria-label={`${formatDayHeading(d, today)}${cats.length ? ', com itens' : ''}`}
                  onClick={() => set({ dia: d, mes: d.slice(0, 7) })}
                  className={clsx(
                    'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm font-bold transition-colors md:aspect-[1.15]',
                    isSel ? 'bg-ink text-bg' : 'hover:bg-sunken',
                    !inMonth && !isSel && 'text-muted/50',
                    d === today && !isSel && 'ring-2 ring-accent',
                  )}
                >
                  <span>{Number(d.slice(8))}</span>
                  <span className="flex h-1.5 gap-1">
                    {cats.map((c) => (
                      <span key={c} className={clsx('h-1.5 w-1.5 rounded-full', c === 'work' ? 'bg-work' : 'bg-leisure')} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {month !== today.slice(0, 7) && (
          <button
            type="button"
            onClick={() => set({ dia: today, mes: today.slice(0, 7) })}
            className="mt-3 text-sm font-bold text-muted underline underline-offset-4"
          >
            Voltar para hoje
          </button>
        )}
      </div>

      <div className="mt-8 xl:mt-0">
        <Section title={formatDayHeading(selected, today)}>
          <LoadState isPending={isPending} isError={isError} hasData={!!data} />
          {data && dayList.length === 0 ? (
            <EmptyState title="Dia livre" hint="Toque no + para marcar algo neste dia." />
          ) : (
            <ItemList items={dayList} now={now} tz={tz} />
          )}
        </Section>
      </div>
    </div>
  );
}
