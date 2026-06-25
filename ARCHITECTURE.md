# Excalidraw 系统架构文档

> 本文档基于代码库实际结构与配置整理，描述 Excalidraw 的整体架构、目录组织、各包职责与核心运行机制。

## 1. 概述

Excalidraw 是一个**开源的、手绘风格的无限白板**应用，支持端到端加密的实时协作。项目以 **Yarn workspaces 单仓多包**形式组织，核心交付两类产物：

- `@excalidraw/excalidraw` —— 一个可嵌入任意 React 应用的**画布编辑器组件库**（npm 包）。
- excalidraw.com —— 基于 Vite 的**完整 Web 应用**（含协作、分享、Firebase、Sentry 等），它消费上述组件库的源码。

## 2. 技术栈

| 领域 | 技术 |
|------|------|
| 语言 | TypeScript（严格模式，全仓） |
| UI 框架 | React 19（编辑器组件同时兼容 React 17/18/19） |
| 状态管理 | Jotai + jotai-scope（经 `editor-jotai` / `app-jotai` 封装隔离） |
| 渲染 | Canvas 2D（roughjs 生成手绘风格）+ SVG 图层（交互层） |
| 构建 | Vite（app） / esbuild（包产物 dev + prod） / tsc（仅类型声明） |
| 测试 | Vitest + jsdom + Testing Library |
| 代码风格 | Prettier + ESLint（`--max-warnings=0`） |
| 协作 | Socket.IO 客户端 + 自研 CRDT-like 同步 |
| 包管理 | Yarn 1（`yarn@1.22.22`） |
| 运行环境 | Node `>=18`，CI 使用 Node 20 |

## 3. 整体架构（分层视图）

```
┌──────────────────────────────────────────────────────────────┐
│  excalidraw-app/  （excalidraw.com 网页应用，Vite 构建）        │
│  入口 index.tsx → App.tsx，负责协作 / 分享 / Firebase / Sentry  │
└───────────────────────────┬──────────────────────────────────┘
                            │ 消费源码（非构建产物）
        ┌───────────────────┴──────────────────┐
        ▼                                      ▼
┌──────────────────────┐              ┌─────────────────────┐
│ @excalidraw/excalidraw│              │   其他内部包         │
│ （编辑器组件库）       │              │ （被 excalidraw 依赖）│
│ index.tsx → <Excalidraw>             └─────────────────────┘
│ 核心类: components/App.tsx                    ▲
│ UI: components/  动作: actions/  渲染: scene/  │
│ 数据: data/  字体: fonts/                    │
└──────────────┬───────────────────────────────┘
               │ 依赖
   ┌───────────┼───────────┬───────────┬───────────┐
   ▼           ▼           ▼           ▼           ▼
 @excalidraw  @excalidraw @excalidraw @excalidraw @excalidraw
 /element      /math       /common     /fractional /laser-pointer
                                      -indexing
   元素逻辑     几何/数学   通用工具    顺序索引      激光笔轨迹
               （Point 等）（常量/键码  （FractionalIndex）
                            /事件总线
                            等）
```

**关键点：** 内部 `@excalidraw/*` 包在开发与测试中通过 **TS path 别名 / vitest 别名直接解析到源码**（`src/index.ts`），无需先构建。只有发布到 npm 时才产出 `dist/dev` + `dist/prod`。

## 4. 顶层目录结构

```
excalidraw/
├── packages/                 # 核心库（workspaces）
│   ├── common/               # @excalidraw/common 通用工具、常量、事件总线
│   ├── math/                 # @excalidraw/math  纯数学/几何（Point 类型来源）
│   ├── element/              # @excalidraw/element 元素模型、碰撞、绑定、渲染
│   ├── fractional-indexing/  # @excalidraw/fractional-indexing 分数索引排序
│   ├── laser-pointer/        # @excalidraw/laser-pointer 激光笔效果
│   ├── excalidraw/           # @excalidraw/excalidraw 编辑器 React 组件库（主包）
│   └── utils/                # @excalidraw/utils 辅助工具（独立发布流程）
├── excalidraw-app/           # excalidraw.com 网页应用（Vite）
├── examples/                 # 集成示例：with-nextjs / with-script-in-browser
├── dev-docs/                 # Docusaurus 文档站点源码
├── firebase-project/         # Firebase 配置（协作后端相关）
├── public/                   # 静态资源
├── scripts/                  # 构建/发布/字体等脚本（release.js / buildWasm.js …）
├── setupTests.ts             # Vitest 全局测试环境（mock 字体/IndexedDB/RAF 等）
├── vitest.config.mts         # 测试配置 + 包别名
├── tsconfig.json             # 根 TS 配置（path 别名，覆盖 packages + app）
├── .eslintrc.json            # ESLint 规则（jotai 限制、barrel 限制、import 顺序）
└── package.json              # workspaces 定义与统一脚本
```

## 5. 各包职责详解

### 5.1 `packages/common` —— `@excalidraw/common`
被所有其他包共享的基础设施，零业务依赖。
- `constants.ts` / `keys.ts`：全局常量与键码、`MIME_TYPES`、`FONT_FAMILY` 等。
- `colors.ts` / `bounds.ts` / `points.ts`：颜色与几何工具。
- `utils.ts`：`arrayToMap`、`cloneJSON`、`isShallowEqual` 等高频工具。
- `appEventBus.ts` / `emitter.ts`：事件总线。
- `editorInterface.ts`：对外编辑器接口契约。
- `versionedSnapshotStore.ts`：带版本快照的状态存储（协作对账用）。

### 5.2 `packages/math` —— `@excalidraw/math`
纯数学库。**所有坐标统一用 `Point` 类型（`src/types.ts`），禁止裸 `{ x, y }`。**

### 5.3 `packages/element` —— `@excalidraw/element`
元素领域逻辑（不依赖 React / Canvas），是架构最重的一环：
- `types.ts`：所有元素类型定义（`ExcalidrawElement` 家族 + 品牌类型）。
- `newElement.ts` / `mutateElement.ts`：元素创建与不可变更新。
- `typeChecks.ts`：类型守卫（`isTextElement`、`isFrameLikeElement`…）。
- `collision.ts` / `bounds.ts` / `distance.ts`：命中检测与包围盒。
- `binding.ts` / `arrows/` / `elbowArrow.ts`：箭头与可绑定元素关系。
- `linearElementEditor.ts`：折线/箭头顶点编辑。
- `frame.ts` / `groups.ts` / `fractionalIndex.ts` / `zindex.ts`：容器、分组、层级排序。
- `image.ts` / `textElement.ts` / `embeddable.ts`：特定元素能力。
- `Scene.ts`：**场景状态中心**，维护 `elements` 数组（含已删除软删除）、回调订阅、索引同步。
- `renderElement.ts` / `shape.ts`：把元素转成 roughjs 可绘制形状。
- `store.ts`：元素快照存储，支持增量的 `DurableIncrement` / `EphemeralIncrement`（协作同步基础）。
- `visualdebug.ts`：可视化调试导出（独立子入口 `./visualdebug`）。

### 5.4 `packages/excalidraw` —— `@excalidraw/excalidraw`（主包）
画布编辑器本体，对外暴露 `index.tsx`（React 入口）。

#### 入口与对外 API
- `index.tsx`：导出 `<Excalidraw>` 组件、`ExcalidrawAPIProvider`、命令式 API（`ExcalidrawImperativeAPI`）等。
- `index-node.ts`：Node 环境专用入口（SSR / 导出服务端用）。
- `editor-jotai.ts`：**Jotai 隔离层**（用 `jotai-scope` 创建独立 store，禁止直接 import `jotai`）。
- `types.ts`：对外类型契约（`AppState`、`ExcalidrawProps`、`Collaborator` 等）。

#### 核心编辑器
- `components/App.tsx`：**编辑器核心类组件（~13000 行）**，承载所有交互、事件、渲染调度、动作分发。是整个项目的中枢。
- `scene/`：渲染流水线
  - `Renderer.ts`：计算「当前视口内可渲染元素」并驱动分层渲染。
  - `export.ts`：导出为 Canvas / SVG。
  - `scroll.ts` / `zoom.ts` / `scrollbars.ts`：视口与滚动条。
- `renderer/`：Canvas 落地渲染（`staticScene.ts` 静态层、交互层），底层用 roughjs。

#### 动作系统（commands）
- `actions/`：每个文件一个编辑动作（对齐、复制、删除、分组、历史、导出……）。
- `actions/manager.tsx`：动作注册与统一分发，支持快捷键、菜单、命令面板调用。
- `actions/shortcuts.ts`：快捷键映射（如 `CtrlOrCmd+S` → `saveFileToDisk`）。
- `actions/register.ts`：集中注册所有内置动作。

#### UI 层
- `components/`：大量 React UI 组件（工具栏 `Toolbar`、属性面板 `PropertiesPopover`、主菜单 `main-menu/`、命令面板 `CommandPalette/`、上下文菜单、对话框、色盘 `ColorPicker/`、库面板 `LibraryMenu*`、欢迎屏 `welcome-screen/` 等）。

#### 数据与持久化
- `data/`：
  - `json.ts`：`serializeAsJSON` / `saveAsJSON` —— 序列化为 `.excalidraw` 文件（**含图片，base64 内嵌于 `files` 字段**）。
  - `blob.ts` / `image.ts`：Blob 与 PNG 元数据嵌入（可把场景嵌入 `.excalidraw.png`）。
  - `filesystem.ts`：基于 `browser-fs-access` 的文件打开/保存（File System Access API 优先，回退到下载）。
  - `library.ts`：素材库（支持本地与第三方库安装，含持久化适配器接口）。
  - `resave.ts`：文件句柄覆盖保存流程。
- `history.ts`：撤销/重做栈。
- `appState.ts`：`AppState` 序列化净化（`cleanAppStateForExport` / `clearAppStateForDatabase`）。

#### 其他子系统
- `fonts/`：字体加载、子集化（WASM：harfbuzz + woff2，由 `scripts/buildWasm.js` 生成 `wasm/*-wasm.ts`，勿手改）。
- `subset/`、`charts/`、`mermaid.ts`：字体子集、图表粘贴、Mermaid 导入。
- `eraser/`、`lasso/`、`laserTrails.ts`：橡皮擦、套索、激光笔轨迹。
- `snapping.ts`、`gesture.ts`、`cursor.ts`、`shortcut.ts`：吸附、手势、光标、快捷键辅助。
- `clipboard.ts`：系统剪贴板（含 Excalidraw 私有 MIME 互操作）。
- `context/`、`hooks/`：React Context 与自定义 Hook。
- `locales/`：i18n 资源（`i18n.ts` 为入口）。
- `wysiwyg/`：所见即所得文本编辑。
- `workers.ts`：Web Worker 注册。
- `renderer/renderElement.tsx` / `renderer/staticScene.ts`：最终绘制实现。

### 5.5 `packages/fractional-indexing` / `laser-pointer`
- 前者实现 **FractionalIndex**（无冲突的元素排序键，用于协作时的稳定顺序）。
- 后者实现激光笔轨迹的绘制与衰减。

### 5.6 `excalidraw-app/` —— excalidraw.com 网页应用
直接以源码方式引用 `@excalidraw/excalidraw`，外加网页专属能力：
- `index.tsx`：React 根（`createRoot` + PWA `registerSW` + Sentry 初始化）。
- `App.tsx`：组装 `<Excalidraw>` 并挂载协作/分享。
- `collab/`：实时协作
  - `Collab.tsx`：协作组件（用户列表、光标同步、房间管理）。
  - `Portal.ts`：Socket.IO 通信层。
- `share/`：分享链接 / 导出分享。
- `app-language/`：应用语言状态（`app-jotai.ts` 为应用级 Jotai 隔离）。
- `data/`：应用级本地存储（IndexedDB，`idb-keyval`）。
- `sentry.ts`：错误上报。
- `vite.config.mts`：Vite 构建配置（PWA、Sitemap、HTML、env 注入）。

## 6. 核心运行机制

### 6.1 渲染流水线
1. 用户输入 → `App.tsx` 更新 `AppState` / `elements`（经 `Scene`）。
2. `scene/Renderer.ts` 计算视口内可见、需要绘制的元素集合（含 frame/分组/选中态过滤）。
3. `renderer/staticScene.ts` 用 Canvas + roughjs 绘制静态层；交互层走 SVG（`components/SVGLayer.tsx`）以便 DOM 事件。
4. 通过 `throttleRAF`（测试中被 mock）节流到动画帧。

### 6.2 状态管理
- **React State**：`App.tsx` 持有 `AppState`（视口、选中、工具等）。
- **Scene（element 包）**：持有 `elements` 数组（含软删除），订阅式通知。
- **Jotai**：通过 `editor-jotai`（编辑器内）/ `app-jotai`（app 内）两个隔离实例管理细粒度响应式状态（库、光标等）。
- **store.ts（element）**：维护元素快照与增量，是协作与持久化的对账基础。

### 6.3 动作分发
任意编辑操作（菜单点击、快捷键、命令面板）→ `ActionManager.renderAction(name)` → 命中对应 `actions/*.ts` → 返回 `ActionResult`（新的 `elements` / `appState` / `commitToHistory` 等）→ `App` 应用并触发重渲染。

### 6.4 持久化与导出
- **自动保存（浏览器内）**：经 `data/` 层写入 IndexedDB，刷新可恢复（含图片）。
- **手动保存到磁盘**：`saveAsJSON` → `.excalidraw` 文件（JSON，`files` 字段内嵌图片 base64）。
- **导出图片**：`exportCanvas`（PNG / SVG / 剪贴板），可选把场景嵌入 `.excalidraw.png` / `.excalidraw.svg`。
- **文件读写底座**：`browser-fs-access` —— Chrome/Edge 走 File System Access API（真实文件、可覆盖保存），其他浏览器回退到下载。

### 6.5 实时协作（excalidraw-app）
- `Portal.ts` 经 Socket.IO 连接协作服务，广播 `PointerUpdate` 与元素增量。
- 元素增量基于 `store.ts` 的 `DurableIncrement`/`EphemeralIncrement` 进行对账与顺序合并（配合 fractional-indexing 保证稳定层级）。

## 7. 构建与发布

### 7.1 开发 / 测试（无需构建包）
内部包通过别名直连源码：
```bash
yarn start          # 启动 excalidraw-app（Vite 开发服务器）
yarn test:app       # Vitest（默认 watch 模式）
```

### 7.2 构建 npm 包产物
依赖链顺序（重要）：
```
common → fractional-indexing → laser-pointer → math → element → excalidraw
```
```bash
yarn build:packages
```
每个包产出 `dist/dev`、`dist/prod`（esbuild）与类型声明（`tsc --emitDeclarationOnly`）。

### 7.3 构建 App
```bash
yarn build          # excalidraw-app 生产构建 + 版本号
```

### 7.4 发布
- `scripts/release.js` 驱动，仅作用于 `common / fractional-indexing / math / element / excalidraw`（`utils` 走独立流程）。
- `yarn release --tag=test|next|latest`；推送到 `release` 分支自动发 `next`；`latest` 必须指定 `--version`。

## 8. 代码规范要点（CI 强制）

- **禁止直接 import `jotai`**，必须经 `editor-jotai`（编辑器内）或 `app-jotai`（app 内）。
- **`packages/excalidraw/` 内禁止从 barrel（`@excalidraw/excalidraw`）导入**，改用相对路径；仅类型导入豁免。
- **类型导入必须单独**：`import type { Foo }`（`separate-type-imports`）。
- **import 顺序**：`newlines-between: always-and-inside-groups`，`@excalidraw/**` 归为 external 组。
- **数学代码**统一用 `@excalidraw/math` 的 `Point`，禁用裸 `{ x, y }`。
- ESLint `--max-warnings=0`（warning 视同 error）。

## 9. 扩展阅读

- 启动 / 命令速查：见仓库根 `STARTUP.md`、`AGENTS.md`。
- 贡献指南：`CONTRIBUTING.md`（指向 `docs.excalidraw.com`）。
- 字体 WASM 生成：`scripts/buildWasm.js`。
- 完整开发文档：`dev-docs/`（Docusaurus 站点源码）。
