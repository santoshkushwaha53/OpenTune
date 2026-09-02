/**
 * Jamendo `search` matches names. Discover scenes are genres/languages, so we
 * also query `fuzzytags` (OR). These are open-catalog tags — not a commercial
 * Bollywood/Spotify mapping.
 */
const JAMENDO_TAG_ALIASES: Record<string, string[]> = {
  bollywood: ["india", "indian", "sitar", "world"],
  "indian pop": ["indian", "pop", "world"],
  hindi: ["india", "indian", "world"],
  tamil: ["india", "indian", "world"],
  telugu: ["india", "indian", "world"],
  malayalam: ["india", "indian", "world"],
  kannada: ["india", "indian", "world"],
  bengali: ["india", "indian", "world"],
  marathi: ["india", "indian", "world"],
  punjabi: ["india", "indian", "world"],
  gujarati: ["india", "indian", "world"],
  urdu: ["india", "indian", "world"],
  korean: ["pop", "world"],
  japanese: ["pop", "world"],
  spanish: ["latin", "pop"],
  french: ["pop", "world"],
  "english vocal": ["pop", "vocal"],
  "rnb soul": ["rnb", "soul"],
  "hip hop": ["hiphop", "rap"],
  lofi: ["lounge", "relaxation"],
  soundtrack: ["soundtrack"],
  devotional: ["relaxation", "world"],
  night: ["lounge", "ambient"],
  romantic: ["pop", "songwriter"],
  workout: ["electronic", "rock", "hiphop"],
  focus: ["classical", "relaxation", "ambient"],
  party: ["pop", "electronic", "dance"],
  relax: ["relaxation", "lounge", "ambient"],
  folk: ["folk"],
};

export function jamendoFuzzyTags(query: string, nameHitCount = 0): string[] {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key || key === "*") {
    return [];
  }
  const aliased = JAMENDO_TAG_ALIASES[key];
  if (aliased) {
    return aliased;
  }
  const tokens = key
    .split(/[\s,/]+/)
    .map((token) => token.replace(/[^a-z0-9-]/g, ""))
    .filter((token) => token.length >= 2);
  if (nameHitCount === 0 || tokens.length === 1) {
    return tokens;
  }
  return [];
}
