import { useTheme } from '../context/ThemeContext.jsx';
import { Icon } from './Icons.jsx';

export default function ThemeToggle({ withLabel = false }) {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button className="theme-toggle" onClick={toggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      {withLabel && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
}
