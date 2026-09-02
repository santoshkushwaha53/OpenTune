# Pull request

## Phase

- [ ] Change is in the **currently requested** development phase
- [ ] I am not landing work from a later phase

## Summary

<!-- What and why. -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Documentation
- [ ] Infrastructure / tooling
- [ ] Provider connector (legal API or written permission required)

## Checklist

- [ ] I did not add audio/video proxying, caching, or storage on the API
- [ ] I did not add scraping or DRM bypass
- [ ] No secrets committed
- [ ] Tests added or updated
- [ ] `cd backend && npm test && npm run lint && npm run db:validate` (if backend changed)
- [ ] Migrations included and `npm run db:migrate:deploy` succeeds (if schema changed)
- [ ] `cd mobile && flutter analyze && flutter test` (if mobile changed)
- [ ] Documentation updated (`README.md`, `ARCHITECTURE.md`, `API.md` as needed)
