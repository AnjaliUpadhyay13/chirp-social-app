import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, mockApi, okRes, errRes, feedRes, post, mine, USER } from './test-utils.jsx';
import { timeAgo } from './utils/time.js';
import { splitHashtags, charCount } from './utils/text.js';

const base = { 'GET /auth/me': okRes({ user: USER }), 'GET /config': okRes({ postMaxLength: 280 }) };

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.clear();
});

describe('utils', () => {
  const now = new Date('2026-10-15T12:00:00Z').getTime();
  it('timeAgo formats compactly', () => {
    expect(timeAgo('2026-10-15T11:59:58Z', now)).toBe('now');
    expect(timeAgo('2026-10-15T11:59:30Z', now)).toBe('30s');
    expect(timeAgo('2026-10-15T11:45:00Z', now)).toBe('15m');
    expect(timeAgo('2026-10-15T09:00:00Z', now)).toBe('3h');
    expect(timeAgo('2026-10-12T12:00:00Z', now)).toBe('3d');
    expect(timeAgo('2026-08-01T12:00:00Z', now)).toMatch(/Aug 1/);
    expect(timeAgo('2025-08-01T12:00:00Z', now)).toMatch(/2025/);
  });
  it('splitHashtags separates tags (incl. Hindi) from text', () => {
    expect(splitHashtags('hi #React and #हिंदी!')).toEqual([
      { type: 'text', value: 'hi ' }, { type: 'tag', value: '#React' },
      { type: 'text', value: ' and ' }, { type: 'tag', value: '#हिंदी' }, { type: 'text', value: '!' },
    ]);
    expect(splitHashtags('no tags here a#b')).toEqual([{ type: 'text', value: 'no tags here a#b' }]);
  });
  it('charCount counts emoji as one character', () => {
    expect(charCount('😀😀a')).toBe(3);
  });
});

describe('Home feed', () => {
  it('shows a loading skeleton, then the posts from the API', async () => {
    mockApi({ ...base, 'GET /posts/feed': feedRes([post(1), post(2)]) });
    renderApp('/');
    expect(await screen.findByText('post number 1')).toBeInTheDocument();
    expect(screen.getByText('post number 2')).toBeInTheDocument();
    expect(screen.getAllByText('@rohan_v')).toHaveLength(2);
    expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no posts', async () => {
    mockApi({ ...base, 'GET /posts/feed': feedRes([]) });
    renderApp('/');
    expect(await screen.findByText('No posts yet')).toBeInTheDocument();
  });

  it('shows an error state and recovers with "Try again"', async () => {
    let fail = true;
    mockApi({ ...base, 'GET /posts/feed': () => (fail ? errRes(500, 'INTERNAL_ERROR', 'Server exploded') : feedRes([post(1)])) });
    renderApp('/');
    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('post number 1')).toBeInTheDocument();
  });

  it('loads more with the cursor and appends without duplicates', async () => {
    const calls = mockApi({
      ...base,
      'GET /posts/feed?limit=20': feedRes([post(1), post(2)], 'cursor-2'),
      'GET /posts/feed?limit=20&cursor=cursor-2': feedRes([post(2), post(3)], null),
    });
    renderApp('/');
    await screen.findByText('post number 1');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('post number 3')).toBeInTheDocument();
    expect(screen.getAllByText('post number 2')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.full.includes('cursor=cursor-2'))).toBe(true);
  });

  it('renders #hashtags highlighted', async () => {
    mockApi({ ...base, 'GET /posts/feed': feedRes([post(1, { text: 'learning #react today' })]) });
    renderApp('/');
    const tag = await screen.findByText('#react');
    expect(tag).toHaveClass('hashtag');
  });
});

describe('Composer', () => {
  const setup = async (extra = {}) => {
    const calls = mockApi({ ...base, 'GET /posts/feed': feedRes([]), ...extra });
    renderApp('/');
    const box = await screen.findByRole('textbox', { name: /what's happening/i });
    return { calls, box, submit: screen.getByRole('button', { name: 'Post' }) };
  };

  it('disables Post when empty or whitespace-only', async () => {
    const { box, submit } = await setup();
    expect(submit).toBeDisabled();
    await userEvent.type(box, '   ');
    expect(submit).toBeDisabled();
    await userEvent.type(box, 'hello');
    expect(submit).toBeEnabled();
  });

  it('shows the remaining count near the limit and blocks posting over the limit', async () => {
    const { box, submit } = await setup();
    await userEvent.click(box);
    await userEvent.paste('a'.repeat(270));
    expect(screen.getByText('10', { selector: '.counter__num' })).toBeInTheDocument();
    expect(submit).toBeEnabled();
    await userEvent.paste('b'.repeat(15));
    expect(screen.getByText('-5', { selector: '.counter__num' })).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });

  it('publishes a post: calls the API, clears the box and shows it at the top of the feed', async () => {
    const created = mine(9, { text: 'my brand new post' });
    const { calls, box, submit } = await setup({ 'POST /posts': okRes({ post: created }, 201) });
    await userEvent.type(box, '  my brand new post ');
    await userEvent.click(submit);
    expect(await screen.findByText('my brand new post')).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'POST /posts').body).toEqual({ text: 'my brand new post' });
    expect(box).toHaveValue('');
    expect(screen.queryByText('No posts yet')).not.toBeInTheDocument();
  });

  it('keeps the text and shows the error when publishing fails', async () => {
    const { box, submit } = await setup({ 'POST /posts': errRes(500, 'INTERNAL_ERROR', 'Could not save') });
    await userEvent.type(box, 'important draft');
    await userEvent.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
    expect(box).toHaveValue('important draft');
  });

  it('submits with Ctrl+Enter', async () => {
    const { calls, box } = await setup({ 'POST /posts': okRes({ post: mine(8, { text: 'via keyboard' }) }, 201) });
    await userEvent.type(box, 'via keyboard');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /posts')).toBe(true));
  });
});

describe('likes and reposts', () => {
  it('likes optimistically, then syncs the count from the server', async () => {
    const calls = mockApi({ ...base, 'GET /posts/feed': feedRes([post(1, { likeCount: 2 })]), 'POST /posts/p1/like': okRes({ liked: true, likeCount: 3 }) });
    renderApp('/');
    const btn = await screen.findByRole('button', { name: /^like, 2 likes/i });
    await userEvent.click(btn);
    const liked = await screen.findByRole('button', { name: /^unlike, 3 likes/i });
    expect(liked).toHaveAttribute('aria-pressed', 'true');
    expect(calls.some((c) => c.key === 'POST /posts/p1/like')).toBe(true);
  });

  it('unlikes with DELETE', async () => {
    const calls = mockApi({ ...base, 'GET /posts/feed': feedRes([post(1, { likeCount: 1, viewer: { liked: true, reposted: false } })]), 'DELETE /posts/p1/like': okRes({ liked: false, likeCount: 0 }) });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /^unlike/i }));
    expect(await screen.findByRole('button', { name: /^like, 0 likes/i })).toHaveAttribute('aria-pressed', 'false');
    expect(calls.some((c) => c.key === 'DELETE /posts/p1/like')).toBe(true);
  });

  it('rolls back and shows an error toast when the like fails', async () => {
    mockApi({ ...base, 'GET /posts/feed': feedRes([post(1, { likeCount: 2 })]), 'POST /posts/p1/like': errRes(500, 'INTERNAL_ERROR', 'Like failed') });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /^like, 2 likes/i }));
    expect(await screen.findByText('Like failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^like, 2 likes/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reposts and undoes a repost', async () => {
    mockApi({
      ...base,
      'GET /posts/feed': feedRes([post(1)]),
      'POST /posts/p1/repost': okRes({ reposted: true, repostCount: 1 }),
      'DELETE /posts/p1/repost': okRes({ reposted: false, repostCount: 0 }),
    });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /^repost, 0 reposts/i }));
    const undo = await screen.findByRole('button', { name: /^undo repost, 1 reposts/i });
    expect(undo).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(undo);
    expect(await screen.findByRole('button', { name: /^repost, 0 reposts/i })).toBeInTheDocument();
  });
});

describe('deleting posts', () => {
  it('shows the menu only on your own posts', async () => {
    mockApi({ ...base, 'GET /posts/feed': feedRes([mine(1), post(2)]) });
    renderApp('/');
    await screen.findByText('post number 1');
    expect(screen.getAllByRole('button', { name: /more options/i })).toHaveLength(1);
    const card = screen.getByTestId('post-p1');
    expect(within(card).getByRole('button', { name: /more options/i })).toBeInTheDocument();
  });

  it('confirms in a dialog, calls DELETE and removes the post', async () => {
    const calls = mockApi({ ...base, 'GET /posts/feed': feedRes([mine(1), post(2)]), 'DELETE /posts/p1': okRes({ deleted: true, removed: 1 }) });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /more options/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /delete post/i }));
    const dialog = await screen.findByRole('dialog', { name: /delete this post/i });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('post number 1')).not.toBeInTheDocument());
    expect(calls.some((c) => c.key === 'DELETE /posts/p1')).toBe(true);
    expect(screen.getByText('post number 2')).toBeInTheDocument();
  });

  it('Cancel (and Escape) close the dialog without deleting', async () => {
    const calls = mockApi({ ...base, 'GET /posts/feed': feedRes([mine(1)]) });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /more options/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /delete post/i }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /delete post/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false);
    expect(screen.getByText('post number 1')).toBeInTheDocument();
  });

  it('keeps the post and shows an error if the server refuses (e.g. 403)', async () => {
    mockApi({ ...base, 'GET /posts/feed': feedRes([mine(1)]), 'DELETE /posts/p1': errRes(403, 'FORBIDDEN', 'You can only delete your own posts') });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /more options/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /delete post/i }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('You can only delete your own posts')).toBeInTheDocument();
    expect(screen.getByText('post number 1')).toBeInTheDocument();
  });
});

describe('post detail and replies', () => {
  const root = post(1, { text: 'the root post' });
  const parent = post(2, { text: 'middle of the thread', replyTo: 'p1', rootPost: 'p1' });
  const main = post(3, { text: 'the post we opened', replyTo: 'p2', rootPost: 'p1', replyCount: 1 });
  const reply = post(4, { text: 'first reply', replyTo: 'p3', rootPost: 'p1' });

  it('clicking a post in the feed opens its page', async () => {
    mockApi({ ...base, 'GET /posts/feed': feedRes([post(3)]), 'GET /posts/p3': okRes({ post: main, ancestors: [] }), 'GET /posts/p3/replies': feedRes([]) });
    renderApp('/');
    await userEvent.click(await screen.findByText('post number 3'));
    expect(await screen.findByRole('textbox', { name: /reply to @rohan_v/i })).toBeInTheDocument();
  });

  it('shows ancestors (root first), the post and its replies', async () => {
    mockApi({ ...base, 'GET /posts/p3': okRes({ post: main, ancestors: [root, parent] }), 'GET /posts/p3/replies': feedRes([reply]) });
    renderApp('/post/p3');
    await screen.findByText('the post we opened');
    const texts = screen.getAllByText(/root post|middle of the thread|the post we opened|first reply/).map((n) => n.textContent);
    expect(texts).toEqual(['the root post', 'middle of the thread', 'the post we opened', 'first reply']);
  });

  it('posts a reply, shows it and bumps the reply count', async () => {
    const calls = mockApi({
      ...base,
      'GET /posts/p3': okRes({ post: main, ancestors: [] }),
      'GET /posts/p3/replies': feedRes([]),
      'POST /posts/p3/replies': okRes({ post: mine(5, { text: 'my reply', replyTo: 'p3' }) }, 201),
    });
    renderApp('/post/p3');
    await userEvent.type(await screen.findByRole('textbox', { name: /reply to @rohan_v/i }), 'my reply');
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(await screen.findByText('my reply')).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'POST /posts/p3/replies').body).toEqual({ text: 'my reply' });
    expect(screen.getByRole('button', { name: /^reply, 2 replies/i })).toBeInTheDocument();
  });

  it('shows a friendly not-found state for a missing post', async () => {
    mockApi({ ...base, 'GET /posts/missing': errRes(404, 'NOT_FOUND', 'Post not found'), 'GET /posts/missing/replies': errRes(404, 'NOT_FOUND', 'Post not found') });
    renderApp('/post/missing');
    expect(await screen.findByText("This post doesn't exist")).toBeInTheDocument();
  });

  it('shows the empty state when there are no replies', async () => {
    mockApi({ ...base, 'GET /posts/p3': okRes({ post: { ...main, replyCount: 0 }, ancestors: [] }), 'GET /posts/p3/replies': feedRes([]) });
    renderApp('/post/p3');
    expect(await screen.findByText('No replies yet')).toBeInTheDocument();
  });
});
