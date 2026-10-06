// Loads rule-set contents (remote URL or local file) as client-neutral items.
const fs = require('fs/promises');
const { parseSurgeList } = require('./parse');
const { RULE_SETS } = require('./definition');

const FETCH_TIMEOUT_MS = 60 * 1000;
const DOMAIN_TYPES = new Set(['domain', 'suffix', 'keyword']);

async function readSource(source) {
  if (!/^https?:\/\//.test(source)) return fs.readFile(source, 'utf8');

  const res = await fetch(source, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${source}`);
  return res.text();
}

// Returns { items, skipped } for a rule set id; throws if the set ends up empty
// so a broken upstream never publishes an empty list.
async function loadSet(id) {
  const def = RULE_SETS[id];
  if (!def) throw new Error(`unknown rule set: ${id}`);

  const { items, skipped } = parseSurgeList(await readSource(def.source));
  const kept = items.filter(item => {
    if (def.only === 'domain') return DOMAIN_TYPES.has(item.type);
    if (def.only === 'ip') return !DOMAIN_TYPES.has(item.type);
    return true;
  });
  if (kept.length === 0) throw new Error(`rule set ${id} is empty`);
  return { items: kept, skipped };
}

module.exports = { loadSet };
