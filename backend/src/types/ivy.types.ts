/**
 * TypeScript interfaces derived from reading API_REFERENCE.md.
 *
 * IMPORTANT — discrepancy notes embedded:
 *   - `is_live` is NOT documented in the listing schema but Question 3
 *     of the assignment asks to count records by it. It must exist on
 *     the real API. Treated as optional here until confirmed.
 *   - `super_built_up_area` (listings) ≠ `super_builtup_area` (rentals) —
 *     different spellings in the docs; zod schemas will capture what the
 *     API actually sends.
 *   - Timestamps: docs say "UTC, Z suffix everywhere" but /health may
 *     return +05:30. All dates parsed to Date objects by Mongoose; the
 *     raw string is retained in a separate `_raw_posted_at` field for audit.
 */

// ─── Listing ──────────────────────────────────────────────────────────────────

export type PropertyType =
  | 'apartment'
  | 'villa'
  | 'independent house'
  | 'plot'
  | 'builder floor';

export type FurnishingType = 'unfurnished' | 'semi-furnished' | 'fully-furnished';

export type PostedBy = 'agent' | 'owner' | 'builder';

/**
 * A raw listing record as returned by the Ivy API.
 * We do NOT trust this shape — zod validates every response before storage.
 *
 * Note: `is_live` is not in API_REFERENCE.md but is expected based on
 * assignment question 3. Marked optional; if absent the validator will log a
 * schema_mismatch finding.
 */
export interface IvyListing {
  listing_id: string;
  listing_url: string;
  website: string;
  city_id: number;
  apartment_name: string;
  locality: string;
  property_type: PropertyType;
  bedroom: number;
  bathroom: number;
  balcony: number;
  floor: number;
  total_floors: number;
  furnishing: FurnishingType;
  facing_direction: string;
  covered_parking: number;
  price: number;
  carpet_area: number;
  super_built_up_area: number;
  latitude: number;
  longitude: number;
  posted_by: PostedBy;
  posted_by_name: string;
  posted_by_contact: string;
  project_id: string | null;
  description: string;
  posted_at: string;
  is_verified: boolean;
  /** NOT documented but expected from assignment Q3 */
  is_live?: boolean;
}

// ─── Rental ───────────────────────────────────────────────────────────────────

/**
 * Note: docs use `super_builtup_area` (no underscore between "built" and "up")
 * for rentals vs `super_built_up_area` for listings. We capture both variants
 * in the zod schema and normalise to `super_built_up_area` in our DB model.
 */
export interface IvyRental {
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
  furnishing: FurnishingType;
  facing_direction: string;
  /** Monthly rent in rupees */
  price: number;
  deposit: number;
  maintenance: number;
  carpet_area: number;
  /**
   * Docs spell this `super_builtup_area` for rentals.
   * The zod schema accepts both spellings and normalises on ingest.
   */
  super_built_up_area: number;
  latitude: number;
  longitude: number;
  posted_by: PostedBy;
  posted_by_name: string;
  posted_by_contact: string;
  description: string;
  posted_at: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'under construction'
  | 'ready to move'
  | 'launched'
  | 'upcoming'
  | 'completed'; // not in docs, verify

export interface IvyProject {
  project_id: string;
  project_url: string;
  city_id: number;
  apartment_name: string;
  developer_name: string;
  locality: string;
  project_status: ProjectStatus;
  total_units: number;
  total_towers: number;
  total_floors: number;
  launch_date: string;
  possession_date: string;
  rera_number: string;
  min_area_sqft: number;
  max_area_sqft: number;
  /**
   * Documented as "always agrees with GET /v1/listings?project_id=...".
   * Assignment Q10 asks how many are wrong — this claim is likely false.
   */
  total_listings: number;
  price_min: number;
  price_max: number;
  amenities: string[];
  latitude: number;
  longitude: number;
}

// ─── Paginated response wrapper ───────────────────────────────────────────────

export interface IvyPaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  results: T[];
}

export interface IvyLoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_url?: string;
  user: {
    email: string;
    name?: string;
  };
}

// ─── Favourites ───────────────────────────────────────────────────────────────

export interface IvyFavouritesResponse {
  count: number;
  results: IvyListing[];
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/** GET /v1/analytics/summary — may not exist at this path, verify on first call */
export interface IvyAnalyticsSummary {
  city: string;
  total_listings: number;
  median_price: number;
  median_price_per_sqft: number;
  by_locality: Array<{
    locality: string;
    count: number;
    median_price: number;
  }>;
  by_bhk: Array<{
    bedroom: number;
    count: number;
  }>;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface IvyHealthResponse {
  status: string;
  /** May include timezone offset — docs claim UTC but +05:30 suspected */
  server_time?: string;
  [key: string]: unknown;
}
