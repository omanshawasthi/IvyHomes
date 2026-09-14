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
  bhk:       z.coerce.number().int().nonnegative().optional(),
  furnishing:z.string().optional(),
  sort_by:   z.enum(['price', 'carpet_area', 'posted_at', 'bedroom']).optional(),
  order:     z.enum(['asc', 'desc']).default('asc'),
});

router.get('/', async (req, res, next) => {
  try {
    const params = QuerySchema.parse(req.query);
    const token  = req.cookies['ivy_session'] as string | undefined;
    const result = await client.getRentalsPage({
      page:  params.page,
      limit: params.limit,
      order: params.order,
      ...(params.locality   !== undefined && { locality:   mapLocality(params.locality) }),
      ...(params.bhk        !== undefined && { bhk:        params.bhk }),
      ...(params.furnishing !== undefined && { furnishing: params.furnishing }),
      ...(params.sort_by    !== undefined && { sort_by:    params.sort_by }),
    }, token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id    = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing rental ID' }); return; }
    const token = req.cookies['ivy_session'] as string | undefined;
    const result = await client.getRentalById(id, token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { router as rentalsRouter };
