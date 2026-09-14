import { Router } from 'express';
import { z } from 'zod';
import { IvyApiClient } from '../ivy-client/IvyApiClient.js';
import { mapLocality } from '../utils/localityMapper.js';

const router = Router();
const client = new IvyApiClient();

const QuerySchema = z.object({
  page:           z.coerce.number().int().positive().default(1),
  limit:          z.coerce.number().int().positive().max(200).default(20),
  locality:       z.string().trim().toLowerCase().optional(),
  project_status: z.string().optional(),
  sort_by:        z.enum(['price_min', 'price_max', 'launch_date', 'total_units']).optional(),
  order:          z.enum(['asc', 'desc']).default('asc'),
});

router.get('/', async (req, res, next) => {
  try {
    const params = QuerySchema.parse(req.query);
    const token  = req.cookies['ivy_session'] as string | undefined;
    const result = await client.getProjectsPage({
      page:  params.page,
      limit: params.limit,
      order: params.order,
      ...(params.locality       !== undefined && { locality:       mapLocality(params.locality) }),
      ...(params.project_status !== undefined && { project_status: params.project_status }),
      ...(params.sort_by        !== undefined && { sort_by:        params.sort_by }),
    }, token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id    = req.params['id'];
    if (!id) { res.status(400).json({ error: 'Missing project ID' }); return; }
    const token = req.cookies['ivy_session'] as string | undefined;
    const result = await client.getProjectById(id, token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { router as projectsRouter };
