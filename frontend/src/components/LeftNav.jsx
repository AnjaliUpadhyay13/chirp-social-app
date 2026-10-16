import { Link } from 'react-router-dom';
import NavItem, { useNavItems } from './NavItem.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import UserMenu from './UserMenu.jsx';
import { Icon } from './Icons.jsx';

export default function LeftNav() {
  const items = useNavItems();
  return (
    <header className="left-nav">
      <Link to="/" className="brand" aria-label="Chirp home">
        <span className="brand__mark"><Icon name="logo" size={22} /></span>
        <span className="brand__name">Chirp</span>
      </Link>
      <nav aria-label="Main">
        <ul className="nav-list">
          {items.map((item) => (
            <li key={item.to}><NavItem {...item} /></li>
          ))}
        </ul>
      </nav>
      <div className="left-nav__footer"><ThemeToggle withLabel /><UserMenu /></div>
    </header>
  );
}
