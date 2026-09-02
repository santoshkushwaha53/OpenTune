const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

const DEFAULT_ALLOWLIST = [
  "api.jamendo.com",
  "www.jamendo.com",
  "jamendo.com",
  "usercontent.jamendo.com",
  "prod-1.storage.jamendo.com",
  "mp3l.jamendo.com",
  "mp3d.jamendo.com",
  "storage.jamendo.com",
  "api.audius.co",
  "audius.co",
  "archive.org",
  "us.archive.org",
];

/**
 * SSRF guard for provider metadata/media URLs.
 * Never used to fetch user-supplied URLs; callers pass connector-issued https hosts.
 */
export function assertSafeProviderUrl(
  urlString: string,
  allowlist: string[] = DEFAULT_ALLOWLIST,
): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Invalid provider URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Only https provider URLs are allowed");
  }
  if (url.username || url.password) {
    throw new Error("Provider URLs must not include credentials");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Provider URLs must use https port 443");
  }
  const hostname = url.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    throw new Error("Provider host is not allowlisted");
  }
  const allowed = allowlist.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
  if (!allowed) {
    throw new Error("Provider host is not allowlisted");
  }
  return url;
}

function isBlockedHostname(hostname: string): boolean {
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost")) {
    return true;
  }
  if (hostname.includes(":")) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return true;
  }
  return false;
}
