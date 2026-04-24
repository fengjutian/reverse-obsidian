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
- 目录树（按文件夹折叠）
- 命令面板（Ctrl/Cmd+P 快速打开笔记）
- 实时 Markdown 预览与 WikiLink 点击跳转
- 新建与保存笔记（按钮 + 快捷键 Ctrl+N / Ctrl+S）
- 视图模式切换（分屏 / 仅编辑 / 仅预览；快捷键 Ctrl+E）
- 全局搜索（右侧搜索面板；快捷键 Ctrl+Shift+F）
- 左右分隔条拖拽调整侧栏宽度
- 文件右键菜单：打开/重命名/移动/删除；重命名与移动支持输入目标路径，删除支持确认
- 删除笔记并同步更新链接与搜索索引





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
