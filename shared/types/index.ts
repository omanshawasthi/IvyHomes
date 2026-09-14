/**
 * Shared types between frontend and backend.
 * These are the DTO shapes that our backend returns to the frontend.
 * They intentionally omit fields that should never reach the client
 * (e.g. _raw, __v).
 *
 * Both packages import from here via relative paths.
 */

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  results: T[];
}

// ─── Listing ──────────────────────────────────────────────────────────────────

export interface ListingDTO {
  listing_id: string;
  listing_url: string;
  website: string;
  city_id: number;
  apartment_name: string;
  locality: string;
  property_type: string;
  bedroom: number;
  bathroom: number;
  balcony: number;
  floor: number;
  total_floors: number;
  furnishing: string;
  facing_direction: string | null;
  covered_parking: number;
  price: number;
  carpet_area: number;
  super_built_up_area: number;
  latitude: number;
  longitude: number;
  posted_by: string;
  /** Free-text seller name — render as text only, never innerHTML */
  posted_by_name: string;
  /** Seller contact — render as text only */
  posted_by_contact: string;
  project_id: string | null;
  /** Free-text seller description — render as text only, never innerHTML */
  description: string;
  posted_at: string;
  is_verified: boolean;
  is_live: boolean;
}

// ─── Rental ───────────────────────────────────────────────────────────────────

export interface RentalDTO {
  listing_id: string;
  listing_url: string;
  website: string;
  city_id: number;
  title: string;
  apartment_name: string;
  locality: string;
  property_type: string;
  bedroom: number;
  bathroom: number;
  floor: number;
  total_floors: number;
  furnishing: string;
  facing_direction: string | null;
  /** Monthly rent in rupees */
  price: number;
  deposit: number;
  maintenance: number;
  carpet_area: number;
  super_built_up_area: number;
  latitude: number;
  longitude: number;
  posted_by: string;
  posted_by_name: string;
  posted_by_contact: string;
  description: string;
  posted_at: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface ProjectDTO {
  project_id: string;
  project_url: string;
  city_id: number;
  apartment_name: string;
  developer_name: string;
  locality: string;
  project_status: string;
  total_units: number;
  total_towers: number;
  total_floors: number;
  launch_date: string;
  possession_date: string;
  rera_number: string | null;
  min_area_sqft: number;
  max_area_sqft: number;
  total_listings: number;
  actual_listing_count: number;
  price_min: number;
  price_max: number;
  amenities: string[];
  latitude: number;
  longitude: number;
}

// ─── Finding (for insights / audit screen) ────────────────────────────────────

export interface FindingDTO {
  _id: string;
  endpoint: string;
  category: string;
  documented: string;
  actual: string;
  how_found: string;
  impact: string;
  evidence: string[];
  status: 'confirmed' | 'ruled_out' | 'pending';
  ruling_reason?: string;
  created_at: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsSummaryDTO {
  city: string;
  total_listings: number;
  active_listings: number;
  total_rentals: number;
  by_locality: Array<{ locality: string; count: number; median_price: number }>;
  by_bhk: Array<{ bedroom: number; count: number }>;
  rental_by_locality: Array<{ locality: string; count: number; avg_rent: number }>;
  bellandur_total_monthly_rent: number;
  upstream_analytics: unknown;
  findings_count: number;
  findings: FindingDTO[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface UserDTO {
  email: string;
  name: string;
}

export interface LoginResponseDTO {
  user: UserDTO;
}

export interface MeResponseDTO {
  authenticated: boolean;
}
