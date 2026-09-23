#!/usr/bin/env bash
# 提交前凭据扫描。只看暂存内容 —— 也就是这次真正会进 git 历史的字节。
#
# 本仓库是公开的，[Proxy] 段的一切（节点地址、密码、UUID、订阅链接）都不得入库。
# git 历史推上去就删不掉，所以拦截点必须在 commit 之前。
#
# 安装：  ln -sf ../../tools/pre-commit.sh .git/hooks/pre-commit
# 绕过：  git commit --no-verify   （确知是误报时）
set -uo pipefail

git diff --cached --quiet && exit 0   # 没有暂存内容

python3 - "$(git rev-parse --show-toplevel)" <<'PY'
import subprocess, sys, os, re, io

ROOT = sys.argv[1]
fail, warn = [], []

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout

# ── 1. 路径闸门 ───────────────────────────────────────────────
# 即使被 git add -f 强加，这些名字也一律拒绝
staged = [p for p in sh('git','diff','--cached','--name-only','--diff-filter=ACMR').splitlines() if p]
PATH_DENY = [
    (re.compile(r'(^|/)nodes?\.dconf$'),              '节点文件'),
    (re.compile(r'(^|/)[Pp]roxy[^/]*\.dconf$'),       '节点文件'),
    (re.compile(r'\.conf$(?<!\.example\.conf)'),      '完整配置（可能含 ca-p12/http-api key）'),
    (re.compile(r'(^|/)\.env$|(^|/)secrets?/'),       '密钥文件'),
    (re.compile(r'(^|/)sub-store.*\.json$'),          'Sub-Store 数据备份'),
    (re.compile(r'\.(p12|pem|key)$'),                 '证书/私钥'),
]
for p in staged:
    for rx, why in PATH_DENY:
        if rx.search(p):
            fail.append(f'路径被拒绝: {p}  ({why})')

# ── 2. 内容扫描 ───────────────────────────────────────────────
blob = sh('git','diff','--cached','--unified=0','--no-color')
added = '\n'.join(l[1:] for l in blob.splitlines()
                  if l.startswith('+') and not l.startswith('+++'))

IP_OK = {'127.0.0.1','0.0.0.0','8.8.8.8','8.8.4.4','1.1.1.1','1.0.0.1',
         '9.9.9.9','208.67.222.222','208.67.220.220','100.100.100.100',
         '223.5.5.5','119.29.29.29','114.114.114.114'}

SHAPES = [
    # 尾部排除反引号：文档里的 `ss://` 是行文，真凭据后面不会紧跟反引号
    ('节点链接',      re.compile(r'\b(ss|ssr|vmess|vless|trojan|hysteria2?|tuic|snell|anytls)://[^\s`]')),
    ('32位十六进制',  re.compile(r'(?<![0-9a-fA-F])[0-9a-f]{32}(?![0-9a-fA-F])')),
    ('UUID',          re.compile(r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b')),
    ('凭据赋值',      re.compile(r'\b(password|uuid|psk|private-key|auth|token|secret|api[-_]?key|ca-p12|ca-passphrase)\s*=\s*[^\s%$你<`]')),
    ('Base64长串',    re.compile(r'(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{60,}={0,2}')),
]
for label, rx in SHAPES:
    for m in rx.finditer(added):
        fail.append(f'{label}: …{m.group(0)[:16]}… (已截断)')

for m in re.finditer(r'\b(\d{1,3}(?:\.\d{1,3}){3})\s*:\s*\d{2,5}', added):
    if m.group(1) not in IP_OK:
        fail.append(f'非白名单 IP:端口 {m.group(0)}')

# ── 3. 主机名白名单 ───────────────────────────────────────────
# 订阅链接的特征就是一个没见过的域名。白名单化是最省事也最严的检查。
HOST_OK = {'127.0.0.1','localhost','cdn.jsdelivr.net','purge.jsdelivr.net',
           'raw.githubusercontent.com','github.com','sub.store',
           'cp.cloudflare.com','www.apple.com','doh.pub','captive.apple.com'}
for m in re.finditer(r'https?://([A-Za-z0-9._-]+)', added):
    if m.group(1) not in HOST_OK:
        fail.append(f'主机名不在白名单: {m.group(1)}  '
                    f'（确属公开资源请加进 tools/pre-commit.sh 的 HOST_OK）')

# ── 4. 拿本机真实节点数据反查（文件存在才跑，不联网）────────────
N = os.path.expanduser('~/Library/Application Support/Surge/Profiles/nodes.dconf')
if os.path.exists(N) and added.strip():
    servers, creds, names = set(), set(), set()
    for ln in io.open(N, encoding='utf-8', errors='replace'):
        ln = ln.strip()
        if not ln or ln[0] in '#[' or '=' not in ln:
            continue
        name, rhs = ln.split('=', 1)
        f = [x.strip() for x in rhs.split(',')]
        names.add(name.strip())
        if len(f) >= 2 and len(f[1]) > 3:
            servers.add(f[1])
        for x in f[2:]:
            if '=' in x:
                k, v = x.split('=', 1)
                if k.strip() in ('password','uuid','psk','private-key','token','auth') and len(v.strip()) > 5:
                    creds.add(v.strip())
            elif len(x) >= 16:
                creds.add(x)
    for s in servers | creds:
        if s in added:
            fail.append(f'命中本机真实节点数据: …{s[:8]}… (已截断)')
    for n in names:
        if len(n) >= 8 and n in added:
            warn.append(f'与本机节点名称相同: {n}')

# ── 输出 ─────────────────────────────────────────────────────
for w in sorted(set(warn)):
    print(f'  \033[33m警告\033[0m  {w}', file=sys.stderr)
if fail:
    print('\n\033[31m✗ pre-commit 拦截：暂存内容里有不该进公开仓库的东西\033[0m\n', file=sys.stderr)
    for f_ in sorted(set(fail)):
        print(f'  {f_}', file=sys.stderr)
    print(f'\n  共 {len(set(fail))} 项。确知是误报： git commit --no-verify\n', file=sys.stderr)
    sys.exit(1)
sys.exit(0)
PY
