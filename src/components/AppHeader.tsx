import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useStore } from '../store';

export function LogoMark({ size = 28 }: { size?: number }) {
  const id = 'lg' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a59" />
          <stop offset="1" stopColor="#e2366b" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill={`url(#${id})`} />
      <ellipse cx="32" cy="32" rx="12" ry="28" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M4 32h56M9 18h46M9 46h46" stroke="#fff" strokeWidth="3" fill="none" />
    </svg>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="logo" aria-label="Globus home">
      <LogoMark size={compact ? 32 : 28} />
      {!compact && <span>Globus</span>}
    </Link>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useStore();
  return (
    <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title="Toggle theme">
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
