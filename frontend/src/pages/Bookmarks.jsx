import { useEffect } from 'react';
import PageHeader from './PageHeader.jsx';
import PostList from '../components/PostList.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePaginatedPosts } from '../hooks/usePaginatedPosts.js';
import { getBookmarks } from '../services/posts.js';

export default function Bookmarks() {
  const { user } = useAuth();
  const list = usePaginatedPosts(getBookmarks, 'bookmarks');

  useEffect(() => { document.title = 'Bookmarks / Chirp'; }, []);

  // Removing a bookmark takes the post off this page (the server has already confirmed it).
  const onUpdate = (id, patch) => (patch.viewer && patch.viewer.bookmarked === false ? list.remove(id) : list.update(id, patch));

  return (
    <>
      <PageHeader title="Bookmarks" subtitle="Only you can see your bookmarks" />
      <PostList
        list={list}
        me={user}
        onUpdate={onUpdate}
        onDelete={list.remove}
        emptyIcon="save"
        emptyTitle="No bookmarks yet"
        emptyMessage="Tap the bookmark icon on a post to save it here for later."
      />
    </>
  );
}
