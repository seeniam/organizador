import { dayOf, itemDay, startOfDayIn } from './dates';
import type { Category, Filter, Item } from './types';

export interface DayGroup {
  day: string;
  items: Item[];
}

export interface Buckets {
  overdue: Item[];
  today: Item[];
  noDate: Item[];
  upcoming: DayGroup[];
  history: DayGroup[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Momento em que o compromisso termina (dia inteiro sem fim termina 24 h depois do início). */
function eventEnd(item: Item): number {
  if (item.ends_at) return Date.parse(item.ends_at);
  const start = Date.parse(item.starts_at!);
  return item.all_day ? start + DAY_MS : start;
}

export function isEventPast(item: Item, now: Date): boolean {
  return item.kind === 'event' && !!item.starts_at && eventEnd(item) < now.getTime();
}

export function isOverdue(item: Item, now: Date, viewerTz: string): boolean {
  if (item.kind !== 'task' || item.done_at || !item.starts_at) return false;
  if (item.all_day) return itemDay(item, viewerTz)! < dayOf(now, viewerTz);
  return Date.parse(item.starts_at) < now.getTime();
}

export function filterByCategory(items: Item[], f: Filter): Item[] {
  return f === 'all' ? items : items.filter((i) => i.category === f);
}

/** Dia inteiro primeiro, depois por horário. */
function byTime(a: Item, b: Item): number {
  if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
  return (a.starts_at ?? '').localeCompare(b.starts_at ?? '');
}

function group(entries: [string, Item][], desc: boolean): DayGroup[] {
  const map = new Map<string, Item[]>();
  for (const [day, it] of entries) {
    const list = map.get(day) ?? [];
    list.push(it);
    map.set(day, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (desc ? b.localeCompare(a) : a.localeCompare(b)))
    .map(([day, items]) => ({ day, items: desc ? items.sort(byTime).reverse() : items.sort(byTime) }));
}

export function bucketize(items: Item[], now: Date, viewerTz: string): Buckets {
  const today = dayOf(now, viewerTz);
  const todayStart = startOfDayIn(today, viewerTz).getTime();
  const overdue: Item[] = [];
  const todayList: Item[] = [];
  const noDate: Item[] = [];
  const upcoming: [string, Item][] = [];
  const history: [string, Item][] = [];

  for (const it of items) {
    if (it.kind === 'task') {
      if (it.done_at) {
        history.push([dayOf(it.done_at, viewerTz), it]);
      } else if (!it.starts_at) {
        noDate.push(it);
      } else if (isOverdue(it, now, viewerTz)) {
        overdue.push(it);
      } else {
        const day = itemDay(it, viewerTz)!;
        if (day === today) todayList.push(it);
        else upcoming.push([day, it]);
      }
      continue;
    }

    // Compromisso
    const day = itemDay(it, viewerTz)!;
    if (day > today) upcoming.push([day, it]);
    else if (day === today || eventEnd(it) >= todayStart) todayList.push(it);
    else history.push([day, it]);
  }

  return {
    overdue: overdue.sort(byTime),
    today: todayList.sort(byTime),
    noDate: noDate.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    upcoming: group(upcoming, false),
    history: group(history, true),
  };
}

export function itemsOnDay(items: Item[], day: string, viewerTz: string): Item[] {
  return items.filter((i) => itemDay(i, viewerTz) === day).sort(byTime);
}

export function daysWithItems(items: Item[], month: string, viewerTz: string): Map<string, Category[]> {
  const map = new Map<string, Category[]>();
  for (const it of items) {
    const day = itemDay(it, viewerTz);
    if (!day || !day.startsWith(`${month}-`)) continue;
    const cats = map.get(day) ?? [];
    if (!cats.includes(it.category)) cats.push(it.category);
    map.set(day, cats);
  }
  return map;
}
