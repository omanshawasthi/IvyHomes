import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { IvyApiClient } from '../ivy-client/IvyApiClient.js';
import { logger } from '../config/logger.js';

const router = Router();
const client = new IvyApiClient();

/**
 * Loads analysis output produced by `npm run analyze`.
 * Returns null if the analysis script hasn't been run yet.
 */
function loadAnalysisOutput(): unknown {
  let outputPath = resolve(process.cwd(), 'analysis-output.json');
  if (!existsSync(outputPath)) {
    // Try Vercel root path
    outputPath = resolve(process.cwd(), 'backend/analysis-output.json');
  }
  
  if (!existsSync(outputPath)) {
    logger.warn(`analysis-output.json not found — run \`npm run analyze\` first (checked ${outputPath})`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(outputPath, 'utf-8'));
  } catch (err) {
    logger.error({ err }, 'Failed to parse analysis-output.json');
    return null;
  }
}

/**
 * GET /api/analytics/summary
 *
 * Returns pre-computed analysis results from analysis-output.json, plus
 * a live attempt at the upstream /v1/analytics/summary endpoint (which may
 * or may not exist — its existence/non-existence is itself a finding).
 */
router.get('/summary', async (_req, res, next) => {
  try {
    const localAnalysis = loadAnalysisOutput();

    // Attempt upstream analytics endpoint — may 404 (that's a finding)
    let upstreamAnalytics: unknown = null;
    let upstreamError: string | null = null;
    try {
      upstreamAnalytics = await client.getAnalyticsSummary();
    } catch (err) {
      upstreamError = err instanceof Error ? err.message : String(err);
      logger.warn({ err: upstreamError }, '/v1/analytics/summary failed');
    }

    res.json({
      local_analysis:     localAnalysis,
      upstream_analytics: upstreamAnalytics,
      upstream_error:     upstreamError,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/findings
 * Returns findings from the analysis output file.
 */
router.get('/findings', (_req, res) => {
  const analysis = loadAnalysisOutput() as Record<string, unknown> | null;
  if (!analysis) {
    res.json({ count: 0, findings: [], note: 'Run `npm run analyze` to generate findings.' });
    return;
  }
  const findings = Array.isArray(analysis['findings']) ? analysis['findings'] : [];
  res.json({ count: findings.length, findings });
});

/**
 * GET /api/analytics/findings/:id/verify
 * Re-fetches the listed evidence IDs from the live API so the audit screen
 * can display "what the API actually says right now" next to the finding.
 */
router.get('/findings/:hypothesisId/verify', async (req, res, next) => {
  try {
    const analysis = loadAnalysisOutput() as Record<string, unknown> | null;
    if (!analysis) {
      res.status(404).json({ error: 'Analysis not yet run' });
      return;
    }

    const findings = Array.isArray(analysis['findings']) ? analysis['findings'] as Array<Record<string, unknown>> : [];
    const finding  = findings.find((f) => f['id'] === req.params['hypothesisId']);
    if (!finding) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }

    const evidence = Array.isArray(finding['evidence'])
      ? (finding['evidence'] as string[]).slice(0, 5)
      : [];

    // Re-fetch live evidence to prove the finding is still reproducible
    const liveResults = await Promise.allSettled(
      evidence.map(async (id) => {
        if (id.startsWith('R')) {
          // Rental ID
          const page = await client.getRentalsPage({ limit: 1 });
          return { id, type: 'rental', total: page.total };
        } else if (typeof id === 'string' && id.startsWith('P') && !id.includes('-')) {
          return await client.getProjectById(id);
        } else {
          return await client.getListingById(id);
        }
      }),
    );

    res.json({
      finding,
      live_verification: liveResults.map((r, i) => ({
        evidence_id: evidence[i],
        status:      r.status,
        data:        r.status === 'fulfilled' ? r.value : null,
        error:       r.status === 'rejected'  ? String(r.reason) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export { router as analyticsRouter };
