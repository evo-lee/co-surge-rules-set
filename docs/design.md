# 设计决策记录

记录这个仓库为什么长成现在这样。带 ✅ 的是实测验证过的结论，不是推测。

---

## 核心原则：按敏感度切分，不按功能切分

规则、策略组、DNS 设置是**公共知识**——它们体现的是路由偏好，泄露了没有任何损失，共享出去反而有价值。

节点定义是**凭证**——服务器 IP、端口、密码一应俱全，泄露等于把线路拱手让人。

这两类东西的正确归宿完全相反，所以它们必须走不同的路径。仓库公开，节点留在本地，边界就是主配置里的 `[Proxy]` 段那一行。

早期曾考虑过把节点同步到 Secret Gist 再让 Surge 拉取，**已否决**：那等于把最敏感的东西搬到最公开的地方，方向反了。

---

## 实测结论

### ✅ Surge 跟随 `#!include` 的软链接

**测法**：在 Surge 的 Profiles 目录放两个探针，一个是普通文件、一个是指向本仓库的软链接，各自 REJECT 一个当前可达的域名，对比重载前后。

| 探针 | 形式 | 重载前 | 重载后 |
|---|---|---|---|
| `example.org` | 普通文件 | 200 | 503 |
| `example.com` | **软链接** | 200 | 503 |
| `cp.cloudflare.com` | 对照 | 204 | 204 |

两个域名在重载前都是 200，证明 DNS 本来就通，所以 503 只可能来自 REJECT 规则而非解析失败。对照域名不受影响，排除整体故障。

**影响**：仓库可以放在任意位置，软链进 Profiles 目录即可。不必把仓库 clone 到 Surge 的目录里。

### ✅ Surge 不会自动重载被外部修改的配置文件

同一次实验中，插入 include 后轮询 60 秒（6 次，10 秒间隔）无任何变化；手动重载后立刻生效。

**影响**：这条推翻了一个早先的判断。原本认为「`rules.dconf` 走远程 include，稳定且能防手滑」，但远程 include 的刷新依赖 `#!MANAGED-CONFIG` 的 `interval`（默认 86400 秒），而官方文档并未说明纯 dconf 被远程 include 时的刷新语义。

相比之下，**本地软链接 + 手动重载是即时且确定的**。因此自用场景下软链接优于远程 include。

远程 include 退回到它本来的定位：**给他人的分发方式**，以及将来多设备时的同步手段。同一批 dconf 文件支持两种消费方式，不需要维护两套。

---

## 结构决策

### 三层策略组

借鉴 [Rabbit-Spec/Surge](https://github.com/Rabbit-Spec/Surge) 的结构，这是社区已验证的做法：

```
第 3 层 业务组   只引用地区组，永不出现节点名
第 2 层 地区组   include-other-group + policy-regex-filter，hidden=1
第 1 层 入口组   唯一需要使用者替换的一行
```

选它而不是单纯用 `include-all-proxies=true`，原因有三：

1. 地区分组本来就是刚需（AI 要固定出口、流媒体要挑地区），这套结构顺带满足
2. 业务组只认地区组，**节点名变化不影响业务组**——这恰好治了 Sub-Store 输出的节点名带随机后缀、导致手动选择丢失的问题
3. `hidden=1` 让地区组不占 UI

**对上游的唯一实质改动**：入口层给出 A/B 两种接法。Rabbit-Spec 原版只有 `policy-path=<订阅地址>`；本仓库额外支持 `include-all-proxies=true` 配合本地 `[Proxy]` 段，因为节点来自本机 Sub-Store（MitM 虚拟域名 `sub.store`），`policy-path` 能否拉取该域名**未经验证**。A 方案全程使用已文档化的机制。

### 规则来源：自维护 vs 引用上游

分界线是「这条规则是否体现我的策略偏好」：

- **自维护**：AI 分流（`rules/AI.list` 等）。这块上游普遍做得粗，而且是本配置最在意的部分。
- **引用上游**：基础分流、广告拦截。社区（Rabbit-Spec、Sukka）的共识做法。

### 不上 CI

规则是手写的 `.list`，没有构建步骤就不需要管线。Loyalsoldier 的 `main` → `release` 分支模式是因为它要从上游合并去重，本仓库不做这件事。

将来若需要，`rules/` 改名 `source/` 加一个 workflow 即可。

### 用 jsDelivr（2026-09-23 推翻原决定）

原结论是"不用 jsDelivr"：Rabbit-Spec 和 Sukka 都直接用 `raw.githubusercontent.com`，多一层缓存改了规则要等失效。

实际不成立——`raw.githubusercontent.com` 在国内不可达，规则集根本拉不下来，更新无从谈起。缓存是可以忍的代价，不可达不是。

因此全部 `RULE-SET` 与远程 `#!include` 统一走 `https://cdn.jsdelivr.net/gh/evo-lee/co-surge-rules-set@main/...`。

代价与对策：

- `@main` 这类分支引用 jsDelivr 缓存约 12 小时，push 之后不会立刻生效。
- 要立刻生效：把 URL 里的 `cdn.` 换成 `purge.` 请求一次即可刷新该文件
  （`https://purge.jsdelivr.net/gh/evo-lee/co-surge-rules-set@main/rules/AI.list`）。
- 需要绝对确定性时可以把 `@main` 换成 `@<commit-sha>`，jsDelivr 对 commit 引用永久缓存，
  但每次改规则都要改 URL，自用不划算。

### 只做 Surge

多客户端意味着中间表示 + 构建管线，是 Sukka 那个量级的投入。仓库名即边界。

---

## Surge 机制备忘

来自官方文档，落地时会踩：

- 被 `#!include` 的文件**必须自带段声明**（如 `[Rule]`）
- **不能嵌套 include**——被引用的文件不可再引用其他文件，所以 dconf 必须扁平
- 一个段引用了**多个**分离文件时，该段在 UI 中变为只读
- 引用远程 URL 的段同样变为只读
- 模块**不能**修改 `[Proxy]`、`[Proxy Group]`、`[Rule]` 和 MitM 根证书；可以用 `%APPEND%` 追加 `[MITM] hostname`

---

## 待解决

- `nodes.dconf` 的生成方式尚未定案。属于本地工具，不在本仓库范围内。
- 纯 dconf（不带 `#!MANAGED-CONFIG`）被远程 include 时的刷新语义未验证。

---

## 上游数据整理（2026-09-23）

策略组的正则依赖节点名，所以先把 Sub-Store 侧的数据整理干净。

**发现的问题**：`all-in-one` 产出 176 行却只有 64 个唯一节点。

```
m-nhy2   57   VPS 上 sub 服务的端点：2 个自建 + 55 个机场节点转发
m-ntro   57   订阅 URL 与 m-nhy2 完全相同，纯重复
vvcloud  58   机场直连（含 3 条流量/到期信息条目）
其余 4 条  各 1   自建节点
```

更值得注意的是 **`sub` 的转发在静默丢节点**：`vvcloud` 直连有、经 `sub` 转发后消失的恰好 3 个，都是带 `port-hopping-interval` 的 Hysteria2。`sub` 的转换器不认这个参数。这是 parser 覆盖长尾的实证——而丢的正好是家宽港区节点，属于 AI 组最想要的那类。

**处理**：

1. 删除 `m-ntro`（纯重复）
2. 给 `m-nhy2` 加 `Regex Filter`（`keep: ^(h2n|macn)`），只留 2 个自建节点，机场节点交还给 `vvcloud` 直连
3. 给 5 条含自建节点的订阅加 `Regex Rename Operator`（`^` → `🏠 `），统一前缀

**结果**：176 行 → 64 行，唯一 64，零重复；产出体积 31.6 KB → 11.1 KB。

**副作用（已知并接受）**：`vultr-all` 和 `rack-vultr` 两个组合订阅不再包含转发来的机场节点，从 59/61 个降为 4/6 个纯自建节点。按其命名本意这更准确，但与改动前的行为不同。

**对策略组的影响**：`🏠 自建` 的正则从 `(^racked?[- ])|(^mac)|(^h2n$)` 收紧为 `^🏠`。旧正则的 `^mac` 会误伤未来任何「澳门 / Macau」节点。

### 算子 schema 备忘

Sub-Store 的调用方式是 `PROXY_PROCESSORS[type](item.args)`，args 直接作为第一个参数：

```jsonc
{ "type": "Regex Filter",           "args": { "regex": ["^(h2n|macn)"], "keep": true } }
{ "type": "Regex Rename Operator",  "args": [{ "expr": "^", "now": "🏠 " }] }
```

注意 `Regex Rename Operator` 的 args 是**数组**而非对象。API 为 `PATCH /api/sub/:name`，做浅合并（`{...oldSub, ...body}`），因此只发 `process` 字段即可。删除订阅时 Sub-Store 会自动清理组合订阅里的引用。
