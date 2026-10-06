// Clash / Mihomo: referenced sets point at their upstream URLs; our own sets
// are published as classical text.
const { RULES, RULE_SETS, CLASH_LANCIDR } = require('../definition');
const { renderSurgeList } = require('./surge');

function provider(id, { url, behavior, format }) {
  const ext = format === 'text' ? 'txt' : 'yaml';
  return { type: 'http', behavior, ...(format ? { format } : {}), url, path: `./ruleset/${id}.${ext}`, interval: 86400 };
}

function renderClashRules(ctx) {
  const providers = {};
  const rules = [];

  for (const rule of RULES) {
    if (rule.set) {
      const upstream = RULE_SETS[rule.set].clash || { url: ctx.setUrl('clash', rule.set), behavior: 'classical', format: 'text' };
      providers[rule.set] = provider(rule.set, upstream);
      rules.push(`RULE-SET,${rule.set},${rule.policy}${rule.noResolve ? ',no-resolve' : ''}`);
    } else if (rule.builtin === 'lan') {
      providers.lancidr = provider('lancidr', { url: CLASH_LANCIDR, behavior: 'ipcidr' });
      rules.push(`RULE-SET,lancidr,${rule.policy},no-resolve`);
    } else if (rule.geoip) {
      rules.push(`GEOIP,${rule.geoip},${rule.policy}`);
    } else if (rule.final) {
      rules.push(`MATCH,${rule.final}`);
    }
    // `system` is Surge-only; comments have no place in a YAML list.
  }

  return { 'rule-providers': providers, rules };
}

// Classical text format: `behavior: classical, format: text`.
const renderClashList = renderSurgeList;

module.exports = { renderClashRules, renderClashList };
