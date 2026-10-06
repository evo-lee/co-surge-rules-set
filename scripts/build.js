#!/usr/bin/env node
// Builds every client artifact into an output directory (default: dist/).
//
//   node scripts/build.js [outDir]
//
// Env:
//   RULESET_BASE  public base URL of the release branch (see src/definition.js)
//   SING_BOX      path to the sing-box binary used to compile .srs (default: sing-box on PATH)
//   REQUIRE_SRS=1 fail instead of skipping when sing-box is unavailable (CI)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { RULE_SETS } = require('../src/definition');
const { loadSet } = require('../src/load');
const { RULES_FILE, setPath, setUrl } = require('../src/paths');
const { toYaml } = require('../src/yaml');
const { renderSurgeRules, renderSurgeList } = require('../src/render/surge');
const { renderClashRules, renderClashList } = require('../src/render/clash');
const { renderSingboxRules, renderSingboxSet } = require('../src/render/singbox');
const { renderQxRules, renderQxSet, SYNTHETIC_SETS } = require('../src/render/qx');

const outDir = path.resolve(process.argv[2] || 'dist');
const ctx = { setUrl: (client, id) => setUrl(client, id) };

function write(rel, content) {
  const file = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function findSingBox() {
  const bin = process.env.SING_BOX || 'sing-box';
  try {
    execFileSync(bin, ['version'], { stdio: 'ignore' });
    return bin;
  } catch {
    if (process.env.REQUIRE_SRS) throw new Error(`sing-box not found (${bin}); required to compile .srs`);
    return null;
  }
}

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  const singBox = findSingBox();
  // No timestamp: identical inputs must give identical output so CI can skip no-op releases.
  const header = '# https://github.com/evo-lee/rule-set (GPL-3.0) — data: Loyalsoldier (GPL-3.0)\n';

  const ids = Object.keys(RULE_SETS);
  const loaded = await Promise.all(ids.map(async id => [id, await loadSet(id)]));

  for (const [id, { items, skipped }] of loaded) {
    if (skipped.length > 0) console.warn(`[${id}] skipped ${skipped.length} unsupported lines, e.g. ${skipped[0]}`);
    const def = RULE_SETS[id];

    // Surge/Clash reference Loyalsoldier's native builds; publish only our own sets.
    if (!def.surge) write(setPath('surge', id), header + renderSurgeList(items));
    if (!def.clash) write(setPath('clash', id), header + renderClashList(items));

    // Source JSON is published alongside the compiled .srs.
    const srsRel = setPath('singbox', id);
    const json = write(srsRel.replace(/\.srs$/, '.json'), JSON.stringify(renderSingboxSet(items)));
    if (singBox) {
      execFileSync(singBox, ['rule-set', 'compile', '--output', path.join(outDir, srsRel), json], { stdio: 'inherit' });
    }

    write(setPath('qx', id), header + renderQxSet(id, items));
    console.log(`[${id}] ${items.length} entries`);
  }

  for (const id of Object.keys(SYNTHETIC_SETS)) {
    write(setPath('qx', id), header + renderQxSet(id, []));
  }

  write(RULES_FILE.surge, header + renderSurgeRules(ctx));
  write(RULES_FILE.shadowrocket, header + renderSurgeRules(ctx, { dialect: 'shadowrocket' }));
  write(RULES_FILE.clash, header + toYaml(renderClashRules(ctx)));
  write(RULES_FILE.singbox, JSON.stringify(renderSingboxRules(ctx), null, 2) + '\n');
  write(RULES_FILE.qx, header + renderQxRules(ctx));

  if (!singBox) console.warn('sing-box not found: skipped .srs compilation (set SING_BOX or REQUIRE_SRS=1)');
  console.log(`Built into ${outDir}`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
