import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Item } from './types';

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
}

/** Dia (yyyy-MM-dd) de um instante em um fuso. */
export function dayOf(instant: string | Date, tz: string): string {
  return formatInTimeZone(instant, tz, 'yyyy-MM-dd');
}

/** Instante em que começa um dia (yyyy-MM-dd) num fuso. */
export function startOfDayIn(day: string, tz: string): Date {
  return fromZonedTime(`${day}T00:00:00`, tz);
}

export function addDay(day: string, n: number): string {
  return format(addDays(parseISO(day), n), 'yyyy-MM-dd');
}

/**
 * Dia do item. Itens de dia inteiro usam o fuso do próprio item, para não
 * mudarem de dia quando vistos de outro fuso; itens com hora usam o fuso de quem vê.
 */
export function itemDay(item: Item, viewerTz: string): string | null {
  if (!item.starts_at) return null;
  return dayOf(item.starts_at, item.all_day ? item.timezone : viewerTz);
}

export function formatItemTime(item: Item, viewerTz: string): string {
  if (!item.starts_at) return '';
  if (item.all_day) return 'Dia inteiro';
  const start = formatInTimeZone(item.starts_at, viewerTz, 'HH:mm');
  if (!item.ends_at) return start;
  return `${start}–${formatInTimeZone(item.ends_at, viewerTz, 'HH:mm')}`;
}

export function formatDayHeading(day: string, todayDay: string): string {
  if (day === todayDay) return 'Hoje';
  if (day === addDay(todayDay, 1)) return 'Amanhã';
  if (day === addDay(todayDay, -1)) return 'Ontem';
  const d = parseISO(day);
  const sameYear = day.slice(0, 4) === todayDay.slice(0, 4);
  return format(d, sameYear ? "EEE, d 'de' MMM" : "EEE, d 'de' MMM 'de' yyyy", { locale: ptBR });
}

export function formatMonthHeading(month: string): string {
  const s = format(parseISO(`${month}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
