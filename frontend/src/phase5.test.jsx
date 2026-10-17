import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, mockApi, okRes, errRes, feedRes, post, USER } from './test-utils.jsx';

const trend = (tag, posts = 3, authors = 2) => ({ tag, posts, authors });
const person = (n, extra = {}) => ({
  id: `u${n}`, name: `Person ${n}`, username: `person_${n}`, bio: `bio ${n}`, avatar: '', followerCount: 4, followingCount: 2,
  createdAt: '2026-09-01T10:00:00Z', viewer: { isMe: false, following: false }, ...extra,
});
const usersRes = (users) => ({ ok: true, status: 200, json: async () => ({ success: true, data: { users } }) });
const notif = (id, type, extra = {}) => ({
  id, type, readAt: null, createdAt: new Date(Date.now() - 60000).toISOString(),
  actor: { id: '2', name: 'Rohan Verma', username: 'rohan_v', avatar: '' },
  post: type === 'follow' ? null : { id: 'p1', text: 'my post text' }, ...extra,
});
const notifsRes = (notifications, nextCursor = null) => ({ ok: true, status: 200, json: async () => ({ success: true, data: { notifications }, meta: { nextCursor } }) });
const params = (full) => new URLSearchParams(full.split('?')[1]);

const base = {
  'GET /auth/me': okRes({ user: USER }), 'GET /config': okRes({ postMaxLength: 280 }), 'GET /posts/feed': feedRes([]),
  'GET /search/trending': okRes({ trends: [] }), 'GET /users/suggestions': okRes({ users: [] }),
  'GET /notifications/unread-count': okRes({ unreadCount: 0 }),
};

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.clear();
});

describe('right sidebar (live data on every page)', () => {
  it('shows trends and suggestions, and Follow works from the sidebar', async () => {
    const calls = mockApi({
      ...base,
      'GET /search/trending': okRes({ trends: [trend('mern', 5, 3), trend('react', 1, 1)] }),
      'GET /users/suggestions': okRes({ users: [person(1), person(2)] }),
      'POST /users/person_1/follow': okRes({ following: true, followerCount: 5 }),
    });
    renderApp('/');
    const aside = within(await screen.findByRole('complementary', { name: /trends and suggestions/i }));
    expect(await aside.findByText('#mern')).toBeInTheDocument();
    expect(aside.getByText('5 posts · 3 people')).toBeInTheDocument();
    expect(aside.getByText('1 post')).toBeInTheDocument();
    expect(aside.getByRole('link', { name: /#mern/ })).toHaveAttribute('href', '/explore?q=%23mern');
    await userEvent.click(await aside.findByRole('button', { name: 'Follow @person_1' }));
    expect(await aside.findByRole('button', { name: 'Unfollow @person_1' })).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /users/person_1/follow')).toBe(true);
    expect(aside.getAllByRole('link', { name: 'Show more' })[0]).toHaveAttribute('href', '/explore');
  });

  it('has friendly empty states and a Retry button on errors (the page keeps working)', async () => {
    mockApi({ ...base, 'GET /search/trending': errRes(500, 'INTERNAL_ERROR', 'boom') });
    renderApp('/');
    const aside = within(await screen.findByRole('complementary', { name: /trends and suggestions/i }));
    expect(await aside.findByText(/no suggestions right now/i)).toBeInTheDocument();
    expect(await aside.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('shows the no-trends hint when nobody used a hashtag yet', async () => {
    mockApi(base);
    renderApp('/');
    expect(await screen.findByText(/no trends yet/i)).toBeInTheDocument();
  });
});

describe('Explore', () => {
  const searchRoutes = (extra = {}) => ({
    ...base,
    'GET /search/trending': okRes({ trends: [trend('react', 4, 2)] }),
    'GET /users/suggestions': okRes({ users: [person(9)] }),
    'GET /search': (opts, full) => {
      const p = params(full);
      if (p.get('type') === 'users') return usersRes([person(1), person(2)]);
      return feedRes([post(1, { text: `result for ${p.get('q')}` })]);
    },
    ...extra,
  });

  it('shows trending hashtags and people to follow when nothing is searched', async () => {
    mockApi(searchRoutes());
    renderApp('/explore');
    const trending = within((await screen.findByRole('heading', { name: 'Trending hashtags' })).closest('section'));
    expect(await trending.findByText('#react')).toBeInTheDocument();
    const who = within(within(screen.getByRole('main')).getByRole('heading', { name: 'Who to follow' }).closest('section'));
    expect(await who.findByText('Person 9')).toBeInTheDocument();
  });

  it('searches posts as you type, waiting for a pause (debounced) and using the final text', async () => {
    const calls = mockApi(searchRoutes());
    renderApp('/explore');
    await userEvent.type(await screen.findByRole('searchbox', { name: /search chirp/i }), 'react');
    expect(await screen.findByText('result for react')).toBeInTheDocument();
    const searchCalls = calls.filter((c) => c.key === 'GET /search');
    expect(searchCalls).toHaveLength(1);
    expect(params(searchCalls[0].full).get('q')).toBe('react');
    expect(params(searchCalls[0].full).get('type')).toBe('posts');
  });

  it('clicking a hashtag (in a post or the trends) searches for it', async () => {
    const calls = mockApi(searchRoutes());
    renderApp('/explore');
    const trending = within((await screen.findByRole('heading', { name: 'Trending hashtags' })).closest('section'));
    await userEvent.click(await trending.findByRole('link', { name: /#react/ }));
    expect(await screen.findByText('result for')).toBeInTheDocument(); // text + a #react link inside the post
    expect(screen.getByRole('searchbox', { name: /search chirp/i })).toHaveValue('#react');
    expect(params(calls.filter((c) => c.key === 'GET /search').at(-1).full).get('q')).toBe('#react');
  });

  it('a #hashtag inside a post links to its search', async () => {
    mockApi({ ...base, 'GET /posts/feed': feedRes([post(1, { text: 'love #mern', hashtags: ['mern'] })]) });
    renderApp('/');
    const tag = await screen.findByText('#mern', { selector: 'a.hashtag' });
    expect(tag).toHaveAttribute('href', '/explore?q=%23mern');
  });

  it('opens straight from a URL (?q=...) with the box pre-filled', async () => {
    mockApi(searchRoutes());
    renderApp('/explore?q=hello');
    expect(await screen.findByText('result for hello')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search chirp/i })).toHaveValue('hello');
    expect(screen.getByRole('tab', { name: 'Posts' })).toHaveAttribute('aria-selected', 'true');
  });

  it('People tab searches users and lets you follow from the results', async () => {
    const calls = mockApi(searchRoutes({ 'POST /users/person_1/follow': okRes({ following: true, followerCount: 5 }) }));
    renderApp('/explore?q=person');
    await screen.findByText('result for person');
    await userEvent.click(screen.getByRole('tab', { name: 'People' }));
    expect(await screen.findByText('Person 1')).toBeInTheDocument();
    expect(params(calls.filter((c) => c.key === 'GET /search').at(-1).full).get('type')).toBe('users');
    await userEvent.click(screen.getByRole('button', { name: 'Follow @person_1' }));
    expect(await screen.findByRole('button', { name: 'Unfollow @person_1' })).toBeInTheDocument();
  });

  it('shows "no results" states for posts and people', async () => {
    mockApi(searchRoutes({ 'GET /search': (opts, full) => (params(full).get('type') === 'users' ? usersRes([]) : feedRes([])) }));
    renderApp('/explore?q=zzz');
    expect(await screen.findByText('No posts found')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'People' }));
    expect(await screen.findByText('No people found')).toBeInTheDocument();
  });

  it('shows an error with "Try again" when search fails', async () => {
    let fail = true;
    mockApi(searchRoutes({ 'GET /search': () => (fail ? errRes(500, 'INTERNAL_ERROR', 'Search exploded') : feedRes([post(1, { text: 'recovered' })])) }));
    renderApp('/explore?q=oops');
    expect(await screen.findByText('Search exploded')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('recovered')).toBeInTheDocument();
  });

  it('Clear empties the box and returns to the Explore home', async () => {
    mockApi(searchRoutes());
    renderApp('/explore?q=hello');
    await screen.findByText('result for hello');
    await userEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(screen.getByRole('searchbox', { name: /search chirp/i })).toHaveValue('');
    expect(await screen.findByRole('heading', { name: 'Trending hashtags' })).toBeInTheDocument();
  });
});

describe('bookmarks', () => {
  it('bookmarks and un-bookmarks from a post, with a confirmation toast', async () => {
    const calls = mockApi({
      ...base, 'GET /posts/feed': feedRes([post(1)]),
      'POST /posts/p1/bookmark': okRes({ bookmarked: true }), 'DELETE /posts/p1/bookmark': okRes({ bookmarked: false }),
    });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Bookmark' }));
    const on = await screen.findByRole('button', { name: 'Remove bookmark' });
    expect(on).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('Saved to your bookmarks')).toBeInTheDocument();
    await userEvent.click(on);
    expect(await screen.findByRole('button', { name: 'Bookmark' })).toHaveAttribute('aria-pressed', 'false');
    expect(calls.some((c) => c.key === 'DELETE /posts/p1/bookmark')).toBe(true);
  });

  it('keeps the old state and shows an error toast when it fails', async () => {
    mockApi({ ...base, 'GET /posts/feed': feedRes([post(1)]), 'POST /posts/p1/bookmark': errRes(500, 'INTERNAL_ERROR', 'Save failed') });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Bookmark' }));
    expect(await screen.findByText('Save failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bookmark' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('the Bookmarks page lists saved posts, says they are private, and removing one takes it off the page', async () => {
    const saved = (n) => post(n, { viewer: { liked: false, reposted: false, bookmarked: true } });
    const calls = mockApi({
      ...base, 'GET /bookmarks': feedRes([saved(1), saved(2)]), 'DELETE /posts/p1/bookmark': okRes({ bookmarked: false }),
    });
    renderApp('/bookmarks');
    expect(await screen.findByText('post number 1')).toBeInTheDocument();
    expect(screen.getByText('Only you can see your bookmarks')).toBeInTheDocument();
    await userEvent.click(within(screen.getByTestId('post-p1')).getByRole('button', { name: 'Remove bookmark' }));
    await waitFor(() => expect(screen.queryByText('post number 1')).not.toBeInTheDocument());
    expect(screen.getByText('post number 2')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'DELETE /posts/p1/bookmark')).toBe(true);
  });

  it('shows an empty state with no bookmarks', async () => {
    mockApi({ ...base, 'GET /bookmarks': feedRes([]) });
    renderApp('/bookmarks');
    expect(await screen.findByText('No bookmarks yet')).toBeInTheDocument();
  });

  it('shows an error state with a retry', async () => {
    let fail = true;
    mockApi({ ...base, 'GET /bookmarks': () => (fail ? errRes(500, 'INTERNAL_ERROR', 'Nope') : feedRes([post(1)])) });
    renderApp('/bookmarks');
    expect(await screen.findByText('Nope')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('post number 1')).toBeInTheDocument();
  });
});

describe('notifications', () => {
  it('lists every kind with the right wording, snippet and link', async () => {
    mockApi({
      ...base,
      'GET /notifications': notifsRes([notif('n1', 'like'), notif('n2', 'repost'), notif('n3', 'reply', { post: { id: 'r1', text: 'nice post!' } }), notif('n4', 'follow')]),
    });
    renderApp('/notifications');
    expect(await screen.findByRole('link', { name: /liked your post/ })).toHaveAttribute('href', '/post/p1');
    expect(screen.getByRole('link', { name: /reposted your post/ })).toHaveAttribute('href', '/post/p1');
    expect(screen.getByRole('link', { name: /replied to your post/ })).toHaveAttribute('href', '/post/r1');
    expect(screen.getByText('nice post!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /followed you/ })).toHaveAttribute('href', '/rohan_v');
    expect(screen.getAllByText('Unread')).toHaveLength(4);
  });

  it('opening an unread notification marks it read and lowers the badge', async () => {
    const calls = mockApi({
      ...base,
      'GET /notifications/unread-count': okRes({ unreadCount: 2 }),
      'GET /notifications': notifsRes([notif('n1', 'like'), notif('n2', 'follow')]),
      'PATCH /notifications/n1/read': okRes({ read: true, unreadCount: 1 }),
      'GET /post/p1': okRes({}),
    });
    renderApp('/notifications');
    const nav = (await screen.findAllByRole('navigation', { name: 'Main' }))[0];
    expect(await within(nav).findByRole('link', { name: /notifications.*2 unread/i })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('link', { name: /liked your post/ }));
    await waitFor(() => expect(calls.some((c) => c.key === 'PATCH /notifications/n1/read')).toBe(true));
    expect(await within(nav).findByRole('link', { name: /notifications.*1 unread/i })).toBeInTheDocument();
  });

  it('"Mark all as read" clears everything and the badge', async () => {
    const calls = mockApi({
      ...base,
      'GET /notifications/unread-count': okRes({ unreadCount: 2 }),
      'GET /notifications': notifsRes([notif('n1', 'like'), notif('n2', 'follow')]),
      'PATCH /notifications/read-all': okRes({ updated: 2, unreadCount: 0 }),
    });
    renderApp('/notifications');
    await screen.findByRole('link', { name: /liked your post/ });
    const button = screen.getByRole('button', { name: 'Mark all as read' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() => expect(screen.queryAllByText('Unread')).toHaveLength(0));
    expect(button).toBeDisabled();
    expect(calls.some((c) => c.key === 'PATCH /notifications/read-all')).toBe(true);
    const nav = (await screen.findAllByRole('navigation', { name: 'Main' }))[0];
    expect(within(nav).getByRole('link', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('has an empty state, an error state with retry, and load more', async () => {
    mockApi({ ...base, 'GET /notifications': notifsRes([]) });
    const view = renderApp('/notifications');
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
    view.unmount();

    let fail = true;
    mockApi({ ...base, 'GET /notifications': () => (fail ? errRes(500, 'INTERNAL_ERROR', 'Nope') : notifsRes([notif('n1', 'like')])) });
    renderApp('/notifications');
    expect(await screen.findByText('Nope')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('link', { name: /liked your post/ })).toBeInTheDocument();
  });

  it('loads more notifications with the cursor', async () => {
    const calls = mockApi({
      ...base,
      'GET /notifications?limit=20': notifsRes([notif('n1', 'like')], 'c1'),
      'GET /notifications?limit=20&cursor=c1': notifsRes([notif('n2', 'follow')], null),
    });
    renderApp('/notifications');
    await screen.findByRole('link', { name: /liked your post/ });
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('link', { name: /followed you/ })).toBeInTheDocument();
    expect(calls.some((c) => c.full.includes('cursor=c1'))).toBe(true);
  });
});

describe('unread badge in the navigation', () => {
  it('shows the count, caps it at 9+, and is silent at zero', async () => {
    mockApi({ ...base, 'GET /notifications/unread-count': okRes({ unreadCount: 12 }) });
    const view = renderApp('/');
    const nav = (await screen.findAllByRole('navigation', { name: 'Main' }))[0];
    const link = await within(nav).findByRole('link', { name: /notifications.*12 unread/i });
    expect(within(link).getByText('9+')).toBeInTheDocument();
    view.unmount();

    mockApi(base);
    renderApp('/');
    const nav2 = (await screen.findAllByRole('navigation', { name: 'Main' }))[0];
    expect(await within(nav2).findByRole('link', { name: 'Notifications' })).toBeInTheDocument();
    expect(within(nav2).queryByText(/unread/)).not.toBeInTheDocument();
  });
});
