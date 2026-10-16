import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface Props {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}

/** Natives <dialog>: bringt Fokusfalle und Schließen per Esc mit. */
export function Modal({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Über eine Ref, damit ein neu erzeugter Callback den Dialog nicht schließt und wieder öffnet.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const cancel = (event: Event) => {
      event.preventDefault();
      close.current();
    };
    dialog.addEventListener('cancel', cancel);
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.removeEventListener('cancel', cancel);
      dialog.close();
    };
  }, []);

  return (
    <dialog ref={ref} class="modal" aria-labelledby="modal-title">
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}
