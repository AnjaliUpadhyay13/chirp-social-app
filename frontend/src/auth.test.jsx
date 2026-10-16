import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, mockApi, okRes, errRes, feedRes, USER } from './test-utils.jsx';

const guest = { 'GET /auth/me': errRes(401, 'UNAUTHORIZED', 'Authentication required') };
const authed = { 'GET /auth/me': okRes({ user: USER }), 'GET /posts/feed': feedRes([]), 'GET /config': okRes({ postMaxLength: 280 }) };

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.clear();
});

describe('route protection', () => {
  it('redirects a guest from a private page to /login', async () => {
    mockApi(guest);
    renderApp('/bookmarks');
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows private pages to an authenticated user', async () => {
    mockApi(authed);
    renderApp('/bookmarks');
    expect(await screen.findByRole('heading', { name: 'Bookmarks' })).toBeInTheDocument();
  });

  it('redirects an authenticated user away from /login', async () => {
    mockApi(authed);
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('treats an unreachable server as logged out (no crash)', async () => {
    global.fetch = async () => { throw new TypeError('Failed to fetch'); };
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows a 404 page for unknown routes when logged in', async () => {
    mockApi(authed);
    renderApp('/does-not-exist');
    expect(await screen.findByText(/this page doesn't exist/i)).toBeInTheDocument();
  });

  it('renders the main nav with all destinations and marks the current page', async () => {
    mockApi(authed);
    renderApp('/explore');
    await screen.findByRole('heading', { name: 'Explore' });
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0];
    for (const label of ['Home', 'Explore', 'Notifications', 'Bookmarks', 'Profile']) expect(nav).toHaveTextContent(label);
    expect(within(nav).getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('login page', () => {
  it('validates empty fields on the client without calling the API', async () => {
    const calls = mockApi(guest);
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Email or username is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /auth/login')).toBe(false);
  });

  it('logs in and lands on Home', async () => {
    const calls = mockApi({ ...guest, 'POST /auth/login': okRes({ user: USER }), ...authed, 'GET /auth/me': errRes(401, 'UNAUTHORIZED', 'x') });
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email or username'), 'anjali@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /what's happening/i })).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'POST /auth/login').body).toEqual({ identifier: 'anjali@example.com', password: 'Passw0rd123' });
  });

  it('shows the server error for invalid credentials and stays on the page', async () => {
    mockApi({ ...guest, 'POST /auth/login': errRes(401, 'INVALID_CREDENTIALS', 'Invalid email/username or password') });
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email or username'), 'x@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email/username or password');
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    mockApi(guest);
    renderApp('/login');
    const input = await screen.findByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: /show/i }));
    expect(input).toHaveAttribute('type', 'text');
  });
});

describe('register page', () => {
  const fill = async (v) => {
    await userEvent.type(await screen.findByLabelText('Name'), v.name);
    await userEvent.type(screen.getByLabelText('Username'), v.username);
    await userEvent.type(screen.getByLabelText('Email'), v.email);
    await userEvent.type(screen.getByLabelText('Password'), v.password);
  };

  it('shows client validation errors for weak input', async () => {
    const calls = mockApi(guest);
    renderApp('/register');
    await fill({ name: 'A', username: 'a!', email: 'bad', password: 'short' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getByText(/username must be 3-20/i)).toBeInTheDocument();
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters$/i, { selector: '.field__error' })).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /auth/register')).toBe(false);
  });

  it('registers and lands on Home', async () => {
    mockApi({ ...guest, 'POST /auth/register': okRes({ user: USER }, 201), ...authed, 'GET /auth/me': errRes(401, 'UNAUTHORIZED', 'x') });
    renderApp('/register');
    await fill({ name: 'Anjali Upadhyay', username: 'anjali_u', email: 'anjali@example.com', password: 'Passw0rd123' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('maps server 409 details onto the right fields', async () => {
    mockApi({
      ...guest,
      'POST /auth/register': errRes(409, 'CONFLICT', 'Account already exists', [
        { field: 'email', message: 'An account with this email already exists' },
        { field: 'username', message: 'This username is taken' },
      ]),
    });
    renderApp('/register');
    await fill({ name: 'Anjali', username: 'anjali_u', email: 'anjali@example.com', password: 'Passw0rd123' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByText('This username is taken')).toBeInTheDocument();
    expect(screen.getByText('An account with this email already exists')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('logout', () => {
  it('logs out from the account menu and returns to /login', async () => {
    const calls = mockApi({ ...authed, 'POST /auth/logout': okRes({ loggedOut: true }) });
    renderApp('/');
    await screen.findByRole('heading', { name: 'Home' });
    await userEvent.click(screen.getAllByRole('button', { name: /account menu/i })[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: /log out/i }));
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /auth/logout')).toBe(true));
  });
});
