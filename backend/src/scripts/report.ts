/**
 * report.ts — CLI summary of the analysis output.
 * Prints a formatted table to the terminal.
 *
 * Run: npm run report
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface AnalysisOutput {
  generated_at: string;
  dataset: { total_listings: number; total_rentals: number; total_projects: number };
  answers: Record<string, unknown>;
  findings: Array<{ id: string; status: string; category: string; actual: string }>;
  insights: {
    bellandur_rentals: number;
    unique_exact: number;
    unique_loose: number;
    eligible_2bhk_count: number;
    wrong_count_projects: Array<{ project_id: string; documented: number; actual: number }>;
  };
}

const outputPath = resolve(process.cwd(), 'analysis-output.json');

if (!existsSync(outputPath)) {
  console.error('❌ analysis-output.json not found. Run: npm run analyze');
  process.exit(1);
}

const data = JSON.parse(readFileSync(outputPath, 'utf-8')) as AnalysisOutput;

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  IVY HOMES — ANALYSIS REPORT');
console.log(`  Generated: ${new Date(data.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
console.log('═══════════════════════════════════════════════════════════\n');

console.log('DATASET');
console.log(`  Listings:  ${data.dataset.total_listings.toLocaleString('en-IN')}`);
console.log(`  Rentals:   ${data.dataset.total_rentals.toLocaleString('en-IN')}`);
console.log(`  Projects:  ${data.dataset.total_projects.toLocaleString('en-IN')}`);

console.log('\n10 ANSWERS');
console.log('─────────────────────────────────────────────────────────');
const a = data.answers;
console.log(`  Q1  total_listing_records:         ${a['total_listing_records']}`);
console.log(`  Q2  unique_properties:             ${a['unique_properties']}  (exact dedup: ${data.insights.unique_exact}, loose: ${data.insights.unique_loose})`);
console.log(`  Q3  active_listings:               ${a['active_listings']}`);
console.log(`  Q4  corrupt_listing_ids:           ${(a['corrupt_listing_ids'] as string[]).length} records`);
console.log(`  Q5  total_monthly_rent (Bellandur):₹${Number(a['total_monthly_rent']).toLocaleString('en-IN')}  (${data.insights.bellandur_rentals} rentals)`);
console.log(`  Q6  avg_price_per_sqft_2bhk:       ₹${a['avg_price_per_sqft_2bhk']}  (${data.insights.eligible_2bhk_count} eligible listings)`);
const cp = a['costliest_project'] as { project_id: string; price_max_inr: number };
console.log(`  Q7  costliest_project:             ${cp.project_id} @ ₹${cp.price_max_inr.toLocaleString('en-IN')}`);
console.log(`  Q8  listings_last_7_days:          ${a['listings_last_7_days']}`);
console.log(`  Q9  fake_listing_ids:              ${(a['fake_listing_ids'] as string[]).length} records`);
console.log(`  Q10 projects_with_wrong_count:     ${a['projects_with_wrong_listing_count']}`);

console.log('\nFINDINGS');
console.log('─────────────────────────────────────────────────────────');
const confirmed = data.findings.filter(f => f.status === 'confirmed');
const ruledOut  = data.findings.filter(f => f.status === 'ruled_out');
console.log(`  Confirmed: ${confirmed.length}   Ruled out: ${ruledOut.length}`);
console.log();
for (const f of confirmed) {
  console.log(`  ✓ [${f.category}] ${f.id}`);
  console.log(`    ${f.actual.slice(0, 100)}${f.actual.length > 100 ? '...' : ''}`);
}
console.log();
for (const f of ruledOut) {
  console.log(`  ○ [ruled out] ${f.id}`);
}

if (data.insights.wrong_count_projects.length > 0) {
  console.log('\nWRONG PROJECT COUNTS (Q10) — sample');
  console.log('─────────────────────────────────────────────────────────');
  for (const p of data.insights.wrong_count_projects.slice(0, 10)) {
    const diff = p.actual - p.documented;
    console.log(`  ${p.project_id}: documented=${p.documented}, actual=${p.actual} (${diff > 0 ? '+' : ''}${diff})`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════\n');
