# Excalidraw 页面布局说明

> 描述编辑器界面的区域划分、层级关系、响应式与各模式表现。基于 `packages/excalidraw/components/App.tsx`（render 方法 `App.tsx:2144`）与 `components/LayerUI.tsx` 的实际结构整理。

竟品：
https://heptabase.com/pricing
https://fabric.so/pricing-and-plans-for-individuals?utm_source=chatgpt.com
https://affine.pro/?utm_source=chatgpt.com


## 1. 总体结构

整个编辑器是一个根容器 `.excalidraw.excalidraw-container`（`App.tsx:2147`），内部由两大部分叠加而成：

```
┌─────────────────────────────────────────────────────────┐
│  .excalidraw-container  （根容器，position: relative）     │
│                                                         │
│   ① 画布层（多层 Canvas + SVG + Embeddable，z-index 叠加） │
│   ② UI 覆盖层 LayerUI（工具栏/面板/菜单/对话框，绝对定位）  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- 画布层负责**绘制与交互**（底层 Canvas、上层 Canvas 接管指针事件）。
- UI 覆盖层是**绝对定位的浮层**，不占文档流，通过 `pointer-events` 控制是否拦截事件。

根容器 CSS 变量：
- `--right-sidebar-width: 302px`（停靠侧栏宽度，`App.tsx:2157`）。
- `--ui-pointerEvents`：根据 `shouldBlockPointerEvents` 在 `enabled/disabled` 间切换，用于画布交互期临时屏蔽 UI 拦截。

## 2. 画布层级（自下而上）

渲染顺序见 `App.tsx:2225–2434`，靠后的元素覆盖在上方：

| 层级 | 组件 | 作用 | 文件 |
|------|------|------|------|
| 0（最底） | `StaticCanvas` | 用 roughjs 绘制所有静态元素（含网格、背景色、图片、embeddable 占位） | `components/canvases/StaticCanvas.tsx` |
| 1 | `NewElementCanvas` | 当前正在拖拽创建的临时元素（预览） | `components/canvases/NewElementCanvas.tsx` |
| 2 | `InteractiveCanvas` | **选中框、缩放/旋转把手、滚动条**；**唯一绑定全部 pointer 事件的层** | `components/canvases/InteractiveCanvas.tsx` |
| 3 | `SVGLayer` | 激光笔 / 套索 / 橡皮擦的轨迹（SVG，便于动画与透明） | `components/SVGLayer.tsx` |
| 4 | 各种浮层 | `Hyperlink` 链接气泡、`ContextMenu`、`ElementCanvasButtons`（magic frame / iframe 操作）、`FollowMode`、`UnlockPopup`、`ConvertElementTypePopup`、frame 名字 | `App.tsx:2232–2432` |
| 5（最顶） | `renderEmbeddables()` | 可嵌入元素（Web-Embed / iframe）的实际 iframe DOM，**强制置于最上层**以便交互 | `App.tsx:1554`、`2434` |

> 设计要点：交互把手与元素选中都在 `InteractiveCanvas` 上重绘，而真正的指针事件统一由它接管，避免多层 Canvas 各自监听造成的冲突。静态层只在元素变化时重绘，交互层每帧/每次手势更新。

## 3. UI 覆盖层（LayerUI）桌面布局

由 `LayerUI.tsx` 渲染，桌面端（`formFactor !== "phone"`）包在 `.layer-ui__wrapper` 内（`LayerUI.tsx:611`）。核心是一个 `FixedSideContainer side="top"` + 三列的 `App-menu App-menu_top`（`LayerUI.tsx:298`）。

```
┌───────────────────────────────────────────────────────────────┐
│ 顶部左                  顶部中                      顶部右        │
│ ┌─────┐   ┌─────────────────────┐        ┌──────────────┐     │
│ │主菜单│   │      工具栏 Island    │        │ 协作者头像列表 │     │
│ │ (☰) │   │ ✏️🔒│ 1 2 3 4 5 6 7 8 9│        └──────────────┘     │
│ ├─────┤   └─────────────────────┘        ┌──────────────┐     │
│ │属性  │            （HintViewer 提示在工具栏顶部）          │ │
│ │面板  │                                    │  侧栏开关 ▤  │     │
│ │(样式)│                                    └──────────────┘     │
│ │描边  │                                    ┌──────────────┐     │
│ │填色  │                                    │   统计面板   │     │
│ │…    │                                    │  (可选 Alt+/)│     │
│ └─────┤                                    └──────────────┘     │
│ │笔模式│ (compact 模式下出现在此列外)                              │
│ └─────┘                                                         │
│                                                               │
│                  ┌───────────────────────┐                     │
│                  │     底部 Footer        │  ← 缩放控件、撤销/重做等 │
│                  └───────────────────────┘                     │
│                                          ┌─────────────────┐   │
│                                          │   右侧 Sidebar   │   │
│                                          │  (素材库/可停靠)  │   │
│                                          └─────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### 3.1 顶部左列 `App-menu_top__left`（`LayerUI.tsx:300`）
- **主菜单 `MainMenu`**（汉堡按钮）→ 通过 `MainMenuTunnel` 注入；默认项见 `DefaultMainMenu`（`LayerUI.tsx:104`）：打开/保存、导出、存为图片、搜索菜单、帮助、清空画布、主题切换、画布背景色。
- **属性面板 `SelectedShapeActions`**（`LayerUI.tsx:237`）→ 包在 `Island` 内；仅在选中元素时显示（`showSelectedShapeActions`）。提供描边/填色/线宽/圆角/字体等。两种形态：
  - 标准 `SelectedShapeActions`（`Island padding=2`）。
  - 紧凑 `CompactShapeActions`（`stylesPanelMode === "compact"`，窄屏触发）。
- **笔模式按钮 `PenModeButton`**（compact 模式下移到本列底部独立浮动）。

### 3.2 顶部中列 工具栏 `App-toolbar`（`LayerUI.tsx:346`）
- 外层 `Island`（圆角浮岛），顶部是 `HintViewer`（当前操作提示）。
- 内含：`PenModeButton`（非 compact 时）、`LockButton`（工具锁定）、分隔线 `App-toolbar__divider`、`ShapesSwitcher`（实际渲染 `SHAPES` 列表中的工具按钮，见 `components/shapes.tsx`）。
- 协作中：右侧追加一个 `LaserPointerButton` 小岛。
- 工具项来源：`SHAPES`（`shapes.tsx:20`）中 `toolbar: true` 的项；桌面工具项与快捷键由此驱动（`getToolbarTools` / `findShapeByKey`）。

### 3.3 顶部右列 `layer-ui__wrapper__top-right`（`LayerUI.tsx:415`）
- **`UserList`** 协作者头像（`appState.collaborators.size > 0` 时）。
- **`renderTopRightUI`**（宿主自定义插槽，app 在此放协作触发按钮等）。
- **侧栏触发器** `DefaultSidebarTriggerTunnel`（侧栏未停靠时显示）。
- **`Stats`** 统计面板（`Alt+/` 开启）。

### 3.4 底部 Footer（`LayerUI.tsx:623`）
- `components/footer/Footer*`，含缩放控件、撤销/重做、Zen 模式退出提示等。

### 3.5 右侧 Sidebar（`LayerUI.tsx:655` → `renderSidebars`）
- `DefaultSidebar`（素材库 Library），可**停靠/取消停靠**（`isSidebarDockedAtom`）。
- 停靠时主区域宽度变为 `calc(100% - var(--right-sidebar-width))`（`LayerUI.tsx:613`）。

### 3.6 浮动状态栈（`LayerUI.tsx:630`）
- `Toast` 提示、`scroll-back-to-content`（滚出内容时的"回到内容"按钮）。

## 4. 对话框与浮层（条件渲染）

`LayerUI.tsx:475` 起的 `layerUIJSX` 按条件挂载：

| 触发条件 | 组件 |
|----------|------|
| `appState.isLoading` | `LoadingMessage` |
| `appState.errorMessage` | `ErrorDialog` |
| `activeEyeDropperAtom`（桌面） | `EyeDropper` 取色器 |
| `openDialog.name === "help"` | `HelpDialog` |
| 始终 | `ActiveConfirmDialog` |
| `openDialog.name === "elementLinkSelector"` | `ElementLinkDialog` |
| `openDialog.name === "imageExport"` | `ImageExportDialog` |
| 导出动作 | `JSONExportDialog` |
| `openDialog.name === "charts"` | `PasteChartDialog` |
| 始终（可被 tunnel） | `OverwriteConfirmDialog`（覆盖保存确认） |
| `openDialog.name === "ttd"` | `TTDDialog`（文生图/Mermaid） |

> 这些组件多采用 `Island`/`Modal`/`Dialog` 样式，绝对居中或贴边，`pointer-events: auto`，不影响画布。

## 5. Tunnel（插槽）机制

宿主应用（excalidraw-app）通过 React Context「隧道」把自定义 UI 注入到编辑器预设位置（`LayerUI.tsx:165` `useInitializeTunnels`）：

- `MainMenuTunnel` — 替换/扩展主菜单（`App.tsx:480` 先渲染 children 以探测宿主组件）。
- `WelcomeScreenCenterTunnel` / `WelcomeScreenToolbarHintTunnel` / `WelcomeScreenMenuHintTunnel` — 欢迎屏各位置。
- `DefaultSidebarTriggerTunnel` — 侧栏开关。
- `OverwriteConfirmDialogTunnel`。

规则：宿主若渲染了同名组件则用宿主的，否则回退到 `Default*`（`__fallback`）。

## 6. 响应式：桌面 vs 移动

由 `editorInterface.formFactor` 判定（`LayerUI.tsx:591`）：

- **`"phone"`**：渲染 `MobileMenu`（`components/MobileMenu.tsx`），底部抽屉式工具栏，工具项含 embeddable/laser/frame 等（见 `MobileToolBar.tsx`）。不渲染桌面三列布局与右侧停靠侧栏。
- **桌面**：渲染上述 `.layer-ui__wrapper` 完整布局。
- **样式面板自适应**：`useStylesPanelMode()` 返回 `"compact"` 时，属性面板切换为 `CompactShapeActions`，间距变量 `spacing` 整体收紧（`LayerUI.tsx:167`）。

## 7. 特殊显示模式

| 模式 | 触发 | 视觉影响 |
|------|------|----------|
| **Zen 模式** | `appState.zenModeEnabled`（`Alt+Z`） | 顶部左/右列加 `transition-left/right` 类滑出隐藏；工具栏加 `zen-mode` 类；底部出现"退出 Zen"按钮 |
| **View 模式** | `appState.viewModeEnabled`（`Alt+R`） | 根容器加 `excalidraw--view-mode`（禁用编辑交互）；隐藏工具栏/属性面板（多处 `!appState.viewModeEnabled` 判断） |
| **网格模式** | `appState.gridMode`（`Ctrl+'`） | `StaticCanvas` 的 `renderGrid` 生效，绘制背景网格 |
| **元素链接选择器** | `openDialog.name === "elementLinkSelector"` | 类同 view 模式，隐藏工具栏/侧栏触发器，用于选择链接目标 |

## 8. 关键样式与文件索引

| 用途 | 文件 |
|------|------|
| UI 覆盖层布局/样式 | `components/LayerUI.tsx` + `LayerUI.scss` |
| 工具栏 | `components/Toolbar.scss`、`components/Actions.tsx`、`components/shapes.tsx` |
| 浮岛容器 | `components/Island.tsx`、`components/FixedSideContainer.tsx` |
| 主菜单 | `components/main-menu/MainMenu.tsx` |
| 侧栏 | `components/Sidebar/Sidebar.tsx`、`components/DefaultSidebar.tsx` |
| 属性面板 | `components/PropertiesPopover.tsx`、`components/Actions.tsx`(`SelectedShapeActions`) |
| 画布分层 | `components/canvases/*.tsx`、`components/SVGLayer.tsx` |
| 全局编辑器外观/CSS 变量 | `css/app.scss`、`css/styles.scss` |
| 移动端 | `components/MobileMenu.tsx`、`components/MobileToolBar.tsx` |

## 9. 一句话总结

Excalidraw 桌面端是「**多层 Canvas（静态/新建/交互）+ SVG 轨迹层 + Embeddable iframe 层**」做绘制，上面叠加一层绝对定位的 **LayerUI**：顶部三列（左=主菜单+属性面板，中=工具栏，右=协作者/侧栏/统计），底部 Footer，右侧可停靠侧栏，外加一整套条件渲染的对话框/浮层；移动端切换为底部抽屉式 `MobileMenu`。
