import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useStore } from '../store';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Globus home">
      <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff7a59" />
            <stop offset="1" stopColor="#e2366b" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill="url(#lg)" />
        <ellipse cx="32" cy="32" rx="12" ry="28" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="M4 32h56M9 18h46M9 46h46" stroke="#fff" strokeWidth="3" fill="none" />
      </svg>
      <span>Globus</span>
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

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="app-header">
      <Logo />
      <div className="grow">{children}</div>
      <ThemeToggle />
    </header>
  );
}
