import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Composer from '../components/Composer.jsx';
import PostCard from '../components/PostCard.jsx';
import PostList from '../components/PostList.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { PostSkeleton } from '../components/Skeleton.jsx';
import { Icon } from '../components/Icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { usePaginatedPosts } from '../hooks/usePaginatedPosts.js';
import { createReply, getPost, getReplies } from '../services/posts.js';

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const composerRef = useRef(null);

  const [detail, setDetail] = useState({ status: 'loading', post: null, ancestors: [], error: null });
  const [attempt, setAttempt] = useState(0);
  const replies = usePaginatedPosts((cursor, signal) => getReplies(id, cursor, signal), id);

  useEffect(() => {
    const controller = new AbortController();
    setDetail({ status: 'loading', post: null, ancestors: [], error: null });
    getPost(id, controller.signal)
      .then(({ post, ancestors }) => setDetail({ status: 'ready', post, ancestors, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setDetail({ status: 'error', post: null, ancestors: [], error }); });
    return () => controller.abort();
  }, [id, attempt]);

  useEffect(() => { document.title = 'Post / Chirp'; }, []);

  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));
  const patchMain = useCallback((patch) => setDetail((d) => (d.post ? { ...d, post: { ...d.post, ...patch } } : d)), []);
  const patchAncestor = useCallback((aid, patch) => setDetail((d) => ({ ...d, ancestors: d.ancestors.map((a) => (a.id === aid ? { ...a, ...patch } : a)) })), []);

  const sendReply = useCallback(async (text) => {
    const reply = await createReply(id, text);
    replies.append(reply);
    setDetail((d) => (d.post ? { ...d, post: { ...d.post, replyCount: d.post.replyCount + 1 } } : d));
    toast.success('Your reply was published');
  }, [id, replies.append, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const onReplyDeleted = useCallback((rid) => {
    replies.remove(rid);
    setDetail((d) => (d.post ? { ...d, post: { ...d.post, replyCount: Math.max(0, d.post.replyCount - 1) } } : d));
  }, [replies.remove]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMainDeleted = () => navigate(detail.post.replyTo ? `/post/${detail.post.replyTo}` : '/', { replace: true });

  return (
    <>
      <div className="page-header page-header--row">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Go back"><Icon name="back" size={20} /></button>
        <h1 className="page-header__title">Post</h1>
      </div>

      {detail.status === 'loading' && <div className="post-list__skeleton"><PostSkeleton /></div>}

      {detail.status === 'error' && (
        <ErrorState
          title={detail.error?.status === 404 ? 'This post doesn\'t exist' : "Couldn't load this post"}
          message={detail.error?.status === 404 ? 'It may have been deleted.' : detail.error?.message}
          onRetry={detail.error?.status === 404 ? undefined : () => setAttempt((a) => a + 1)}
        />
      )}

      {detail.status === 'ready' && (
        <>
          {detail.ancestors.map((a) => (
            <PostCard key={a.id} post={a} me={user} variant="ancestor" onUpdate={patchAncestor} onDelete={() => navigate('/', { replace: true })} />
          ))}
          <PostCard post={detail.post} me={user} variant="detail" onUpdate={(_id, patch) => patchMain(patch)} onDelete={onMainDeleted}
            onReplyClick={() => composerRef.current?.focus()} />
          <Composer inputRef={composerRef} placeholder={`Reply to @${detail.post.author.username}`} submitLabel="Reply" onSubmit={sendReply} />
          <PostList
            list={replies}
            me={user}
            onDelete={onReplyDeleted}
            emptyIcon="comment"
            emptyTitle="No replies yet"
            emptyMessage="Start the conversation."
          />
        </>
      )}
    </>
  );
}
