import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useState } from 'preact/hooks';

type Kind = 'ok' | 'info' | 'error';

interface Toast {
  id: number;
  text: string;
  kind: Kind;
}

type Notify = (text: string, kind?: Kind) => void;

const ToastContext = createContext<Notify>(() => {});

export const useToast = (): Notify => useContext(ToastContext);

let nextId = 1;

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback<Notify>((text, kind = 'ok') => {
    const id = nextId++;
    setToasts((list) => [...list, { id, text, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div class="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} class={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
