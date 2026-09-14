import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { authApi } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Sidebar } from '@/components/Sidebar';
import { LoginPage }     from '@/pages/LoginPage';
import { ListingsPage }  from '@/pages/ListingsPage';
import { RentalsPage }   from '@/pages/RentalsPage';
import { ProjectsPage }  from '@/pages/ProjectsPage';
import { FavouritesPage }from '@/pages/FavouritesPage';
import { InsightsPage }  from '@/pages/InsightsPage';
import { AuditPage }     from '@/pages/AuditPage';
import { ListingDetailPage } from '@/pages/ListingDetailPage';

function App() {
  const { authenticated, clearUser } = useAuthStore();

  // Attempt session restoration on every page load
  const { data: me, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn:  authApi.me,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (me?.authenticated) {
      // Cookie is valid — keep store in sync
      // We don't have user details without a /me that returns them,
      // so we just mark authenticated=true
      useAuthStore.getState().setUser({ email: '', name: 'You' });
    } else if (!isLoading && !me) {
      clearUser();
    }
  }, [me, isLoading, clearUser]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--mist)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--blueprint)' }}>
          Loading…
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/"             element={<Navigate to="/listings" replace />} />
          <Route path="/listings"     element={<ListingsPage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
          <Route path="/rentals"      element={<RentalsPage />} />
          <Route path="/projects"     element={<ProjectsPage />} />
          <Route path="/favourites"   element={<FavouritesPage />} />
          <Route path="/insights"     element={<InsightsPage />} />
          <Route path="/audit"        element={<AuditPage />} />
          <Route path="*"             element={<Navigate to="/listings" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
