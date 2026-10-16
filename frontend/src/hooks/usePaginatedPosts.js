import { useCallback, useEffect, useRef, useState } from 'react';

// Cursor-paginated list with load-more and local edit helpers (posts by default; itemsKey: 'users' for user lists).
// fetchPage(cursor, signal) must resolve to { data: { [itemsKey]: [...] }, meta: { nextCursor } }.
// Timeline entries carry a unique `feedId` (a post can appear as an original and as a repost); otherwise `id` is used.
const keyOf = (p) => p.feedId ?? p.id;

export function usePaginatedPosts(fetchPage, key, itemsKey = 'posts') {
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const [state, setState] = useState({ items: [], status: 'loading', nextCursor: null, loadingMore: false, error: null, loadMoreError: null });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ items: [], status: 'loading', nextCursor: null, loadingMore: false, error: null, loadMoreError: null });
    fetchRef.current(null, controller.signal)
      .then((res) => setState({ items: res.data[itemsKey], status: 'ready', nextCursor: res.meta?.nextCursor ?? null, loadingMore: false, error: null, loadMoreError: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState((s) => ({ ...s, status: 'error', error }));
      });
    return () => controller.abort();
  }, [key, attempt]);

  const loadMore = useCallback(async () => {
    const { nextCursor, loadingMore } = stateRef.current;
    if (!nextCursor || loadingMore) return;
    setState((s) => ({ ...s, loadingMore: true, loadMoreError: null }));
    try {
      const res = await fetchRef.current(nextCursor);
      setState((s) => {
        const seen = new Set(s.items.map(keyOf));
        return { ...s, items: [...s.items, ...res.data[itemsKey].filter((p) => !seen.has(keyOf(p)))], nextCursor: res.meta?.nextCursor ?? null, loadingMore: false };
      });
    } catch (loadMoreError) {
      setState((s) => ({ ...s, loadingMore: false, loadMoreError }));
    }
  }, []);

  const prepend = useCallback((post) => setState((s) => (s.items.some((p) => keyOf(p) === keyOf(post)) ? s : { ...s, items: [post, ...s.items] })), []);
  // Newest-last lists (replies): only append locally when everything is already loaded, otherwise order would be wrong.
  const append = useCallback((post) => setState((s) => (s.nextCursor || s.items.some((p) => keyOf(p) === keyOf(post)) ? s : { ...s, items: [...s.items, post] })), []);
  const update = useCallback((id, patch) => setState((s) => ({ ...s, items: s.items.map((p) => (p.id === id ? { ...p, ...patch } : p)) })), []);
  const remove = useCallback((id) => setState((s) => ({ ...s, items: s.items.filter((p) => p.id !== id) })), []);

  return { ...state, hasMore: Boolean(state.nextCursor), loadMore, retry: () => setAttempt((a) => a + 1), prepend, append, update, remove };
}
