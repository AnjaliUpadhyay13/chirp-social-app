import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from './PageHeader.jsx';
import Button from '../components/Button.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { Icon } from '../components/Icons.jsx';
import PostList from '../components/PostList.jsx';
import { PostSkeleton, Skeleton } from '../components/Skeleton.jsx';
import SuggestedUser from '../components/SuggestedUser.jsx';
import Tabs from '../components/Tabs.jsx';
import TrendItem from '../components/TrendItem.jsx';
import UserRow from '../components/UserRow.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { usePaginatedPosts } from '../hooks/usePaginatedPosts.js';
import { useRemote } from '../hooks/useRemote.js';
import { getSuggestions, getTrends, searchPosts, searchUsers } from '../services/search.js';

const TABS = [{ id: 'posts', label: 'Posts' }, { id: 'people', label: 'People' }];

function ExploreHome() {
  const trends = useRemote((s) => getTrends(s, 10));
  const people = useRemote((s) => getSuggestions(s, 10));
  return (
    <>
      <section aria-labelledby="ex-trends">
        <h2 id="ex-trends" className="section-title">Trending hashtags</h2>
        {trends.status === 'loading' && <div className="post-list__skeleton"><Skeleton width="40%" /><Skeleton width="60%" height={18} /></div>}
        {trends.status === 'error' && <ErrorState title="Couldn't load trends" message={trends.error?.message} onRetry={trends.retry} />}
        {trends.status === 'ready' && (trends.data.length === 0
          ? <EmptyState icon="search" title="No trends yet" message="Use #hashtags in your posts and the popular ones appear here." />
          : trends.data.map((t) => <TrendItem key={t.tag} trend={t} />))}
      </section>

      <section aria-labelledby="ex-people">
        <h2 id="ex-people" className="section-title">Who to follow</h2>
        {people.status === 'loading' && <div className="post-list__skeleton"><PostSkeleton /></div>}
        {people.status === 'error' && <ErrorState title="Couldn't load suggestions" message={people.error?.message} onRetry={people.retry} />}
        {people.status === 'ready' && (people.data.length === 0
          ? <EmptyState icon="user" title="No suggestions right now" message="When more people join, you'll find them here." />
          : people.data.map((u) => <SuggestedUser key={u.id} user={u} />))}
      </section>
    </>
  );
}

function PostResults({ q }) {
  const { user } = useAuth();
  const list = usePaginatedPosts((cursor, signal) => searchPosts(q, cursor, signal), `posts-${q}`);
  return (
    <PostList
      list={list}
      me={user}
      onDelete={list.remove}
      emptyTitle="No posts found"
      emptyMessage={`Nothing matches “${q}”. Try different words or a #hashtag.`}
    />
  );
}

function PeopleResults({ q }) {
  const list = usePaginatedPosts((_cursor, signal) => searchUsers(q, signal), `people-${q}`, 'users');
  const onFollowChange = (u, next, count) =>
    list.update(u.id, { viewer: { ...u.viewer, following: next }, ...(count !== undefined ? { followerCount: count } : {}) });

  if (list.status === 'loading') return <div aria-busy="true">{[1, 2, 3].map((i) => <div key={i} className="post-list__skeleton"><PostSkeleton /></div>)}</div>;
  if (list.status === 'error') return <ErrorState title="Search failed" message={list.error?.message} onRetry={list.retry} />;
  if (list.items.length === 0) return <EmptyState icon="user" title="No people found" message={`Nobody matches “${q}”. Check the spelling or try a username.`} />;
  return <div>{list.items.map((u) => <UserRow key={u.id} user={u} onFollowChange={onFollowChange} />)}</div>;
}

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const urlQ = params.get('q') || '';
  const tab = params.get('tab') === 'people' ? 'people' : 'posts';

  const [input, setInput] = useState(urlQ);
  const debounced = useDebounce(input.trim(), 300);
  const inputRef = useRef(null);

  useEffect(() => { document.title = 'Explore / Chirp'; }, []);

  const writeParams = (patch) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    return next;
  }, { replace: true });

  // typing -> URL (debounced)
  useEffect(() => { if (debounced !== urlQ) writeParams({ q: debounced }); }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  // URL -> input, only for outside changes (hashtag click, back button); never overwrite what is being typed
  useEffect(() => { if (urlQ !== debounced) setInput(urlQ); }, [urlQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => { e.preventDefault(); writeParams({ q: input.trim() }); };
  const clear = () => { setInput(''); writeParams({ q: '' }); inputRef.current?.focus(); };

  return (
    <>
      <PageHeader title="Explore" />
      <form className="searchbar" role="search" onSubmit={submit}>
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          type="search"
          className="searchbar__input"
          aria-label="Search Chirp"
          placeholder="Search posts and people"
          value={input}
          maxLength={100}
          onChange={(e) => setInput(e.target.value)}
        />
        {input && <Button type="button" variant="ghost" size="sm" onClick={clear} aria-label="Clear search">Clear</Button>}
      </form>

      {!urlQ ? <ExploreHome /> : (
        <>
          <Tabs tabs={TABS} value={tab} onChange={(id) => writeParams({ tab: id === 'people' ? 'people' : '' })} label="Search results" />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'posts' ? <PostResults key={urlQ} q={urlQ} /> : <PeopleResults key={urlQ} q={urlQ} />}
          </div>
        </>
      )}
    </>
  );
}
