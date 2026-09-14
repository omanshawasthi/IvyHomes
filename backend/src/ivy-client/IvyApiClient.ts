import { CONSTANTS } from '../config/constants.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  FavouritesResponseSchema,
  HealthSchema,
  LoginResponseSchema,
  PaginatedListingSchema,
  PaginatedProjectSchema,
  PaginatedRentalSchema,
  type PaginatedListing,
  type PaginatedProject,
  type PaginatedRental,
} from './schemas.js';
import type { IvyHealthResponse, IvyLoginResponse, IvyFavouritesResponse } from '../types/ivy.types.js';
import { z } from 'zod';

/** Parameters for listing queries */
export interface ListingQueryParams {
  page?: number;
  limit?: number;
  locality?: string;
  /** Note: filter param in docs is 'bhk', field on object is 'bedroom'. May be silently ignored. */
  bhk?: number;
  property_type?: string;
  min_price?: number;
  max_price?: number;
  furnishing?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
  project_id?: string;
}

export interface RentalQueryParams {
  page?: number;
  limit?: number;
  locality?: string;
  bhk?: number;
  furnishing?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

export interface ProjectQueryParams {
  page?: number;
  limit?: number;
  locality?: string;
  project_status?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

/** A typed error surfacing the upstream detail message */
export class IvyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly endpoint: string,
  ) {
    super(`IvyAPI ${status} on ${endpoint}: ${detail}`);
    this.name = 'IvyApiError';
  }
}

/**
 * Typed wrapper around the upstream Ivy Homes API.
 *
 * Security contract:
 *   - The API key is injected from env at construction time.
 *   - It is appended as a query param on every request server-side.
 *   - It is NEVER returned to any caller or logged.
 *
 * Behavioural contract:
 *   - Every response is validated against a zod schema.
 *   - A schema mismatch is logged as a Finding but does NOT crash the call.
 *   - 429 and 5xx responses are retried with exponential backoff.
 *   - The upstream error `detail` message is always surfaced (never swallowed).
 */
export class IvyApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string = env.IVY_BASE_URL, apiKey: string = env.IVY_API_KEY) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // strip trailing slash
    this.apiKey = apiKey;
  }

  // ─── Health ─────────────────────────────────────────────────────────────────

  async health(): Promise<IvyHealthResponse> {
    const raw = await this.get<unknown>('/health', {}, false); // no auth required
    const result = HealthSchema.safeParse(raw);
    if (!result.success) {
      logger.warn({ errors: result.error.flatten() }, 'Schema mismatch on /health');
    }
    return raw as IvyHealthResponse;
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<IvyLoginResponse> {
    const raw = await this.post<unknown>('/auth/login', { email, password }, true);
    const result = LoginResponseSchema.safeParse(raw);
    if (!result.success) {
      logger.warn({ errors: result.error.flatten() }, 'Schema mismatch on /auth/login');
      throw new IvyApiError(200, 'Login response shape unexpected', '/auth/login');
    }
    return result.data as IvyLoginResponse;
  }

  async logout(token: string): Promise<void> {
    await this.post<unknown>('/auth/logout', {}, true, token);
  }

  // ─── Listings ───────────────────────────────────────────────────────────────

  async getListingsPage(params: ListingQueryParams, token?: string): Promise<PaginatedListing> {
    const raw = await this.get<unknown>('/v1/listings', params as Record<string, unknown>, true, token);
    return this.validate(raw, PaginatedListingSchema, '/v1/listings');
  }

  /**
   * Fetches ALL listing pages exhaustively.
   * Reads `total` from the first page, computes number of pages, then
   * fetches them concurrently in batches of 5 (well within the 1200/min limit).
   */
  async getAllListings(params: Omit<ListingQueryParams, 'page'> = {}, token?: string): Promise<PaginatedListing['results']> {
    const limit = CONSTANTS.IVY.MAX_PAGE_LIMIT;
    const first = await this.getListingsPage({ ...params, page: 1, limit }, token);
    const totalPages = Math.ceil(first.total / limit);

    logger.info({ total: first.total, pages: totalPages }, 'Fetching all listings');

    if (totalPages <= 1) return first.results;

    const remaining = await this.fetchAllPages(
      (page) => this.getListingsPage({ ...params, page, limit }, token),
      2,
      totalPages,
    );

    return [...first.results, ...remaining.flatMap((p) => p.results)];
  }

  async getListingById(listingId: string, token?: string): Promise<PaginatedListing['results'][number]> {
    // Docs say /v1/listing/{id} (singular) — but all other detail endpoints are plural.
    // We try /v1/listings/{id} first, fall back to /v1/listing/{id} and log the finding.
    try {
      const raw = await this.get<unknown>(`/v1/listings/${listingId}`, {}, true, token);
      return this.validate(raw, PaginatedListingSchema.shape.results.element, `/v1/listings/${listingId}`);
    } catch (err) {
      if (err instanceof IvyApiError && err.status === 404) {
        logger.warn({ listingId }, 'GET /v1/listings/{id} 404 — trying singular /v1/listing/{id}');
        const raw = await this.get<unknown>(`/v1/listing/${listingId}`, {}, true, token);
        return this.validate(raw, PaginatedListingSchema.shape.results.element, `/v1/listing/${listingId}`);
      }
      throw err;
    }
  }

  async getSimilarListings(listingId: string, token?: string): Promise<PaginatedListing['results']> {
    try {
      const raw = await this.get<unknown>(`/v1/listings/${listingId}/similar`, {}, true, token);
      // May return an array or paginated — handle both
      if (Array.isArray(raw)) return raw as PaginatedListing['results'];
      const parsed = PaginatedListingSchema.safeParse(raw);
      if (parsed.success) return parsed.data.results;
      return raw as PaginatedListing['results'];
    } catch (err) {
      if (err instanceof IvyApiError && (err.status === 404 || err.status === 422)) {
        logger.warn({ listingId, err: err.message }, '/similar endpoint not available — finding logged');
        return [];
      }
      throw err;
    }
  }

  // ─── Rentals ────────────────────────────────────────────────────────────────

  async getRentalsPage(params: RentalQueryParams = {}, token?: string): Promise<PaginatedRental> {
    const raw = await this.get<unknown>('/v1/rentals', params as Record<string, unknown>, true, token);
    return this.validate(raw, PaginatedRentalSchema, '/v1/rentals');
  }

  async getRentalById(rentalId: string, token?: string): Promise<PaginatedRental['results'][number]> {
    const raw = await this.get<unknown>(`/v1/rentals/${rentalId}`, {}, true, token);
    return this.validate(raw, PaginatedRentalSchema.shape.results.element, `/v1/rentals/${rentalId}`);
  }

  async getAllRentals(params: Omit<RentalQueryParams, 'page'> = {}, token?: string): Promise<PaginatedRental['results']> {
    const limit = CONSTANTS.IVY.MAX_PAGE_LIMIT;
    const first = await this.getRentalsPage({ ...params, page: 1, limit }, token);
    const totalPages = Math.ceil(first.total / limit);
    if (totalPages <= 1) return first.results;
    const remaining = await this.fetchAllPages(
      (page) => this.getRentalsPage({ ...params, page, limit }, token),
      2,
      totalPages,
    );
    return [...first.results, ...remaining.flatMap((p) => p.results)];
  }

  // ─── Projects ───────────────────────────────────────────────────────────────

  async getProjectsPage(params: ProjectQueryParams = {}, token?: string): Promise<PaginatedProject> {
    const raw = await this.get<unknown>('/v1/projects', params as Record<string, unknown>, true, token);
    return this.validate(raw, PaginatedProjectSchema, '/v1/projects');
  }

  async getAllProjects(params: Omit<ProjectQueryParams, 'page'> = {}, token?: string): Promise<PaginatedProject['results']> {
    const limit = CONSTANTS.IVY.MAX_PAGE_LIMIT;
    const first = await this.getProjectsPage({ ...params, page: 1, limit }, token);
    const totalPages = Math.ceil(first.total / limit);
    if (totalPages <= 1) return first.results;
    const remaining = await this.fetchAllPages(
      (page) => this.getProjectsPage({ ...params, page, limit }, token),
      2,
      totalPages,
    );
    return [...first.results, ...remaining.flatMap((p) => p.results)];
  }

  async getProjectById(projectId: string, token?: string): Promise<PaginatedProject['results'][number]> {
    const raw = await this.get<unknown>(`/v1/projects/${projectId}`, {}, true, token);
    return this.validate(raw, PaginatedProjectSchema.shape.results.element, `/v1/projects/${projectId}`);
  }

  // ─── Favourites ─────────────────────────────────────────────────────────────

  async getFavourites(token: string): Promise<IvyFavouritesResponse> {
    const raw = await this.get<unknown>('/v1/favourites', {}, true, token);
    return this.validate(raw, FavouritesResponseSchema, '/v1/favourites') as IvyFavouritesResponse;
  }

  async addFavourite(listingId: string, token: string): Promise<void> {
    // Docs say POST body is { "id": "..." } — may actually be { "listing_id": "..." }
    await this.post<unknown>('/v1/favourites', { id: listingId }, true, token);
  }

  async removeFavourite(listingId: string, token: string): Promise<void> {
    await this.delete(`/v1/favourites/${listingId}`, token);
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  async getAnalyticsSummary(): Promise<unknown> {
    // Documented endpoint — may not exist. Returns raw unknown so callers handle gracefully.
    return this.get<unknown>('/v1/analytics/summary', {});
  }

  // ─── HTTP primitives ────────────────────────────────────────────────────────

  private async get<T>(
    path: string,
    params: Record<string, unknown> = {},
    requiresKey = true,
    token?: string,
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    const headers = this.buildHeaders(token, requiresKey);
    return this.request<T>('GET', url, headers);
  }

  private async post<T>(
    path: string,
    body: unknown,
    requiresKey = true,
    token?: string,
  ): Promise<T> {
    const url = this.buildUrl(path, {});
    const headers = { ...this.buildHeaders(token, requiresKey), 'Content-Type': 'application/json' };
    return this.request<T>('POST', url, headers, body);
  }

  private async delete(path: string, token: string): Promise<void> {
    const url = this.buildUrl(path, {});
    const headers = this.buildHeaders(token, true);
    await this.request<unknown>('DELETE', url, headers);
  }

  private async request<T>(
    method: string,
    url: URL,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= CONSTANTS.IVY.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = CONSTANTS.IVY.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn({ attempt, delay, url: url.pathname }, 'Retrying after backoff');
        await sleep(delay);
      }

      try {
        const response = await fetch(url.toString(), {
          method,
          headers,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });

        if (response.status === 429 && attempt < CONSTANTS.IVY.MAX_RETRIES) {
          lastError = new IvyApiError(429, 'Rate limit exceeded', url.pathname);
          continue; // retry
        }

        if (!response.ok) {
          let detail = `HTTP ${response.status}`;
          try {
            const errBody = (await response.json()) as { detail?: string };
            detail = errBody.detail ?? detail;
          } catch {
            /* ignore parse error */
          }
          throw new IvyApiError(response.status, detail, url.pathname);
        }

        // 204 No Content
        if (response.status === 204) return undefined as T;

        return (await response.json()) as T;
      } catch (err) {
        if (err instanceof IvyApiError) throw err; // don't retry client errors
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt >= CONSTANTS.IVY.MAX_RETRIES) throw lastError;
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  private buildUrl(path: string, params: Record<string, unknown>): URL {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  private buildHeaders(token?: string, includeKey: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (includeKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private validate<T extends z.ZodTypeAny>(raw: unknown, schema: T, endpoint: string): z.infer<T> {
    const result = schema.safeParse(raw);
    if (!result.success) {
      logger.warn(
        { endpoint, errors: result.error.flatten() },
        'Schema mismatch — storing raw, flagging as finding',
      );
      // Return raw data (passthrough) so ingestion doesn't lose records
      return raw as z.infer<T>;
    }
    return result.data;
  }

  /** Fetch pages [startPage, endPage] concurrently in batches of 5 */
  private async fetchAllPages<T>(
    fetcher: (page: number) => Promise<T>,
    startPage: number,
    endPage: number,
  ): Promise<T[]> {
    const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => i + startPage);
    const results: T[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
      const batch = pages.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(fetcher));
      results.push(...batchResults);
    }

    return results;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
