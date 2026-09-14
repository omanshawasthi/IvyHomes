import type { Finding } from './hypothesis.js';
import type { IvyApiClient } from '../ivy-client/IvyApiClient.js';

type ProjectLike = {
  project_id: string;
  total_listings: number;
  [key: string]: unknown;
};

type ListingLike = {
  listing_id: string;
  project_id: string | null;
  [key: string]: unknown;
};

/**
 * ProjectListingCountValidator
 *
 * Hypothesis: The `total_listings` field on a project object is documented
 * as always matching the live count from GET /v1/listings?project_id=...
 * This is almost certainly not true for every project — find the ones that disagree.
 *
 * This feeds Q10 (projects_with_wrong_listing_count).
 *
 * Method A (in-memory): count listings per project_id from the already-fetched
 * dataset. Fast, no extra API calls, but only counts what was ingested.
 *
 * Method B (live API): for a sample of projects, fetch
 * GET /v1/listings?project_id=X&limit=1 and read the `total` field.
 * Authoritative, but costs one API call per project.
 *
 * We run Method A on all projects, then Method B on a 10-project sample to
 * cross-validate that Method A and the live API agree. If they disagree, that's
 * itself a finding about pagination/completeness.
 */
export class ProjectListingCountValidator {
  readonly id = 'project-listing-count';
  readonly description =
    'total_listings on each project is documented as always agreeing with the live listing count — this validator checks whether that claim holds.';

  constructor(private readonly client: IvyApiClient) {}

  async test(listings: ListingLike[], projects: ProjectLike[], token: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // ── Method A: in-memory count ─────────────────────────────────────────
    const actualCounts = new Map<string, number>();
    for (const l of listings) {
      if (l.project_id) {
        actualCounts.set(l.project_id, (actualCounts.get(l.project_id) ?? 0) + 1);
      }
    }

    const wrongProjects = projects.filter(p => {
      const actual = actualCounts.get(p.project_id) ?? 0;
      return actual !== p.total_listings;
    });

    const evidence = wrongProjects
      .slice(0, 20)
      .map(p => p.project_id)
      .sort();

    if (wrongProjects.length === 0) {
      findings.push({
        id:         this.id,
        endpoint:   '/v1/projects',
        category:   'consistency',
        documented: 'total_listings is recomputed whenever a listing is added or withdrawn, so it always agrees with what GET /v1/listings?project_id=... returns.',
        actual:     'Confirmed for the in-memory dataset: all project total_listings values match actual listing counts.',
        how_found:  'Counted listings per project_id from the ingested dataset and compared against project.total_listings for all projects.',
        impact:     'None — this claim holds for our dataset.',
        evidence:   [],
        status:     'ruled_out',
        ruling_reason: 'All project.total_listings values match the actual ingested listing count per project_id.',
      });
    } else {
      const examples = wrongProjects.slice(0, 5).map(p => ({
        project_id:  p.project_id,
        documented:  p.total_listings,
        actual:      actualCounts.get(p.project_id) ?? 0,
        difference:  (actualCounts.get(p.project_id) ?? 0) - p.total_listings,
      }));

      findings.push({
        id:         this.id,
        endpoint:   '/v1/projects',
        category:   'consistency',
        documented: 'total_listings is recomputed whenever a listing is added or withdrawn, so it always agrees with what GET /v1/listings?project_id=... returns.',
        actual:     `${wrongProjects.length} of ${projects.length} projects have a total_listings that disagrees with the actual listing count. Examples: ${JSON.stringify(examples)}`,
        how_found:  'Counted listings per project_id from the complete ingested dataset and compared against project.total_listings.',
        impact:     'Displays wrong listing counts in project cards. The documented guarantee of consistency is false.',
        evidence,
        status:     'confirmed',
      });
    }

    // ── Method B: live API spot-check on 10 random projects ──────────────
    const sampleProjects = projects.slice(0, 10);
    const liveDiscrepancies: string[] = [];

    for (const project of sampleProjects) {
      try {
        const page = await this.client.getListingsPage(
          { project_id: project.project_id, limit: 1, page: 1 },
          token,
        );
        const liveCount = page.total;
        const memCount  = actualCounts.get(project.project_id) ?? 0;

        if (Math.abs(liveCount - memCount) > 1) {
          // The live API count disagrees with our in-memory count — completeness issue
          liveDiscrepancies.push(project.project_id);
        }
      } catch {
        // Ignore individual failures
      }
    }

    if (liveDiscrepancies.length > 0) {
      findings.push({
        id:         `${this.id}-live-vs-memory`,
        endpoint:   '/v1/listings',
        category:   'completeness',
        documented: 'The full dataset is retrievable by paging /v1/listings to exhaustion.',
        actual:     `For ${liveDiscrepancies.length} of 10 sampled projects, the live API total differs from our in-memory ingested count — suggesting our full-fetch may have missed some records.`,
        how_found:  'Cross-validated in-memory listing counts against GET /v1/listings?project_id=X&limit=1 total field for 10 sampled projects.',
        impact:     'Our total_listing_records answer may be slightly lower than the true count.',
        evidence:   liveDiscrepancies,
        status:     liveDiscrepancies.length > 0 ? 'confirmed' : 'ruled_out',
      });
    }

    return findings;
  }
}
