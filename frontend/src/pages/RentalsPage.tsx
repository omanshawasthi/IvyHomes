import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rentalsApi } from '@/api/client';
import { useDebounce } from '@/hooks/useDebounce';
import type { RentalDTO } from '../../../shared/types/index.js';
import './ListingsPage.css'; // Reusing standard grid/filter styles

export function RentalsPage() {
  const [page, setPage] = useState(1);
  const [localityInput, setLocalityInput] = useState('');
  const debouncedLocality = useDebounce(localityInput, 600);
  
  const [filters, setFilters] = useState({
    bhk: '',
    sort_by: 'posted_at',
  });

  useEffect(() => {
    setPage(1);
  }, [filters, debouncedLocality]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rentals', page, filters, debouncedLocality],
    queryFn: () => rentalsApi.list({
      page,
      limit: 12,
      locality: debouncedLocality || undefined,
      bhk: filters.bhk ? parseInt(filters.bhk, 10) : undefined,
      sort_by: filters.sort_by,
      order: filters.sort_by === 'price' ? 'asc' : 'desc',
    }),
    placeholderData: (prev) => prev,
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Rentals</h1>
          <p className="page-subtitle">Showing {data?.total.toLocaleString() ?? '—'} rentals in Bangalore</p>
        </div>
      </header>

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
          <label htmlFor="filter-bhk" className="filter-label">BHK</label>
          <select
            id="filter-bhk"
            className="filter-input"
            value={filters.bhk}
            onChange={(e) => handleFilterChange('bhk', e.target.value)}
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
            <option value="price">Rent (Low to High)</option>
            <option value="carpet_area">Area (Largest First)</option>
          </select>
        </div>
      </section>

      {isError ? (
        <div className="empty-state">
          <span className="empty-icon">⚠</span>
          <p>Could not load rentals. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="listing-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="listing-card skeleton" style={{ height: '360px' }} />
          ))}
        </div>
      ) : data?.results.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">⊘</span>
          <p>No rentals match your filters.</p>
        </div>
      ) : (
        <>
          <div className="listing-grid">
            {data?.results.map(rental => (
              <RentalCard key={rental.listing_id} rental={rental} />
            ))}
          </div>

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

function RentalCard({ rental }: { rental: RentalDTO }) {
  return (
    <article className="listing-card">
      <div className="listing-card__image-wrap">
        <span aria-hidden="true">⌂</span>
      </div>
      <div className="listing-card__content">
        <div className="listing-card__signage">
          <div className="signage-plate">
            <span className="price">₹{rental.price.toLocaleString('en-IN')}/mo</span>
            <span className="area">{rental.carpet_area} sqft</span>
          </div>
        </div>
        
        <div className="listing-card__header">
          <h3 className="listing-card__title text-truncate" title={rental.apartment_name}>
            {rental.apartment_name}
          </h3>
          <p className="listing-card__locality">
            {rental.bedroom} BHK in <span style={{ textTransform: 'capitalize' }}>{rental.locality}</span>
          </p>
        </div>

        <div className="listing-card__specs">
          <div className="spec-item">
            <span className="spec-label">Deposit</span>
            <span className="spec-value">₹{rental.deposit.toLocaleString('en-IN')}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Furnishing</span>
            <span className="spec-value" style={{ textTransform: 'capitalize' }}>{rental.furnishing || '—'}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Floor</span>
            <span className="spec-value">{rental.floor} / {rental.total_floors}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
