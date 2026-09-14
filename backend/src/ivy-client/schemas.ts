import { z } from 'zod';

/**
 * Zod schemas for every Ivy API response shape.
 *
 * Contract: every response is validated through here before being stored or
 * returned. A schema mismatch is logged as a Finding with category
 * "data_quality" or "completeness" — it does NOT crash the ingestion.
 *
 * The schemas are intentionally slightly lenient (many fields optional or
 * passthrough) so we don't lose records when the API returns unexpected extra
 * fields. We then flag the extras in the audit log.
 */

// ─── Shared ───────────────────────────────────────────────────────────────────

const PropertyTypeSchema = z.enum([
  'apartment',
  'villa',
  'independent house',
  'plot',
  'builder floor',
]);

const FurnishingSchema = z.enum([
  'unfurnished',
  'semi-furnished',
  'fully-furnished',
]);

const PostedBySchema = z.enum(['agent', 'owner', 'builder']);

// ─── Listing ──────────────────────────────────────────────────────────────────

/**
 * The `is_live` field is NOT in API_REFERENCE.md but is expected based on
 * assignment Q3 ("how many have is_live true?"). Marked optional here;
 * if it's missing on the real API, we'll know immediately from test runs.
 *
 * We use `.passthrough()` so undocumented extra fields are retained (not stripped)
 * — they may be findings themselves.
 */
export const ListingSchema = z
  .object({
    listing_id: z.string(),
    listing_url: z.string().url().optional().or(z.literal('')),
    website: z.string(),
    city_id: z.number().int(),
    apartment_name: z.string(),
    locality: z.string(),
    property_type: PropertyTypeSchema,
    bedroom: z.number().int().nonnegative(),
    bathroom: z.number().int().nonnegative(),
    balcony: z.number().int().nonnegative(),
    floor: z.number().int(),
    total_floors: z.number().int().nonnegative(),
    furnishing: FurnishingSchema,
    facing_direction: z.string().optional().nullable(),
    covered_parking: z.number().int().nonnegative(),
    price: z.number().int().positive(),
    carpet_area: z.number().int().nonnegative(),
    super_built_up_area: z.number().int().nonnegative(),
    latitude: z.number(),
    longitude: z.number(),
    posted_by: PostedBySchema,
    posted_by_name: z.string(),
    posted_by_contact: z.string(),
    project_id: z.string().nullable(),
    description: z.string(),
    posted_at: z.string(), // raw string — timezone audit happens in analysis
    is_verified: z.boolean(),
    // NOT documented — but expected (Q3)
    is_live: z.boolean().optional(),
  })
  .passthrough(); // retain any extra undocumented fields for audit

export type ListingShape = z.infer<typeof ListingSchema>;

// ─── Rental ───────────────────────────────────────────────────────────────────

/**
 * The docs spell `super_builtup_area` for rentals (no underscore between
 * "built" and "up") vs `super_built_up_area` for listings. We accept both
 * and normalise to `super_built_up_area` in the model transform.
 */
export const RentalSchema = z
  .object({
    listing_id: z.string(),
    listing_url: z.string().url().optional().or(z.literal('')),
    website: z.string(),
    city_id: z.number().int(),
    title: z.string().optional(),
    apartment_name: z.string(),
    locality: z.string(),
    property_type: z.string(),
    bedroom: z.number().int().nonnegative(),
    bathroom: z.number().int().nonnegative(),
    floor: z.number().int(),
    total_floors: z.number().int().nonnegative(),
    furnishing: FurnishingSchema,
    facing_direction: z.string().optional().nullable(),
    price: z.number().int().positive(), // monthly rent
    deposit: z.number().int().nonnegative(),
    maintenance: z.number().int().nonnegative(),
    carpet_area: z.number().int().nonnegative(),
    // Accept both spellings — normalise downstream
    super_builtup_area: z.number().int().nonnegative().optional(),
    super_built_up_area: z.number().int().nonnegative().optional(),
    latitude: z.number(),
    longitude: z.number(),
    posted_by: PostedBySchema,
    posted_by_name: z.string(),
    posted_by_contact: z.string(),
    description: z.string(),
    posted_at: z.string(),
  })
  .passthrough();

export type RentalShape = z.infer<typeof RentalSchema>;

// ─── Project ──────────────────────────────────────────────────────────────────

export const ProjectSchema = z
  .object({
    project_id: z.string(),
    project_url: z.string().url().optional().or(z.literal('')),
    city_id: z.number().int(),
    apartment_name: z.string(),
    developer_name: z.string(),
    locality: z.string(),
    project_status: z.string(), // flexible — doc has 4 values, API may have more
    total_units: z.number().int().nonnegative(),
    total_towers: z.number().int().nonnegative(),
    total_floors: z.number().int().nonnegative(),
    launch_date: z.string(),
    possession_date: z.string(),
    rera_number: z.string().optional().nullable(),
    min_area_sqft: z.number().int().nonnegative(),
    max_area_sqft: z.number().int().nonnegative(),
    /**
     * Documented as always accurate. It is not — Q10 asks how many are wrong.
     * We store this raw value and later compare against actual listing counts.
     */
    total_listings: z.number().int().nonnegative(),
    price_min: z.number().int().nonnegative(),
    price_max: z.number().int().nonnegative(),
    amenities: z.array(z.string()),
    latitude: z.number(),
    longitude: z.number(),
  })
  .passthrough();

export type ProjectShape = z.infer<typeof ProjectSchema>;

// ─── Paginated response ───────────────────────────────────────────────────────

export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    results: z.array(itemSchema),
  });
}

export const PaginatedListingSchema = paginatedSchema(ListingSchema);
export const PaginatedRentalSchema = paginatedSchema(RentalSchema);
export const PaginatedProjectSchema = paginatedSchema(ProjectSchema);

export type PaginatedListing = z.infer<typeof PaginatedListingSchema>;
export type PaginatedRental = z.infer<typeof PaginatedRentalSchema>;
export type PaginatedProject = z.infer<typeof PaginatedProjectSchema>;

export const LoginResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  refresh_url: z.string().optional(),
  user: z.object({
    email: z.string().email(),
    name: z.string().optional(),
  }),
});

// ─── Favourites ───────────────────────────────────────────────────────────────

export const FavouritesResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  results: z.array(ListingSchema),
});

// ─── Health ───────────────────────────────────────────────────────────────────

export const HealthSchema = z.object({
  status: z.string(),
}).passthrough(); // retain server_time and any other fields for audit

// ─── Schema mismatch finding ──────────────────────────────────────────────────

export interface SchemaMismatch {
  endpoint: string;
  expected_field: string;
  actual_value: unknown;
  error: string;
}
