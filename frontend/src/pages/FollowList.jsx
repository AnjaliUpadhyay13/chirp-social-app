import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import NotFound from './NotFound.jsx';
import Button from '../components/Button.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { Icon } from '../components/Icons.jsx';
import { PostSkeleton } from '../components/Skeleton.jsx';
import Tabs from '../components/Tabs.jsx';
import UserRow from '../components/UserRow.jsx';
import { usePaginatedPosts } from '../hooks/usePaginatedPosts.js';
import { getFollowers, getFollowing, getProfile } from '../services/users.js';

const NAME_RE = /^[a-z0-9_]{3,20}$/i;
const TABS = [{ id: 'followers', label: 'Followers' }, { id: 'following', label: 'Following' }];

// kind: 'followers' | 'following' (route: /:username/followers, /:username/following)
export default function FollowList({ kind }) {
  const { username = '' } = useParams();
  if (!NAME_RE.test(username)) return <NotFound />;
  return <FollowListView key={`${username.toLowerCase()}-${kind}`} username={username.toLowerCase()} kind={kind} />;
}

function FollowListView({ username, kind }) {
  const navigate = useNavigate();
  const [owner, setOwner] = useState(null);
  const list = usePaginatedPosts(
    (cursor, signal) => (kind === 'followers' ? getFollowers : getFollowing)(username, cursor, signal),
    `${username}-${kind}`,
    'users', // these endpoints return { users }
  );

  useEffect(() => {
    const controller = new AbortController();
    getProfile(username, controller.signal).then(setOwner).catch(() => {});
    return () => controller.abort();
  }, [username]);

  useEffect(() => { document.title = `${kind === 'followers' ? 'Followers' : 'Following'} / Chirp`; }, [kind]);

  const onFollowChange = (user, next, count) =>
    list.update(user.id, { viewer: { ...user.viewer, following: next }, ...(count !== undefined ? { followerCount: count } : {}) });

  const notFound = list.status === 'error' && list.error?.status === 404;

  return (
    <>
      <div className="page-header page-header--row">
        <Link to={`/${username}`} className="icon-btn" aria-label={`Back to @${username}`}><Icon name="back" size={20} /></Link>
        <div>
          <h1 className="page-header__title">{owner?.name || `@${username}`}</h1>
          <p className="page-header__sub">@{username}</p>
        </div>
      </div>

      <Tabs tabs={TABS} value={kind} onChange={(id) => navigate(`/${username}/${id}`, { replace: true })} label="Connections" />

      <div role="tabpanel" id={`panel-${kind}`} aria-labelledby={`tab-${kind}`}>
        {list.status === 'loading' && <div aria-busy="true">{[1, 2, 3].map((i) => <div key={i} className="post-list__skeleton"><PostSkeleton /></div>)}</div>}

        {list.status === 'error' && (
          <ErrorState
            title={notFound ? "This account doesn't exist" : "Couldn't load this list"}
            message={notFound ? undefined : list.error?.message}
            onRetry={notFound ? undefined : list.retry}
          />
        )}

        {list.status === 'ready' && list.items.length === 0 && (
          <EmptyState icon="user" title={kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            message={kind === 'followers' ? 'When people follow this account, they will show up here.' : 'Accounts they follow will show up here.'} />
        )}

        {list.status === 'ready' && list.items.length > 0 && (
          <div>
            {list.items.map((u) => <UserRow key={u.id} user={u} onFollowChange={onFollowChange} />)}
            <div className="post-list__footer">
              {list.loadMoreError && <p className="post-list__error" role="alert">Couldn't load more people.</p>}
              {list.hasMore && <Button variant="outline" size="sm" onClick={list.loadMore} loading={list.loadingMore}>{list.loadMoreError ? 'Try again' : 'Load more'}</Button>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
