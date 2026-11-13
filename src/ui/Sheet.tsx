import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';

/**
 * Celular: folha que sobe de baixo. Tablet: modal centralizado. Desktop: painel à direita.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const nodes = el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prevFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center xl:justify-end">
      <div className="sheet-backdrop absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-panel relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl md:max-w-lg md:rounded-3xl xl:h-dvh xl:max-h-none xl:max-w-[460px] xl:rounded-none"
      >
        <div className="flex items-center justify-between gap-4 px-5 pt-3 pb-2 md:pt-5">
          <span aria-hidden="true" className="absolute top-2 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-line md:hidden" />
          <h2 id={titleId} className="mt-3 font-display text-2xl font-semibold tracking-tight md:mt-0">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="mt-3 grid h-10 w-10 place-items-center rounded-full hover:bg-sunken md:mt-0"
          >
            <IconClose />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
