/**
 * Jamendo `search` matches names. Discover scenes are genres/languages, so we
 * also query `fuzzytags` one tag at a time. These are open-catalog tags — not a
 * commercial Bollywood/Spotify mapping.
 */
const JAMENDO_TAG_ALIASES: Record<string, string[]> = {
  bollywood: ["india", "indian", "sitar", "tabla", "raga", "bhangra", "carnatic"],
  "indian pop": ["indian", "sitar", "bhangra"],
  hindi: ["india", "indian", "sitar", "tabla", "raga", "bhangra"],
  tamil: ["india", "indian", "carnatic", "sitar"],
  telugu: ["india", "indian", "carnatic"],
  malayalam: ["india", "indian"],
  kannada: ["india", "indian"],
  bengali: ["india", "indian"],
  marathi: ["india", "indian"],
  punjabi: ["india", "indian", "bhangra"],
  gujarati: ["india", "indian"],
  urdu: ["india", "indian"],
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
  piano: ["piano"],
  jazz: ["jazz"],
  rock: ["rock"],
  pop: ["pop"],
  ambient: ["ambient"],
  acoustic: ["acoustic"],
  classical: ["classical"],
  electronic: ["electronic"],
  indie: ["indie"],
  instrumental: ["instrumental"],
  world: ["world"],
};

export function jamendoHasTagAlias(query: string): boolean {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ");
  return Boolean(JAMENDO_TAG_ALIASES[key]);
}

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
