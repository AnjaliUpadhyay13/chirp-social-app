import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import FollowButton from './FollowButton.jsx';
import UserRow from './UserRow.jsx';

// A person from "Who to follow". Keeps its own follow state so the button can flip in place.
export default function SuggestedUser({ user, compact = false }) {
  const [following, setFollowing] = useState(Boolean(user.viewer?.following));

  if (!compact) {
    return <UserRow user={{ ...user, viewer: { ...user.viewer, following } }} onFollowChange={(_u, next) => setFollowing(next)} />;
  }
  return (
    <div className="suggest">
      <Link to={`/${user.username}`} tabIndex={-1} aria-hidden="true"><Avatar name={user.name} src={user.avatar} size={40} /></Link>
      <Link to={`/${user.username}`} className="suggest__name">
        <strong>{user.name}</strong>
        <span>@{user.username}</span>
      </Link>
      <FollowButton username={user.username} following={following} onChange={(next) => setFollowing(next)} />
    </div>
  );
}
