import { useId, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import Button from './Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { usePostLimit } from '../hooks/usePostLimit.js';
import { charCount } from '../utils/text.js';

const RING_R = 9;
const RING_C = 2 * Math.PI * RING_R;

// Shared by "new post" (Home) and "reply" (PostDetail). onSubmit(text) must throw on failure.
export default function Composer({ placeholder = "What's happening?", submitLabel = 'Post', onSubmit, inputRef, autoFocus = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const limit = usePostLimit();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const localRef = useRef(null);
  const ref = inputRef || localRef;
  const counterId = useId();

  const count = charCount(text);
  const remaining = limit - count;
  const over = remaining < 0;
  const empty = text.trim().length === 0;
  const canSubmit = !empty && !over && !busy;

  const grow = (el) => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 320)}px`; };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit(text.trim());
      setText('');
      if (ref.current) ref.current.style.height = 'auto';
    } catch (err) {
      toast.error(err.message || 'Could not publish. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const showNumber = remaining <= 20;
  const progress = Math.min(count / limit, 1);

  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Avatar name={user?.name} src={user?.avatar} size={44} />
      <div className="composer__body">
        <textarea
          ref={ref}
          className="composer__input"
          rows={2}
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby={counterId}
          autoFocus={autoFocus}
          disabled={busy}
          onChange={(e) => { setText(e.target.value); grow(e.target); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
        />
        <div className="composer__bar">
          <span className="composer__hint">Ctrl + Enter to {submitLabel.toLowerCase()}</span>
          <div className="composer__right">
            <span id={counterId} className={`counter ${over ? 'is-over' : remaining <= 20 ? 'is-warn' : ''}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r={RING_R} className="counter__track" />
                <circle cx="12" cy="12" r={RING_R} className="counter__bar" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - progress)} />
              </svg>
              {showNumber && <span className="counter__num" role="status" aria-live="polite">{remaining}</span>}
              <span className="sr-only">{over ? `${-remaining} characters over the limit` : `${remaining} characters remaining`}</span>
            </span>
            <Button type="submit" size="sm" disabled={!canSubmit} loading={busy}>{submitLabel}</Button>
          </div>
        </div>
      </div>
    </form>
  );
}
