import { describe, expect, it } from "vitest";

import { assertSafeProviderUrl } from "../src/security/url-allowlist.js";

describe("provider URL allowlist", () => {
  it("accepts Jamendo https hosts and rejects SSRF shapes", () => {
    expect(assertSafeProviderUrl("https://api.jamendo.com/v3.0/tracks").hostname).toBe(
      "api.jamendo.com",
    );
    expect(
      assertSafeProviderUrl("https://archive.org/metadata/open-pulse").hostname,
    ).toBe("archive.org");
    expect(
      assertSafeProviderUrl("https://ia601208.us.archive.org/5/items/open-pulse/a.mp3")
        .hostname,
    ).toBe("ia601208.us.archive.org");
    expect(() => assertSafeProviderUrl("http://api.jamendo.com/v3.0/tracks")).toThrow();
    expect(() => assertSafeProviderUrl("https://evil.example/audio.mp3")).toThrow();
    expect(() =>
      assertSafeProviderUrl("https://user:pass@api.jamendo.com/v3.0/tracks"),
    ).toThrow();
    expect(() => assertSafeProviderUrl("https://127.0.0.1/audio")).toThrow();
    expect(() => assertSafeProviderUrl("https://169.254.169.254/latest")).toThrow();
    expect(() => assertSafeProviderUrl("https://localhost/audio")).toThrow();
    expect(() =>
      assertSafeProviderUrl("https://api.jamendo.com:8080/v3.0/tracks"),
    ).toThrow();
    expect(() =>
      assertSafeProviderUrl("https://api.jamendo.com.evil.example/v3.0/tracks"),
    ).toThrow();
  });

  it("accepts the fake provider host used in tests", () => {
    expect(
      assertSafeProviderUrl("https://example.invalid/stream/fake-1.mp3", [
        "example.invalid",
      ]).hostname,
    ).toBe("example.invalid");
  });
});
