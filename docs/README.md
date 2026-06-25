# 项目文档索引

本目录收纳本项目（在 Excalidraw 基础上扩展的「AI 多媒体知识画布」）的工程文档。
Excalidraw 官方文档站点源码在仓库根的 `../dev-docs/`，不在此处。

## 文档清单

| 文档 | 内容 | 何时看 |
|------|------|--------|
| [**STARTUP.md**](./STARTUP.md) | 启动指南：环境要求、网页应用 / 桌面壳（Tauri）启动、离线装 Rust、镜像配置、图标、常见问题 | 第一次跑项目 / 新机器搭建 |
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | 系统架构：Yarn workspaces 分层、各 `@excalidraw/*` 包职责、渲染流水线、动作系统、持久化、协作、构建发布 | 想理解整体结构与数据流 |
| [**UI_LAYOUT.md**](./UI_LAYOUT.md) | 页面布局：画布 6 层叠加、桌面 UI 三列（工具栏/属性/侧栏）、对话框、Tunnel 插槽、响应式、Zen/View/Grid 模式 | 想改 UI / 加面板 / 调布局 |
| [**MEDIA_CANVAS_REFACTOR.md**](./MEDIA_CANVAS_REFACTOR.md) | 多媒体画布改造方案（最终锁定）：Tauri × Excalidraw 纯 Overlay 解耦、卡片系统、三阶段路线（媒体→Runtime→AI） | 做多媒体卡片 / AI 知识画布的总体设计 |

## 仓库根的其它说明文件

| 文件 | 说明 |
|------|------|
| `../AGENTS.md` | 给 AI agent 的工作指南（命令、约定、坑）——保留在根，便于工具自动发现 |
| `../README.md` | Excalidraw 官方 README |
| `../CLAUDE.md` / `../CONTRIBUTING.md` | 官方贡献说明 |
| `../desktop/README.md` | 桌面壳（Tauri）使用说明 |
| `../desktop/RUST_INSTALL.md` | Rust 工具链手动安装教程（国内镜像） |

## 建议阅读顺序（新成员）

1. **STARTUP.md** —— 把项目跑起来（网页端 `yarn start`，或桌面端 `yarn workspace desktop tauri dev`）。
2. **ARCHITECTURE.md** —— 建立整体心智模型（Excalidraw 当空间引擎、各包边界）。
3. **UI_LAYOUT.md** —— 知道界面区域怎么拼的，改 UI 不迷路。
4. **MEDIA_CANVAS_REFACTOR.md** —— 如果做多媒体卡片 / AI 能力，这是总蓝图。
