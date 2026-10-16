import { Icon } from './Icons.jsx';
import Button from './Button.jsx';

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon"><Icon name="alert" size={28} /></span>
      <h2 className="state__title">{title}</h2>
      {message && <p className="state__msg">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Try again
        </Button>
      )}
    </div>
  );
}
