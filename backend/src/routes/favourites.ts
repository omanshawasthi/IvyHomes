import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { IvyApiClient } from '../ivy-client/IvyApiClient.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import type { ListingDTO } from '../../../shared/types/index.js';

const router = Router();
const client = new IvyApiClient();

router.use(requireAuth);

const AddSchema = z.object({
  listing_id: z.string().min(1),
});

const COOKIE_NAME = 'ivy_favourites';

function getFavs(req: Request): Set<string> {
  const val = req.cookies[COOKIE_NAME];
  if (!val) return new Set();
  try {
    return new Set(JSON.parse(val));
  } catch {
    return new Set();
  }
}

function setFavs(res: Response, favs: Set<string>) {
  res.cookie(COOKIE_NAME, JSON.stringify(Array.from(favs)), {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/** GET /api/favourites — current user's saved listings */
router.get('/', async (req, res, next) => {
  try {
    const token = req.ivyToken;
    const favs = getFavs(req);
    const ids = Array.from(favs);
    
    // Fetch details for all saved listings sequentially
    const results: ListingDTO[] = [];
    for (const id of ids) {
      try {
        const listing = await client.getListingById(id, token) as unknown as ListingDTO;
        results.push(listing);
      } catch (err) {
        logger.warn({ listingId: id }, 'Failed to fetch saved listing details');
      }
    }
    
    res.json({ count: results.length, results });
  } catch (err) { next(err); }
});

/**
 * POST /api/favourites
 */
router.post('/', async (req, res, next) => {
  try {
    const { listing_id } = AddSchema.parse(req.body);
    const favs = getFavs(req);
    favs.add(listing_id);
    setFavs(res, favs);
    
    res.status(201).json({ message: 'Added', listing_id });
  } catch (err) { next(err); }
});

/** DELETE /api/favourites/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing ID' }); return; }
    
    const favs = getFavs(req);
    favs.delete(id);
    setFavs(res, favs);
    
    res.json({ message: 'Removed', listing_id: id });
  } catch (err) { next(err); }
});

export { router as favouritesRouter };
