// Quantumult X: every plan entry except `final` becomes a [filter_remote]
// resource in QX-native syntax. [filter_local] outranks [filter_remote], so
// keeping it to `final` preserves the plan order whether or not QX's type-based
// "filter matching optimization" is on.
const { RULES, LAN_CIDRS } = require('../definition');
const { parseRuleLines } = require('../parse');

const TYPE = {
  domain: 'host',
  suffix: 'host-suffix',
  keyword: 'host-keyword',
  ip: 'ip-cidr',
  ip6: 'ip6-cidr'
};

// Resources synthesized for plan entries that are not rule sets.
const SYNTHETIC_SETS = {
  lan: rule => rule.builtin === 'lan',
  'geoip-cn': rule => rule.geoip === 'CN'
};

function qxPolicy(policy) {
  if (policy === 'DIRECT') return 'direct';
  if (policy === 'REJECT') return 'reject';
  return policy;
}

function setIdFor(rule) {
  if (rule.set) return rule.set;
  return Object.keys(SYNTHETIC_SETS).find(id => SYNTHETIC_SETS[id](rule)) || null;
}

function planRuleFor(id) {
  return RULES.find(rule => setIdFor(rule) === id) || null;
}

function renderQxRules(ctx) {
  const remote = [];
  const local = [];

  for (const rule of RULES) {
    const id = setIdFor(rule);
    if (id) {
      remote.push(`${ctx.setUrl('qx', id)}, tag=${id}, force-policy=${qxPolicy(rule.policy)}, update-interval=86400, opt-parser=false, enabled=true`);
    } else if (rule.final) {
      local.push(`final, ${qxPolicy(rule.final)}`);
    }
    // `system` is Surge-only.
  }

  return `[filter_remote]\n${remote.join('\n')}\n\n[filter_local]\n${local.join('\n')}\n`;
}

function renderQxList(items, policy) {
  return items.map(item => `${TYPE[item.type]}, ${item.value}, ${policy}`).join('\n') + '\n';
}

// QX resource for a plan entry; null for ids that are not QX resources.
function renderQxSet(id, items) {
  const rule = planRuleFor(id);
  if (!rule) return null;
  const policy = qxPolicy(rule.policy);
  if (id === 'lan') return renderQxList(parseRuleLines(LAN_CIDRS).items, policy);
  if (id === 'geoip-cn') return `geoip, cn, ${policy}\n`;
  return renderQxList(items, policy);
}

module.exports = { renderQxRules, renderQxSet, SYNTHETIC_SETS };
