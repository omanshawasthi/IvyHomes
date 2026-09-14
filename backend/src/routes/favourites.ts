import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { IvyApiClient } from '../ivy-client/IvyApiClient.js';
import { logger } from '../config/logger.js';
import type { ListingDTO } from '../../../shared/types/index.js';

const router = Router();
const client = new IvyApiClient();

// In-memory store: Map<ivyToken, Set<listing_id>>
const favouritesStore = new Map<string, Set<string>>();

router.use(requireAuth);

const AddSchema = z.object({
  listing_id: z.string().min(1),
});

/** GET /api/favourites — current user's saved listings */
router.get('/', async (req, res, next) => {
  try {
    const token = req.ivyToken;
    const ids = Array.from(favouritesStore.get(token) || new Set<string>());
    
    // Fetch details for all saved listings concurrently
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
    const token = req.ivyToken;
    
    if (!favouritesStore.has(token)) {
      favouritesStore.set(token, new Set<string>());
    }
    favouritesStore.get(token)!.add(listing_id);
    
    res.status(201).json({ message: 'Added', listing_id });
  } catch (err) { next(err); }
});

/** DELETE /api/favourites/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing ID' }); return; }
    
    const token = req.ivyToken;
    if (favouritesStore.has(token)) {
      favouritesStore.get(token)!.delete(id);
    }
    
    res.json({ message: 'Removed', listing_id: id });
  } catch (err) { next(err); }
});

export { router as favouritesRouter };
