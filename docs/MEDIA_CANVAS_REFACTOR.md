# AI 多媒体知识画布 · 系统改造方案（Tauri × Excalidraw）

> 本文档定义产品的**远景、技术栈**，并按**三个阶段**给出具体实施方案。
> 设计基线已锁定（见 §0）。架构评价：这是一个可落地、可扩展、长期可维护的 **Workspace OS 架构**。

---

## §0 锁定决策

| # | 决策点 | 选定 |
|---|--------|------|
| 1 | 架构方向 | **纯 Overlay 解耦**：卡片独立于 Excalidraw，Excalidraw 只作空间引擎 |
| 2 | AI 定位 | **媒体优先，AI 后置**（阶段三） |
| 3 | 运行形态 | **Tauri 桌面**（Rust 后端） |
| 4 | 卡片交互 | **复用占位元素交互**（Excalidraw 处理选择/拖拽/缩放，Overlay 跟随） |
| 5 | 导出 | **第一期不做整图导出** |
| 6 | WebCard | **统一 OG 预览卡**（Rust 抓 OG，不做 iframe 实时嵌入） |

---

# 第一部分 · 产品远景与技术栈

## 1. 产品定位：AI-native Spatial Operating System

不是"在线白板二开"，而是 **AI 原生的空间化知识工作台**。

- **Excalidraw 只做空间引擎**（坐标/缩放/平移/选择/连线）——避开"深改白板内核"这个最大坑，保证未来可升级。
- **Card 系统才是产品核心**，全部在 Overlay 层实现。
- **护城河不是 AI 聊天，而是空间上下文**：AI 理解"这个视频关联哪个 PDF、属于哪个研究区、和哪个网页关联"。

## 2. 演进路径：Card → Node → Knowledge Graph

```
阶段一:  Card (媒体卡)              —— 多媒体画布能用
阶段二:  Card + Runtime             —— 规模化、可承载 100+ 媒体
阶段三:  Node + Relation + SemanticEdge —— Knowledge Graph / AI Workspace
```

## 3. 技术栈

| 层 | 技术 | 用途 |
|----|------|------|
| Shell | **Tauri 2** | 跨端桌面壳，Rust 后端，小体积 |
| 前端框架 | **React 19 + TypeScript** | UI |
| 空间引擎 | **Excalidraw（源码包）** | 坐标/缩放/选择/连线/Scene |
| 状态 | **Zustand** | Card Store / Workspace Runtime |
| 卡片媒体 | **wavesurfer.js / pdf.js / hls.js** | 音频波形 / PDF / 流媒体 |
| 本地资源 | **Tauri `plugin-fs` / `convertFileSrc`** | 本地文件直读直播 |
| Rust 后端 | **reqwest / scraper / tokio** | OG 代理、文件、(后置) AI |
| 持久化 | 本地文件 + `.workspace.json` | 独立于 `.excalidraw` |

> Excalidraw 内核**零改动**：仅用 `rectangle` + `customData.cardId`。

## 4. 核心架构原则（铁律）

1. **Scene ≠ Workspace**：Excalidraw 元素只存几何；卡片/资源/AI 元数据独立成 `WorkspaceDocument`。绝不把业务塞进 Excalidraw JSON。
2. **Workspace Version Layer**：`WorkspaceDocument` 带 `workspaceVersion`，**不依赖 Excalidraw schema 版本**——未来 schema 迁移/卡片演进/AI 元数据演进才不痛苦。
3. **大文件绝不内联**：Card 只存 `localPath/url`；字节永远在 Excalidraw JSON 之外。
4. **禁止 Card 旋转（阶段一铁律）**：见 §阶段一风险。只允许 move/resize。
5. **事件分层**：用 `InteractionMode` 状态机，而非裸 `pointer-events`。
6. **媒体虚拟化**：视口外卸载、保缩略、近视口懒加载。

---

# 第二部分 · 阶段一：多媒体画布 MVP（聚焦）

> **目标**：跑通"本地/网络 媒体卡 在空间画布上展示与播放"。
> **聚焦铁律**：只做 **图片 / 视频 / 音频 / URL-OG 卡** 四种。PDF/File 后置到阶段二。

## 阶段一 · 数据模型

```ts
type WorkspaceDocument = {
  workspaceVersion: 1;            // ★ 独立于 Excalidraw version
  scene: SceneSnapshot;           // Excalidraw 元素(占位 rectangle + 普通图形/连线)
  cards: Card[];
  resources: ResourceRef[];       // 引用 FileEntity id，字节不进文档
};

type Card = {
  id: string;                     // = 占位 element.customData.cardId
  sceneElementId: string;
  type: "video" | "audio" | "image" | "web";   // 阶段一仅 4 种
  source: ResourceSource;
  title?: string;
  metadata?: Record<string, any>;
  createdAt: number; updatedAt: number;
};

type ResourceSource =
  | { sourceType: "local";  fileId: string; localPath?: string; mimeType: string }
  | { sourceType: "remote"; url: string; mimeType?: string };
```

## 阶段一 · 架构分层

```
<Excalidraw>                透明 rectangle 占位 + customData.cardId
   ↑ onChange / onScrollChange / getAppState
Overlay Layer               卡片内容(按 type 渲染)
   ↑ Interaction Layer Manager (InteractionMode 状态机)
Card Store (Zustand)        cards[] / resources[]
Resource Manager            convertFileSrc / 缩略
Workspace Doc               .workspace.json (独立保存)
```

## 阶段一 · 实施步骤

### P0 — Tauri 脚手架 + Excalidraw 嵌入
- `create-tauri-app`（React+Vite）；`@tauri-apps/plugin-fs` `plugin-dialog` `@tauri-apps/api/core`(convertFileSrc)。
- vite.config 加 `@excalidraw/*` 源码别名（同 `excalidraw-app/vite.config.mts`）。
- `<Excalidraw>` 渲染进窗口；**剥离** `registerSW()`（`excalidraw-app/index.tsx:12`）与 PWA；裁剪云端 env。
- **验收**：桌面窗口能画图/缩放/平移。

### P1 — 数据层 + 占位元素
- 占位：插 `rectangle`（透明、无边框），`customData={cardId}`。**零内核改动**。
- Card Store(Zustand) + `WorkspaceDocument{workspaceVersion:1}`。
- 联动规则：占位元素删/复制 → `onChange` 监听 → 同步 Card Store。
- **白嫖能力**：选择/拖拽/缩放/分组/frame/箭头绑定/撤销栈 全原生作用于占位元素。

### P2 — Overlay 坐标同步（成败关键）
- Overlay `<div>` 绝对覆盖，`pointer-events: none`（卡片内部按 InteractionMode 开启）。
- 订阅 `onChange` + `onScrollChange(scrollX,scrollY,zoom)`（`types.ts:676`），读 `getAppState()`。
- 投影公式（复刻 `scene/zoom.ts:15`、`App.tsx:1762`）：
  ```
  vx = (sceneX − scrollX) * zoom + offsetLeft
  vy = (sceneY − scrollY) * zoom + offsetTop
  style: translate(vx,vy) scale(zoom); w/h = elem.w/elem.h
  ```
- **RAF 节流** + `IntersectionObserver` 视口外卸载。
- 选中联动：读 `appState.selectedElementIds` 加高亮。
- **验收**：拖/缩/平移/分组移动，卡片严丝合缝跟随。

### P3 — 媒体卡（Video/Audio/Image）+ ResourceManager
- **`convertFileSrc(path)`**：本地路径 → webview URL → `<video>/<audio>/<img>` 直接播，**零 base64、零 CORS**。
- VideoCard `<video controls>`；AudioCard `wavesurfer.js`；ImageCard `<img>`。
- ResourceManager：`getPlayableUrl()`=convertFileSrc；`getThumbnail()`（视频抽帧）；`getMetadata()`。
- **验收**：本地 mp4/mp3/jpg 拖入出卡播放。

### P4 — WebCard（统一 OG 预览）
- 贴 URL → Rust `reqwest` 抓页面 → `scraper` 解析 `og:image/title/description/域名` → 前端渲染预览卡。
- **不做 iframe 实时嵌入**；点击 → 系统浏览器打开。
- **验收**：粘 URL → OG 卡。

## 阶段一 · 关键风险与铁律

> 这些比"功能"更重要，是后期不返工的护城河。

### R1. 事件系统（最大风险，非 Overlay 本身）
画布拖拽 / 卡片内滚动 / video controls / 双击编辑 / text selection 会互相抢事件。
**裸 `pointer-events:none` 只是第一版够用。** 必须引入 **Interaction Layer Manager**：

```ts
enum InteractionMode {
  Canvas,     // 画布接管(平移/框选/连线)
  Card,       // 卡片悬浮交互
  Editing,    // 文本/表单编辑
  Dragging,   // 拖拽卡片
  Resizing,   // 缩放卡片
}
```
单一全局 mode，由 mode 决定 Overlay `pointer-events` 与事件透传。**阶段一必须建这个壳**，否则后期复杂卡片交互错乱。

### R2. 禁止 Card 旋转
`scale/translate` 同步 OK；但 **rotate 会爆炸**——DOM `transform-origin` 与 Excalidraw `element.angle` 同步极易错，PDF/video/iframe 进入 transform 噩梦。
**阶段一铁律：只允许 move + resize，禁用 rotate。** （占位元素可锁定旋转角为 0）

### R3. 协作/导出（已接受）
第一期单机；无整图导出（画布导出只含透明占位框）。

---

# 第三部分 · 阶段二：Workspace Runtime（规模化）

> **目标**：从"几张卡能跑"进化到"100+ 媒体稳定、资源可控、可持久可撤销"。
> **核心**：Card Store 升级为 **Workspace Engine**。

## 阶段二 · 新增子系统

### 1. Media Virtualization（性能瓶颈，比画布更重要）
100 个 `<video>` 浏览器会炸。必须：
- **视口外**：卸载 `<video>`，只保留 **thumbnail**（静态图占位）。
- **接近视口**（IntersectionObserver margin）：**lazy hydrate** 回真实组件。
- 缩放阈值：zoom 过小时降级为缩略图，不挂载媒体元素。

### 2. Resource Lifecycle 状态机
所有资源（视频/PDF/图片/波形）走统一状态机，避免后续错乱：
```ts
enum ResourceStatus { Idle, Loading, Ready, Error, Unloaded }
```
ResourceManager 按 status 驱动加载/卸载/重试/缓存。

### 3. Workspace Runtime（Card Store 不够，演化为 Engine）
当系统接近"浏览器里的操作系统"，必须管理：
- 文件引用 / 文件缓存（LRU）
- session / memory pressure（内存压力下主动 Unload）
- preload（预加载邻近卡片资源）
- persistence（自动保存、崩溃恢复）
- undo system（跨"占位元素+卡片+资源"的统一撤销栈）

### 4. 卡片扩展
- PdfCard（`pdf.js` + convertFileSrc）。
- FileCard（通用文件图标卡，点击系统打开）。

## 阶段二 · 实施要点
- 把阶段一的 Overlay 渲染改造为 **virtualized renderer**（卡槽 + 内容按需挂载）。
- ResourceManager 升级为带状态机 + LRU 缓存的 Runtime 模块。
- 撤销栈：Excalidraw 占位元素用其原生栈；卡片/资源变更用独立栈，做"双栈合并"呈现给用户。

---

# 第四部分 · 阶段三：AI Spatial Workspace（知识图谱）

> **目标**：Card → Node，Relation + Semantic Edge → Knowledge Graph。AI 的价值是**空间上下文**。

## 阶段三 · 数据演进

```ts
type Node = Card & {                 // Card 升级为 Node
  aiData: AIData;
};
type AIData = {
  summary?: string; transcript?: string;
  embeddingId?: string; tags?: string[]; entities?: string[];
};
type Relation = {                    // 语义边(独立于画布箭头)
  id: string; from: nodeId; to: nodeId;
  type: "relates" | "cites" | "part-of" | "derived" | ...;  // SemanticEdge
  weight?: number; aiGenerated?: boolean;
};
```

## 阶段三 · 能力
- **Rust embedding**（`fastembed-rs` / 调 API）+ 本地向量库（`sqlite-vec` / `lancedb`）。
- **空间上下文 RAG**：检索时带"画布空间邻域"（同 frame / 箭头相连 / 视口邻近）作为上下文——这是区别于普通 RAG 的护城河。
- **AI 摘要 / 转录 / 自动打标 / 自动建边**：挂 `node.aiData` + `relations[]`。
- **知识图谱视图**：Node + SemanticEdge 可在画布或独立视图渲染。
- AIChatCard / MarkdownCard 在此阶段补齐（作为 Node 的一种 type）。

---

# 第五部分 · 现状基线（Excalidraw 源码核实）

### 5.1 对外 API（`packages/excalidraw/index.tsx` / `types.ts`）
- `getAppState()` / `getSceneElementsIncludingDeleted()`（`App.tsx:757`）。
- `onChange(elements, appState, files)`；`onScrollChange(scrollX, scrollY, zoom)`（`types.ts:676`，触发于 `App.tsx:3437`）。
- `exportToBlob` / `exportToCanvas`（`index.tsx:333`）——阶段一不用。

### 5.2 坐标变换（Overlay 同步依据）
来源 `scene/zoom.ts:15`、`App.tsx:1762`：
```
viewportX = (sceneX − scrollX) * zoom + offsetLeft
viewportY = (sceneY − scrollY) * zoom + offsetTop
```

### 5.3 元素与序列化
- `_ExcalidrawElementBase`（`types.ts:40`）带 `customData` → 存 `cardId`，**零内核改动**。
- `rectangle`（`types.ts:88`）直接作占位。
- Excalidraw `serializeAsJSON`（`data/json.ts`）**不改**——占位元素是普通 rectangle。

### 5.4 需在 Tauri 侧剥离
- `registerSW()`（`excalidraw-app/index.tsx:12`）+ PWA。
- 云端 env：`VITE_APP_FIREBASE_CONFIG` / `VITE_APP_WS_SERVER_URL` / `VITE_APP_BACKEND_V2_*`。

---

# 第六部分 · 改动清单

## 新增（Tauri 应用，独立于 Excalidraw 内核）
| 模块 | 阶段 | 说明 |
|------|------|------|
| `desktop/src-tauri/` | 一 | fs / convertFileSrc / OG 代理 |
| `desktop/src/overlay/` | 一 | Overlay 层 + 坐标同步 + InteractionMode |
| `desktop/src/cards/` | 一/二/三 | Video/Audio/Image/Web(一) · Pdf/File(二) · Chat/Markdown(三) |
| `desktop/src/store/` | 一→二→三 | Card Store → Workspace Runtime → Node/Relation |
| `desktop/src/resource/` | 一→二 | ResourceManager → +状态机/LRU/虚拟化 |
| `desktop/src/ai/` | 三 | embedding / 向量库 / 空间 RAG |

## Excalidraw 内核（零改动）
| 文件 | 改动 |
|------|------|
| 无 | 仅**使用** `rectangle` + `customData.cardId`；不复用 `excalidraw-app`，仅复用 `packages/*` 源码包 |

> 内核零改动 = 未来 Excalidraw 升级几乎无痛（最大架构优势）。

---

# 第七部分 · 风险总览与铁律汇总

| 风险 | 阶段 | 对策（铁律） |
|------|------|-------------|
| 事件抢夺（pointer-events 地狱） | 一 | **InteractionMode 状态机**，非裸 pointer-events |
| rotate transform 噩梦 | 一 | **阶段一禁用 Card rotate**，仅 move/resize |
| 100+ video 卡崩 | 二 | **Media Virtualization**（视口外卸载保缩略，懒加载） |
| 资源状态错乱 | 二 | **ResourceStatus 状态机** |
| Card Store 不够 | 二 | 升级为 **Workspace Runtime**（缓存/内存/预加载/持久/撤销） |
| schema 演进痛苦 | 一即立 | **WorkspaceDocument.workspaceVersion** 独立于 Excalidraw |
| 业务塞进 Excalidraw JSON | 全程 | **Scene ≠ Workspace**，字节永不内联 |

---

# 一句话总结

**Excalidraw 只做空间引擎（透明 rectangle + customData.cardId，内核零改动）**，所有媒体/Runtime/AI 在 **Tauri 桌面 Overlay 层**实现；阶段一聚焦 4 种媒体卡（含 InteractionMode + 禁旋转），阶段二升级为 Workspace Runtime（虚拟化 + 资源状态机），阶段三演化为 Node+Relation 的 **AI Spatial Knowledge Graph**——`WorkspaceDocument.workspaceVersion` 独立演进，护城河是**空间上下文**而非 AI 聊天。
