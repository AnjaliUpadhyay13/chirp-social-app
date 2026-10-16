import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from './Icons.jsx';

function FullPageLoader() {
  return (
    <div className="boot" role="status" aria-label="Loading">
      <span className="brand__mark"><Icon name="logo" size={26} /></span>
    </div>
  );
}

// Frontend guard for UX only. The backend enforces auth on every protected API regardless.
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

// Keeps logged-in users away from /login and /register
export function GuestRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}
