import { useQuery } from '@tanstack/react-query';
import { favouritesApi } from '@/api/client';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import './ListingsPage.css'; // Reusing layout css

export function FavouritesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['favourites'],
    queryFn: favouritesApi.list,
  });

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Saved Properties</h1>
          <p className="page-subtitle">
            {data ? `${data.count} saved listings` : 'Your shortlisted properties'}
          </p>
        </div>
      </header>

      {isError ? (
        <div className="empty-state">
          <span className="empty-icon">⚠</span>
          <p>Could not load your saved properties.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="listing-grid">
          {Array.from({ length: 3 }).map((_, i) => <ListingCardSkeleton key={i} />)}
        </div>
      ) : data?.results.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">☆</span>
          <p>You haven't saved any properties yet.</p>
        </div>
      ) : (
        <div className="listing-grid">
          {data?.results.map(listing => (
            <ListingCard
              key={listing.listing_id}
              listing={listing}
              isFavourite={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
