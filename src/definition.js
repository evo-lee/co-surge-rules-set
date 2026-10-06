// Single source of truth for the rule plan. Client-agnostic: renderers in
// ./render translate it into each client's dialect.
//
// Policy contract: rules only reference these names. Every config that uses the
// rules must provide policy groups / outbounds named `AI` and `Proxy`; DIRECT
// and REJECT map to each client's built-ins (sing-box: outbound `direct`).
const path = require('path');

const POLICIES = ['AI', 'Proxy', 'DIRECT', 'REJECT'];

// Where the `release` branch is served from. Override for forks.
const RELEASE_BASE = process.env.RULESET_BASE || 'https://cdn.jsdelivr.net/gh/evo-lee/rule-set@release';

// All domain/IP data comes from one upstream (Loyalsoldier, GPL-3.0) so every
// client classifies each domain identically. Clients with a native Loyalsoldier
// build reference it directly; sing-box and Quantumult X get our conversion of
// the Surge build.
const LS_SURGE = 'https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/ruleset';
const LS_CLASH = 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release';

function loyalsoldier(name, behavior) {
  return {
    source: `${LS_SURGE}/${name}.txt`,
    surge: `${LS_SURGE}/${name}.txt`,
    clash: { url: `${LS_CLASH}/${name}.txt`, behavior }
  };
}

const AI_LIST = path.join(__dirname, '..', 'rules', 'ai.list');

// Rule sets. `source` is a URL or local file in Surge syntax; `only` keeps one
// kind of entry. Sets without `surge` / `clash` upstreams are published by us.
// Domains and IPs are separate sets so DNS-aware clients can match the domain
// part without the IP part turning into a response filter (sing-box).
const RULE_SETS = {
  ai: { source: AI_LIST, only: 'domain' },
  'ai-ip': { source: AI_LIST, only: 'ip' },
  private: loyalsoldier('private', 'domain'),
  reject: loyalsoldier('reject', 'domain'),
  icloud: loyalsoldier('icloud', 'domain'),
  apple: loyalsoldier('apple', 'domain'),
  proxy: loyalsoldier('proxy', 'domain'),
  direct: loyalsoldier('direct', 'domain'),
  telegramcidr: loyalsoldier('telegramcidr', 'ipcidr'),
  cncidr: loyalsoldier('cncidr', 'ipcidr')
};

// `lan` builtin: Surge uses RULE-SET,LAN; Clash uses Loyalsoldier lancidr;
// sing-box uses ip_is_private; others get these CIDRs.
const CLASH_LANCIDR = `${LS_CLASH}/lancidr.txt`;
const LAN_CIDRS = [
  'IP-CIDR,10.0.0.0/8',
  'IP-CIDR,100.64.0.0/10',
  'IP-CIDR,127.0.0.0/8',
  'IP-CIDR,169.254.0.0/16',
  'IP-CIDR,172.16.0.0/12',
  'IP-CIDR,192.168.0.0/16',
  'IP-CIDR6,::1/128',
  'IP-CIDR6,fc00::/7',
  'IP-CIDR6,fe80::/10'
];

// Ordered rule plan. Entry kinds:
//   { comment }                      section label
//   { set, policy, remoteDns?, noResolve? }
//   { builtin: 'system' | 'lan', policy }
//   { geoip, policy }
//   { final, dnsFailed? }
// `remoteDns` also tells DNS-aware renderers (sing-box) to resolve the set remotely.
const RULES = [
  { comment: 'AI services (highest priority — manual AI group to prevent account bans)' },
  { set: 'ai', policy: 'AI', remoteDns: true },
  { set: 'ai-ip', policy: 'AI', noResolve: true },
  { comment: 'Loyalsoldier rules (whitelist mode)' },
  { set: 'private', policy: 'DIRECT' },
  { set: 'reject', policy: 'REJECT' },
  { builtin: 'system', policy: 'DIRECT' },
  { set: 'icloud', policy: 'DIRECT' },
  { set: 'apple', policy: 'DIRECT' },
  { set: 'proxy', policy: 'Proxy', remoteDns: true },
  { set: 'direct', policy: 'DIRECT' },
  { set: 'telegramcidr', policy: 'Proxy', noResolve: true },
  { set: 'cncidr', policy: 'DIRECT', noResolve: true },
  { builtin: 'lan', policy: 'DIRECT' },
  { geoip: 'CN', policy: 'DIRECT' },
  { final: 'Proxy', dnsFailed: true }
];

module.exports = { POLICIES, RELEASE_BASE, RULE_SETS, RULES, CLASH_LANCIDR, LAN_CIDRS };
