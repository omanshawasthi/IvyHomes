import type { Hypothesis, Finding } from './hypothesis.js';

type ListingLike = {
  listing_id: string;
  locality: string;
  bedroom: number;
  carpet_area: number;
  super_built_up_area: number;
  floor: number;
  apartment_name: string;
  posted_by_contact: string;
  posted_by_name: string;
};

/**
 * DuplicatePropertyDetector — two-pass deduplication.
 *
 * Pass 1 (exact): same locality+bedroom+areas+floor+name
 * Pass 2 (loose): same contact+locality+bedroom
 *
 * Gap between methods is a finding in itself.
 * Feeds Q2 (unique_properties).
 */
export class DuplicatePropertyDetector implements Hypothesis<ListingLike> {
  readonly id = 'duplicate-properties';
  readonly description =
    'The same physical property appears as multiple listing records, inflating counts and distorting averages.';

  test(records: ListingLike[]): Finding[] {
    const findings: Finding[] = [];

    const exactGroups  = this.groupByExactKey(records);
    const exactDups    = [...exactGroups.values()].filter(g => g.length > 1);
    const exactUnique  = exactGroups.size;

    const looseGroups  = this.groupByLooseKey(records);
    const looseDups    = [...looseGroups.values()].filter(g => g.length > 1);

    if (exactDups.length === 0) {
      findings.push({
        id: `${this.id}-exact`, endpoint: '/v1/listings', category: 'duplicates',
        documented: 'Every listing_id is globally unique and each listing corresponds to exactly one physical property.',
        actual: `No exact structural duplicates found. Unique property count (exact): ${exactUnique} = total records.`,
        how_found: 'Grouped by (locality, bedroom, carpet_area, super_built_up_area, floor, apartment_name).',
        impact: 'None for exact method.',
        evidence: [], status: 'ruled_out',
        ruling_reason: 'No groups with 2+ listing_ids on exact structural key.',
      });
    } else {
      const evidence = exactDups.flatMap(g => g.map(l => l.listing_id)).slice(0, 20).sort();
      findings.push({
        id: `${this.id}-exact`, endpoint: '/v1/listings', category: 'duplicates',
        documented: 'Every listing_id is globally unique and each listing corresponds to exactly one physical property.',
        actual: `${exactDups.length} groups of structurally identical listings. ${records.length - exactUnique} excess records. Unique count (exact): ${exactUnique}.`,
        how_found: 'Grouped by (locality, bedroom, carpet_area, super_built_up_area, floor, apartment_name). Groups with 2+ members are duplicates.',
        impact: 'Inflates total_listing_records. Q2 must exclude these.',
        evidence, status: 'confirmed',
      });
    }

    if (looseDups.length > 0) {
      const evidence = looseDups.flatMap(g => g.map(l => l.listing_id)).slice(0, 20).sort();
      findings.push({
        id: `${this.id}-loose`, endpoint: '/v1/listings', category: 'duplicates',
        documented: 'Each listing corresponds to exactly one physical property.',
        actual: `Loose dedup (same seller+locality+bedroom): ${looseDups.length} clusters. This widens the duplicate count beyond the exact method.`,
        how_found: 'Grouped by (posted_by_contact, locality, bedroom). Gap vs exact method is itself a finding.',
        impact: 'True unique count is between exact and loose estimates.',
        evidence, status: 'confirmed',
      });
    }

    return findings;
  }

  groupByExactKey(records: ListingLike[]): Map<string, ListingLike[]> {
    const groups = new Map<string, ListingLike[]>();
    for (const l of records) {
      const key = [l.locality.toLowerCase().trim(), l.bedroom, l.carpet_area, l.super_built_up_area, l.floor, l.apartment_name.toLowerCase().trim()].join('|');
      const g = groups.get(key) ?? [];
      g.push(l);
      groups.set(key, g);
    }
    return groups;
  }

  groupByLooseKey(records: ListingLike[]): Map<string, ListingLike[]> {
    const groups = new Map<string, ListingLike[]>();
    for (const l of records) {
      if (!l.posted_by_contact?.trim()) continue;
      const key = [l.posted_by_contact.trim(), l.locality.toLowerCase().trim(), l.bedroom].join('|');
      const g = groups.get(key) ?? [];
      g.push(l);
      groups.set(key, g);
    }
    return groups;
  }

  countUniqueExact(records: ListingLike[]): number {
    return this.groupByExactKey(records).size;
  }
}
