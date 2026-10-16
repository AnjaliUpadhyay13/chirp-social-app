import { Link, Outlet } from 'react-router-dom';
import LeftNav from '../components/LeftNav.jsx';
import RightSidebar from '../components/RightSidebar.jsx';
import BottomNav from '../components/BottomNav.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import UserMenu from '../components/UserMenu.jsx';
import { Icon } from '../components/Icons.jsx';

// Desktop: 3 columns. Tablet: icon-only nav + feed (+ right column hidden). Mobile: top bar + feed + bottom nav.
export default function MainLayout() {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>

      <div className="mobile-topbar">
        <Link to="/" className="brand" aria-label="Chirp home">
          <span className="brand__mark"><Icon name="logo" size={20} /></span>
          <span className="brand__name">Chirp</span>
        </Link>
        <div className="mobile-topbar__actions">
          <ThemeToggle />
          <UserMenu compact direction="down" align="right" />
        </div>
      </div>

      <LeftNav />
      <main id="main" className="feed-column" tabIndex={-1}>
        <Outlet />
      </main>
      <RightSidebar />
      <BottomNav />
    </div>
  );
}
