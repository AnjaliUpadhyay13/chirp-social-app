const COLORS = ['#ea580c', '#2563eb', '#059669', '#7c3aed', '#dc2626', '#0d9488', '#c2410c'];

// Deterministic colour + initials fallback; shows the image when `src` is provided.
export default function Avatar({ name = '?', src, size = 44 }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  const color = COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (src) return <img className="avatar" style={style} src={src} alt={`${name}'s avatar`} loading="lazy" />;
  return (
    <span className="avatar avatar--fallback" style={{ ...style, background: color }} role="img" aria-label={`${name}'s avatar`}>
      {initials}
    </span>
  );
}
