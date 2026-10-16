const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 4.4 12.4l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4z',
  bell: 'M12 3a6 6 0 0 0-6 6v3.5L4 16v1h16v-1l-2-3.5V9a6 6 0 0 0-6-6zm-2 16a2 2 0 0 0 4 0z',
  bookmark: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9a8 8 0 0 1 16 0z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM5.6 19.8l-1.4-1.4 2.1-2.1 1.4 1.4zM17.7 7.7l-1.4-1.4 2.1-2.1 1.4 1.4z',
  moon: 'M21 13.5A9 9 0 0 1 10.5 3 9 9 0 1 0 21 13.5z',
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L21 7.5l-1.4-1.4z',
  alert: 'M12 2 1 21h22zm-1 7h2v6h-2zm0 8h2v2h-2z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v2h-2zm0 4h2v6h-2z',
  close: 'M6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z',
  logo: 'M5 7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5v5a3.5 3.5 0 0 1-3.5 3.5H12l-4.5 4v-4h0A3.5 3.5 0 0 1 5 12.5z',
  refresh: 'M12 4a8 8 0 0 0-7.7 6h2.1A6 6 0 0 1 12 6c1.7 0 3.2.7 4.3 1.8L13 11h7V4l-2.6 2.6A7.9 7.9 0 0 0 12 4zm7.7 10a8 8 0 0 1-13.4 2.4L4 19v-7h7l-3.3 3.3A6 6 0 0 0 17.6 14z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  comment: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  trash: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  back: 'M19 12H5M12 19l-7-7 7-7',
  inbox: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v8h4l1 2h4l1-2h4V6z',
};

// Icons drawn as outlines (stroke) instead of filled shapes. `filled` fills the heart when liked.
const STROKE = new Set(['heart', 'comment', 'repeat', 'trash', 'more', 'back']);

export function Icon({ name, size = 22, className = '', filled = false, ...rest }) {
  const stroke = STROKE.has(name);
  const strokeProps = stroke
    ? { fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: name === 'more' ? 3 : 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
    : { fill: 'currentColor' };
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...strokeProps}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name] || PATHS.info} />
    </svg>
  );
}
