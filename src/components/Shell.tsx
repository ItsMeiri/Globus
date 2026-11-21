import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Logo, ThemeToggle } from './AppHeader';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
}

/** Desktop/tablet navigation rail. Hidden on phones, where BottomNav takes over. */
export function Rail({ items, footer }: { items: NavItem[]; footer?: ReactNode }) {
  return (
    <nav className="rail" aria-label="Main">
      <div className="rail-logo">
        <Logo compact />
      </div>
      <div className="rail-items">
        {items.map((it) => (
          <NavLink key={it.label} to={it.to} className={() => `rail-item ${it.active ? 'active' : ''}`} aria-current={it.active ? 'page' : undefined}>
            <span className="rail-icon">
              <it.icon size={20} />
              {!!it.badge && <span className="nav-badge">{it.badge}</span>}
            </span>
            <span className="rail-label">{it.label}</span>
          </NavLink>
        ))}
      </div>
      <div className="rail-footer">
        {footer}
        <ThemeToggle />
      </div>
    </nav>
  );
}

/** Phone tab bar. */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="bottom-nav" aria-label="Sections">
      {items.map((it) => (
        <NavLink key={it.label} to={it.to} className={() => `bottom-item ${it.active ? 'active' : ''}`} aria-current={it.active ? 'page' : undefined}>
          <span className="bottom-icon">
            <it.icon size={20} />
            {!!it.badge && <span className="nav-badge">{it.badge}</span>}
          </span>
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
