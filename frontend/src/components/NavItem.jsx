import { NavLink } from 'react-router-dom';
import { Icon } from './Icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/explore', label: 'Explore', icon: 'search' },
  { to: '/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/bookmarks', label: 'Bookmarks', icon: 'bookmark' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

// NavLink sets aria-current="page" on the active item automatically.
export default function NavItem({ to, label, icon, end, compact = false }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''} ${compact ? 'nav-item--compact' : ''}`}>
      <Icon name={icon} />
      <span className="nav-item__label">{label}</span>
    </NavLink>
  );
}

// Same list, with "Profile" pointing at /<your username>.
export function useNavItems() {
  const { user } = useAuth();
  return NAV_ITEMS.map((i) => (i.to === '/profile' && user ? { ...i, to: `/${user.username}` } : i));
}
