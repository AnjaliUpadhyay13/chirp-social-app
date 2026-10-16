import { Icon } from './Icons.jsx';

export default function EmptyState({ icon = 'inbox', title, message, action }) {
  return (
    <div className="state">
      <span className="state__icon"><Icon name={icon} size={28} /></span>
      <h2 className="state__title">{title}</h2>
      {message && <p className="state__msg">{message}</p>}
      {action}
    </div>
  );
}
