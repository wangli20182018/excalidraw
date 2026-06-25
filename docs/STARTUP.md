# 启动指南

## 环境要求

- **Node.js** `>=18`（CI 使用 Node 20）
- **Yarn** 1.x（仓库通过 `packageManager` 锁定为 `yarn@1.22.22`）
- **Rust**（仅 `desktop/` Tauri 桌面壳需要；纯网页/前端开发不需要）

## 安装依赖

在仓库根目录执行（Yarn workspaces 会自动为所有子包安装）：

```bash
yarn
```

## 启动开发服务器（excalidraw.com 网页应用）

```bash
yarn start
```

底层等价于 `yarn --cwd ./excalidraw-app start`，会先 `yarn` 再用 **Vite** 启动开发服务器。默认地址见终端输出（通常为 http://localhost:5173 或 Vite 提示的端口）。

## 启动桌面应用（desktop/ · Tauri × Excalidraw）

`desktop/` 是基于 Tauri 的桌面壳，把 Excalidraw 当纯空间引擎嵌入（多媒体卡片/Overlay 在后续阶段加入）。详见 `../desktop/README.md`、`../desktop/RUST_INSTALL.md`。

> 桌面壳**不依赖**网页应用的 PWA/Firebase/Sentry 等云端能力，为本地优先形态。

### A. 仅前端（浏览器验证，无需 Rust）
```bash
yarn workspace desktop dev      # http://localhost:1420
```
打开 http://localhost:1420 即可看到 Excalidraw 编辑器。`@excalidraw/*` 走源码别名，无需构建包。

### B. 日常启动桌面窗口（Rust 已装，秒级）
本机 Rust 1.96.0 已装在 `~/.cargo`、PATH 已写进 `~/.zshrc`、cargo 镜像已配、图标已生成、crate 已编译过：
```bash
yarn workspace desktop tauri dev      # 增量编译，几秒开窗；改前端自动热重载
```
首次完整编译耗时约 9 分钟（351 个 crate），之后都是增量、秒级。

### C. 首次环境搭建（新机器/重装时才看）

**C-0. 补桌面 JS 依赖（仅一次）**
```bash
yarn install      # desktop/package.json 已含 @tauri-apps/cli / api / plugin-fs / plugin-dialog
```

**C-1. 装 Rust（二选一）**

▸ 在线（网络好时）：
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
source "$HOME/.cargo/env"
```

▸ 离线（国内受限网络，已验证可行）：见 `../desktop/RUST_INSTALL.md` 与 `~/rust-pkgs/下载说明.md`。
手动下 3 个 `.tar.xz` 到 `~/rust-pkgs/`（rustc / cargo / rust-std，x86_64-apple-darwin，共 ~113MB），再：
```bash
mkdir -p /tmp/rust-install && cd /tmp/rust-install
for f in ~/rust-pkgs/*.tar.xz; do tar xf "$f"; done                 # 解压 3 个包
for d in */; do ( cd "$d" && ./install.sh --prefix=$HOME/.cargo --disable-ldconfig ); done
xattr -dr com.apple.quarantine ~/.cargo     # ★ 清 macOS Gatekeeper 隔离，否则提示"无法验证开发者"
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc
```
> Apple Silicon 把 `x86_64` 换成 `aarch64`。

**C-2. 配 cargo 镜像（国内必做，否则 `tauri dev` 拉 crate 会卡）**
```bash
cat > ~/.cargo/config.toml <<'EOF'
[source.crates-io]
replace-with = 'tuna'
[source.tuna]
registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"
[net]
git-fetch-with-cli = true
EOF
```
（TUNA 不通可换中科大 `mirrors.ustc.edu.cn` 或字节 `rsproxy.cn`）

**C-3. 生成应用图标（仅一次，需源图）**
```bash
yarn workspace desktop tauri icon /绝对路径/icon.png   # 源图最好 ≥512×512，正方形
```
（本机已用 `public/android-chrome-512x512.png` 生成；命令在 `desktop/` 下执行，源图要用绝对路径。）

**C-4. 首次启动（会全量编译，~9 分钟）**
```bash
yarn workspace desktop tauri dev      # 开发窗口
yarn workspace desktop tauri build    # 生产打包（.app/.dmg）
```

### 停止桌面应用
```bash
pkill -f "target/debug/desktop"; pkill -f "tauri dev"; pkill -f "vite --port 1420"
```

## 生产构建与预览

```bash
yarn build          # 构建 excalidraw-app 生产包 + 生成版本号
yarn build:preview  # 构建后用 vite preview 在 5000 端口预览
```

## 构建内部 npm 包（一般开发不需要）

仅在需要 `dist/` 产物（如发布、在 examples 中引用）时运行。顺序依赖：

```bash
yarn build:packages
# 链路：common → fractional-indexing → laser-pointer → math → element → excalidraw
```

> 说明：内部 `@excalidraw/*` 包在开发与测试中通过 TS 路径别名直接解析到**源码**（`src/index.ts`），所以**日常开发和跑测试无需先构建包**。

## 跑测试 / 校验（提交前）

```bash
yarn test:other      # prettier 格式检查
yarn test:code       # eslint（--max-warnings=0）
yarn test:typecheck  # 全仓库 tsc 类型检查
yarn test:app        # vitest（默认是 watch 模式，加 --watch=false 可单次跑）
yarn fix             # 自动修复格式和 lint
```

## 运行 examples

```bash
yarn start:example   # 会先 build:packages 再启动 with-script-in-browser 示例
```

## 常见问题

- **端口被占用**：Vite 会自动切到下一个可用端口，按终端提示访问即可。
- **依赖装不上**：可执行 `yarn clean-install`（清掉所有 `node_modules` 后重装）。
- **只改了某个内部包**：无需重新 `build:packages`，Vitest 和 Vite 都走源码别名。
- **桌面壳 `tauri dev` 报错**：确认已装 Rust、已 `yarn install` 桌面 JS 依赖、已生成图标（见 §启动桌面应用 C）。
- **只想验证 Excalidraw 嵌入**：直接 `yarn workspace desktop dev` 用浏览器看，不必装 Rust。
- **macOS 提示"无法打开 rustc，无法验证开发者"**：Gatekeeper 拦截了离线装的二进制，执行 `xattr -dr com.apple.quarantine ~/.cargo` 清隔离属性。
- **`tauri dev` 卡在下载 crate（Downloading/Fetch 不动）**：`~/.cargo/config.toml` 镜像没配或网络堵，按 §C-2 配 TUNA/中科大/rsproxy 镜像。
- **`tauri icon` 提示找不到源图**：该命令在 `desktop/` 下执行，源图要用**绝对路径**。
- **首次 `tauri dev` 很慢**：正常，要全量编译 ~351 个 crate（约 9 分钟、下载 ~17MB）；之后增量秒级。
