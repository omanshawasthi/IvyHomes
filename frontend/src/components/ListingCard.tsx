import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { favouritesApi } from '@/api/client';
import type { ListingDTO } from '../../../shared/types/index.js';
import './ListingCard.css';

interface ListingCardProps {
  listing: ListingDTO;
  isFavourite?: boolean;
}

export function ListingCard({ listing, isFavourite = false }: ListingCardProps) {
  const queryClient = useQueryClient();

  const toggleFavourite = useMutation({
    mutationFn: (id: string) =>
      isFavourite ? favouritesApi.remove(id) : favouritesApi.add(id),
    onSuccess: () => {
      // Invalidate both lists so UI updates instantly
      queryClient.invalidateQueries({ queryKey: ['favourites'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  return (
    <article className="listing-card">
      {/* ── Image placeholder ──────────────────────────────── */}
      <div className="listing-card__image-wrap">
        <div className="listing-card__image-placeholder">
          <span aria-hidden="true">⌂</span>
        </div>
        <button
          className={`listing-card__fav-btn ${isFavourite ? 'listing-card__fav-btn--active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            toggleFavourite.mutate(listing.listing_id);
          }}
          disabled={toggleFavourite.isPending}
          aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
        >
          {isFavourite ? '★' : '☆'}
        </button>
      </div>

      <div className="listing-card__content">
        {/* ── The bold "signage plate" element ─────────────── */}
        <div className="listing-card__signage">
          <div className="signage-plate">
            <span className="price">
              ₹{(listing.price / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}L
            </span>
            <span className="area">{listing.carpet_area} sqft</span>
          </div>
        </div>

        {/* ── Core details ─────────────────────────────────── */}
        <div className="listing-card__header">
          <h3 className="listing-card__title text-truncate" title={listing.apartment_name}>
            {listing.apartment_name}
          </h3>
          <p className="listing-card__locality">
            {listing.bedroom} BHK in <span style={{ textTransform: 'capitalize' }}>{listing.locality}</span>
          </p>
        </div>

        {/* ── Specs grid ───────────────────────────────────── */}
        <div className="listing-card__specs">
          <div className="spec-item">
            <span className="spec-label">Floor</span>
            <span className="spec-value">{listing.floor} / {listing.total_floors}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Furnishing</span>
            <span className="spec-value" style={{ textTransform: 'capitalize' }}>
              {listing.furnishing || '—'}
            </span>
          </div>
          <div className="spec-item">
            <span className="spec-label">SBA</span>
            <span className="spec-value">{listing.super_built_up_area}</span>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="listing-card__footer">
          <Link
            to={`/listings/${encodeURIComponent(listing.listing_id)}`}
            className="listing-card__link"
          >
            View Details →
          </Link>
          {!listing.is_live && (
            <span className="listing-card__badge-inactive">Inactive</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <article className="listing-card">
      <div className="listing-card__image-wrap skeleton" style={{ height: '160px' }} />
      <div className="listing-card__content">
        <div className="skeleton" style={{ height: '40px', width: '120px', marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ height: '24px', width: '80%', marginBottom: 'var(--space-2)' }} />
        <div className="skeleton" style={{ height: '16px', width: '40%', marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ height: '32px', width: '100%', marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ height: '16px', width: '30%' }} />
      </div>
    </article>
  );
}
