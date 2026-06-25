# 手动安装 Rust + Tauri 工具链（国内网络版）

> 本机当前网络对 Google / `static.rustup.rs` / `static.crates.io` 受限。本文全程走**清华 TUNA 镜像**，避免卡住。
> 架构：`x86_64-apple-darwin`（Intel Mac）。M 系列把下文 `x86_64` 换成 `aarch64`。

---

## 0. 先配镜像环境变量（关键，否则必卡）

把下面 3 行加到 `~/.zshrc`（或 `~/.bashrc`），然后 `source ~/.zshrc`：

```bash
export RUSTUP_DIST_SERVER="https://mirrors.tuna.tsinghua.edu.cn/rustup"
export RUSTUP_UPDATE_ROOT="https://mirrors.tuna.tsinghua.edu.cn/rustup/rustup"
export RUSTUP_HOME="$HOME/.rustup"
export CARGO_HOME="$HOME/.cargo"
```

验证镜像可达（应返回 200）：
```bash
curl -sS -o /dev/null -w "%{http_code}\n" --max-time 15 \
  https://mirrors.tuna.tsinghua.edu.cn/rustup/rustup/dist/x86_64-apple-darwin/rustup-init
```
> 若 403/超时：换中科大 `mirrors.ustc.edu.cn` 或字节 `rsproxy.cn`（见文末）。

---

## 方式 A：官方脚本 + 镜像（推荐）

```bash
# 1. 下安装脚本
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init.sh

# 2. 跑安装(minimal profile 省 ~200MB, Tauri 够用)
sh /tmp/rustup-init.sh -y --default-toolchain stable --profile minimal

# 3. 让当前终端立刻能用
source "$HOME/.cargo/env"

# 4. 验证
rustc --version && cargo --version
```

---

## 方式 B：直接下二进制（脚本卡住时用）

```bash
# 1. 从 TUNA 直接拉 rustup-init 二进制
curl -sSf -o /tmp/rustup-init \
  "https://mirrors.tuna.tsinghua.edu.cn/rustup/rustup/dist/x86_64-apple-darwin/rustup-init"
chmod +x /tmp/rustup-init

# 2. 运行(已配好 RUSTUP_DIST_SERVER，会从镜像拉工具链)
/tmp/rustup-init -y --default-toolchain stable --profile minimal

# 3. 生效 + 验证
source "$HOME/.cargo/env"
rustc --version && cargo --version
```

---

## 方式 C：Homebrew（若 brew CDN 能连）

```bash
brew install rustup-init
rustup-init -y --default-toolchain stable --profile minimal
source "$HOME/.cargo/env"
rustc --version && cargo --version
```

---

## 1. 配置 cargo 镜像（必做！否则 `cargo tauri dev` 又会卡）

Rust 装好后，`cargo` 默认从 `static.crates.io` 拉 crate——国内同样慢/堵。新建 `~/.cargo/config.toml`：

```bash
mkdir -p ~/.cargo
cat > ~/.cargo/config.toml <<'EOF'
[source.crates-io]
replace-with = 'tuna'

[source.tuna]
registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"

[net]
git-fetch-with-cli = true
EOF
```

> `sparse+` 是新版稀疏协议，比 git index 快很多（需 cargo ≥ 1.68，stable 已支持）。

---

## 2. 补桌面 JS 依赖（已做过可跳）

```bash
# 在仓库根目录
yarn install
```
（`desktop/package.json` 已含 `@tauri-apps/cli / api / plugin-fs / plugin-dialog`。）

---

## 3. 生成应用图标（仅一次）

Tauri 打包需要图标。准备一张 1024×1024 的 PNG，然后：

```bash
cd /Users/wangli/Work/python_github/excalidraw
yarn workspace desktop tauri icon /path/to/your-1024.png
```
这会自动生成 `desktop/src-tauri/icons/` 下全尺寸图标。
> 没图也行：临时随便放一张 png 进去先生成，后面替换。

---

## 4. 启动桌面窗口 🎉

```bash
yarn workspace desktop tauri dev      # 开发模式，热重载（首次会编译 Rust，约 3-8 分钟）
yarn workspace desktop tauri build    # 生产打包
```

首次 `tauri dev` 会下载并编译 Tauri 的 Rust crates（走镜像），耐心等编译。

---

## 备用镜像（TUNA 不通就换）

把环境变量/`config.toml` 里的域名替换：

| 镜像源 | rustup dist | crates index |
|--------|-------------|--------------|
| **TUNA（清华）** | `mirrors.tuna.tsinghua.edu.cn/rustup` | `sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/` |
| **中科大** | `mirrors.ustc.edu.cn/rustup` | `sparse+https://mirrors.ustc.edu.cn/crates.io-index/` |
| **字节 rsproxy** | `rsproxy.cn` | `sparse+https://rsproxy.cn/index/` |

字节 rsproxy 配置示例（`~/.cargo/config.toml`）：
```toml
[source.crates-io]
replace-with = 'rsproxy-sparse'
[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"
[registries.rsproxy]
index = "https://rsproxy.cn/crates.io-index"
[net]
git-fetch-with-cli = true
```
rustup 用 rsproxy：
```bash
export RUSTUP_DIST_SERVER="https://rsproxy.cn"
export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup"
```

---

## 排错

- **`command not found: cargo`**：`source "$HOME/.cargo/env"`，或确认 `~/.zshrc` 里有 `. "$HOME/.cargo/env"`。
- **`tauri` 命令找不到**：在仓库根 `yarn install`（JS 依赖没装）。
- **`error: linker cc not found`**：装 Xcode CLT：`xcode-select --install`（你这台已装，可忽略）。
- **编译卡在某个 crate 下载**：确认 `~/.cargo/config.toml` 镜像已配（第 1 步）。
- **完全连不上任何镜像**：开代理后重试；或在网络好的机器/时段装。

---

## 卸载（如需）

```bash
rustup self uninstall       # 干净移除 Rust 工具链 + ~/.cargo + ~/.rustup
```
JS 依赖移除：把 `desktop/package.json` 里 `@tauri-apps/*` 删掉再 `yarn install`。
