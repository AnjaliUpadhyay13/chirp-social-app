import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from './PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import Button from '../components/Button.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { Icon } from '../components/Icons.jsx';
import { PostSkeleton } from '../components/Skeleton.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { usePaginatedPosts } from '../hooks/usePaginatedPosts.js';
import { getNotifications, markAllRead, markRead } from '../services/notifications.js';
import { timeAgo, fullDate } from '../utils/time.js';

const META = {
  like: { icon: 'heart', text: 'liked your post' },
  repost: { icon: 'repeat', text: 'reposted your post' },
  reply: { icon: 'comment', text: 'replied to your post' },
  follow: { icon: 'user', text: 'followed you' },
};

function NotificationItem({ n, onOpen }) {
  const meta = META[n.type];
  const unread = !n.readAt;
  const to = n.type === 'follow' ? `/${n.actor.username}` : `/post/${n.post.id}`;
  return (
    <Link to={to} className={`notif ${unread ? 'is-unread' : ''}`} onClick={() => unread && onOpen(n)}>
      <span className={`notif__icon notif__icon--${n.type}`}><Icon name={meta.icon} size={20} filled={n.type === 'like'} /></span>
      <div className="notif__body">
        <Avatar name={n.actor.name} src={n.actor.avatar} size={32} />
        <p className="notif__text">
          <strong>{n.actor.name}</strong> {meta.text}
          {' '}<time dateTime={n.createdAt} title={fullDate(n.createdAt)} className="notif__time">{timeAgo(n.createdAt)}</time>
        </p>
        {n.post && <p className="notif__snippet">{n.post.text}</p>}
      </div>
      {unread && <><span className="notif__dot" aria-hidden="true" /><span className="sr-only">Unread</span></>}
    </Link>
  );
}

export default function Notifications() {
  const toast = useToast();
  const { unread, setUnread, refresh } = useNotifications();
  const list = usePaginatedPosts(getNotifications, 'notifications', 'notifications');

  useEffect(() => { document.title = 'Notifications / Chirp'; }, []);

  const open = async (n) => {
    list.update(n.id, { readAt: new Date().toISOString() });
    setUnread((c) => Math.max(0, c - 1));
    try { setUnread((await markRead(n.id)).unreadCount); } catch { refresh(); }
  };

  const readAll = async () => {
    try {
      await markAllRead();
      const now = new Date().toISOString();
      list.items.filter((i) => !i.readAt).forEach((i) => list.update(i.id, { readAt: now }));
      setUnread(0);
    } catch (err) {
      toast.error(err.message || 'Could not mark notifications as read');
    }
  };

  return (
    <>
      <div className="page-header page-header--row page-header--space">
        <h1 className="page-header__title">Notifications</h1>
        <Button variant="outline" size="sm" onClick={readAll} disabled={unread === 0}>Mark all as read</Button>
      </div>

      {list.status === 'loading' && <div aria-busy="true">{[1, 2, 3].map((i) => <div key={i} className="post-list__skeleton"><PostSkeleton /></div>)}</div>}
      {list.status === 'error' && <ErrorState title="Couldn't load notifications" message={list.error?.message} onRetry={list.retry} />}
      {list.status === 'ready' && list.items.length === 0 && (
        <EmptyState icon="bell" title="No notifications yet" message="Likes, replies, reposts and new followers will show up here." />
      )}
      {list.status === 'ready' && list.items.length > 0 && (
        <div>
          {list.items.map((n) => <NotificationItem key={n.id} n={n} onOpen={open} />)}
          <div className="post-list__footer">
            {list.loadMoreError && <p className="post-list__error" role="alert">Couldn&apos;t load more notifications.</p>}
            {list.hasMore && <Button variant="outline" size="sm" onClick={list.loadMore} loading={list.loadingMore}>{list.loadMoreError ? 'Try again' : 'Load more'}</Button>}
          </div>
        </div>
      )}
    </>
  );
}
