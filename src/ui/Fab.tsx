import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useOnline } from '@/lib/online';
import { useOpenEditor } from './editorNav';
import { IconPlus } from './icons';

export function Fab({ date }: { date?: string }) {
  const online = useOnline();
  const openEditor = useOpenEditor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(kind: 'task' | 'event') {
    setOpen(false);
    openEditor({ kind, date });
  }

  return (
    <div
      ref={ref}
      className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-3 md:right-8 md:bottom-8"
    >
      {open && (
        <div role="menu" className="flex flex-col items-end gap-2">
          <button
            role="menuitem"
            type="button"
            onClick={() => choose('event')}
            className="rounded-full bg-surface px-4 py-2.5 font-bold shadow-lg ring-1 ring-line"
          >
            Novo compromisso
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => choose('task')}
            className="rounded-full bg-surface px-4 py-2.5 font-bold shadow-lg ring-1 ring-line"
          >
            Nova tarefa
          </button>
        </div>
      )}
      <button
        type="button"
        aria-label="Criar item"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!online}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'grid h-15 w-15 place-items-center rounded-2xl bg-accent text-accent-ink shadow-[0_6px_20px_-6px_rgba(120,80,0,0.6)] transition active:scale-95 disabled:opacity-40 disabled:shadow-none',
          open && 'rotate-45',
        )}
      >
        <IconPlus width={28} height={28} />
      </button>
    </div>
  );
}
