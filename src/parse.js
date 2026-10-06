// Parse Surge-style rule lists into client-neutral items:
//   { type: 'domain' | 'suffix' | 'keyword' | 'ip' | 'ip6', value }
const TYPE_MAP = {
  'DOMAIN': 'domain',
  'DOMAIN-SUFFIX': 'suffix',
  'DOMAIN-KEYWORD': 'keyword',
  'IP-CIDR': 'ip',
  'IP-CIDR6': 'ip6'
};

function parseRuleLines(lines) {
  const items = [];
  const skipped = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const [rawType, rawValue] = line.split(',').map(s => s.trim());
    const type = TYPE_MAP[(rawType || '').toUpperCase()];
    if (!type || !rawValue) {
      skipped.push(line);
      continue;
    }
    items.push({ type, value: rawValue });
  }

  return { items, skipped };
}

function parseSurgeList(text) {
  return parseRuleLines(String(text).split(/\r?\n/));
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.type}:${item.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { parseRuleLines, parseSurgeList, dedupeItems };
