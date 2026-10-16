import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../context/ThemeContext.jsx';
import { ToastProvider, useToast } from '../context/ToastContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Avatar from './Avatar.jsx';
import ErrorState from './ErrorState.jsx';

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.clear();
});

describe('ThemeToggle', () => {
  it('switches theme and persists it', async () => {
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    await userEvent.click(screen.getByRole('button', { name: /switch to dark mode/i }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('chirp-theme')).toBe('dark');
  });
});

describe('Avatar', () => {
  it('shows initials when there is no image', () => {
    render(<Avatar name="Anjali Upadhyay" />);
    expect(screen.getByRole('img', { name: /anjali upadhyay/i })).toHaveTextContent('AU');
  });
});

describe('ErrorState', () => {
  it('calls onRetry', async () => {
    let called = false;
    render(<ErrorState message="boom" onRetry={() => { called = true; }} />);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(called).toBe(true);
  });
});

describe('Toast', () => {
  it('renders and dismisses a toast', async () => {
    function Trigger() { const t = useToast(); return <button onClick={() => t.success('Saved!')}>go</button>; }
    render(<ToastProvider><Trigger /></ToastProvider>);
    await userEvent.click(screen.getByText('go'));
    expect(screen.getByText('Saved!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });
});
