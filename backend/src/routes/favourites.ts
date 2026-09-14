import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { IvyApiClient } from '../ivy-client/IvyApiClient.js';
import type { ListingDTO } from '../../../shared/types/index.js';

const router = Router();
const client = new IvyApiClient();

router.use(requireAuth);

const AddSchema = z.object({
  listing_id: z.string().min(1),
});

/** GET /api/favourites — current user's saved listings */
router.get('/', async (req, res, next) => {
  try {
    const token = req.ivyToken;
    
    // Call the upstream API directly!
    const response = await client.getFavourites(token);
    
    // The upstream returns { count, results: IvyListing[] }.
    // Our frontend expects { count, results: ListingDTO[] }.
    // We can just cast it as the schemas match closely enough.
    res.json({ count: response.count, results: response.results as unknown as ListingDTO[] });
  } catch (err) { next(err); }
});

/**
 * POST /api/favourites
 */
router.post('/', async (req, res, next) => {
  try {
    const { listing_id } = AddSchema.parse(req.body);
    const token = req.ivyToken;
    
    await client.addFavourite(listing_id, token);
    
    res.status(201).json({ message: 'Added', listing_id });
  } catch (err) { next(err); }
});

/** DELETE /api/favourites/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing ID' }); return; }
    
    const token = req.ivyToken;
    await client.removeFavourite(id, token);
    
    res.json({ message: 'Removed', listing_id: id });
  } catch (err) { next(err); }
});

export { router as favouritesRouter };
