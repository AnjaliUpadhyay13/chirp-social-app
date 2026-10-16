import { Link, useNavigate } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import FollowButton from './FollowButton.jsx';

// One person in a followers/following list.
export default function UserRow({ user, onFollowChange }) {
  const navigate = useNavigate();
  const onClick = (e) => {
    if (e.target.closest('a, button')) return;
    navigate(`/${user.username}`);
  };

  return (
    <div className="user-row" onClick={onClick}>
      <Link to={`/${user.username}`} tabIndex={-1} aria-hidden="true"><Avatar name={user.name} src={user.avatar} size={48} /></Link>
      <div className="user-row__main">
        <Link to={`/${user.username}`} className="user-row__name">
          <strong>{user.name}</strong>
          <span>@{user.username}</span>
        </Link>
        {user.bio && <p className="user-row__bio">{user.bio}</p>}
      </div>
      {!user.viewer?.isMe && (
        <FollowButton username={user.username} following={Boolean(user.viewer?.following)} onChange={(next, count) => onFollowChange(user, next, count)} />
      )}
    </div>
  );
}
