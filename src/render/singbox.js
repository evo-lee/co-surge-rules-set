// sing-box (>= 1.12): route rules + rule_set + matching DNS rules.
// Outbound contract: selectors tagged `AI` and `Proxy`, and a direct outbound
// tagged `direct`. REJECT maps to the `reject` rule action.
const { RULES } = require('../definition');

const OUTBOUND = { AI: 'AI', Proxy: 'Proxy', DIRECT: 'direct' };
const SOURCE_VERSION = 2; // sing-box >= 1.10

// Domain fields and ip_cidr are ANDed inside one sing-box rule, so they must be
// split into separate headless rules (rules within a set are ORed).
function headlessRules(items) {
  const domain = { domain: [], domain_suffix: [], domain_keyword: [] };
  const ip = [];
  for (const item of items) {
    if (item.type === 'domain') domain.domain.push(item.value);
    else if (item.type === 'suffix') domain.domain_suffix.push(item.value);
    else if (item.type === 'keyword') domain.domain_keyword.push(item.value);
    else ip.push(item.value);
  }

  const rules = [];
  const domainRule = Object.fromEntries(Object.entries(domain).filter(([, v]) => v.length > 0));
  if (Object.keys(domainRule).length > 0) rules.push(domainRule);
  if (ip.length > 0) rules.push({ ip_cidr: ip });
  return rules;
}

function routeAction(policy) {
  return policy === 'REJECT' ? { action: 'reject' } : { action: 'route', outbound: OUTBOUND[policy] };
}

function renderSingboxRules(ctx) {
  const ruleSets = [];
  const rules = [
    { action: 'sniff' },
    { protocol: 'dns', action: 'hijack-dns' }
  ];
  const remoteDnsSets = [];
  const rejectSets = [];
  let final = 'Proxy';

  for (const rule of RULES) {
    if (rule.set) {
      ruleSets.push({ type: 'remote', tag: rule.set, format: 'binary', url: ctx.setUrl('singbox', rule.set) });
      // Only domain sets may appear in DNS rules: a set with ip_cidr there acts
      // as a response filter, sending every unmatched query to that server.
      if (rule.remoteDns) remoteDnsSets.push(rule.set);
      if (rule.policy === 'REJECT') rejectSets.push(rule.set);
      rules.push({ rule_set: rule.set, ...routeAction(rule.policy) });
    } else if (rule.builtin === 'lan') {
      rules.push({ ip_is_private: true, ...routeAction(rule.policy) });
    } else if (rule.geoip === 'CN') {
      // sing-box has no GEOIP; resolve unmatched domains, then re-check CN CIDRs.
      rules.push({ action: 'resolve' });
      rules.push({ rule_set: 'cncidr', ...routeAction(rule.policy) });
    } else if (rule.final) {
      final = OUTBOUND[rule.final];
    }
    // `system` is Surge-only.
  }

  // Encrypted CN DNS by default, remote DNS through the proxy for proxied/AI
  // domains, blocked domains refused.
  const dns = {
    servers: [
      { type: 'https', tag: 'dns-remote', server: '1.1.1.1', detour: 'Proxy' },
      { type: 'https', tag: 'dns-direct', server: '223.5.5.5' }
    ],
    rules: [
      rejectSets.length > 0 && { rule_set: rejectSets, action: 'reject' },
      remoteDnsSets.length > 0 && { rule_set: remoteDnsSets, action: 'route', server: 'dns-remote' }
    ].filter(Boolean),
    final: 'dns-direct',
    strategy: 'ipv4_only'
  };

  return {
    dns,
    route: { rule_set: ruleSets, rules, final, default_domain_resolver: 'dns-direct' }
  };
}

// Rule-set source format; compiled to .srs at build time.
function renderSingboxSet(items) {
  return { version: SOURCE_VERSION, rules: headlessRules(items) };
}

module.exports = { renderSingboxRules, renderSingboxSet };
