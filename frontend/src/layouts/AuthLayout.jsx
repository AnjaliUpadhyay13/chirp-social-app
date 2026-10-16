import { Link, Outlet } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { Icon } from '../components/Icons.jsx';

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-shell__theme"><ThemeToggle /></div>
      <main className="auth-card">
        <Link to="/login" className="brand auth-card__brand" aria-label="Chirp">
          <span className="brand__mark"><Icon name="logo" size={22} /></span>
          <span className="brand__name">Chirp</span>
        </Link>
        <Outlet />
      </main>
    </div>
  );
}
