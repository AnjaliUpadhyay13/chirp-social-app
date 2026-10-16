import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

// Accessible confirm dialog: Esc / backdrop closes, Tab is trapped, focus returns to the opener.
export default function Modal({ open, title, children, actions, onClose, wide = false }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  // Keep the latest onClose in a ref so the effect below only runs when `open` changes.
  // (A fresh onClose on every render used to re-run it and steal focus back to the first field on each keystroke.)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const focusables = () => [...dialogRef.current.querySelectorAll('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])')];
    focusables()[0]?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (!els.length) return;
      const first = els[0]; const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
        <h2 id={titleId} className="modal__title">{title}</h2>
        <div className="modal__body">{children}</div>
        <div className="modal__actions">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}
