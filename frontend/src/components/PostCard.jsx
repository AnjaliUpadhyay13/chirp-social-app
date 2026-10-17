import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Button from './Button.jsx';
import Dropdown from './Dropdown.jsx';
import Modal from './Modal.jsx';
import { Icon } from './Icons.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { deletePost, setBookmark, setLike, setRepost } from '../services/posts.js';
import { timeAgo, fullDate } from '../utils/time.js';
import { splitHashtags } from '../utils/text.js';

// variant: 'default' (feed/replies) | 'detail' (main post on its own page) | 'ancestor' (thread parent above the main post)
export default function PostCard({ post, me, variant = 'default', onUpdate, onDelete, onReplyClick }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = me?.id === post.author.id;
  const { liked, reposted } = post.viewer;
  const bookmarked = Boolean(post.viewer.bookmarked);

  // Optimistic toggle: update immediately, reconcile with the server's counts, roll back on failure.
  const toggle = async (kind) => {
    if (busy[kind]) return;
    const isLike = kind === 'like';
    const flag = isLike ? 'liked' : 'reposted';
    const countKey = isLike ? 'likeCount' : 'repostCount';
    const next = !post.viewer[flag];
    const patch = (on, count) => ({ viewer: { ...post.viewer, [flag]: on }, [countKey]: count });

    onUpdate?.(post.id, patch(next, Math.max(0, post[countKey] + (next ? 1 : -1))));
    setBusy((b) => ({ ...b, [kind]: true }));
    try {
      const res = await (isLike ? setLike : setRepost)(post.id, next);
      onUpdate?.(post.id, patch(res[flag], res[countKey]));
    } catch (err) {
      onUpdate?.(post.id, patch(!next, post[countKey]));
      toast.error(err.message || `Could not ${kind} this post`);
    } finally {
      setBusy((b) => ({ ...b, [kind]: false }));
    }
  };

  // Bookmarks are private and cheap, so no optimistic update: wait for the server, then update.
  const toggleBookmark = async () => {
    if (busy.bookmark) return;
    const next = !bookmarked;
    setBusy((b) => ({ ...b, bookmark: true }));
    try {
      const res = await setBookmark(post.id, next);
      onUpdate?.(post.id, { viewer: { ...post.viewer, bookmarked: res.bookmarked } });
      toast.success(res.bookmarked ? 'Saved to your bookmarks' : 'Removed from your bookmarks');
    } catch (err) {
      toast.error(err.message || 'Could not update your bookmarks');
    } finally {
      setBusy((b) => ({ ...b, bookmark: false }));
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deletePost(post.id);
      setConfirmOpen(false);
      toast.success('Post deleted');
      onDelete?.(post.id);
    } catch (err) {
      toast.error(err.message || 'Could not delete the post');
      setDeleting(false);
    }
  };

  const onCardClick = (e) => {
    if (variant !== 'default') return;
    if (e.target.closest('a, button, [role="menu"], [role="menuitem"], [role="dialog"]')) return;
    if (window.getSelection?.().toString()) return; // don't navigate while selecting text
    navigate(`/post/${post.id}`);
  };

  const segments = splitHashtags(post.text);

  return (
    <article className={`post post--${variant}`} onClick={onCardClick} data-testid={`post-${post.id}`}>
      <div className="post__gutter">
        <Link to={`/${post.author.username}`} tabIndex={-1} aria-hidden="true"><Avatar name={post.author.name} src={post.author.avatar} size={44} /></Link>
        {variant === 'ancestor' && <span className="post__thread-line" aria-hidden="true" />}
      </div>

      <div className="post__main">
        {post.repostedBy && (
          <p className="post__context">
            <Icon name="repeat" size={14} />
            <Link to={`/${post.repostedBy.username}`}>{post.repostedBy.id === me?.id ? 'You' : post.repostedBy.name}</Link> reposted
          </p>
        )}
        <header className="post__head">
          <Link to={`/${post.author.username}`} className="post__author">
            <span className="post__name">{post.author.name}</span>
            <span className="post__handle">@{post.author.username}</span>
          </Link>
          <span aria-hidden="true" className="post__dot">·</span>
          <Link to={`/post/${post.id}`} className="post__time">
            <time dateTime={post.createdAt} title={fullDate(post.createdAt)}>{timeAgo(post.createdAt)}</time>
          </Link>
          {isOwner && (
            <div className="post__more">
              <Dropdown
                label="More options for this post"
                direction="down"
                align="right"
                trigger={<span className="icon-btn"><Icon name="more" size={18} /></span>}
                items={[{ label: 'Delete post', danger: true, onSelect: () => setConfirmOpen(true) }]}
              />
            </div>
          )}
        </header>

        {post.replyingTo && <p className="post__replying">Replying to <Link to={`/${post.replyingTo}`}>@{post.replyingTo}</Link></p>}

        <p className="post__text">
          {segments.map((s, i) => (s.type === 'tag'
            ? <Link key={i} to={`/explore?q=${encodeURIComponent(s.value)}`} className="hashtag">{s.value}</Link>
            : <span key={i}>{s.value}</span>))}
        </p>

        {variant === 'detail' && <p className="post__fulltime">{fullDate(post.createdAt)}</p>}

        <div className="post__actions" role="group" aria-label="Post actions">
          <button type="button" className="action action--reply" aria-label={`Reply, ${post.replyCount} replies`}
            onClick={() => (onReplyClick ? onReplyClick() : navigate(`/post/${post.id}`))}>
            <Icon name="comment" size={18} /><span>{post.replyCount || ''}</span>
          </button>
          <button type="button" className={`action action--repost ${reposted ? 'is-on' : ''}`} aria-pressed={reposted}
            aria-label={`${reposted ? 'Undo repost' : 'Repost'}, ${post.repostCount} reposts`} onClick={() => toggle('repost')}>
            <Icon name="repeat" size={18} /><span>{post.repostCount || ''}</span>
          </button>
          <button type="button" className={`action action--like ${liked ? 'is-on' : ''}`} aria-pressed={liked}
            aria-label={`${liked ? 'Unlike' : 'Like'}, ${post.likeCount} likes`} onClick={() => toggle('like')}>
            <Icon name="heart" size={18} filled={liked} /><span>{post.likeCount || ''}</span>
          </button>
          <button type="button" className={`action action--save ${bookmarked ? 'is-on' : ''}`} aria-pressed={bookmarked}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'} onClick={toggleBookmark} disabled={busy.bookmark}>
            <Icon name="save" size={18} filled={bookmarked} />
          </button>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        title="Delete this post?"
        onClose={() => !deleting && setConfirmOpen(false)}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>Delete</Button>
          </>
        )}
      >
        This can't be undone. Replies to this post will be removed too.
      </Modal>
    </article>
  );
}
