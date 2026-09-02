import { describe, expect, it } from "vitest";

import { catalogArtistSeedQueries } from "../src/onboarding/catalog.js";
import { isWildcardCatalogQuery } from "../src/catalog/discover.js";

describe("open-catalog singer seeds", () => {
  it("covers discover scenes and is not a commercial artist list", () => {
    const queries = catalogArtistSeedQueries();
    expect(queries).toEqual(
      expect.arrayContaining(["bollywood", "hindi", "jazz", "piano", "vocal"]),
    );
    expect(queries.join(" ")).not.toMatch(/arijit|weeknd|spotify/i);
    expect(isWildcardCatalogQuery("*")).toBe(true);
    expect(isWildcardCatalogQuery("northwind")).toBe(false);
  });
});
