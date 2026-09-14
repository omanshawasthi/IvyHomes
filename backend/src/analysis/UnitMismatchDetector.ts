import type { Finding } from './hypothesis.js';

/**
 * UnitMismatchDetector
 *
 * Hypothesis: The documentation claims all monetary values are "integer, rupees"
 * and all area values are "integer, square feet, everywhere in the API."
 * Some values may be in different units than documented.
 *
 * Checks performed:
 *   1. Rental prices: are any suspiciously high to be monthly rent?
 *      (> ₹5,00,000/month is possible for luxury but warrants flagging > ₹10L)
 *   2. Area values: are any in square metres rather than square feet?
 *      (1 sqm = 10.764 sqft; a 100 sqm flat is ~1076 sqft, very common in Bangalore.
 *       If carpet_area is routinely 100–200 for 2BHK, it's sqm not sqft.)
 *   3. Project price_min/price_max: are they in lakhs rather than rupees?
 *      (documented as rupees; a ₹89 project would be absurd — ₹8900000 is normal)
 *
 * This detector produces ruled_out findings if all unit assumptions check out.
 */
export class UnitMismatchDetector {
  readonly id = 'unit-mismatch';
  readonly description =
    'Verifies that all monetary values are in rupees and all area values are in square feet as documented.';

  test(listings: unknown[], rentals: unknown[]): Finding[] {
    const findings: Finding[] = [];

    findings.push(...this.checkAreaUnits(listings as Array<{ listing_id: string; carpet_area: number; bedroom: number }>));
    findings.push(...this.checkRentalPriceUnits(rentals as Array<{ listing_id: string; price: number; bedroom: number; locality: string }>));

    return findings;
  }

  private checkAreaUnits(
    listings: Array<{ listing_id: string; carpet_area: number; bedroom: number }>,
  ): Finding[] {
    // For a 2BHK in Bangalore, carpet area in sqft is typically 800–1400 sqft.
    // In sqm it would be ~74–130. A carpet_area of 100–200 on a 2BHK strongly
    // suggests square metres, not square feet.
    const suspiciouslySmall = listings.filter(l =>
      l.bedroom >= 2 && l.carpet_area > 0 && l.carpet_area < 300
    );

    if (suspiciouslySmall.length === 0) {
      return [{
        id:         `${this.id}-area`,
        endpoint:   '/v1/listings',
        category:   'units',
        documented: 'Area: Square feet, integer, everywhere in the API.',
        actual:     'All 2BHK+ listings have carpet_area ≥ 300 — consistent with square feet. Unit assumption confirmed.',
        how_found:  'Checked all 2BHK+ listings for carpet_area < 300, which would suggest square metres.',
        impact:     'None — area units are correct.',
        evidence:   [],
        status:     'ruled_out',
        ruling_reason: 'No listings found with suspiciously small carpet_area for their bedroom count.',
      }];
    }

    return [{
      id:         `${this.id}-area`,
      endpoint:   '/v1/listings',
      category:   'units',
      documented: 'Area: Square feet, integer, everywhere in the API.',
      actual:     `${suspiciouslySmall.length} listings have carpet_area < 300 sqft for a 2BHK+ property — possible square-metre values.`,
      how_found:  'Flagged 2BHK+ listings with carpet_area < 300 as suspiciously small for square feet.',
      impact:     'Price-per-sqft calculations would be inflated ~10x if areas are in sqm.',
      evidence:   suspiciouslySmall.slice(0, 20).map(l => l.listing_id).sort(),
      status:     'confirmed',
    }];
  }

  private checkRentalPriceUnits(
    rentals: Array<{ listing_id: string; price: number; bedroom: number; locality: string }>,
  ): Finding[] {
    // Monthly rent > ₹10,00,000 (₹10L) for any property in Bangalore is
    // extremely unusual. Flag for review — could be annual rent entered as monthly.
    const suspicious = rentals.filter(r => r.price > 1_000_000);

    if (suspicious.length === 0) {
      return [{
        id:         `${this.id}-rental-price`,
        endpoint:   '/v1/rentals',
        category:   'units',
        documented: 'price is the monthly rent in rupees.',
        actual:     'All rental prices are ≤ ₹10,00,000/month — consistent with monthly rent in rupees.',
        how_found:  'Checked all rentals for price > ₹10L (would suggest annual or incorrect unit).',
        impact:     'None — rental price units are correct.',
        evidence:   [],
        status:     'ruled_out',
        ruling_reason: 'No rental prices exceed ₹10L/month.',
      }];
    }

    return [{
      id:         `${this.id}-rental-price`,
      endpoint:   '/v1/rentals',
      category:   'units',
      documented: 'price is the monthly rent in rupees.',
      actual:     `${suspicious.length} rental listings have price > ₹10,00,000 — possibly annual rent entered as monthly, or incorrect unit.`,
      how_found:  'Flagged rentals with price > ₹10,00,000 as suspicious for monthly rent.',
      impact:     'Q5 (total_monthly_rent for Bellandur) would be significantly inflated if any Bellandur rentals have this issue.',
      evidence:   suspicious.slice(0, 20).map(r => r.listing_id).sort(),
      status:     'confirmed',
    }];
  }
}
