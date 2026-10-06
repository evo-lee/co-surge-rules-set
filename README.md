# co-surge-rules-set

[English](#english) | [中文](#中文)

---

## English

One routing rule plan, rendered for **Surge**, **Shadowrocket** and **Clash / Mihomo**. Rules only — no proxies, no subscriptions.

- **AI first, manual only.** AI services (Claude, ChatGPT, Gemini, Copilot, Perplexity) go to a dedicated `AI` policy that you pin to one node, so your exit IP never churns.
- **Whitelist mode** on top of [Loyalsoldier](https://github.com/Loyalsoldier/surge-rules) data.
- **Reference, don't copy.** Upstream lists are referenced by URL, so your client picks up upstream updates directly. Only the AI list maintained here is published by this repo.
- **Identical classification on every client.** All clients use the same upstream data. (Mixing Loyalsoldier and MetaCubeX would put ~200 domains on opposite sides of direct/proxy.)
- **Leak-aware.** IP rules use `no-resolve`; proxied and AI domains resolve remotely.
- **Reachable from mainland China.** Every URL goes through jsDelivr, not `raw.githubusercontent.com`.

### Policy contract

The rules only reference these policy names. **Your config must define the `AI` and `Proxy` policy groups.**

| Name | Meaning |
|---|---|
| `AI` | AI services; select one fixed node manually |
| `Proxy` | everything that should be proxied |
| `DIRECT` / `REJECT` | built-in |

### Rule order

1. AI → `AI`:
   - `ai` and `ai-ip` (maintained here)
   - [xiaolai/anthropic-claude-surge-rules-set](https://github.com/xiaolai/anthropic-claude-surge-rules-set), referenced by URL
2. `private` → DIRECT, `reject` → REJECT, Apple system services (Surge only), `icloud` / `apple` → DIRECT
3. `proxy` → Proxy (remote DNS), `direct` → DIRECT
4. `telegramcidr` → Proxy, `cncidr` → DIRECT (`no-resolve`)
5. LAN → DIRECT, `GEOIP,CN` → DIRECT
6. Final → Proxy

### Usage

Base URL: `https://cdn.jsdelivr.net/gh/evo-lee/co-surge-rules-set@release`

| Client | Rules snippet | Rule sets published here |
|---|---|---|
| Surge | `surge/rules.conf` (`[Rule]` section) | `surge/ai.list`, `surge/ai-ip.list` |
| Shadowrocket | `shadowrocket/rules.conf` | same as Surge |
| Clash / Mihomo | `clash/rules.yaml` (`rule-providers` + `rules`) | `clash/ai.txt`, `clash/ai-ip.txt` |

Copy the snippet into your config, or reference single sets:

```ini
# Surge
RULE-SET,https://cdn.jsdelivr.net/gh/evo-lee/co-surge-rules-set@release/surge/ai.list,AI,force-remote-dns
```

```yaml
# Mihomo
rule-providers:
  ai:
    type: http
    behavior: classical
    format: text
    url: https://cdn.jsdelivr.net/gh/evo-lee/co-surge-rules-set@release/clash/ai.txt
    path: ./ruleset/ai.txt
    interval: 86400
```

### Contributing

- AI domains/IPs: edit [`rules/ai.list`](rules/ai.list) (Surge syntax). Only add entries from first-party sources and link the source in the PR.
- Rule order, sets and policies: [`src/definition.js`](src/definition.js) is the single source of truth. Never hand-edit generated output.
- Run `npm test`. If the output change is intended, run `UPDATE_SNAPSHOTS=1 npm test` and commit the snapshot diff.
- Local build: `npm run build` (offline; output in `dist/`).

### License

GPL-3.0. Loyalsoldier data ([surge-rules](https://github.com/Loyalsoldier/surge-rules), [clash-rules](https://github.com/Loyalsoldier/clash-rules)) is GPL-3.0. The xiaolai list is only referenced by URL; this repo does not copy or publish it.

---

## 中文

一份分流规则，同时生成 **Surge**、**Shadowrocket**、**Clash / Mihomo** 三种格式。只包含规则，不包含节点和订阅。

- **AI 优先、只能手动选择**：AI 服务（Claude、ChatGPT、Gemini、Copilot、Perplexity）走独立的 `AI` 策略。你手动把它固定到一个节点，出口 IP 就不会变（防封号）。
- 基于 [Loyalsoldier](https://github.com/Loyalsoldier/surge-rules) 数据的**白名单模式**。
- **引用而不是复制**：上游规则一律通过链接引用，上游一更新，你的客户端就能直接拿到。本仓库只发布自己维护的 AI 列表。
- **所有客户端的分类完全一致**：全部使用同一个上游数据源。（如果混用 Loyalsoldier 和 MetaCubeX，约 200 个域名会被分到相反的直连/代理一侧。）
- **防 DNS 泄漏**：IP 规则都加 `no-resolve`；代理域名和 AI 域名走远程解析。
- **国内可直接访问**：所有链接都走 jsDelivr，不使用 `raw.githubusercontent.com`。

### 策略约定

规则只引用以下策略名。**你的配置必须定义 `AI` 和 `Proxy` 两个策略组。**

| 名称 | 含义 |
|---|---|
| `AI` | AI 服务，手动固定一个节点 |
| `Proxy` | 需要代理的流量 |
| `DIRECT` / `REJECT` | 内置策略 |

### 规则顺序

1. AI → `AI`：
   - `ai`、`ai-ip`（本仓库维护）
   - [xiaolai/anthropic-claude-surge-rules-set](https://github.com/xiaolai/anthropic-claude-surge-rules-set)（链接引用）
2. `private` → 直连；`reject` → 拦截；Apple 系统服务（仅 Surge）；`icloud`、`apple` → 直连
3. `proxy` → 代理（远程 DNS）；`direct` → 直连
4. `telegramcidr` → 代理；`cncidr` → 直连（`no-resolve`）
5. 局域网 → 直连；`GEOIP,CN` → 直连
6. 兜底 → 代理

### 使用

基础地址：`https://cdn.jsdelivr.net/gh/evo-lee/co-surge-rules-set@release`

| 客户端 | 规则片段 | 本仓库发布的规则集 |
|---|---|---|
| Surge | `surge/rules.conf`（`[Rule]` 段） | `surge/ai.list`、`surge/ai-ip.list` |
| Shadowrocket | `shadowrocket/rules.conf` | 同 Surge |
| Clash / Mihomo | `clash/rules.yaml`（`rule-providers` + `rules`） | `clash/ai.txt`、`clash/ai-ip.txt` |

把规则片段复制进你的配置，或者只引用单个规则集（示例见上方英文部分）。

### 参与贡献

- AI 域名和 IP：编辑 [`rules/ai.list`](rules/ai.list)（Surge 语法）。只收录官方来源的条目，并在 PR 中附上来源链接。
- 规则顺序、规则集和策略：[`src/definition.js`](src/definition.js) 是唯一来源。不要手动修改生成的产物。
- 运行 `npm test`。如果输出变化是预期的，运行 `UPDATE_SNAPSHOTS=1 npm test`，并把快照的变化一起提交。
- 本地构建：`npm run build`（不需要联网，产物在 `dist/`）。

### 许可证

GPL-3.0。Loyalsoldier 的数据（[surge-rules](https://github.com/Loyalsoldier/surge-rules)、[clash-rules](https://github.com/Loyalsoldier/clash-rules)）为 GPL-3.0。xiaolai 的列表只通过链接引用，本仓库不复制也不发布它的内容。
