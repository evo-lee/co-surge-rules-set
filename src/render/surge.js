// Surge 6 and Shadowrocket share the same rule syntax; the Shadowrocket dialect
// drops Surge-only built-ins and options.
const { RULES, RULE_SETS, LAN_CIDRS } = require('../definition');
const { parseRuleLines } = require('../parse');

const TYPE = {
  domain: 'DOMAIN',
  suffix: 'DOMAIN-SUFFIX',
  keyword: 'DOMAIN-KEYWORD',
  ip: 'IP-CIDR',
  ip6: 'IP-CIDR6'
};

function itemLine(item, policy) {
  let line = `${TYPE[item.type]},${item.value}`;
  if (policy) line += `,${policy}`;
  // Inline IP rules must not force a DNS lookup for every domain request.
  if (policy && (item.type === 'ip' || item.type === 'ip6')) line += ',no-resolve';
  return line;
}

function renderSurgeRules(ctx, { dialect = 'surge' } = {}) {
  const surge = dialect === 'surge';
  const out = [];

  for (const rule of RULES) {
    if (rule.comment) {
      if (out.length > 0) out.push('');
      out.push(`# ${rule.comment}`);
    } else if (rule.set) {
      const url = RULE_SETS[rule.set].surge || ctx.setUrl('surge', rule.set);
      let line = `RULE-SET,${url},${rule.policy}`;
      if (rule.noResolve) line += ',no-resolve';
      if (surge && rule.remoteDns) line += ',force-remote-dns';
      out.push(line);
    } else if (rule.builtin === 'system') {
      if (surge) out.push(`RULE-SET,SYSTEM,${rule.policy}`);
    } else if (rule.builtin === 'lan') {
      if (surge) out.push(`RULE-SET,LAN,${rule.policy}`);
      else out.push(...parseRuleLines(LAN_CIDRS).items.map(item => itemLine(item, rule.policy)));
    } else if (rule.geoip) {
      out.push(`GEOIP,${rule.geoip},${rule.policy}`);
    } else if (rule.final) {
      out.push(surge && rule.dnsFailed ? `FINAL,${rule.final},dns-failed` : `FINAL,${rule.final}`);
    }
  }

  return `[Rule]\n${out.join('\n')}\n`;
}

// Policy-less list, usable as a Surge/Shadowrocket RULE-SET or a Clash
// classical text provider.
function renderSurgeList(items) {
  return items.map(item => itemLine(item)).join('\n') + '\n';
}

module.exports = { renderSurgeRules, renderSurgeList, itemLine };
