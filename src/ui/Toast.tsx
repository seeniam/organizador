import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastAction {
  label: string;
  onClick(): void;
}
interface ToastState {
  id: number;
  msg: string;
  action?: ToastAction;
}
interface ToastApi {
  show(msg: string, action?: ToastAction): void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((msg: string, action?: ToastAction) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), msg, action });
    timer.current = setTimeout(() => setToast(null), action ? 6000 : 3500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-8"
      >
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex max-w-md items-center gap-4 rounded-xl bg-ink py-3 pr-3 pl-4 text-bg shadow-xl"
          >
            <span>{toast.msg}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onClick();
                  setToast(null);
                }}
                className="rounded-lg px-2 py-1 font-bold text-accent"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
