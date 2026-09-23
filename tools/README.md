# tools

## fetch-nodes.sh

从 Sub-Store 拉取节点，生成 Surge 的 `[Proxy]` 分离配置 `nodes.dconf`。

产物含凭证，**绝不可进版本库**（`.gitignore` 已覆盖 `nodes.dconf`）。

### 安全设计

脚本宁可用旧节点，也不会写出一个坏文件——`nodes.dconf` 一旦为空，Surge 的所有策略组就会指向不存在的节点。

| 防护 | 行为 |
|---|---|
| HTTP 非 200 | 中止，保留旧文件 |
| 节点数 < `MIN_NODES`（默认 10） | 中止，保留旧文件 |
| 节点数较上次缩水超过 `SHRINK_GUARD`%（默认 50） | 中止；确认无误用 `FORCE=1` 重跑 |
| Surge 未运行 / 代理不可达 | 中止，保留旧文件 |
| 写入 | 先写同目录临时文件，再 `mv` 原子替换 |

### 配置

可选，放在 `~/.config/surge-nodes.env`（不进版本库）：

```bash
SURGE_API_KEY=你的key          # 启用 Surge http-api 后自动重载
SUBSTORE_COLLECTION=all-in-one
```

其余可用环境变量：`SUBSTORE_URL` `SURGE_PROXY` `NODES_OUT` `SURGE_API` `MIN_NODES` `SHRINK_GUARD` `FORCE`。

### 为什么需要 SURGE_API_KEY

实测确认 **Surge 不会自动重载被外部修改的配置文件**，所以定时任务写完 `nodes.dconf` 后必须显式触发重载。

在 Surge 主配置的 `[General]` 里加：

```
http-api = 你的key@127.0.0.1:6171
```

不配也能用，只是每次更新后要手动在 Surge 里重载。

## com.surge-nodes.plist

launchd 定时任务模板，默认每 6 小时跑一次。安装步骤见文件内注释。
