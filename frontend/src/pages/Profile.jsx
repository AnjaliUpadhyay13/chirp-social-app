import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import NotFound from './NotFound.jsx';
import Avatar from '../components/Avatar.jsx';
import Button from '../components/Button.jsx';
import EditProfileModal from '../components/EditProfileModal.jsx';
import ErrorState from '../components/ErrorState.jsx';
import FollowButton from '../components/FollowButton.jsx';
import { Icon } from '../components/Icons.jsx';
import PostList from '../components/PostList.jsx';
import { Skeleton } from '../components/Skeleton.jsx';
import Tabs from '../components/Tabs.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { usePaginatedPosts } from '../hooks/usePaginatedPosts.js';
import { getProfile, getUserPosts, getUserReplies } from '../services/users.js';

const NAME_RE = /^[a-z0-9_]{3,20}$/i;
const TABS = [{ id: 'posts', label: 'Posts' }, { id: 'replies', label: 'Replies' }];

// /profile -> /<your username>
export function ProfileRedirect() {
  const { user } = useAuth();
  return <Navigate to={`/${user.username}`} replace />;
}

export default function Profile() {
  const { username = '' } = useParams();
  if (!NAME_RE.test(username)) return <NotFound />; // can't be a real account (also catches unknown one-segment URLs like /abc!)
  return <ProfileView key={username.toLowerCase()} username={username.toLowerCase()} />;
}

function ProfileSkeleton() {
  return (
    <div className="profile" aria-busy="true" role="status" aria-label="Loading profile">
      <div className="profile__banner" />
      <div className="profile__top"><Skeleton width={96} height={96} radius={999} /></div>
      <div className="stack" style={{ padding: '12px 18px' }}><Skeleton width="40%" height={20} /><Skeleton width="25%" /><Skeleton width="70%" /></div>
    </div>
  );
}

function ProfileView({ username }) {
  const { user: me, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ status: 'loading', user: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState('posts');
  const [editing, setEditing] = useState(false);

  const list = usePaginatedPosts(
    (cursor, signal) => (tab === 'posts' ? getUserPosts : getUserReplies)(username, cursor, signal),
    `${username}-${tab}`,
  );

  useEffect(() => {
    const controller = new AbortController();
    setProfile({ status: 'loading', user: null, error: null });
    getProfile(username, controller.signal)
      .then((user) => setProfile({ status: 'ready', user, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setProfile({ status: 'error', user: null, error }); });
    return () => controller.abort();
  }, [username, attempt]);

  useEffect(() => {
    document.title = profile.user ? `${profile.user.name} (@${profile.user.username}) / Chirp` : 'Profile / Chirp';
  }, [profile.user]);

  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));

  const onFollowChange = useCallback((next, exactCount) => {
    setProfile((p) => {
      const u = p.user;
      if (!u) return p;
      const was = u.viewer.following;
      const followerCount = exactCount ?? u.followerCount + (next && !was ? 1 : !next && was ? -1 : 0);
      return { ...p, user: { ...u, followerCount, viewer: { ...u.viewer, following: next } } };
    });
  }, []);

  const onSaved = (saved) => {
    updateUser(saved);
    setProfile((p) => ({ ...p, user: { ...p.user, name: saved.name, bio: saved.bio, avatar: saved.avatar } }));
    setEditing(false);
    toast.success('Profile updated');
    list.retry(); // refresh so your posts show the new name/avatar
  };

  const notFound = profile.error && [400, 404].includes(profile.error.status);
  const u = profile.user;

  return (
    <>
      <div className="page-header page-header--row">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Go back"><Icon name="back" size={20} /></button>
        <h1 className="page-header__title">{u ? u.name : 'Profile'}</h1>
      </div>

      {profile.status === 'loading' && <ProfileSkeleton />}

      {profile.status === 'error' && (
        <ErrorState
          title={notFound ? "This account doesn't exist" : "Couldn't load this profile"}
          message={notFound ? 'Try searching for another name.' : profile.error?.message}
          onRetry={notFound ? undefined : () => setAttempt((a) => a + 1)}
        />
      )}

      {profile.status === 'ready' && (
        <>
          <section className="profile" aria-label={`Profile of ${u.name}`}>
            <div className="profile__banner" />
            <div className="profile__top">
              <div className="profile__avatar"><Avatar name={u.name} src={u.avatar} size={96} /></div>
              <div className="profile__action">
                {u.viewer.isMe
                  ? <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit profile</Button>
                  : <FollowButton username={u.username} following={u.viewer.following} onChange={onFollowChange} />}
              </div>
            </div>

            <h2 className="profile__name">{u.name}</h2>
            <p className="profile__handle">
              @{u.username}
              {u.viewer.followedBy && <span className="pill">Follows you</span>}
            </p>
            {u.bio && <p className="profile__bio">{u.bio}</p>}
            <p className="profile__joined">Joined {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            <p className="profile__counts">
              <Link to={`/${u.username}/following`}><strong>{u.followingCount}</strong> Following</Link>
              <Link to={`/${u.username}/followers`}><strong>{u.followerCount}</strong> {u.followerCount === 1 ? 'Follower' : 'Followers'}</Link>
            </p>
          </section>

          <Tabs tabs={TABS} value={tab} onChange={setTab} label="Profile sections" />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            <PostList
              list={list}
              me={me}
              onDelete={list.remove}
              emptyIcon="comment"
              emptyTitle={tab === 'posts'
                ? (u.viewer.isMe ? "You haven't posted yet" : `@${u.username} hasn't posted yet`)
                : (u.viewer.isMe ? "You haven't replied yet" : `@${u.username} hasn't replied yet`)}
              emptyMessage={tab === 'posts' ? 'Posts and reposts show up here.' : 'Replies to other posts show up here.'}
            />
          </div>

          {editing && <EditProfileModal open user={u} onClose={() => setEditing(false)} onSaved={onSaved} />}
        </>
      )}
    </>
  );
}
