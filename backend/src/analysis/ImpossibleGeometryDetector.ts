import type { Hypothesis, Finding } from './hypothesis.js';

type ListingLike = {
  listing_id: string;
  carpet_area: number;
  super_built_up_area: number;
  price: number;
  bedroom?: number;
};

/**
 * ImpossibleGeometryDetector — flags listings that cannot physically exist.
 * - carpet_area > super_built_up_area (physically impossible)
 * - carpet_area <= 0 or super_built_up_area <= 0
 * - price <= 0
 *
 * Feeds Q4 (corrupt_listing_ids).
 */
export class ImpossibleGeometryDetector implements Hypothesis<ListingLike> {
  readonly id = 'impossible-geometry';
  readonly description =
    'Some listing records describe a property that cannot physically exist — carpet area exceeds super built-up area, or area/price is zero or negative.';

  test(records: ListingLike[]): Finding[] {
    const corrupt = records.filter(l => this.isImpossible(l));

    if (corrupt.length === 0) {
      return [{
        id: this.id, endpoint: '/v1/listings', category: 'data_quality',
        documented: 'Each listing corresponds to exactly one physical property.',
        actual: 'No geometrically impossible listings found. All carpet_area ≤ super_built_up_area, all areas/prices positive.',
        how_found: 'Scanned every listing for carpet_area > super_built_up_area and for zero/negative area or price.',
        impact: 'None — ruled out.',
        evidence: [], status: 'ruled_out',
        ruling_reason: 'All records pass geometry and price checks.',
      }];
    }

    const evidence = corrupt.slice(0, 20).map(l => l.listing_id).sort();
    return [{
      id: this.id, endpoint: '/v1/listings', category: 'data_quality',
      documented: 'Each listing_id corresponds to exactly one physical property.',
      actual: `${corrupt.length} listing records are geometrically impossible (carpet > super built-up, or zero/negative area/price).`,
      how_found: 'Scanned every listing for carpet_area > super_built_up_area and for zero/negative values.',
      impact: 'These inflate listing counts and skew price-per-sqft. Must be excluded from Q6.',
      evidence, status: 'confirmed',
    }];
  }

  isImpossible(l: ListingLike): boolean {
    if (l.carpet_area > l.super_built_up_area) return true;
    if (l.carpet_area <= 0) return true;
    if (l.super_built_up_area <= 0) return true;
    if (l.price <= 0) return true;
    return false;
  }
}
