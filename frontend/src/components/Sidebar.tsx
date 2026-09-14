import { NavLink, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/listings',   label: 'Browse',      icon: '⊞' },
  { to: '/rentals',    label: 'Rentals',      icon: '⌂' },
  { to: '/projects',   label: 'Projects',     icon: '◈' },
  { to: '/favourites', label: 'Saved',        icon: '◇' },
  { to: '/insights',   label: 'Insights',     icon: '◉' },
  { to: '/audit',      label: 'API Audit',    icon: '⊘' },
] as const;

export function Sidebar() {
  const { clearUser } = useAuthStore();
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      clearUser();
      queryClient.clear();
      navigate('/');
    },
  });

  return (
    <aside className="sidebar" aria-label="Main navigation">
      {/* ── Brand ──────────────────────────────────────────── */}
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">◈</span>
        <div>
          <div className="sidebar__brand-name">Ivy Homes</div>
          <div className="sidebar__brand-city">Bangalore</div>
        </div>
      </div>

      {/* ── Nav ────────────────────────────────────────────── */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            id={`nav-${item.to.replace('/', '')}`}
            className={({ isActive }) =>
              `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`
            }
          >
            <span className="sidebar__nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="sidebar__nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="sidebar__footer">
        <div className="sidebar__locality">
          <span className="sidebar__locality-dot" aria-hidden="true">●</span>
          Bellandur
        </div>
        <button
          id="btn-logout"
          className="sidebar__logout"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label="Logout"
        >
          {logout.isPending ? 'Logging out…' : 'Logout'}
        </button>
      </div>
    </aside>
  );
}
