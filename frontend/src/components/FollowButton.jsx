import { useState } from 'react';
import Button from './Button.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { setFollow } from '../services/users.js';

// Optimistic follow/unfollow. onChange(nextFollowing, exactFollowerCount?) lets the parent update its own state:
//   1) before the request: onChange(next)              -> parent adjusts the count by +/-1
//   2) on success:         onChange(next, serverCount) -> parent sets the exact count
//   3) on failure:         onChange(!next)             -> rollback
export default function FollowButton({ username, following, onChange, size = 'sm' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  const click = async () => {
    if (busy) return;
    const next = !following;
    setBusy(true);
    onChange(next);
    try {
      const res = await setFollow(username, next);
      onChange(res.following, res.followerCount);
    } catch (err) {
      onChange(!next);
      toast.error(err.message || `Could not ${next ? 'follow' : 'unfollow'} @${username}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={following ? 'outline' : 'primary'}
      size={size}
      className={following ? 'btn--following' : ''}
      aria-pressed={following}
      aria-label={`${following ? 'Unfollow' : 'Follow'} @${username}`}
      onClick={click}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      disabled={busy}
    >
      {following ? (hover ? 'Unfollow' : 'Following') : 'Follow'}
    </Button>
  );
}
