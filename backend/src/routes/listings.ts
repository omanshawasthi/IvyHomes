import { Router } from 'express';
import { z } from 'zod';
import { IvyApiClient } from '../ivy-client/IvyApiClient.js';
import { mapLocality } from '../utils/localityMapper.js';

const router = Router();
const client = new IvyApiClient();

const QuerySchema = z.object({
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(200).default(20),
  locality:  z.string().trim().toLowerCase().optional(),
  bedroom:   z.coerce.number().int().nonnegative().optional(),
  bhk:       z.coerce.number().int().nonnegative().optional(), // alias the API may accept
  min_price: z.coerce.number().int().nonnegative().optional(),
  max_price: z.coerce.number().int().nonnegative().optional(),
  furnishing:z.string().optional(),
  sort_by:   z.enum(['price', 'carpet_area', 'posted_at', 'bedroom']).optional(),
  order:     z.enum(['asc', 'desc']).default('asc'),
  project_id:z.string().optional(),
});

/**
 * GET /api/listings
 * Proxies to Ivy API, injects server-side API key.
 * Passes all valid filter params upstream; if the API silently ignores some
 * (e.g. the bhk/bedroom naming discrepancy), the frontend analysis script
 * will detect that and note it as a finding.
 */
router.get('/', async (req, res, next) => {
  try {
    const params = QuerySchema.parse(req.query);
    const token  = req.cookies['ivy_session'] as string | undefined;

    const result = await client.getListingsPage({
      page:  params.page,
      limit: params.limit,
      order: params.order,
      ...(params.locality   !== undefined && { locality:    mapLocality(params.locality) }),
      ...(params.bhk        !== undefined && { bhk:         params.bhk }),
      ...(params.bedroom    !== undefined && { bhk:         params.bedroom }),
      ...(params.min_price  !== undefined && { min_price:   params.min_price }),
      ...(params.max_price  !== undefined && { max_price:   params.max_price }),
      ...(params.furnishing !== undefined && { furnishing:  params.furnishing }),
      ...(params.sort_by    !== undefined && { sort_by:     params.sort_by }),
      ...(params.project_id !== undefined && { project_id:  params.project_id }),
    }, token);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/listings/:id
 * Single listing proxy — tries /v1/listings/:id first, falls back to /v1/listing/:id
 * (the path discrepancy between singular/plural is handled inside IvyApiClient).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const listingId = req.params['id'];
    if (!listingId) { res.status(400).json({ error: 'Missing listing ID' }); return; }
    const token = req.cookies['ivy_session'] as string | undefined;
    const result = await client.getListingById(listingId, token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/listings/:id/similar
 * Optional — may 404 upstream; IvyApiClient handles gracefully and returns [].
 */
router.get('/:id/similar', async (req, res, next) => {
  try {
    const listingId = req.params['id'];
    if (!listingId) { res.status(400).json({ error: 'Missing listing ID' }); return; }
    const token  = req.cookies['ivy_session'] as string | undefined;
    const result = await client.getSimilarListings(listingId, token);
    res.json({ results: result });
  } catch (err) {
    next(err);
  }
});

export { router as listingsRouter };
