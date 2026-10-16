import PostCard from './PostCard.jsx';
import { PostSkeleton } from './Skeleton.jsx';
import EmptyState from './EmptyState.jsx';
import ErrorState from './ErrorState.jsx';
import Button from './Button.jsx';

// Renders every state of a usePaginatedPosts() list: loading, error, empty, items + load more.
export default function PostList({ list, me, onDelete, onReplyClick, emptyTitle, emptyMessage, emptyIcon = 'inbox' }) {
  if (list.status === 'loading') {
    return <div className="post-list" aria-busy="true">{[1, 2, 3].map((i) => <div key={i} className="post-list__skeleton"><PostSkeleton /></div>)}</div>;
  }
  if (list.status === 'error') {
    return <ErrorState title="Couldn't load posts" message={list.error?.message} onRetry={list.retry} />;
  }
  if (list.items.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />;
  }
  return (
    <div className="post-list">
      {list.items.map((post) => (
        <PostCard key={post.feedId ?? post.id} post={post} me={me} onUpdate={list.update} onDelete={onDelete} onReplyClick={onReplyClick} />
      ))}
      <div className="post-list__footer">
        {list.loadMoreError && <p className="post-list__error" role="alert">Couldn't load more posts.</p>}
        {list.hasMore
          ? <Button variant="outline" size="sm" onClick={list.loadMore} loading={list.loadingMore}>{list.loadMoreError ? 'Try again' : 'Load more'}</Button>
          : <p className="post-list__end">You're all caught up</p>}
      </div>
    </div>
  );
}
