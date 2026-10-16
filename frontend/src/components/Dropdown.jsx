import { useEffect, useId, useRef, useState } from 'react';

// Accessible menu button: click/Enter/Space/ArrowDown opens, Esc/outside-click closes, arrows move focus.
export default function Dropdown({ trigger, items, align = 'left', direction = 'up', label = 'Menu' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); rootRef.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const onMenuKey = (e) => {
    const els = [...rootRef.current.querySelectorAll('[role="menuitem"]')];
    const i = els.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
  };

  return (
    <div className="dropdown" ref={rootRef}>
      <button type="button" className="dropdown__trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        aria-label={label} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={`dropdown__menu dropdown__menu--${direction} dropdown__menu--${align}`} onKeyDown={onMenuKey}>
          {items.map((item) => (
            <button key={item.label} role="menuitem" type="button" className={`dropdown__item ${item.danger ? 'is-danger' : ''}`}
              onClick={() => { setOpen(false); item.onSelect(); }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
