#!/usr/bin/env node
// Builds every client artifact into an output directory (default: dist/).
//
//   node scripts/build.js [outDir]
//
// Env:
//   RULESET_BASE  public base URL of the release branch (see src/definition.js)
const fs = require('fs');
const path = require('path');

const { RULE_SETS } = require('../src/definition');
const { loadSet } = require('../src/load');
const { RULES_FILE, setPath, setUrl } = require('../src/paths');
const { toYaml } = require('../src/yaml');
const { renderSurgeRules, renderSurgeList } = require('../src/render/surge');
const { renderClashRules, renderClashList } = require('../src/render/clash');

const outDir = path.resolve(process.argv[2] || 'dist');
const ctx = { setUrl: (client, id) => setUrl(client, id) };

function write(rel, content) {
  const file = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  // No timestamp: identical inputs must give identical output so CI can skip no-op releases.
  const header = '# https://github.com/evo-lee/rule-set (GPL-3.0)\n';

  // Only our own sets are published; referenced sets (Loyalsoldier, xiaolai) are
  // fetched by clients straight from their upstream URLs.
  for (const id of Object.keys(RULE_SETS).filter(id => RULE_SETS[id].source)) {
    const { items, skipped } = loadSet(id);
    if (skipped.length > 0) throw new Error(`[${id}] unsupported lines: ${skipped.join(' | ')}`);
    write(setPath('surge', id), header + renderSurgeList(items));
    write(setPath('clash', id), header + renderClashList(items));
    console.log(`[${id}] ${items.length} entries`);
  }

  write(RULES_FILE.surge, header + renderSurgeRules(ctx));
  write(RULES_FILE.shadowrocket, header + renderSurgeRules(ctx, { dialect: 'shadowrocket' }));
  write(RULES_FILE.clash, header + toYaml(renderClashRules(ctx)));

  console.log(`Built into ${outDir}`);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
