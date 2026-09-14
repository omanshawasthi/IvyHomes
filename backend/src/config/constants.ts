/**
 * Application-wide constants — no DB references.
 */
export const CONSTANTS = {
  IVY: {
    MAX_PAGE_LIMIT: 200,
    DEFAULT_LIMIT:  20,
    MAX_RETRIES:    3,
    RETRY_BASE_DELAY_MS: 1000,
  },

  /**
   * Assignment reference time: 2026-09-10T00:00:00+05:30 (IST)
   * UTC equivalent: 2026-09-09T18:30:00Z
   */
  REFERENCE_TIME_UTC: new Date('2026-09-09T18:30:00Z'),
  SEVEN_DAYS_MS: 7 * 24 * 60 * 60 * 1000,

  /** Assigned locality for Q5 */
  ASSIGNED_LOCALITY: 'bellandur',

  RATE_LIMIT: {
    WINDOW_MS:    60 * 1000,
    MAX_REQUESTS: 300,
  },

  /** Path where analyze.ts writes its output */
  ANALYSIS_OUTPUT_PATH: './analysis-output.json',
} as const;
