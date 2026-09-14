const KNOWN_LOCALITIES = [
  'bellandur',
  'whitefield',
  'koramangala',
  'sarjapur road',
  'jayanagar',
  'indiranagar',
  'hsr layout',
  'hebbal',
  'electronic city',
  'marathahalli',
  'yelahanka',
  'malleshwaram',
  'basavanagudi',
  'rajajinagar',
  'btm layout',
  'jp nagar',
  'banashankari',
  'kr puram',
  'bommanahalli',
  'cv raman nagar'
];

export function mapLocality(input?: string): string | undefined {
  if (!input) return undefined;
  const lower = input.trim().toLowerCase();
  if (lower === '') return undefined;
  
  // If exact match, just return it
  if (KNOWN_LOCALITIES.includes(lower)) return lower;

  // Otherwise, find the first locality that includes the typed substring
  const match = KNOWN_LOCALITIES.find(l => l.includes(lower));
  return match || lower;
}
