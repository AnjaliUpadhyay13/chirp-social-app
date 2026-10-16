import { useId, useState } from 'react';
import { Icon } from './Icons.jsx';

export default function FormField({ label, error, hint, type = 'text', multiline = false, ...rest }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const Control = multiline ? 'textarea' : 'input';
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label className="field__label" htmlFor={id}>{label}</label>
      <div className="field__control">
        <Control
          id={id}
          className="field__input"
          {...(multiline ? { rows: 3 } : { type: isPassword && show ? 'text' : type })}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {isPassword && (
          <button type="button" className="field__toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? 'Hide' : 'Show'}
            <span className="sr-only"> password</span>
          </button>
        )}
      </div>
      {error ? <p id={`${id}-err`} className="field__error" role="alert">{error}</p>
        : hint ? <p id={`${id}-hint`} className="field__hint">{hint}</p> : null}
    </div>
  );
}
