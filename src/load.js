// Loads a locally maintained rule set (rules/*.list) as client-neutral items.
const fs = require('fs');
const { parseSurgeList } = require('./parse');
const { RULE_SETS } = require('./definition');

const DOMAIN_TYPES = new Set(['domain', 'suffix', 'keyword']);

// Returns { items, skipped }; throws if the set ends up empty so an empty list
// is never published.
function loadSet(id) {
  const def = RULE_SETS[id];
  if (!def?.source) throw new Error(`rule set ${id} has no local source`);

  const { items, skipped } = parseSurgeList(fs.readFileSync(def.source, 'utf8'));
  const kept = items.filter(item => {
    if (def.only === 'domain') return DOMAIN_TYPES.has(item.type);
    if (def.only === 'ip') return !DOMAIN_TYPES.has(item.type);
    return true;
  });
  if (kept.length === 0) throw new Error(`rule set ${id} is empty`);
  return { items: kept, skipped };
}

module.exports = { loadSet };
