// Clash / Mihomo: Loyalsoldier sets point at its native Clash build; our own
// sets are published as classical text.
const { RULES, RULE_SETS, CLASH_LANCIDR } = require('../definition');
const { renderSurgeList } = require('./surge');

function renderClashRules(ctx) {
  const providers = {};
  const rules = [];

  for (const rule of RULES) {
    if (rule.set) {
      const upstream = RULE_SETS[rule.set].clash;
      providers[rule.set] = upstream
        ? { type: 'http', behavior: upstream.behavior, url: upstream.url, path: `./ruleset/${rule.set}.yaml`, interval: 86400 }
        : { type: 'http', behavior: 'classical', format: 'text', url: ctx.setUrl('clash', rule.set), path: `./ruleset/${rule.set}.txt`, interval: 86400 };
      rules.push(`RULE-SET,${rule.set},${rule.policy}${rule.noResolve ? ',no-resolve' : ''}`);
    } else if (rule.builtin === 'lan') {
      providers.lancidr = { type: 'http', behavior: 'ipcidr', url: CLASH_LANCIDR, path: './ruleset/lancidr.yaml', interval: 86400 };
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
