import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, mockApi, okRes, errRes, feedRes, post, USER } from './test-utils.jsx';

const base = { 'GET /auth/me': okRes({ user: USER }), 'GET /config': okRes({ postMaxLength: 280 }), 'GET /posts/feed': feedRes([]) };

const profile = (extra = {}) => ({
  id: '2', name: 'Rohan Verma', username: 'rohan_v', bio: 'Backend dev from Lucknow', avatar: '',
  followerCount: 5, followingCount: 3, createdAt: '2026-09-01T10:00:00Z', ...extra,
  viewer: { isMe: false, following: false, followedBy: false, ...(extra.viewer || {}) },
});
const myProfile = (extra = {}) => profile({ id: '1', name: 'Anjali Upadhyay', username: 'anjali_u', bio: 'Full-stack dev', ...extra, viewer: { isMe: true, following: false, followedBy: false } });
const usersRes = (users, nextCursor = null) => ({ ok: true, status: 200, json: async () => ({ success: true, data: { users }, meta: { nextCursor } }) });
const row = (n, extra = {}) => ({ ...profile({ id: `u${n}`, name: `Person ${n}`, username: `person_${n}`, bio: `bio ${n}` }), ...extra });

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.clear();
});

describe('navigation', () => {
  it('the Profile nav link points at your own profile', async () => {
    mockApi(base);
    renderApp('/');
    await screen.findByRole('heading', { name: 'Home' });
    expect(screen.getAllByRole('link', { name: 'Profile' })[0]).toHaveAttribute('href', '/anjali_u');
  });

  it('/profile redirects to /<your username>', async () => {
    mockApi({ ...base, 'GET /users/anjali_u': okRes({ user: myProfile() }), 'GET /users/anjali_u/posts': feedRes([]) });
    renderApp('/profile');
    expect(await screen.findByRole('heading', { level: 2, name: 'Anjali Upadhyay' })).toBeInTheDocument();
  });

  it('unknown multi-segment URLs and impossible usernames show the generic 404 page', async () => {
    mockApi(base);
    renderApp('/a/b/c');
    expect(await screen.findByText(/this page doesn't exist/i)).toBeInTheDocument();
  });

  it('a malformed username never hits the API', async () => {
    const calls = mockApi(base);
    renderApp('/ab');
    expect(await screen.findByText(/this page doesn't exist/i)).toBeInTheDocument();
    expect(calls.some((c) => c.key.startsWith('GET /users/'))).toBe(false);
  });
});

describe('profile page', () => {
  const others = { ...base, 'GET /users/rohan_v': okRes({ user: profile() }), 'GET /users/rohan_v/posts': feedRes([post(1)]) };

  it("shows another person's profile with a Follow button and counts", async () => {
    mockApi(others);
    renderApp('/rohan_v');
    expect(await screen.findByRole('heading', { level: 2, name: 'Rohan Verma' })).toBeInTheDocument();
    const header = within(screen.getByRole('region', { name: 'Profile of Rohan Verma' }));
    expect(header.getByText('@rohan_v')).toBeInTheDocument();
    expect(header.getByText('Backend dev from Lucknow')).toBeInTheDocument();
    expect(screen.getByText(/Joined September 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /3 following/i })).toHaveAttribute('href', '/rohan_v/following');
    expect(screen.getByRole('link', { name: /5 followers/i })).toHaveAttribute('href', '/rohan_v/followers');
    expect(screen.getByRole('button', { name: 'Follow @rohan_v' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
    expect(await screen.findByText('post number 1')).toBeInTheDocument();
  });

  it('your own profile has Edit profile and no Follow button', async () => {
    mockApi({ ...base, 'GET /users/anjali_u': okRes({ user: myProfile() }), 'GET /users/anjali_u/posts': feedRes([]) });
    renderApp('/anjali_u');
    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^follow/i })).not.toBeInTheDocument();
    expect(await screen.findByText("You haven't posted yet")).toBeInTheDocument();
  });

  it('shows a "Follows you" badge', async () => {
    mockApi({ ...others, 'GET /users/rohan_v': okRes({ user: profile({ viewer: { followedBy: true } }) }) });
    renderApp('/rohan_v');
    expect(await screen.findByText('Follows you')).toBeInTheDocument();
  });

  it('shows a friendly state for an account that does not exist', async () => {
    mockApi({ ...base, 'GET /users/ghost_user': errRes(404, 'NOT_FOUND', 'User not found'), 'GET /users/ghost_user/posts': errRes(404, 'NOT_FOUND', 'User not found') });
    renderApp('/ghost_user');
    expect(await screen.findByText("This account doesn't exist")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('switches between Posts and Replies tabs (with "Replying to")', async () => {
    const calls = mockApi({
      ...others,
      'GET /users/rohan_v/replies': feedRes([post(7, { text: 'my reply here', replyTo: 'p1', replyingTo: 'anjali_u' })]),
    });
    renderApp('/rohan_v');
    await screen.findByText('post number 1');
    await userEvent.click(screen.getByRole('tab', { name: 'Replies' }));
    expect(await screen.findByText('my reply here')).toBeInTheDocument();
    expect(screen.getByText('Replying to')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '@anjali_u' })).toHaveAttribute('href', '/anjali_u');
    expect(screen.queryByText('post number 1')).not.toBeInTheDocument();
    expect(calls.some((c) => c.key === 'GET /users/rohan_v/replies')).toBe(true);
    expect(screen.getByRole('tab', { name: 'Replies' })).toHaveAttribute('aria-selected', 'true');
  });

  it('tabs work with the keyboard (ArrowRight)', async () => {
    mockApi({ ...others, 'GET /users/rohan_v/replies': feedRes([]) });
    renderApp('/rohan_v');
    await screen.findByText('post number 1');
    screen.getByRole('tab', { name: 'Posts' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Replies' })).toHaveAttribute('aria-selected', 'true');
  });

  it('labels reposts ("X reposted" / "You reposted") and renders the same post twice when needed', async () => {
    const reposter = { id: '3', name: 'Sara Khan', username: 'sara_k', avatar: '' };
    mockApi({
      ...others,
      'GET /users/rohan_v/posts': feedRes([
        post(1, { feedId: 'f3', repostedBy: reposter }),
        post(1, { feedId: 'f2', repostedBy: { id: '1', name: 'Anjali Upadhyay', username: 'anjali_u', avatar: '' } }),
        post(1, { feedId: 'f1' }),
      ]),
    });
    renderApp('/rohan_v');
    expect(await screen.findByText(/Sara Khan/, { selector: 'a' })).toBeInTheDocument();
    expect(screen.getByText('You', { selector: 'a' })).toBeInTheDocument();
    expect(screen.getAllByText('post number 1')).toHaveLength(3);
  });

  it('liking one copy of a reposted post updates every copy', async () => {
    mockApi({
      ...others,
      'GET /users/rohan_v/posts': feedRes([
        post(1, { feedId: 'f2', repostedBy: { id: '3', name: 'Sara Khan', username: 'sara_k', avatar: '' } }),
        post(1, { feedId: 'f1' }),
      ]),
      'POST /posts/p1/like': okRes({ liked: true, likeCount: 1 }),
    });
    renderApp('/rohan_v');
    await screen.findAllByRole('button', { name: /^like, 0 likes/i });
    await userEvent.click(screen.getAllByRole('button', { name: /^like, 0 likes/i })[0]);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^unlike, 1 likes/i })).toHaveLength(2));
  });
});

describe('follow / unfollow', () => {
  const setup = (routes = {}, user = {}) => mockApi({
    ...base, 'GET /users/rohan_v': okRes({ user: profile(user) }), 'GET /users/rohan_v/posts': feedRes([]), ...routes,
  });

  it('follows optimistically and syncs the follower count from the server', async () => {
    const calls = setup({ 'POST /users/rohan_v/follow': okRes({ following: true, followerCount: 6 }) });
    renderApp('/rohan_v');
    await userEvent.click(await screen.findByRole('button', { name: 'Follow @rohan_v' }));
    expect(await screen.findByRole('button', { name: 'Unfollow @rohan_v' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /6 followers/i })).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /users/rohan_v/follow')).toBe(true);
  });

  it('unfollows with DELETE and lowers the count', async () => {
    const calls = setup({ 'DELETE /users/rohan_v/follow': okRes({ following: false, followerCount: 4 }) }, { viewer: { following: true } });
    renderApp('/rohan_v');
    await userEvent.click(await screen.findByRole('button', { name: 'Unfollow @rohan_v' }));
    expect(await screen.findByRole('button', { name: 'Follow @rohan_v' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /4 followers/i })).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'DELETE /users/rohan_v/follow')).toBe(true);
  });

  it('rolls back and shows an error toast if the request fails', async () => {
    setup({ 'POST /users/rohan_v/follow': errRes(500, 'INTERNAL_ERROR', 'Follow failed') });
    renderApp('/rohan_v');
    await userEvent.click(await screen.findByRole('button', { name: 'Follow @rohan_v' }));
    expect(await screen.findByText('Follow failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow @rohan_v' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('link', { name: /5 followers/i })).toBeInTheDocument();
  });
});

describe('edit profile', () => {
  const setup = (routes = {}) => mockApi({
    ...base, 'GET /users/anjali_u': okRes({ user: myProfile() }), 'GET /users/anjali_u/posts': feedRes([]), ...routes,
  });
  const openModal = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
    return screen.findByRole('dialog', { name: 'Edit profile' });
  };

  it('opens pre-filled, saves only the changed fields and updates the page', async () => {
    const calls = setup({ 'PATCH /users/me': okRes({ user: { ...USER, name: 'Anjali Upadhyay', bio: 'New bio', avatar: '' } }) });
    renderApp('/anjali_u');
    const dialog = await openModal();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Anjali Upadhyay');
    expect(within(dialog).getByLabelText('Bio')).toHaveValue('Full-stack dev');
    const bio = within(dialog).getByLabelText('Bio');
    await userEvent.clear(bio);
    await userEvent.type(bio, 'New bio');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('New bio')).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'PATCH /users/me').body).toEqual({ bio: 'New bio' });
    expect(screen.getByText('Profile updated')).toBeInTheDocument();
  });

  it('closing without changes sends nothing', async () => {
    const calls = setup();
    renderApp('/anjali_u');
    const dialog = await openModal();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.key === 'PATCH /users/me')).toBe(false);
  });

  it('validates the name, the bio length and the avatar URL on the client', async () => {
    const calls = setup();
    renderApp('/anjali_u');
    const dialog = await openModal();
    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.click(within(dialog).getByLabelText('Bio'));
    await userEvent.paste('x'.repeat(161));
    await userEvent.type(within(dialog).getByLabelText('Avatar image URL'), 'javascript:alert(1)');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText(/at most 160 characters/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/http\(s\) image URL/i)).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'PATCH /users/me')).toBe(false);
  });

  it('shows server-side field errors inside the dialog and keeps it open', async () => {
    setup({ 'PATCH /users/me': errRes(400, 'VALIDATION_ERROR', 'Invalid request data', [{ field: 'avatar', message: 'Avatar must be an http(s) image URL' }]) });
    renderApp('/anjali_u');
    const dialog = await openModal();
    await userEvent.type(within(dialog).getByLabelText('Avatar image URL'), 'https://example.com/x.png');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Avatar must be an http(s) image URL')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Escape closes the dialog', async () => {
    setup();
    renderApp('/anjali_u');
    await openModal();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('followers / following pages', () => {
  it('lists followers with Follow buttons (none on your own row) and follows from the list', async () => {
    const calls = mockApi({
      ...base,
      'GET /users/rohan_v': okRes({ user: profile() }),
      'GET /users/rohan_v/followers': usersRes([row(1), row(2, { viewer: { isMe: false, following: true } }), row(3, { id: '1', name: 'Anjali Upadhyay', username: 'anjali_u', viewer: { isMe: true, following: false } })]),
      'POST /users/person_1/follow': okRes({ following: true, followerCount: 6 }),
    });
    renderApp('/rohan_v/followers');
    expect(await screen.findByText('Person 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unfollow @person_2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /@anjali_u/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Follow @person_1' }));
    expect(await screen.findByRole('button', { name: 'Unfollow @person_1' })).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /users/person_1/follow')).toBe(true);
  });

  it('shows the following tab, an empty state, and switches tabs via routes', async () => {
    mockApi({
      ...base,
      'GET /users/rohan_v': okRes({ user: profile() }),
      'GET /users/rohan_v/followers': usersRes([row(1)]),
      'GET /users/rohan_v/following': usersRes([]),
    });
    renderApp('/rohan_v/followers');
    await screen.findByText('Person 1');
    await userEvent.click(screen.getByRole('tab', { name: 'Following' }));
    expect(await screen.findByText('Not following anyone yet')).toBeInTheDocument();
  });

  it('loads more people with the cursor', async () => {
    const calls = mockApi({
      ...base,
      'GET /users/rohan_v': okRes({ user: profile() }),
      'GET /users/rohan_v/followers?limit=20': usersRes([row(1)], 'c1'),
      'GET /users/rohan_v/followers?limit=20&cursor=c1': usersRes([row(2)], null),
    });
    renderApp('/rohan_v/followers');
    await screen.findByText('Person 1');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Person 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.full.includes('cursor=c1'))).toBe(true);
  });

  it('opens from the counts on a profile', async () => {
    mockApi({
      ...base,
      'GET /users/rohan_v': okRes({ user: profile() }), 'GET /users/rohan_v/posts': feedRes([]),
      'GET /users/rohan_v/followers': usersRes([row(1)]),
    });
    renderApp('/rohan_v');
    await userEvent.click(await screen.findByRole('link', { name: /5 followers/i }));
    expect(await screen.findByText('Person 1')).toBeInTheDocument();
  });
});

describe('Home timelines', () => {
  it('"For you" is the default and does not send a scope', async () => {
    const calls = mockApi({ ...base, 'GET /posts/feed': feedRes([post(1)]) });
    renderApp('/');
    await screen.findByText('post number 1');
    expect(screen.getByRole('tab', { name: 'For you' })).toHaveAttribute('aria-selected', 'true');
    expect(calls.find((c) => c.key === 'GET /posts/feed').full).toBe('GET /posts/feed?limit=20');
  });

  it('the Following tab loads the following timeline and has its own empty state', async () => {
    const calls = mockApi({
      ...base,
      'GET /posts/feed?limit=20': feedRes([post(1)]),
      'GET /posts/feed?limit=20&scope=following': feedRes([]),
    });
    renderApp('/');
    await screen.findByText('post number 1');
    await userEvent.click(screen.getByRole('tab', { name: 'Following' }));
    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.queryByText('post number 1')).not.toBeInTheDocument();
    expect(calls.some((c) => c.full.includes('scope=following'))).toBe(true);
  });
});
