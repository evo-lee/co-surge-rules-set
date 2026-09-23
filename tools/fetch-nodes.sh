#!/bin/bash
#
# 从 Sub-Store 拉取节点，生成 Surge 的 [Proxy] 分离配置 nodes.dconf。
#
# 设计要点：产物含凭证，绝不进版本库；拉取失败时保留上一版，
# 宁可用旧节点，也不能写出一个空文件把 Surge 打挂。
#
# 可选配置（不进版本库）：~/.config/surge-nodes.env
#   SURGE_API_KEY=xxxxx        # 启用 http-api 后，写完自动重载 Surge
#   SUBSTORE_COLLECTION=all-in-one
#
set -uo pipefail

CONF="${HOME}/.config/surge-nodes.env"
[ -f "$CONF" ] && . "$CONF"

COLLECTION="${SUBSTORE_COLLECTION:-all-in-one}"
SUBSTORE_URL="${SUBSTORE_URL:-https://sub.store/download/collection/${COLLECTION}?target=Surge}"
PROXY="${SURGE_PROXY:-http://127.0.0.1:6152}"
OUT="${NODES_OUT:-${HOME}/Library/Application Support/Surge/Profiles/nodes.dconf}"
API="${SURGE_API:-http://127.0.0.1:6171}"
MIN_NODES="${MIN_NODES:-10}"
SHRINK_GUARD="${SHRINK_GUARD:-50}"   # 新节点数低于旧的百分之多少就拒绝写入

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "ABORT: $*"; exit 1; }

PROTO='ss|ssr|vmess|vless|trojan|http|https|socks5|socks5-tls|snell|hysteria2|tuic|wireguard|anytls|ssh|direct'
count_nodes() { grep -cE "^[^#[:space:]].*=[[:space:]]*(${PROTO})," "$1" 2>/dev/null || echo 0; }

TMP="${OUT}.tmp.$$"          # 与目标同目录，保证 mv 是原子的
BODY="${OUT}.body.$$"
trap 'rm -f "$TMP" "$BODY"' EXIT

# ── 拉取 ────────────────────────────────────────────────────
log "拉取 ${COLLECTION} …"
code=$(curl -sS --proxy "$PROXY" --max-time 180 -o "$BODY" -w '%{http_code}' "$SUBSTORE_URL" 2>/dev/null) \
  || die "curl 失败（Surge 没运行？代理 ${PROXY} 不可达？）"
[ "$code" = "200" ] || die "HTTP $code"

new=$(count_nodes "$BODY")
log "解析到 $new 个节点"
[ "$new" -ge "$MIN_NODES" ] || die "只有 $new 个节点，低于下限 ${MIN_NODES}，拒绝写入"

# ── 缩水保护：机场临时故障时别把好数据覆盖掉 ──────────────────
if [ -f "$OUT" ]; then
  old=$(count_nodes "$OUT")
  if [ "$old" -gt 0 ]; then
    pct=$(( new * 100 / old ))
    if [ "$pct" -lt "$SHRINK_GUARD" ] && [ "${FORCE:-0}" != "1" ]; then
      die "节点数从 $old 降到 ${new}（${pct}%），低于 ${SHRINK_GUARD}% 阈值。确认无误请用 FORCE=1 重跑"
    fi
  fi
fi

# ── 原子写入 ────────────────────────────────────────────────
{
  echo "# 由 tools/fetch-nodes.sh 生成于 $(date '+%Y-%m-%d %H:%M:%S')"
  echo "# 来源: Sub-Store / ${COLLECTION}    节点数: ${new}"
  echo "# 请勿手工编辑，每次运行都会覆盖。此文件含凭证，绝不可进版本库。"
  echo
  echo "[Proxy]"
  cat "$BODY"
} > "$TMP" || die "写临时文件失败"
mv -f "$TMP" "$OUT" || die "替换 $OUT 失败"
log "已写入 $OUT"

# ── 重载 Surge（可选）───────────────────────────────────────
if [ -n "${SURGE_API_KEY:-}" ]; then
  rc=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API}/v1/profiles/reload" \
        -H "X-Key: ${SURGE_API_KEY}" --max-time 30 2>/dev/null)
  case "$rc" in
    200|204) log "Surge 已重载" ;;
    *)       log "WARN: 重载失败 (HTTP ${rc:-?})，节点文件已更新但需手动重载" ;;
  esac
else
  log "未配置 SURGE_API_KEY，跳过自动重载（需在 Surge 里手动重载才生效）"
fi
