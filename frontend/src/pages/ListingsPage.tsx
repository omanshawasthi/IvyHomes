import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listingsApi, favouritesApi } from '@/api/client';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { useDebounce } from '@/hooks/useDebounce';
import './ListingsPage.css';

export function ListingsPage() {
  const [page, setPage] = useState(1);
  const [localityInput, setLocalityInput] = useState('');
  const debouncedLocality = useDebounce(localityInput, 600);
  
  const [filters, setFilters] = useState({
    bedroom: '',
    sort_by: 'posted_at',
  });

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters, debouncedLocality]);

  // Query: Listings
  const { data, isLoading, isError } = useQuery({
    queryKey: ['listings', page, filters, debouncedLocality],
    queryFn: () => listingsApi.list({
      page,
      limit: 12,
      locality: debouncedLocality || undefined,
      bedroom: filters.bedroom ? parseInt(filters.bedroom, 10) : undefined,
      sort_by: filters.sort_by,
      order: filters.sort_by === 'price' ? 'asc' : 'desc',
    }),
    placeholderData: (prev) => prev, // keeps old data visible while fetching next page
  });

  // Query: Favourites (to know which hearts to fill)
  const { data: favData } = useQuery({
    queryKey: ['favourites'],
    queryFn: favouritesApi.list,
  });

  const favSet = useMemo(() => {
    const set = new Set<string>();
    if (favData?.results) {
      favData.results.forEach(f => set.add(f.listing_id));
    }
    return set;
  }, [favData]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Browse Properties</h1>
          <p className="page-subtitle">Showing {data?.total.toLocaleString() ?? '—'} listings in Bangalore</p>
        </div>
      </header>

      {/* ── Filters Bar ──────────────────────────────────────── */}
      <section className="filters-bar" aria-label="Filters">
        <div className="filter-group">
          <label htmlFor="filter-locality" className="filter-label">Locality</label>
          <input
            id="filter-locality"
            type="text"
            className="filter-input"
            placeholder="e.g. Bellandur"
            value={localityInput}
            onChange={(e) => setLocalityInput(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="filter-bedroom" className="filter-label">BHK</label>
          <select
            id="filter-bedroom"
            className="filter-input"
            value={filters.bedroom}
            onChange={(e) => handleFilterChange('bedroom', e.target.value)}
          >
            <option value="">Any</option>
            <option value="1">1 BHK</option>
            <option value="2">2 BHK</option>
            <option value="3">3 BHK</option>
            <option value="4">4+ BHK</option>
          </select>
        </div>
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <label htmlFor="filter-sort" className="filter-label">Sort by</label>
          <select
            id="filter-sort"
            className="filter-input"
            value={filters.sort_by}
            onChange={(e) => handleFilterChange('sort_by', e.target.value)}
          >
            <option value="posted_at">Newest First</option>
            <option value="price">Price (Low to High)</option>
            <option value="carpet_area">Area (Largest First)</option>
          </select>
        </div>
      </section>

      {/* ── Grid ─────────────────────────────────────────────── */}
      {isError ? (
        <div className="empty-state">
          <span className="empty-icon">⚠</span>
          <p>Could not load listings. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="listing-grid">
          {Array.from({ length: 6 }).map((_, i) => <ListingCardSkeleton key={i} />)}
        </div>
      ) : data?.results.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">⊘</span>
          <p>No listings match your filters.</p>
          <button className="btn-secondary" onClick={() => { setLocalityInput(''); setFilters({ bedroom: '', sort_by: 'posted_at' }); }}>
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="listing-grid">
            {data?.results.map(listing => (
              <ListingCard
                key={listing.listing_id}
                listing={listing}
                isFavourite={favSet.has(listing.listing_id)}
              />
            ))}
          </div>

          {/* ── Pagination ─────────────────────────────────────── */}
          {data && data.total > data.page_size && (
            <div className="pagination">
              <button
                className="btn-secondary"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {page} of {Math.ceil(data.total / data.page_size)}
              </span>
              <button
                className="btn-secondary"
                disabled={page >= Math.ceil(data.total / data.page_size)}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
