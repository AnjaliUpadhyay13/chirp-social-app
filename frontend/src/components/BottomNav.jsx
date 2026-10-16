import NavItem, { useNavItems } from './NavItem.jsx';

export default function BottomNav() {
  const items = useNavItems();
  return (
    <nav className="bottom-nav" aria-label="Main">
      <ul>
        {items.map((item) => (
          <li key={item.to}><NavItem {...item} compact /></li>
        ))}
      </ul>
    </nav>
  );
}
