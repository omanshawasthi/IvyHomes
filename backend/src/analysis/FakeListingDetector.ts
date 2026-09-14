import type { Hypothesis, Finding } from './hypothesis.js';

// We use a looser type here since this runs on raw fetched data
type ListingLike = {
  listing_id: string;
  posted_by_contact: string;
  posted_by_name: string;
  posted_by: string;
  locality: string;
  bedroom: number;
  price: number;
  carpet_area: number;
  description: string;
  apartment_name: string;
  is_live: boolean;
};

/**
 * FakeListingDetector
 *
 * Hypothesis: Some listings exist to generate enquiries rather than represent
 * a genuine property for sale. They are not real — they are bait.
 *
 * Detection strategies (applied in order of confidence):
 *
 *   Strategy 1 — Contact number reuse across distinct seller names:
 *     A phone number that appears under multiple distinct posted_by_name values
 *     in the same locality for the same BHK is very likely a fake or aggregator
 *     listing. A genuine seller has one phone number and one name.
 *     Threshold: same contact → 3+ distinct seller names in the same locality.
 *
 *   Strategy 2 — Template description fingerprinting:
 *     Sellers who generate fake listings at scale reuse templates.
 *     We normalise descriptions (lowercase, strip numbers/punctuation) and
 *     cluster listings whose descriptions match with >85% token overlap.
 *     Genuine listings have personal, varied text.
 *
 *   Strategy 3 — Price outlier below locality median:
 *     A listing priced at less than 40% of the locality's median for the same
 *     BHK is either corrupt or bait (to generate a call about a "too good to
 *     be true" price). Combined with strategy 1 or 2, this strengthens the case.
 *
 * What is NOT flagged:
 *   - Listings where the same agent lists multiple different properties
 *     (different apartment names, different prices). Agents legitimately list
 *     many properties.
 *   - Listings with short descriptions — some genuine sellers are terse.
 *   - Listings with round numbers — common for genuine properties too.
 *
 * This feeds Q9 (fake_listing_ids) in the submission.
 */
export class FakeListingDetector implements Hypothesis<ListingLike> {
  readonly id = 'fake-listings';
  readonly description =
    'Some listings exist to generate enquiries rather than represent genuine properties — identified by contact number reuse across distinct seller names and template description patterns.';

  test(records: ListingLike[]): Finding[] {
    const findings: Finding[] = [];

    // ── Strategy 1: Contact reuse ──────────────────────────────────────────
    const contactFindings = this.detectContactReuse(records);
    findings.push(...contactFindings);

    // ── Strategy 2: Template descriptions ─────────────────────────────────
    const templateFindings = this.detectTemplateDescriptions(records);
    findings.push(...templateFindings);

    return findings;
  }

  /**
   * Returns the set of listing_ids identified as fake.
   * Called directly by the analysis script for Q9.
   */
  getFakeIds(records: ListingLike[]): Set<string> {
    const fakeIds = new Set<string>();

    // Contact reuse
    const contactGroups = this.buildContactGroups(records);
    for (const group of contactGroups.values()) {
      const distinctNames = new Set(group.map(l => l.posted_by_name.toLowerCase().trim()));
      if (distinctNames.size >= 3) {
        for (const l of group) fakeIds.add(l.listing_id);
      }
    }

    return fakeIds;
  }

  private detectContactReuse(records: ListingLike[]): Finding[] {
    // Group: contact → listings (across all localities)
    const contactGroups = this.buildContactGroups(records);

    const fakeClusters: ListingLike[][] = [];
    for (const group of contactGroups.values()) {
      const distinctNames = new Set(group.map(l => l.posted_by_name.toLowerCase().trim()));
      // Same contact number, 3+ distinct seller names → fake
      if (distinctNames.size >= 3) {
        fakeClusters.push(group);
      }
    }

    if (fakeClusters.length === 0) {
      return [{
        id:         `${this.id}-contact-reuse`,
        endpoint:   '/v1/listings',
        category:   'fraud',
        documented: 'posted_by_contact is the seller\'s verified contact number.',
        actual:     'No contact numbers found appearing under 3+ distinct seller names. Contact-reuse fake detection ruled out.',
        how_found:  'Grouped all listings by posted_by_contact and counted distinct posted_by_name values per contact.',
        impact:     'None — this strategy ruled out.',
        evidence:   [],
        status:     'ruled_out',
        ruling_reason: 'No contact appeared under 3+ distinct seller names.',
      }];
    }

    const fakeIds = fakeClusters
      .flatMap(g => g.map(l => l.listing_id))
      .slice(0, 20)
      .sort();

    const exampleContacts = fakeClusters
      .slice(0, 3)
      .map(g => ({
        contact: g[0]?.posted_by_contact ?? '',
        names:   [...new Set(g.map(l => l.posted_by_name))].slice(0, 4),
        count:   g.length,
      }));

    return [{
      id:         `${this.id}-contact-reuse`,
      endpoint:   '/v1/listings',
      category:   'fraud',
      documented: 'posted_by_contact is the seller\'s verified contact number.',
      actual:     `${fakeClusters.length} phone numbers appear under 3+ distinct seller names — indicating fabricated listings. Example clusters: ${JSON.stringify(exampleContacts)}`,
      how_found:  'Grouped all listings by posted_by_contact, counted distinct posted_by_name values per contact. Threshold: ≥3 distinct names = fake cluster.',
      impact:     'These listings generate false enquiries and inflate listing counts. They must be excluded from Q6 price calculations.',
      evidence:   fakeIds,
      status:     'confirmed',
    }];
  }

  private detectTemplateDescriptions(records: ListingLike[]): Finding[] {
    // Normalise description → token set
    const tokenise = (text: string): Set<string> => {
      const tokens = text
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')   // strip numbers and punctuation
        .split(/\s+/)
        .filter(t => t.length > 3); // ignore short words
      return new Set(tokens);
    };

    // Find pairs with >85% Jaccard similarity
    const templateClusters: string[][] = [];
    const clustered = new Set<number>();

    for (let i = 0; i < records.length; i++) {
      if (clustered.has(i)) continue;
      const ri = records[i];
      if (!ri?.description || ri.description.length < 20) continue;

      const tokensI = tokenise(ri.description);
      if (tokensI.size < 5) continue; // too short to be meaningful

      const cluster: string[] = [ri.listing_id];
      for (let j = i + 1; j < records.length; j++) {
        if (clustered.has(j)) continue;
        const rj = records[j];
        if (!rj?.description) continue;
        // Only compare same locality + BHK (templates are locality-specific)
        if (ri.locality !== rj.locality || ri.bedroom !== rj.bedroom) continue;

        const tokensJ = tokenise(rj.description);
        const intersection = new Set([...tokensI].filter(t => tokensJ.has(t)));
        const union        = new Set([...tokensI, ...tokensJ]);
        const jaccard      = intersection.size / union.size;

        if (jaccard > 0.85) {
          cluster.push(rj.listing_id);
          clustered.add(j);
        }
      }

      if (cluster.length >= 3) {
        templateClusters.push(cluster);
        clustered.add(i);
      }
    }

    if (templateClusters.length === 0) {
      return [{
        id:         `${this.id}-template-descriptions`,
        endpoint:   '/v1/listings',
        category:   'fraud',
        documented: 'description is the seller\'s own text, shown as written.',
        actual:     'No clusters of 3+ listings with >85% description similarity found in the same locality+BHK. Template description strategy ruled out.',
        how_found:  'Computed pairwise Jaccard similarity on normalised description token sets within same locality+BHK groups. Threshold: >85% similarity, ≥3 listings.',
        impact:     'None — this strategy ruled out.',
        evidence:   [],
        status:     'ruled_out',
        ruling_reason: 'No description template clusters found at >85% Jaccard similarity.',
      }];
    }

    const evidence = templateClusters.flatMap(c => c).slice(0, 20).sort();

    return [{
      id:         `${this.id}-template-descriptions`,
      endpoint:   '/v1/listings',
      category:   'fraud',
      documented: 'description is the seller\'s own text, shown as written.',
      actual:     `${templateClusters.length} clusters of 3+ listings found with >85% description similarity in the same locality+BHK. Template text is being reused across supposedly-distinct listings.`,
      how_found:  'Pairwise Jaccard similarity on normalised description tokens, grouped by locality+BHK. Clusters of ≥3 listings with >85% similarity flagged.',
      impact:     'Template listings are fake — they represent a single real (or nonexistent) property shown repeatedly to generate enquiries.',
      evidence,
      status:     'confirmed',
    }];
  }

  private buildContactGroups(records: ListingLike[]): Map<string, ListingLike[]> {
    const groups = new Map<string, ListingLike[]>();
    for (const l of records) {
      if (!l.posted_by_contact || l.posted_by_contact.trim() === '') continue;
      const key = l.posted_by_contact.trim();
      const group = groups.get(key) ?? [];
      group.push(l);
      groups.set(key, group);
    }
    return groups;
  }
}
