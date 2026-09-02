export const ONBOARDING_VERSION = 1;

export type OnboardingCategory = {
  slug: string;
  name: string;
  searchQuery: string;
  featured: boolean;
};

export type OnboardingLanguage = {
  code: string;
  name: string;
  searchQuery: string;
};

export type OnboardingMood = {
  slug: string;
  name: string;
  searchQuery: string;
};

/** Editorial scenes mapped to open-catalog search queries — not a commercial genre graph. */
export const ONBOARDING_CATEGORIES: OnboardingCategory[] = [
  { slug: "indian-pop", name: "Indian Pop", searchQuery: "indian pop", featured: true },
  { slug: "bollywood", name: "Bollywood", searchQuery: "bollywood", featured: true },
  { slug: "indie", name: "Indie", searchQuery: "indie", featured: true },
  { slug: "classical", name: "Classical", searchQuery: "classical", featured: true },
  { slug: "electronic", name: "Electronic", searchQuery: "electronic", featured: true },
  { slug: "lofi", name: "Lo-fi", searchQuery: "lofi", featured: true },
  { slug: "rock", name: "Rock", searchQuery: "rock", featured: true },
  { slug: "hip-hop", name: "Hip-Hop", searchQuery: "hip hop", featured: true },
  { slug: "jazz", name: "Jazz", searchQuery: "jazz", featured: true },
  { slug: "acoustic", name: "Acoustic", searchQuery: "acoustic", featured: true },
  { slug: "devotional", name: "Devotional", searchQuery: "devotional", featured: true },
  {
    slug: "instrumental",
    name: "Instrumental",
    searchQuery: "instrumental",
    featured: true,
  },
  { slug: "ambient", name: "Ambient", searchQuery: "ambient", featured: true },
  { slug: "rnb", name: "R&B", searchQuery: "rnb soul", featured: true },
  { slug: "world", name: "World Music", searchQuery: "world", featured: true },
  { slug: "folk", name: "Folk", searchQuery: "folk", featured: true },
  {
    slug: "soundtracks",
    name: "Soundtracks",
    searchQuery: "soundtrack",
    featured: true,
  },
  { slug: "blues", name: "Blues", searchQuery: "blues", featured: false },
  { slug: "funk", name: "Funk", searchQuery: "funk", featured: false },
  { slug: "metal", name: "Metal", searchQuery: "metal", featured: false },
  { slug: "reggae", name: "Reggae", searchQuery: "reggae", featured: false },
  { slug: "piano", name: "Piano", searchQuery: "piano", featured: false },
];

export const ONBOARDING_LANGUAGES: OnboardingLanguage[] = [
  { code: "en", name: "English", searchQuery: "english vocal" },
  { code: "hi", name: "Hindi", searchQuery: "hindi" },
  { code: "ta", name: "Tamil", searchQuery: "tamil" },
  { code: "te", name: "Telugu", searchQuery: "telugu" },
  { code: "ml", name: "Malayalam", searchQuery: "malayalam" },
  { code: "kn", name: "Kannada", searchQuery: "kannada" },
  { code: "bn", name: "Bengali", searchQuery: "bengali" },
  { code: "mr", name: "Marathi", searchQuery: "marathi" },
  { code: "pa", name: "Punjabi", searchQuery: "punjabi" },
  { code: "gu", name: "Gujarati", searchQuery: "gujarati" },
  { code: "ur", name: "Urdu", searchQuery: "urdu" },
  { code: "es", name: "Spanish", searchQuery: "spanish" },
  { code: "fr", name: "French", searchQuery: "french" },
  { code: "ko", name: "Korean", searchQuery: "korean" },
  { code: "ja", name: "Japanese", searchQuery: "japanese" },
  {
    code: "instrumental",
    name: "Instrumental / No Lyrics",
    searchQuery: "instrumental",
  },
];

export const ONBOARDING_MOODS: OnboardingMood[] = [
  { slug: "morning", name: "Morning", searchQuery: "morning" },
  { slug: "focus", name: "Focus", searchQuery: "focus" },
  { slug: "workout", name: "Workout", searchQuery: "workout" },
  { slug: "travel", name: "Travel", searchQuery: "travel" },
  { slug: "relax", name: "Relax", searchQuery: "relax" },
  { slug: "party", name: "Party", searchQuery: "party" },
  { slug: "late-night", name: "Late Night", searchQuery: "night" },
  { slug: "study", name: "Study", searchQuery: "study" },
  { slug: "meditation", name: "Meditation", searchQuery: "meditation" },
  { slug: "romantic", name: "Romantic", searchQuery: "romantic" },
  { slug: "driving", name: "Driving", searchQuery: "driving" },
];

/**
 * Open-catalog search seeds used to populate the artist grid when local
 * artists are sparse. These are not commercial-catalog claims.
 */
export const ARTIST_DISCOVERY_SEEDS = [
  "piano",
  "guitar",
  "ambient",
  "acoustic",
  "electronic",
  "folk",
  "jazz",
  "sitar",
  "flute",
  "choir",
] as const;

export const categoryBySlug = new Map(
  ONBOARDING_CATEGORIES.map((item) => [item.slug, item]),
);
export const languageByCode = new Map(
  ONBOARDING_LANGUAGES.map((item) => [item.code, item]),
);
export const moodBySlug = new Map(ONBOARDING_MOODS.map((item) => [item.slug, item]));

export function publicCategories(includeMore = false) {
  return ONBOARDING_CATEGORIES.filter((item) => includeMore || item.featured).map(
    ({ slug, name, featured }) => ({ slug, name, featured }),
  );
}

export function publicLanguages() {
  return ONBOARDING_LANGUAGES.map(({ code, name }) => ({ code, name }));
}

export function publicMoods() {
  return ONBOARDING_MOODS.map(({ slug, name }) => ({ slug, name }));
}
