import { useCallback, useEffect, useState } from 'react';
import PageHeader from './PageHeader.jsx';
import Composer from '../components/Composer.jsx';
import PostList from '../components/PostList.jsx';
import Tabs from '../components/Tabs.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { usePaginatedPosts } from '../hooks/usePaginatedPosts.js';
import { createPost, getFeed } from '../services/posts.js';

const TABS = [{ id: 'global', label: 'For you' }, { id: 'following', label: 'Following' }];

export default function Home() {
  const { user } = useAuth();
  const toast = useToast();
  const [scope, setScope] = useState('global');
  const feed = usePaginatedPosts((cursor, signal) => getFeed(cursor, signal, scope), `home-${scope}`);

  useEffect(() => { document.title = 'Home / Chirp'; }, []);

  const publish = useCallback(async (text) => {
    const post = await createPost(text); // throws on failure -> Composer shows the error and keeps the text
    feed.prepend(post);
    toast.success('Your post was published');
  }, [feed.prepend, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Home" />
      <Tabs tabs={TABS} value={scope} onChange={setScope} label="Timeline" />
      <Composer onSubmit={publish} />
      <div role="tabpanel" id={`panel-${scope}`} aria-labelledby={`tab-${scope}`}>
        <PostList
          list={feed}
          me={user}
          onDelete={feed.remove}
          emptyIcon="comment"
          emptyTitle={scope === 'following' ? 'Nothing here yet' : 'No posts yet'}
          emptyMessage={scope === 'following'
            ? 'Follow people to see their posts and reposts here.'
            : 'Be the first to share something. Your post will show up here.'}
        />
      </div>
    </>
  );
}
