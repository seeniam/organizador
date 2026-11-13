import clsx from 'clsx';
import type { Filter } from '@/lib/types';
import { useFilter } from './filter';

const OPTIONS: { value: Filter; label: string; dot?: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'work', label: 'Profissional', dot: 'bg-work' },
  { value: 'leisure', label: 'Lazer', dot: 'bg-leisure' },
];

export function FilterChips() {
  const [filter, setFilter] = useFilter();
  return (
    <div role="group" aria-label="Filtrar por categoria" className="flex gap-2">
      {OPTIONS.map((o) => {
        const active = filter === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => setFilter(o.value)}
            className={clsx(
              'flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors',
              active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-muted hover:text-ink',
            )}
          >
            {o.dot && <span aria-hidden="true" className={clsx('h-2.5 w-2.5 rounded-full', o.dot)} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
