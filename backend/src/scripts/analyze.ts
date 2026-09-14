/**
 * analyze.ts — Fetches the entire Bangalore dataset in memory,
 * runs every hypothesis detector, computes all 10 assignment answers,
 * and writes analysis-output.json + submission.json.
 *
 * Run: npm run analyze
 *
 * This is intentionally a single-file script, not split across services,
 * because it only runs once (or on demand) and clarity beats abstraction here.
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

import { IvyApiClient } from '../ivy-client/IvyApiClient.js';
import { ImpossibleGeometryDetector } from '../analysis/ImpossibleGeometryDetector.js';
import { DuplicatePropertyDetector } from '../analysis/DuplicatePropertyDetector.js';
import { FakeListingDetector } from '../analysis/FakeListingDetector.js';
import { ProjectListingCountValidator } from '../analysis/ProjectListingCountValidator.js';
import { UnitMismatchDetector } from '../analysis/UnitMismatchDetector.js';
import { CONSTANTS } from '../config/constants.js';
import type { Finding } from '../analysis/hypothesis.js';

// ─── Types for the raw API shapes ────────────────────────────────────────────

interface RawListing {
  listing_id: string;
  locality: string;
  bedroom: number;
  carpet_area: number;
  super_built_up_area: number;
  floor: number;
  apartment_name: string;
  posted_by_contact: string;
  posted_by_name: string;
  description: string;
  price: number;
  is_live: boolean;
  posted_at: string;
  project_id: string | null;
  [key: string]: unknown;
}

interface RawRental {
  listing_id: string;
  locality: string;
  price: number;
  [key: string]: unknown;
}

interface RawProject {
  project_id: string;
  total_listings: number;
  price_max: number;
  [key: string]: unknown;
}

const client = new IvyApiClient();

async function main(): Promise<void> {
  console.log('\n=== IVY HOMES ANALYSIS ENGINE ===\n');

  // ── Step 1: Login to get token ──────────────────────────────────────────
  console.log('Logging in with demo account...');
  const auth = await client.login('demo1@ivy.homes', process.env['IVY_DEMO_PASSWORD'] || '37ef3a4900');
  const token = auth.access_token;
  console.log(`  ✓ Logged in as ${auth.user.email}`);

  // ── Step 2: Fetch entire dataset ──────────────────────────────────────────
  console.log('Fetching all listings...');
  const allListings = await client.getAllListings({}, token) as RawListing[];
  console.log(`  ✓ ${allListings.length} listing records`);

  console.log('Fetching all rentals...');
  const allRentals = await client.getAllRentals({}, token) as RawRental[];
  console.log(`  ✓ ${allRentals.length} rental records`);

  console.log('Fetching all projects...');
  const allProjects = await client.getAllProjects({}, token) as RawProject[];
  console.log(`  ✓ ${allProjects.length} projects`);

  // ── Step 3: Run hypothesis detectors ─────────────────────────────────────
  console.log('\nRunning hypothesis detectors...');

  const geoDetector   = new ImpossibleGeometryDetector();
  const dupDetector   = new DuplicatePropertyDetector();
  const fakeDetector  = new FakeListingDetector();
  const projValidator = new ProjectListingCountValidator(client);
  const unitDetector  = new UnitMismatchDetector();

  // Cast needed: our detectors use a typed interface but the fetched data
  // is loosely typed — the zod schemas already validated the shapes on ingest.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoFindings   = geoDetector.test(allListings as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dupFindings   = dupDetector.test(allListings as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeFindings  = fakeDetector.test(allListings as any);
  const projFindings  = await projValidator.test(allListings, allProjects, token);
  const unitFindings  = unitDetector.test(allListings as unknown[], allRentals as unknown[]);

  const allFindings: Finding[] = [
    ...geoFindings,
    ...dupFindings,
    ...fakeFindings,
    ...projFindings,
    ...unitFindings,
  ];

  const confirmed  = allFindings.filter(f => f.status === 'confirmed');
  const ruled_out  = allFindings.filter(f => f.status === 'ruled_out');
  console.log(`  ✓ ${confirmed.length} confirmed findings, ${ruled_out.length} ruled out`);

  // ── Step 3: Compute the 10 answers ───────────────────────────────────────
  console.log('\nComputing assignment answers...\n');

  // Q1: total_listing_records
  const total_listing_records = allListings.length;
  console.log(`Q1  total_listing_records:    ${total_listing_records}`);

  // Q2: unique_properties
  // Use exact structural dedup (locality + bedroom + areas + floor + name)
  // and report both methods for transparency
  const exactGroups  = dupDetector.groupByExactKey(allListings as any);
  const unique_exact = exactGroups.size;
  const looseGroups  = dupDetector.groupByLooseKey(allListings as any);
  const unique_loose = computeUniqueLoose(allListings, looseGroups as Map<string, RawListing[]>);
  const unique_properties = unique_exact; // primary answer: structural dedup
  console.log(`Q2  unique_properties:        ${unique_properties} (exact) / ${unique_loose} (loose)`);

  // Q3: active_listings
  const active_listings = allListings.filter(l => l.is_live === true).length;
  console.log(`Q3  active_listings:          ${active_listings}`);

  // Q4: corrupt_listing_ids (impossible geometry)
  const corrupt_listing_ids = allListings
    .filter(l => geoDetector.isImpossible(l as any))
    .map(l => l.listing_id)
    .sort();
  console.log(`Q4  corrupt_listing_ids:      ${corrupt_listing_ids.length} records [${corrupt_listing_ids.slice(0,3).join(', ')}${corrupt_listing_ids.length > 3 ? '...' : ''}]`);

  // Q5: total_monthly_rent in Bellandur
  const bellandurRentals = allRentals.filter(
    r => r.locality?.toLowerCase().trim() === CONSTANTS.ASSIGNED_LOCALITY
  );
  const total_monthly_rent = bellandurRentals.reduce((sum, r) => sum + (r.price ?? 0), 0);
  console.log(`Q5  total_monthly_rent:       ₹${total_monthly_rent.toLocaleString('en-IN')} (${bellandurRentals.length} Bellandur rentals)`);

  // Q6: avg_price_per_sqft for live 2BHK, excluding corrupt + fake listings
  const fakeIds = new Set<string>(
    fakeFindings
      .filter(f => f.status === 'confirmed')
      .flatMap(f => f.evidence)
  );
  const excludeIds = new Set<string>([...corrupt_listing_ids, ...fakeIds]);

  const eligible2bhk = allListings.filter(l =>
    l.is_live === true &&
    l.bedroom === 2 &&
    !excludeIds.has(l.listing_id) &&
    l.carpet_area > 0
  );

  const avg_price_per_sqft_2bhk = eligible2bhk.length === 0
    ? 0
    : parseFloat(
        (eligible2bhk.reduce((sum, l) => sum + (l.price / l.carpet_area), 0) / eligible2bhk.length)
          .toFixed(2)
      );
  console.log(`Q6  avg_price_per_sqft_2bhk:  ₹${avg_price_per_sqft_2bhk} (from ${eligible2bhk.length} eligible 2BHK listings)`);

  // Q7: costliest project by price_max
  const costliest = allProjects.reduce<RawProject | null>((best, p) =>
    best === null || p.price_max > best.price_max ? p : best,
    null
  );
  const costliest_project = costliest
    ? { project_id: costliest.project_id, price_max_inr: costliest.price_max }
    : { project_id: '', price_max_inr: 0 };
  console.log(`Q7  costliest_project:        ${costliest_project.project_id} @ ₹${costliest_project.price_max_inr.toLocaleString('en-IN')}`);

  // Q8: listings in [REFERENCE - 7 days, REFERENCE)
  const refTime   = CONSTANTS.REFERENCE_TIME_UTC.getTime();
  const weekBefore = refTime - CONSTANTS.SEVEN_DAYS_MS;
  const listings_last_7_days = allListings.filter(l => {
    const t = new Date(l.posted_at).getTime();
    return t >= weekBefore && t < refTime;
  }).length;
  console.log(`Q8  listings_last_7_days:     ${listings_last_7_days}`);

  // Q9: fake_listing_ids
  const fake_listing_ids = Array.from(fakeIds).sort();
  console.log(`Q9  fake_listing_ids:         ${fake_listing_ids.length} records`);

  // Q10: projects_with_wrong_listing_count
  // Compare project.total_listings vs actual count of listings per project_id
  const listingsByProject = new Map<string, number>();
  for (const l of allListings) {
    if (l.project_id) {
      listingsByProject.set(l.project_id, (listingsByProject.get(l.project_id) ?? 0) + 1);
    }
  }
  const wrongCountProjects = allProjects.filter(p => {
    const actual = listingsByProject.get(p.project_id) ?? 0;
    return actual !== p.total_listings;
  });
  const projects_with_wrong_listing_count = wrongCountProjects.length;
  console.log(`Q10 projects_with_wrong_count: ${projects_with_wrong_listing_count} of ${allProjects.length} projects`);

  if (wrongCountProjects.length > 0) {
    console.log('    Examples:');
    wrongCountProjects.slice(0, 5).forEach(p => {
      const actual = listingsByProject.get(p.project_id) ?? 0;
      console.log(`    ${p.project_id}: documented=${p.total_listings}, actual=${actual}`);
    });
  }

  // ── Step 4: Build output objects ──────────────────────────────────────────

  const answers = {
    total_listing_records,
    unique_properties,
    active_listings,
    corrupt_listing_ids,
    total_monthly_rent,
    avg_price_per_sqft_2bhk,
    costliest_project,
    listings_last_7_days,
    fake_listing_ids,
    projects_with_wrong_listing_count,
  };

  // Submission-ready findings (confirmed only, capped at 20 evidence each)
  const submissionFindings = confirmed.map(f => ({
    endpoint:   f.endpoint,
    category:   f.category,
    documented: f.documented,
    actual:     f.actual,
    how_found:  f.how_found,
    impact:     f.impact,
    evidence:   f.evidence.slice(0, 20),
  }));

  // analysis-output.json — includes ruled_out findings too (for insights screen)
  const analysisOutput = {
    generated_at:    new Date().toISOString(),
    dataset: {
      total_listings: allListings.length,
      total_rentals:  allRentals.length,
      total_projects: allProjects.length,
    },
    answers,
    findings: allFindings,
    submission_findings: submissionFindings,
    // Extra data for the insights screen
    insights: {
      bellandur_rentals:        bellandurRentals.length,
      unique_exact:             unique_exact,
      unique_loose:             unique_loose,
      duplicate_gap:            unique_loose - unique_exact,
      eligible_2bhk_count:      eligible2bhk.length,
      wrong_count_projects:     wrongCountProjects.map(p => ({
        project_id:   p.project_id,
        documented:   p.total_listings,
        actual:       listingsByProject.get(p.project_id) ?? 0,
      })),
    },
  };

  const outputPath = resolve(process.cwd(), 'analysis-output.json');
  writeFileSync(outputPath, JSON.stringify(analysisOutput, null, 2));
  console.log(`\n✓ Written: ${outputPath}`);

  // submission.json — at repo root
  const submission = {
    api_key: process.env['IVY_API_KEY'] ?? '',
    candidate: {
      name:     '',
      email:    '',
      repo_url: '',
      demo_url: '',
    },
    answers,
    findings: submissionFindings,
  };

  // Try to preserve candidate details if submission.json already has them
  try {
    const existing = JSON.parse(
      (await import('fs')).readFileSync(resolve(process.cwd(), '../submission.json'), 'utf-8')
    ) as typeof submission;
    if (existing.candidate?.name)     submission.candidate.name     = existing.candidate.name;
    if (existing.candidate?.email)    submission.candidate.email    = existing.candidate.email;
    if (existing.candidate?.repo_url) submission.candidate.repo_url = existing.candidate.repo_url;
    if (existing.candidate?.demo_url) submission.candidate.demo_url = existing.candidate.demo_url;
  } catch { /* submission.json doesn't exist yet or can't be parsed */ }

  const submissionPath = resolve(process.cwd(), '../submission.json');
  writeFileSync(submissionPath, JSON.stringify(submission, null, 2));
  console.log(`✓ Written: ${submissionPath}`);

  console.log('\n=== SUMMARY ===');
  console.log(`Confirmed findings: ${confirmed.length}`);
  console.log(`Ruled out:          ${ruled_out.length}`);
  console.log(`\nRun 'npm run report' for a formatted table.\n`);
}

/**
 * Compute unique count from loose groups (seller+locality+bhk).
 * Records not in any loose group are counted individually.
 */
function computeUniqueLoose(
  records: RawListing[],
  looseGroups: Map<string, RawListing[]>,
): number {
  const seenIds = new Set<string>();
  let uniqueCount = 0;

  for (const group of looseGroups.values()) {
    const canonical = group[0];
    if (canonical && !seenIds.has(canonical.listing_id)) {
      uniqueCount++;
      for (const l of group) seenIds.add(l.listing_id);
    }
  }

  // Records not clustered in any loose group
  for (const record of records) {
    if (!seenIds.has(record.listing_id)) {
      uniqueCount++;
      seenIds.add(record.listing_id);
    }
  }

  return uniqueCount;
}

main().catch((err) => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
