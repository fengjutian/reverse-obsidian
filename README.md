# reverse-obsidian

基于 `design.md` 的企业级知识管理系统（EKM）MVP 工程骨架。

## 当前已实现（MVP 对齐）

- 本地 `Vault` 管理与 Markdown 笔记读写（`LocalVaultManager`）
- WikiLink 解析与反向链接索引（`InMemoryLinkIndex`）
- 基础全文搜索（`InMemorySearchEngine`）
- 基础图谱数据构建（`buildBasicGraphData`）
- Markdown + WikiLink 简版渲染（`renderMarkdownWithWikiLink`）
- 桌面端 `main/preload/renderer` 三层结构与 typed IPC
- 三栏布局（文件列表 / 编辑区 / 预览+反链）
- 实时 Markdown 预览与 WikiLink 点击跳转



## 目录

```text
apps/
  desktop/
packages/
  core/
  shared-types/
.kiro/specs/enterprise-knowledge-management/design.md
```

## 快速开始

1. 安装依赖

```bash
pnpm install
```

2. 运行桌面端占位入口（MVP 串联验证）

```bash
pnpm dev
```

3. 全量类型检查

```bash
pnpm typecheck
```

## 说明

- 默认工作目录为仓库下 `workspace/notes`。
- 当前为 MVP 核心模块阶段，后续可继续接入 Electron 主进程、预加载桥接与 React UI。
