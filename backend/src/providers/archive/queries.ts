/**
 * Internet Archive search is a Lucene phrase, not Jamendo tags.
 * Scene chips like Bollywood need extra licensed-catalog terms.
 */
const ARCHIVE_QUERY_ALIASES: Record<string, string[]> = {
  bollywood: ["hindi", "indian", "bhangra", "sitar", "raga", "tabla"],
  hindi: ["indian", "sitar", "raga", "bhangra"],
  tamil: ["indian", "carnatic"],
  telugu: ["indian"],
  malayalam: ["indian"],
  kannada: ["indian"],
  bengali: ["indian"],
  marathi: ["indian"],
  punjabi: ["bhangra", "indian"],
  gujarati: ["indian"],
  urdu: ["indian"],
  "indian pop": ["indian", "hindi"],
};

export function archiveSearchQueries(query: string): string[] {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key || key === "*") {
    return [];
  }
  return [...new Set([key, ...(ARCHIVE_QUERY_ALIASES[key] ?? [])])].slice(0, 6);
}
