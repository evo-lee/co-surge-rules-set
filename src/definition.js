// Single source of truth for the rule plan. Client-agnostic: renderers in
// ./render translate it into each client's dialect.
//
// Policy contract: rules only reference these names. Every config that uses the
// rules must provide policy groups / outbounds named `AI` and `Proxy`; DIRECT
// and REJECT map to each client's built-ins.
const path = require('path');

const POLICIES = ['AI', 'Proxy', 'DIRECT', 'REJECT'];

// Where the `release` branch is served from. Override for forks.
const RELEASE_BASE = process.env.RULESET_BASE || 'https://cdn.jsdelivr.net/gh/evo-lee/rule-set@release';

// All domain/IP data comes from one upstream (Loyalsoldier, GPL-3.0) so every
// client classifies each domain identically. Each client references
// Loyalsoldier's native build for it by URL; nothing is downloaded or converted.
// All URLs use jsDelivr: raw.githubusercontent.com is often unreachable from
// mainland China before a proxy is up.
const LS_SURGE = 'https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/ruleset';
const LS_CLASH = 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release';

function loyalsoldier(name, behavior) {
  return { surge: `${LS_SURGE}/${name}.txt`, clash: { url: `${LS_CLASH}/${name}.txt`, behavior } };
}

const AI_LIST = path.join(__dirname, '..', 'rules', 'ai.list');

// xiaolai's Anthropic list (Surge syntax). It has no license, so it is only
// ever referenced by URL — never copied, converted or published by this repo.
// It mixes domains and IP ranges, so the plan references it with no-resolve.
const XIAOLAI_ANTHROPIC = 'https://cdn.jsdelivr.net/gh/xiaolai/anthropic-claude-surge-rules-set@main/dist/anthropic.list';

// Rule sets. Either referenced by URL (`surge` / `clash`), or built by us from
// a local Surge-syntax `source` file (`only` keeps one kind of entry) and
// published to the release branch.
// Domains and IPs are separate sets so the IP part can carry `no-resolve`
// without affecting domain matching.
const RULE_SETS = {
  ai: { source: AI_LIST, only: 'domain' },
  'ai-ip': { source: AI_LIST, only: 'ip' },
  'ai-anthropic': { surge: XIAOLAI_ANTHROPIC, clash: { url: XIAOLAI_ANTHROPIC, behavior: 'classical', format: 'text' } },
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
// Shadowrocket gets these CIDRs.
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
const RULES = [
  { comment: 'AI services (highest priority — manual AI group to prevent account bans)' },
  { set: 'ai', policy: 'AI', remoteDns: true },
  { set: 'ai-ip', policy: 'AI', noResolve: true },
  { set: 'ai-anthropic', policy: 'AI', noResolve: true },
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
