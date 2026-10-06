# AGENTS.md — rule-set

Public routing rule set. One client-agnostic rule plan is rendered for Surge, Shadowrocket, Clash/Mihomo, sing-box and Quantumult X, built by GitHub Actions and published to the `release` branch (served via jsDelivr). No proxies, no subscriptions, no server.

User-facing docs (`README.md`) are bilingual (English/Chinese). This file is English-only.

## Layout

```
rules/ai.list            # Hand-maintained AI domains/IPs (Surge syntax)
src/
  definition.js          # SINGLE SOURCE: policies, rule sets, ordered rule plan, release base URL
  parse.js               # Surge-style list -> neutral items { type, value }
  load.js                # Load a set from URL or local file (build time)
  paths.js               # Published artifact layout + URLs
  yaml.js                # Minimal YAML serializer
  render/
    surge.js             # Surge + Shadowrocket dialect
    clash.js             # Clash/Mihomo rule-providers + rules
    singbox.js           # sing-box route + dns + rule-set source
    qx.js                # Quantumult X filter_remote/filter_local + resources
scripts/
  build.js               # Build all artifacts into dist/
  verify-singbox.js      # `sing-box check` on built artifacts
test/
  rules.test.js          # node:test, offline
  snapshots/             # Golden outputs per client
.github/workflows/build.yml
```

## Commands

```bash
npm test                                   # offline renderer tests
UPDATE_SNAPSHOTS=1 npm test                # accept intended output changes
npm run build                              # dist/ (needs network)
SING_BOX=/path/sing-box REQUIRE_SRS=1 npm run build && SING_BOX=/path/sing-box npm run verify
```

No dependencies. Node >= 20. CI pins sing-box via `SING_BOX_VERSION` in the workflow.

## Invariants

- **Policy contract**: rules reference only `AI`, `Proxy`, `DIRECT`, `REJECT`. sing-box outbounds are `AI`, `Proxy`, `direct`; QX maps DIRECT/REJECT to `direct`/`reject`. Changing these names breaks every consumer.
- **AI first**: the `ai` / `ai-ip` sets stay at the top of the plan.
- **Single upstream**: all domain/IP data comes from Loyalsoldier. Do not add sets from other sources (e.g. MetaCubeX); they classify ~200 domains on the opposite side. `google.txt` is excluded on purpose (marked "慎用" upstream).
- **Licensing**: output is GPL-3.0 because Loyalsoldier data is GPL-3.0. Never redistribute content from sources without a compatible license. The xiaolai Anthropic list has no license, so it is not used. `rules/ai.list` entries must come from first-party sources.
- **Domain/IP split**: domain and IP entries live in separate sets. A sing-box DNS rule that references a set containing `ip_cidr` turns it into a response filter (every unmatched query hits that server first). Tests enforce this.
- **QX ordering**: only `final` goes in `[filter_local]`; everything else is a `[filter_remote]` resource (`lan` and `geoip-cn` are synthesized).
- **Surge-only** entries (`RULE-SET,SYSTEM`, `RULE-SET,LAN`, `force-remote-dns`, `dns-failed`) must not reach other clients.
- **Deterministic build**: no timestamps or random values in output. CI skips the release when the tree is unchanged.
- **Empty upstream = failure**: `load.js` throws on an empty set so a broken upstream never publishes an empty list.

## Release

The workflow runs on push to `main`, daily at 23:30 UTC, and on demand. It tests, builds (compiling `.srs`), runs `sing-box check`, force-pushes `dist/` as a single-commit orphan `release` branch (only if changed), then purges jsDelivr.

Forks: set `RULESET_BASE` (or edit `RELEASE_BASE` in `src/definition.js`) so the generated snippets point at the fork's release branch.

## Changing rules

1. Edit `rules/ai.list` or `src/definition.js` (never generated files).
2. `npm test`; review the snapshot diff, then `UPDATE_SNAPSHOTS=1 npm test`.
3. If a renderer changes, build with sing-box and run `npm run verify`.
4. Update `README.md` (both languages) when the plan, contract, or layout changes.
