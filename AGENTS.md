# AGENTS.md — co-surge-rules-set

Public routing rule set. One client-agnostic rule plan is rendered for Surge, Shadowrocket and Clash/Mihomo, built by GitHub Actions and published to the `release` branch (served via jsDelivr). No proxies, no subscriptions, no server.

User-facing docs (`README.md`) are bilingual (English/Chinese). This file is English-only.

## Layout

```
rules/ai.list            # Hand-maintained AI domains/IPs (Surge syntax)
src/
  definition.js          # SINGLE SOURCE: policies, rule sets, ordered rule plan, release base URL
  parse.js               # Surge-style list -> neutral items { type, value }
  load.js                # Load a local rules/*.list set (build time)
  paths.js               # Published artifact layout + URLs
  yaml.js                # Minimal YAML serializer
  render/
    surge.js             # Surge + Shadowrocket dialect
    clash.js             # Clash/Mihomo rule-providers + rules
scripts/
  build.js               # Build all artifacts into dist/
test/
  rules.test.js          # node:test, offline
  snapshots/             # Golden outputs per client
.github/workflows/build.yml
```

## Commands

```bash
npm test                                   # offline renderer tests
UPDATE_SNAPSHOTS=1 npm test                # accept intended output changes
npm run build                              # dist/ (offline)
```

No dependencies. Node >= 20.

## Invariants

- **Policy contract**: rules reference only `AI`, `Proxy`, `DIRECT`, `REJECT`. Changing these names breaks every consumer.
- **AI first**: the `ai` / `ai-ip` sets stay at the top of the plan.
- **Single upstream**: all domain/IP data comes from Loyalsoldier. Do not add sets from other sources (e.g. MetaCubeX); they classify ~200 domains on the opposite side. `google.txt` is excluded on purpose (marked "慎用" upstream).
- **Licensing**: output is GPL-3.0 because Loyalsoldier data is GPL-3.0. Never redistribute content from sources without a compatible license. The xiaolai Anthropic list has no license, so it is only referenced by URL (`ai-anthropic`) and must never get a local `source` or be published. `rules/ai.list` entries must come from first-party sources.
- **Domain/IP split**: domain and IP entries live in separate sets (`ai` / `ai-ip`) so the IP set carries `no-resolve` without affecting domain matching.
- **Reference, don't copy**: upstream sets are referenced by URL (jsDelivr, never raw.githubusercontent.com). A set has either upstream URLs or a local `source`, never both; only local sets are built and published.
- **Surge-only** entries (`RULE-SET,SYSTEM`, `RULE-SET,LAN`, `force-remote-dns`, `dns-failed`) must not reach other clients.
- **Deterministic build**: no timestamps or random values in output. CI skips the release when the tree is unchanged.
- **Strict local lists**: the build fails on an empty set or any unsupported line in `rules/*.list`.

## Release

The workflow runs on push to `main` and on demand (no schedule: output only changes when the repo does). It tests, builds, force-pushes `dist/` as a single-commit orphan `release` branch (only if changed), then purges jsDelivr.

Forks: set `RULESET_BASE` (or edit `RELEASE_BASE` in `src/definition.js`) so the generated snippets point at the fork's release branch.

## Scope

sing-box and Quantumult X were dropped on purpose (maintenance cost: sing-box needs its own DNS rules and `.srs` compilation; QX cannot read Surge-syntax lists, so it needs converted copies of upstream data). Do not re-add it without an explicit decision.

## Changing rules

1. Edit `rules/ai.list` or `src/definition.js` (never generated files).
2. `npm test`; review the snapshot diff, then `UPDATE_SNAPSHOTS=1 npm test`.
3. Update `README.md` (both languages) when the plan, contract, or layout changes.
