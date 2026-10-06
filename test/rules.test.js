// Renderer tests. Offline: renderers are pure given a URL builder.
// Update golden files with: UPDATE_SNAPSHOTS=1 npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseSurgeList, parseRuleLines, dedupeItems } = require('../src/parse');
const { RULES, RULE_SETS, POLICIES } = require('../src/definition');
const { loadSet } = require('../src/load');
const { setUrl } = require('../src/paths');
const { toYaml } = require('../src/yaml');
const { renderSurgeRules, renderSurgeList } = require('../src/render/surge');
const { renderClashRules } = require('../src/render/clash');
const { renderQxRules, renderQxSet, SYNTHETIC_SETS } = require('../src/render/qx');

const SNAPSHOT_DIR = path.join(__dirname, 'snapshots');

function matchSnapshot(name, actual) {
  const file = path.join(SNAPSHOT_DIR, name);
  if (process.env.UPDATE_SNAPSHOTS || !fs.existsSync(file)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(file, actual);
    return;
  }
  assert.equal(actual, fs.readFileSync(file, 'utf8'), `snapshot mismatch: ${name}`);
}

const ctx = { setUrl: (client, id) => setUrl(client, id, 'https://example.test/rule-set') };

const sampleItems = parseRuleLines([
  'DOMAIN-SUFFIX,anthropic.com',
  'DOMAIN,copilot.github.com',
  'DOMAIN-KEYWORD,openai',
  'IP-CIDR,160.79.104.0/23',
  'IP-CIDR6,2607:6bc0::/48'
]).items;

test('parseSurgeList keeps supported types and reports the rest', () => {
  const { items, skipped } = parseSurgeList([
    '# comment',
    '',
    'DOMAIN-SUFFIX,example.com',
    'IP-CIDR,1.0.1.0/24,no-resolve',
    'PROCESS-NAME,curl'
  ].join('\n'));
  assert.deepEqual(items, [
    { type: 'suffix', value: 'example.com' },
    { type: 'ip', value: '1.0.1.0/24' }
  ]);
  assert.deepEqual(skipped, ['PROCESS-NAME,curl']);
});

test('dedupeItems is case-insensitive on value', () => {
  const items = dedupeItems(parseRuleLines(['DOMAIN-SUFFIX,A.com', 'DOMAIN-SUFFIX,a.com', 'DOMAIN,a.com']).items);
  assert.equal(items.length, 2);
});

test('rule plan only references known policies and sets', () => {
  for (const rule of RULES) {
    if (rule.policy) assert.ok(POLICIES.includes(rule.policy), rule.policy);
    if (rule.final) assert.ok(POLICIES.includes(rule.final), rule.final);
    if (rule.set) assert.ok(RULE_SETS[rule.set], rule.set);
  }
  assert.equal(RULES.find(r => r.set).set, 'ai', 'AI must be the first rule set');
  assert.ok(RULES[RULES.length - 1].final, 'final must be last');
});

test('rules/ai.list is valid and splits into domain and ip sets', async () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'rules', 'ai.list'), 'utf8');
  const { items, skipped } = parseSurgeList(text);
  assert.deepEqual(skipped, [], 'ai.list has unsupported lines');
  assert.equal(dedupeItems(items).length, items.length, 'ai.list has duplicates');

  const ai = await loadSet('ai');
  const aiIp = await loadSet('ai-ip');
  assert.ok(ai.items.every(i => ['domain', 'suffix', 'keyword'].includes(i.type)));
  assert.ok(aiIp.items.every(i => ['ip', 'ip6'].includes(i.type)));
  assert.equal(ai.items.length + aiIp.items.length, items.length);
});

test('surge rules', () => {
  const out = renderSurgeRules(ctx);
  matchSnapshot('surge.conf', out);
  const lines = out.trim().split('\n').filter(l => l && !l.startsWith('#') && l !== '[Rule]');
  assert.match(lines[0], /\/surge\/ai\.list,AI,force-remote-dns$/);
  assert.match(lines[1], /\/surge\/ai-ip\.list,AI,no-resolve$/);
  assert.equal(lines[lines.length - 1], 'FINAL,Proxy,dns-failed');
});

test('shadowrocket rules drop Surge-only options', () => {
  const out = renderSurgeRules(ctx, { dialect: 'shadowrocket' });
  matchSnapshot('shadowrocket.conf', out);
  for (const surgeOnly of ['force-remote-dns', 'dns-failed', 'RULE-SET,SYSTEM', 'RULE-SET,LAN']) {
    assert.ok(!out.includes(surgeOnly), surgeOnly);
  }
});

test('clash rules', () => {
  const out = renderClashRules(ctx);
  matchSnapshot('clash.yaml', toYaml(out));
  for (const rule of out.rules) {
    const m = rule.match(/^RULE-SET,([^,]+),/);
    if (m) assert.ok(out['rule-providers'][m[1]], `missing provider ${m[1]}`);
  }
  assert.equal(out['rule-providers'].ai.format, 'text');
  assert.equal(out.rules[out.rules.length - 1], 'MATCH,Proxy');
});

test('quantumult x rules', () => {
  const out = renderQxRules(ctx);
  matchSnapshot('qx.conf', out);
  assert.equal(out.split('[filter_local]')[1].trim(), 'final, Proxy', 'filter_local must only hold final');
  for (const id of Object.keys(SYNTHETIC_SETS)) assert.notEqual(renderQxSet(id, []), null, id);
  assert.equal(renderQxSet('nope', []), null);
  assert.equal(renderQxSet('ai', sampleItems).split('\n')[0], 'host-suffix, anthropic.com, AI');
});

test('surge list has no policies', () => {
  assert.equal(renderSurgeList(sampleItems).split('\n')[0], 'DOMAIN-SUFFIX,anthropic.com');
});
