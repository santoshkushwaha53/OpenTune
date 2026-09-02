# Security policy

## Reporting a vulnerability

**Do not open a public GitHub issue** for security vulnerabilities.

Email **security@opentune.dev** or, if the GitHub repository has private vulnerability reporting enabled, use **Security → Advisories → Report a vulnerability**.

Please include:

- A description of the issue and its impact
- Steps to reproduce or a proof of concept
- Affected versions or commits if known

You should receive an acknowledgement within **7 days**. We aim to ship a fix and coordinated disclosure within **90 days** of a valid report, sooner for high-severity issues.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| older than 0.1 | No |

Only the latest 0.1.x patch line receives security fixes until a 0.2 or 1.0 branch is published in [CHANGELOG.md](CHANGELOG.md).

## Scope that matters for OpenTune

OpenTune is a metadata mediator. The following are treated as high severity:

- The API fetching, proxying, or storing audio/video bytes
- SSRF: following arbitrary user-supplied URLs from the server
- Authentication bypass, session fixation, or refresh-token theft
- Playlist ownership / share-token guessing
- Secret leakage (`.env`, provider API keys, signing keys)
- SQL injection or unauthorized data access

Out of scope unless they affect OpenTune itself: vulnerabilities in Jamendo or other upstream providers; local files the Flutter app already downloaded to a user device.

## Production secrets

Production (`NODE_ENV=production`) refuses JWT secrets that are shorter than 32 characters, identical to each other, or match documented placeholders (`change-me`, `replace-with`, `not-for-production`, …). Operator catalog routes require `OPERATOR_TOKEN` (`x-opentune-operator`). Do not commit those values.

- Never commit `.env`, keystores, or provider credentials
- Use `.env.example` (development) and `.env.production.example` (production) as templates
- Rotate any credential that appears in git history

## Provider URLs

The backend may request **allowlisted provider API hosts** to resolve metadata and short-lived playback/download URLs. It must not:

- Fetch media bodies
- Accept a user-provided URL and retrieve it
- Follow redirects off the provider allowlist
- Call IP literals, localhost, non-https, credentialed URLs, or non-443 ports

Playback and download happen on the **user device**, from the original provider URL.

## Threat model (summary)

| Trust boundary | Expectation |
| --- | --- |
| Flutter app | Untrusted network; stores downloads only on device |
| API | Authenticates users; returns metadata; never holds audio |
| PostgreSQL | Metadata and hashed credentials; not published to the internet |
| Music providers | Host audio; OpenTune does not redistribute their bytes |
