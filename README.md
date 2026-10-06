# rule-set

[English](#english) | [中文](#中文)

---

## English

One routing rule plan, rendered for **Surge**, **Shadowrocket**, **Clash / Mihomo**, **sing-box** and **Quantumult X**. Rules only — no proxies, no subscriptions.

- **AI first, manual only.** AI services (Claude, ChatGPT, Gemini, Copilot, Perplexity) go to a dedicated `AI` policy that you pin to one node, so your exit IP never churns.
- **Whitelist mode** on top of [Loyalsoldier](https://github.com/Loyalsoldier/surge-rules) data.
- **Identical classification on every client.** All clients use the same upstream data. (Mixing Loyalsoldier and MetaCubeX would put ~200 domains on opposite sides of direct/proxy.)
- **Leak-aware.** IP rules use `no-resolve`; proxied and AI domains resolve remotely; sing-box gets matching DNS rules.

Built daily by GitHub Actions and served from the `release` branch via jsDelivr.

### Policy contract

The rules only reference these policy names. **Your config must define `AI` and `Proxy`.**

| Name | Meaning | Surge / Shadowrocket / Clash | sing-box | Quantumult X |
|---|---|---|---|---|
| `AI` | AI services; select one fixed node manually | policy group `AI` | outbound `AI` | policy `AI` |
| `Proxy` | everything that should be proxied | policy group `Proxy` | outbound `Proxy` | policy `Proxy` |
| `DIRECT` | direct | built-in | outbound `direct` | `direct` |
| `REJECT` | block | built-in | `reject` action | `reject` |

### Rule order

1. `ai`, `ai-ip` → `AI`
2. `private` → DIRECT, `reject` → REJECT, Apple system services (Surge only), `icloud` / `apple` → DIRECT
3. `proxy` → Proxy (remote DNS), `direct` → DIRECT
4. `telegramcidr` → Proxy, `cncidr` → DIRECT (`no-resolve`)
5. LAN → DIRECT, `GEOIP,CN` → DIRECT
6. Final → Proxy

### Usage

Base URL: `https://cdn.jsdelivr.net/gh/evo-lee/rule-set@release`

| Client | Rules snippet | Rule sets |
|---|---|---|
| Surge | `surge/rules.conf` (`[Rule]` section) | `surge/ai.list`, `surge/ai-ip.list` + Loyalsoldier |
| Shadowrocket | `shadowrocket/rules.conf` | same as Surge |
| Clash / Mihomo | `clash/rules.yaml` (`rule-providers` + `rules`) | `clash/ai.txt`, `clash/ai-ip.txt` + Loyalsoldier clash-rules |
| sing-box ≥ 1.12 | `singbox/rules.json` (`dns` + `route`) | `singbox/<set>.srs` (source: `.json`) |
| Quantumult X | `qx/rules.conf` (`[filter_remote]` + `[filter_local]`) | `qx/<set>.list` |

Copy the snippet into your config, or reference single sets. Examples:

```ini
# Surge
RULE-SET,https://cdn.jsdelivr.net/gh/evo-lee/rule-set@release/surge/ai.list,AI,force-remote-dns
```

```yaml
# Mihomo
rule-providers:
  ai:
    type: http
    behavior: classical
    format: text
    url: https://cdn.jsdelivr.net/gh/evo-lee/rule-set@release/clash/ai.txt
    path: ./ruleset/ai.txt
    interval: 86400
```

```json
// sing-box
{ "type": "remote", "tag": "ai", "format": "binary",
  "url": "https://cdn.jsdelivr.net/gh/evo-lee/rule-set@release/singbox/ai.srs" }
```

**sing-box notes**: sing-box has no GEOIP, so `GEOIP,CN` becomes a `resolve` action followed by `cncidr`. The `dns` block sends AI/proxied domains to `1.1.1.1` via `Proxy` and everything else to `223.5.5.5` (DoH). Adjust the servers if needed.

**Quantumult X notes**: everything except `final` is a `[filter_remote]` resource, because `[filter_local]` always outranks remote filters.

### Contributing

- AI domains/IPs: edit [`rules/ai.list`](rules/ai.list) (Surge syntax). Only add entries from first-party sources and link the source in the PR.
- Rule order, sets and policies: [`src/definition.js`](src/definition.js) is the single source of truth. Never hand-edit generated output.
- Run `npm test`. If the output change is intended, run `UPDATE_SNAPSHOTS=1 npm test` and commit the snapshot diff.
- Local build: `npm run build` (add `SING_BOX=/path/to/sing-box` to compile `.srs`, then `npm run verify`).

### License

GPL-3.0. Domain and IP data is derived from [Loyalsoldier/surge-rules](https://github.com/Loyalsoldier/surge-rules) and [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules) (GPL-3.0).

---

## 中文

一份分流规则，同时生成 **Surge**、**Shadowrocket**、**Clash / Mihomo**、**sing-box**、**Quantumult X** 五种格式。只包含规则，不包含节点和订阅。

- **AI 优先、只能手动选择**：AI 服务（Claude、ChatGPT、Gemini、Copilot、Perplexity）走独立的 `AI` 策略。你手动把它固定到一个节点，出口 IP 就不会变（防封号）。
- 基于 [Loyalsoldier](https://github.com/Loyalsoldier/surge-rules) 数据的**白名单模式**。
- **所有客户端的分类完全一致**：全部使用同一个上游数据源。（如果混用 Loyalsoldier 和 MetaCubeX，约 200 个域名会被分到相反的直连/代理一侧。）
- **防 DNS 泄漏**：IP 规则都加 `no-resolve`；代理域名和 AI 域名走远程解析；sing-box 另外生成配套的 DNS 规则。

由 GitHub Actions 每天构建，发布到 `release` 分支，通过 jsDelivr 分发。

### 策略约定

规则只引用以下策略名。**你的配置必须定义 `AI` 和 `Proxy`。**

| 名称 | 含义 | Surge / Shadowrocket / Clash | sing-box | Quantumult X |
|---|---|---|---|---|
| `AI` | AI 服务，手动固定一个节点 | 策略组 `AI` | 出站 `AI` | 策略 `AI` |
| `Proxy` | 需要代理的流量 | 策略组 `Proxy` | 出站 `Proxy` | 策略 `Proxy` |
| `DIRECT` | 直连 | 内置 | 出站 `direct` | `direct` |
| `REJECT` | 拦截 | 内置 | `reject` 动作 | `reject` |

### 规则顺序

1. `ai`、`ai-ip` → `AI`
2. `private` → 直连；`reject` → 拦截；Apple 系统服务（仅 Surge）；`icloud`、`apple` → 直连
3. `proxy` → 代理（远程 DNS）；`direct` → 直连
4. `telegramcidr` → 代理；`cncidr` → 直连（`no-resolve`）
5. 局域网 → 直连；`GEOIP,CN` → 直连
6. 兜底 → 代理

### 使用

基础地址：`https://cdn.jsdelivr.net/gh/evo-lee/rule-set@release`

| 客户端 | 规则片段 | 规则集 |
|---|---|---|
| Surge | `surge/rules.conf`（`[Rule]` 段） | `surge/ai.list`、`surge/ai-ip.list` + Loyalsoldier |
| Shadowrocket | `shadowrocket/rules.conf` | 同 Surge |
| Clash / Mihomo | `clash/rules.yaml`（`rule-providers` + `rules`） | `clash/ai.txt`、`clash/ai-ip.txt` + Loyalsoldier clash-rules |
| sing-box ≥ 1.12 | `singbox/rules.json`（`dns` + `route`） | `singbox/<set>.srs`（源格式为 `.json`） |
| Quantumult X | `qx/rules.conf`（`[filter_remote]` + `[filter_local]`） | `qx/<set>.list` |

把规则片段复制进你的配置，或者只引用单个规则集（示例见上方英文部分）。

**sing-box 说明**：sing-box 没有 GEOIP，所以 `GEOIP,CN` 用"先 `resolve` 解析，再匹配 `cncidr`"来实现。`dns` 段把 AI 域名和代理域名经 `Proxy` 发给 `1.1.1.1` 解析，其余域名走 `223.5.5.5`（DoH）。可以按需修改 DNS 服务器。

**Quantumult X 说明**：除了兜底规则 `final`，其他规则全部放在 `[filter_remote]`，因为 `[filter_local]` 的优先级永远高于远程规则。

### 参与贡献

- AI 域名和 IP：编辑 [`rules/ai.list`](rules/ai.list)（Surge 语法）。只收录官方来源的条目，并在 PR 中附上来源链接。
- 规则顺序、规则集和策略：[`src/definition.js`](src/definition.js) 是唯一来源。不要手动修改生成的产物。
- 运行 `npm test`。如果输出变化是预期的，运行 `UPDATE_SNAPSHOTS=1 npm test`，并把快照的变化一起提交。
- 本地构建：`npm run build`。加上 `SING_BOX=/path/to/sing-box` 可以编译 `.srs`，然后运行 `npm run verify` 校验。

### 许可证

GPL-3.0。域名和 IP 数据来自 [Loyalsoldier/surge-rules](https://github.com/Loyalsoldier/surge-rules) 与 [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules)（GPL-3.0）。
