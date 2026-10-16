// Compact relative time: now, 5s, 12m, 3h, 2d, then "Oct 15" / "Oct 15, 2025"
export function timeAgo(iso, now = Date.now()) {
  const then = new Date(iso);
  const s = Math.max(0, Math.floor((now - then.getTime()) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const sameYear = then.getFullYear() === new Date(now).getFullYear();
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export const fullDate = (iso) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
