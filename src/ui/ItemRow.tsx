import clsx from 'clsx';
import { useRef, useState, type PointerEvent } from 'react';
import { isEventPast, isOverdue } from '@/lib/buckets';
import { formatItemTime } from '@/lib/dates';
import { useOnline } from '@/lib/online';
import { CATEGORY_LABEL, type Item } from '@/lib/types';
import { useOpenEditor } from './editorNav';
import { IconBell, IconCheck } from './icons';

interface Props {
  item: Item;
  now: Date;
  tz: string;
  onToggle(done: boolean): void;
  onDelete(): void;
  /** Mostra a data além da hora (listas que não são agrupadas por dia). */
  showDate?: string;
}

const SWIPE_THRESHOLD = 96;

export function ItemRow({ item, now, tz, onToggle, onDelete, showDate }: Props) {
  const online = useOnline();
  const openEditor = useOpenEditor();
  const isTask = item.kind === 'task';
  const done = !!item.done_at;
  const past = isEventPast(item, now);
  const overdue = isOverdue(item, now, tz);
  const time = formatItemTime(item, tz);

  // Deslizar (só toque/caneta)
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiping = useRef(false);

  function onPointerDown(e: PointerEvent) {
    if (!online || e.pointerType === 'mouse') return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    swiping.current = false;
  }
  function onPointerMove(e: PointerEvent) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!swiping.current) {
      if (Math.abs(my) > 12) {
        start.current = null;
        return;
      }
      if (Math.abs(mx) > 12) {
        swiping.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }
    if (swiping.current) setDx(isTask ? mx : Math.min(0, mx));
  }
  function onPointerUp() {
    if (swiping.current) {
      if (dx > SWIPE_THRESHOLD && isTask) onToggle(!done);
      else if (dx < -SWIPE_THRESHOLD) onDelete();
    }
    start.current = null;
    setDx(0);
    setTimeout(() => (swiping.current = false), 0);
  }

  const stripe = item.category === 'work' ? 'bg-work' : 'bg-leisure';

  return (
    <li data-past={past ? 'true' : undefined} className="relative overflow-hidden rounded-2xl">
      {dx !== 0 && (
        <div
          aria-hidden="true"
          className={clsx(
            'absolute inset-0 flex items-center px-5 font-bold',
            dx > 0 ? 'justify-start bg-leisure text-white' : 'justify-end bg-danger text-white',
          )}
        >
          {dx > 0 ? (done ? 'Reabrir' : 'Concluir') : 'Excluir'}
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        className={clsx(
          'relative flex touch-pan-y items-stretch gap-3 bg-surface py-3 pr-3 pl-4',
          dx === 0 && 'transition-transform',
          (past || done) && 'opacity-60',
        )}
      >
        <span aria-hidden="true" className={clsx('absolute inset-y-0 left-0 w-1.5', stripe)} />

        {isTask ? (
          <label className="flex shrink-0 cursor-pointer items-start pt-0.5">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={done}
              disabled={!online}
              aria-label={`${done ? 'Reabrir' : 'Concluir'} ${item.title}`}
              onChange={(e) => onToggle(e.target.checked)}
            />
            <span
              className={clsx(
                'grid h-6 w-6 place-items-center rounded-full border-2 transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-accent peer-disabled:opacity-50',
                done
                  ? item.category === 'work'
                    ? 'border-work bg-work text-white'
                    : 'border-leisure bg-leisure text-white'
                  : overdue
                    ? 'border-danger'
                    : 'border-muted',
              )}
            >
              {done && <IconCheck width={14} height={14} />}
            </span>
          </label>
        ) : (
          <span className="w-12 shrink-0 pt-0.5 font-display text-sm leading-6 font-semibold tabular-nums">
            {item.all_day ? 'Dia' : time.split('–')[0]}
          </span>
        )}

        <button
          type="button"
          onClick={() => !swiping.current && openEditor({ itemId: item.id })}
          className="min-w-0 flex-1 text-left"
        >
          <span className={clsx('block font-bold break-words', done && 'line-through decoration-2')}>
            {item.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {overdue && <span className="font-bold text-danger">Atrasada</span>}
            {showDate && <span>{showDate}</span>}
            {isTask && time && <span className="tabular-nums">{time}</span>}
            {!isTask && item.all_day && <span>Dia inteiro</span>}
            {!isTask && !item.all_day && item.ends_at && (
              <span className="tabular-nums">até {time.split('–')[1]}</span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={clsx('h-2 w-2 rounded-full', stripe)} />
              {CATEGORY_LABEL[item.category]}
            </span>
            {item.reminder_minutes !== null && !done && !past && (
              <IconBell width={14} height={14} aria-label="Com lembrete" role="img" aria-hidden={false} />
            )}
          </span>
        </button>
      </div>
    </li>
  );
}
