import { useNavigate } from 'react-router-dom';
import Dropdown from './Dropdown.jsx';
import Avatar from './Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function UserMenu({ compact = false, direction = 'up', align = 'left' }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  if (!user) return null;

  const onLogout = async () => {
    try { await logout(); toast.info('You have been logged out'); }
    catch { toast.error('Logout failed, but your session was cleared locally'); }
    navigate('/login', { replace: true });
  };

  return (
    <Dropdown
      direction={direction}
      align={align}
      label={`Account menu for ${user.name}`}
      items={[{ label: `Log out @${user.username}`, onSelect: onLogout, danger: true }]}
      trigger={
        <span className="user-chip">
          <Avatar name={user.name} src={user.avatar} size={compact ? 32 : 40} />
          {!compact && (
            <span className="user-chip__text">
              <strong>{user.name}</strong>
              <span>@{user.username}</span>
            </span>
          )}
        </span>
      }
    />
  );
}
