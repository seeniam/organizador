import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Category, Item, ItemInput, ItemKind, ReminderMinutes } from './types';

export type ReminderValue = '' | '0' | '10' | '60' | '1440';

export interface ItemFormValues {
  kind: ItemKind;
  category: Category;
  title: string;
  notes: string;
  /** yyyy-MM-dd ou vazio */
  date: string;
  /** HH:mm ou vazio */
  time: string;
  /** HH:mm ou vazio (só compromisso) */
  endTime: string;
  allDay: boolean;
  reminder: ReminderValue;
}

export type FormErrors = Partial<Record<keyof ItemFormValues, string>>;

export function emptyForm(kind: ItemKind, date = '', category: Category = 'work'): ItemFormValues {
  return { kind, category, title: '', notes: '', date, time: '', endTime: '', allDay: false, reminder: '' };
}

export function validateForm(v: ItemFormValues): FormErrors {
  const e: FormErrors = {};
  if (!v.title.trim()) e.title = 'Informe um título';
  else if (v.title.trim().length > 200) e.title = 'Use no máximo 200 caracteres';
  if (v.kind === 'event') {
    if (!v.date) e.date = 'Compromissos precisam de data';
    else if (!v.allDay && !v.time) e.time = 'Informe a hora';
    if (!v.allDay && v.time && v.endTime && v.endTime <= v.time) e.endTime = 'O fim deve ser depois do início';
  }
  if (v.reminder !== '' && !v.date) e.reminder = 'Defina uma data para usar lembrete';
  return e;
}

export function formToInput(v: ItemFormValues, tz: string): ItemInput {
  const base = {
    kind: v.kind,
    category: v.category,
    title: v.title.trim(),
    notes: v.notes.trim() || null,
    timezone: tz,
  };
  if (!v.date) {
    return { ...base, starts_at: null, ends_at: null, all_day: false, reminder_minutes: null };
  }
  const reminder_minutes = (v.reminder === '' ? null : Number(v.reminder)) as ReminderMinutes;
  const allDay = v.allDay || !v.time;
  if (allDay) {
    return {
      ...base,
      starts_at: fromZonedTime(`${v.date}T00:00:00`, tz).toISOString(),
      ends_at: null,
      all_day: true,
      reminder_minutes,
    };
  }
  return {
    ...base,
    starts_at: fromZonedTime(`${v.date}T${v.time}:00`, tz).toISOString(),
    ends_at: v.kind === 'event' && v.endTime ? fromZonedTime(`${v.date}T${v.endTime}:00`, tz).toISOString() : null,
    all_day: false,
    reminder_minutes,
  };
}

/** Converte um item para o formulário, no fuso do próprio item. */
export function itemToForm(item: Item): ItemFormValues {
  const tz = item.timezone;
  const timed = !!item.starts_at && !item.all_day;
  return {
    kind: item.kind,
    category: item.category,
    title: item.title,
    notes: item.notes ?? '',
    date: item.starts_at ? formatInTimeZone(item.starts_at, tz, 'yyyy-MM-dd') : '',
    time: timed ? formatInTimeZone(item.starts_at!, tz, 'HH:mm') : '',
    endTime: timed && item.ends_at ? formatInTimeZone(item.ends_at, tz, 'HH:mm') : '',
    allDay: item.kind === 'event' && item.all_day,
    reminder: item.reminder_minutes === null ? '' : (String(item.reminder_minutes) as ReminderValue),
  };
}
