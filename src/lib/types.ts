export type ItemKind = 'task' | 'event';
export type Category = 'leisure' | 'work';
export type Filter = 'all' | Category;
export type ReminderMinutes = 0 | 10 | 60 | 1440 | null;

export interface Item {
  id: string;
  user_id: string;
  kind: ItemKind;
  category: Category;
  title: string;
  notes: string | null;
  /** ISO UTC */
  starts_at: string | null;
  /** ISO UTC */
  ends_at: string | null;
  all_day: boolean;
  /** IANA */
  timezone: string;
  reminder_minutes: ReminderMinutes;
  remind_at: string | null;
  reminder_sent_at: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ItemInput = Pick<
  Item,
  'kind' | 'category' | 'title' | 'notes' | 'starts_at' | 'ends_at' | 'all_day' | 'timezone' | 'reminder_minutes'
>;

export const REMINDER_OPTIONS: { value: ReminderMinutes; label: string }[] = [
  { value: null, label: 'Sem lembrete' },
  { value: 0, label: 'Na hora' },
  { value: 10, label: '10 min antes' },
  { value: 60, label: '1 h antes' },
  { value: 1440, label: '1 dia antes' },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  leisure: 'Lazer',
  work: 'Profissional',
};

export const KIND_LABEL: Record<ItemKind, string> = {
  task: 'Tarefa',
  event: 'Compromisso',
};
