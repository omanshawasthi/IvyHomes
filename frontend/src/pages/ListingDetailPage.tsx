import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listingsApi } from '@/api/client';
import './ListingDetailPage.css';

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listings', id],
    queryFn: () => listingsApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: '40px', width: '30%', marginBottom: 'var(--space-6)' }} />
        <div className="skeleton" style={{ height: '400px', width: '100%', marginBottom: 'var(--space-6)' }} />
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <span className="empty-icon">⚠</span>
          <p>Listing not found or failed to load.</p>
          <Link to="/listings" className="btn-secondary">← Back to browse</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Link to="/listings" className="back-link">← Back to Browse</Link>

      <div className="detail-layout">
        {/* ── Main content (left) ─────────────────────────────── */}
        <div className="detail-main">
          <header className="detail-header">
            <h1 className="detail-title">{listing.apartment_name}</h1>
            <p className="detail-subtitle">
              {listing.bedroom} BHK in {listing.locality}
              {!listing.is_live && <span className="badge-inactive">Inactive</span>}
            </p>
          </header>

          <div className="detail-image-placeholder">
            <span aria-hidden="true">⌂</span>
          </div>

          <section className="detail-section">
            <h2 className="section-title">Property Description</h2>
            {/* The prompt dictates never to use innerHTML on free-text fields for security */}
            <p className="detail-description">{listing.description}</p>
          </section>

          <section className="detail-section">
            <h2 className="section-title">Specifications</h2>
            <div className="specs-table">
              <div className="specs-row">
                <span className="specs-label">Carpet Area</span>
                <span className="specs-value">{listing.carpet_area} sqft</span>
              </div>
              <div className="specs-row">
                <span className="specs-label">Super Built-up Area</span>
                <span className="specs-value">{listing.super_built_up_area} sqft</span>
              </div>
              <div className="specs-row">
                <span className="specs-label">Floor</span>
                <span className="specs-value">{listing.floor} of {listing.total_floors}</span>
              </div>
              <div className="specs-row">
                <span className="specs-label">Bathrooms</span>
                <span className="specs-value">{listing.bathroom}</span>
              </div>
              <div className="specs-row">
                <span className="specs-label">Balconies</span>
                <span className="specs-value">{listing.balcony}</span>
              </div>
              <div className="specs-row">
                <span className="specs-label">Parking</span>
                <span className="specs-value">{listing.covered_parking} covered</span>
              </div>
              <div className="specs-row">
                <span className="specs-label">Facing</span>
                <span className="specs-value" style={{ textTransform: 'capitalize' }}>
                  {listing.facing_direction || '—'}
                </span>
              </div>
              <div className="specs-row">
                <span className="specs-label">Furnishing</span>
                <span className="specs-value" style={{ textTransform: 'capitalize' }}>
                  {listing.furnishing || '—'}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* ── Sidebar / Sticky pane (right) ────────────────────── */}
        <aside className="detail-sidebar">
          <div className="price-card">
            <div className="price-card__header">Asking Price</div>
            <div className="price-card__amount">
              ₹{(listing.price / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}L
            </div>
            <div className="price-card__sub">
              ₹{Math.round(listing.price / listing.carpet_area).toLocaleString('en-IN')}/sqft
            </div>
            
            <hr className="price-card__divider" />
            
            <div className="contact-info">
              <div className="contact-label">Listed By</div>
              <div className="contact-name">{listing.posted_by_name}</div>
              <div className="contact-type">
                {listing.posted_by === 'owner' ? 'Property Owner' : 'Agent/Builder'}
              </div>
              
              <button className="btn-primary contact-btn">
                Contact: {listing.posted_by_contact.slice(0, 5)} {listing.posted_by_contact.slice(5)}
              </button>
            </div>
          </div>
          
          <div className="meta-card">
            <div className="meta-row">
              <span>Listing ID</span>
              <span>{listing.listing_id}</span>
            </div>
            <div className="meta-row">
              <span>Posted On</span>
              <span>{new Date(listing.posted_at).toLocaleDateString('en-IN')}</span>
            </div>
            {listing.project_id && (
              <div className="meta-row">
                <span>Project ID</span>
                <Link to={`/projects`} className="meta-link">{listing.project_id}</Link>
              </div>
            )}
            <div className="meta-row">
              <span>Source</span>
              <span>{listing.website}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
