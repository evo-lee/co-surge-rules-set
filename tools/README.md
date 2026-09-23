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

## `pre-commit.sh` — 提交前凭据扫描

本仓库是公开的。`[Proxy]` 段的一切（节点地址、密码、UUID、订阅链接）都不得入库，
而 git 历史一旦推送就删不掉，所以拦截点必须在 commit 之前而不是 push 之后。

安装（clone 之后跑一次，`.git/hooks/` 不受版本控制）：

```sh
ln -sf ../../tools/pre-commit.sh .git/hooks/pre-commit
```

只扫**暂存的新增行**，也就是这次真正会进历史的字节。四层检查：

| 层 | 拦什么 |
|---|---|
| 路径闸门 | `nodes.dconf`、`Proxy*.dconf`、`*.conf`（放行 `*.example.conf`）、`.env`、`secrets/`、`*.p12/pem/key`、`sub-store*.json`。`git add -f` 也挡 |
| 形状扫描 | `ss://` `vmess://` 等节点链接、32 位十六进制、UUID、`password=`/`ca-p12=` 类赋值、≥60 位 Base64、非白名单 `IP:端口` |
| 主机名白名单 | 订阅链接的特征就是一个没见过的域名，所以反过来只放行已知公开源（jsDelivr / GitHub / sub.store / cp.cloudflare.com …） |
| 真实数据反查 | 读本机 `nodes.dconf`，把真实服务器地址和凭据逐个在暂存内容里搜。这层能抓住裸域名——它不带 `http://`，白名单层看不见 |

第四层只在 `~/Library/Application Support/Surge/Profiles/nodes.dconf` 存在时运行，不联网。

新增一个公开数据源被拦下时，把域名加进脚本里的 `HOST_OK`，不要用 `--no-verify` 绕。
`--no-verify` 留给确知的误报。

已验证的 6 个用例：真实 hysteria2 节点行 / 订阅链接 / 强加 `nodes.dconf` / 含 `ca-passphrase`
的完整 `.conf` / 裸域名形式的真实节点地址 —— 全部拦下；`*.example.conf` 正常放行。
