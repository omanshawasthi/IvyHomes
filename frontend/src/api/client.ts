/**
 * Typed fetch client for our own backend only.
 * The frontend NEVER calls the Ivy API directly — always through this client.
 * The API key is never in this file.
 */

import type {
  ListingDTO, RentalDTO, ProjectDTO,
  PaginatedResponse, LoginResponseDTO,
  MeResponseDTO, AnalyticsSummaryDTO, FindingDTO,
} from '../../../shared/types/index.js';

// In dev, Vite proxies /api → :4000
// In prod, VITE_API_BASE_URL is set to the deployed backend URL
const BASE = (import.meta as { env?: Record<string, string> }).env?.['VITE_API_BASE_URL'] ?? '';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include', // always send cookies
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; detail?: string };
      detail = body.error ?? body.detail ?? detail;
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login:  (email: string, password: string) =>
    request<LoginResponseDTO>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<MeResponseDTO>('/api/auth/me'),

  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
};

// ─── Listings ─────────────────────────────────────────────────────────────────

export interface ListingFilters {
  page?:      number;
  limit?:     number;
  locality?:  string;
  bedroom?:   number;
  min_price?: number;
  max_price?: number;
  furnishing?:string;
  sort_by?:   string;
  order?:     'asc' | 'desc';
}

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const listingsApi = {
  list: (filters: ListingFilters = {}) =>
    request<PaginatedResponse<ListingDTO>>(`/api/listings${buildQuery(filters as Record<string, unknown>)}`),

  get: (id: string) =>
    request<ListingDTO>(`/api/listings/${encodeURIComponent(id)}`),

  similar: (id: string) =>
    request<{ results: ListingDTO[] }>(`/api/listings/${encodeURIComponent(id)}/similar`),
};

// ─── Rentals ──────────────────────────────────────────────────────────────────

export interface RentalFilters {
  page?:      number;
  limit?:     number;
  locality?:  string;
  bhk?:       number;
  furnishing?:string;
  sort_by?:   string;
  order?:     'asc' | 'desc';
}

export const rentalsApi = {
  list: (filters: RentalFilters = {}) =>
    request<PaginatedResponse<RentalDTO>>(`/api/rentals${buildQuery(filters as Record<string, unknown>)}`),

  get: (id: string) =>
    request<RentalDTO>(`/api/rentals/${encodeURIComponent(id)}`),
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface ProjectFilters {
  page?:           number;
  limit?:          number;
  locality?:       string;
  project_status?: string;
  sort_by?:        string;
  order?:          'asc' | 'desc';
}

export const projectsApi = {
  list: (filters: ProjectFilters = {}) =>
    request<PaginatedResponse<ProjectDTO>>(`/api/projects${buildQuery(filters as Record<string, unknown>)}`),

  get: (id: string) =>
    request<ProjectDTO>(`/api/projects/${encodeURIComponent(id)}`),
};

// ─── Favourites ───────────────────────────────────────────────────────────────

export const favouritesApi = {
  list: () =>
    request<{ count: number; results: ListingDTO[] }>('/api/favourites'),

  add: (listing_id: string) =>
    request<{ message: string; listing_id: string }>('/api/favourites', {
      method: 'POST',
      body: JSON.stringify({ listing_id }),
    }),

  remove: (listing_id: string) =>
    request<void>(`/api/favourites/${encodeURIComponent(listing_id)}`, {
      method: 'DELETE',
    }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsApi = {
  summary: () =>
    request<AnalyticsSummaryDTO>('/api/analytics/summary'),

  findings: () =>
    request<{ count: number; findings: FindingDTO[] }>('/api/analytics/findings'),

  verifyFinding: (hypothesisId: string) =>
    request<unknown>(`/api/analytics/findings/${encodeURIComponent(hypothesisId)}/verify`),
};
