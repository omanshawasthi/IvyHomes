/**
 * Hypothesis engine — shared interface.
 *
 * Every analysis check is a small, named, independently testable class.
 * A ruled-out hypothesis is as valuable as a confirmed one — both get written
 * with their reasoning, because the README needs to report them too.
 */

export type FindingStatus = 'confirmed' | 'ruled_out' | 'pending';

export interface Finding {
  id:          string;
  endpoint:    string;
  category:
    | 'auth' | 'pagination' | 'units' | 'filters' | 'sorting'
    | 'timestamps' | 'duplicates' | 'completeness' | 'data_quality'
    | 'fraud' | 'consistency' | 'missing_endpoint' | 'undocumented_endpoint';
  documented:    string;
  actual:        string;
  how_found:     string;
  impact:        string;
  evidence:      string[];   // real IDs only, max 20
  status:        FindingStatus;
  ruling_reason?: string;
}

export interface Hypothesis<T> {
  readonly id:          string;
  readonly description: string;
  test(records: T[]): Finding[];
}
