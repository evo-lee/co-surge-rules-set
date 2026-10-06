#!/usr/bin/env node
// Validates the built sing-box artifacts with `sing-box check`: wraps
// dist/singbox/rules.json in a minimal config that satisfies the outbound
// contract, pointing rule sets at the locally compiled .srs files.
//
//   node scripts/verify-singbox.js [outDir]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const outDir = path.resolve(process.argv[2] || 'dist');
const bin = process.env.SING_BOX || 'sing-box';

const rules = JSON.parse(fs.readFileSync(path.join(outDir, 'singbox', 'rules.json'), 'utf8'));
rules.route.rule_set = rules.route.rule_set.map(set => ({
  type: 'local',
  tag: set.tag,
  format: 'binary',
  path: path.join(outDir, 'singbox', `${set.tag}.srs`)
}));

const config = {
  log: { level: 'warn' },
  dns: rules.dns,
  outbounds: [
    { type: 'direct', tag: 'direct' },
    { type: 'selector', tag: 'Proxy', outbounds: ['direct'] },
    { type: 'selector', tag: 'AI', outbounds: ['direct'] }
  ],
  route: rules.route
};

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rule-set-')), 'config.json');
fs.writeFileSync(file, JSON.stringify(config, null, 2));
execFileSync(bin, ['check', '-c', file], { stdio: 'inherit' });
console.log('sing-box check passed');
