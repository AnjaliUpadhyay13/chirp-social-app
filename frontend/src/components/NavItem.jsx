import { NavLink } from 'react-router-dom';
import { Icon } from './Icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

export const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/explore', label: 'Explore', icon: 'search' },
  { to: '/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/bookmarks', label: 'Bookmarks', icon: 'bookmark' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

// NavLink sets aria-current="page" on the active item automatically. `badge` = unread count (0 hides it).
export default function NavItem({ to, label, icon, end, badge = 0, compact = false }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''} ${compact ? 'nav-item--compact' : ''}`}>
      <span className="nav-item__icon">
        <Icon name={icon} />
        {badge > 0 && <span className="nav-badge" aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
      </span>
      <span className="nav-item__label">{label}</span>
      {badge > 0 && <span className="sr-only">, {badge} unread</span>}
    </NavLink>
  );
}

// Same list, with "Profile" pointing at /<your username> and the unread badge on Notifications.
export function useNavItems() {
  const { user } = useAuth();
  const { unread } = useNotifications();
  return NAV_ITEMS.map((i) => {
    if (i.to === '/profile' && user) return { ...i, to: `/${user.username}` };
    if (i.to === '/notifications') return { ...i, badge: unread };
    return i;
  });
}
