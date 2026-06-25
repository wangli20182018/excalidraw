# 启动指南

## 环境要求

- **Node.js** `>=18`（CI 使用 Node 20）
- **Yarn** 1.x（仓库通过 `packageManager` 锁定为 `yarn@1.22.22`）

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
