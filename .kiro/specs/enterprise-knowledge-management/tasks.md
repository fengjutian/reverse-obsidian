# Implementation Plan: Enterprise Knowledge Management System (EKM)

## Overview

基于 Electron + React + TypeScript 的企业级知识管理系统实现计划。按 MVP 优先原则分阶段推进：本地 Vault 管理 → Markdown 编辑与渲染 → 双向链接与索引 → 搜索系统 → Graph View → 插件系统 → 企业级功能（权限、同步、协作）。

每个任务均可由代码生成 Agent 独立执行，并在完成后通过自动化测试验证。

---

## Tasks

- [x] 1. 初始化 Monorepo 项目结构与共享类型
  - 配置 pnpm workspaces + Turborepo，创建 `apps/desktop`、`apps/server`、`packages/core`、`packages/shared-types`、`packages/markdown`、`packages/graph`、`packages/search`、`packages/sync`、`packages/plugin-sdk` 目录骨架
  - 在 `packages/shared-types/src/index.ts` 中定义核心 TypeScript 接口：`VaultManager`、`LinkIndex`、`SearchEngine`、`Note`、`LinkEdge`、`SearchResult`、`PluginManifest`、`IpcChannel`
  - 配置 `tsconfig.base.json` 与各包的 `tsconfig.json`，启用严格模式
  - 配置 Vitest 测试框架与 fast-check 属性测试库
  - _Requirements: 9.1, 9.2, 10.1, 10.2_

- [x] 2. 实现 Electron 主进程与 IPC 安全架构
  - [x] 2.1 实现 `apps/desktop/src/main/index.ts` 主进程入口，配置 `BrowserWindow` 参数：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`
    - 实现多窗口管理，支持同时打开多个 Vault 实例
    - _Requirements: 10.1, 10.5_
  - [x] 2.2 实现 `apps/desktop/src/preload/index.ts`，通过 `contextBridge.exposeInMainWorld` 暴露白名单 IPC API
    - 定义 `vault:*`、`note:*`、`search:*`、`plugin:*`、`sync:*` 通道类型
    - 使用 Zod 对所有 IPC 消息进行 Schema 校验
    - _Requirements: 10.2, 10.3_
  - [x] 2.3 在主进程实现 IPC 路径安全校验中间件
    - 文件读写请求必须验证路径在当前 Vault 目录内（防路径穿越）
    - 统一错误返回结构：`{ code, message, details }`
    - _Requirements: 10.4_
  - [ ]* 2.4 为 IPC 路径校验编写属性测试
    - **Property 4: 权限安全性（P4）** — 任意构造的路径穿越请求均被拒绝
    - **Validates: Requirements 10.4**

- [x] 3. 实现本地文件系统与 Vault 管理
  - [x] 3.1 实现 `packages/core/src/vault-manager.ts` 中的 `VaultManager` 类
    - `open(path)`: 检测 `.ekm/` 目录，不存在则初始化；已存在则直接打开
    - `listNotes()`: 递归扫描 `.md` 文件，返回相对路径列表
    - `readNote(path)` / `writeNote(path, content)`: 原子写入（临时文件 + rename）
    - 持久化最近打开 Vault 列表（最多 20 条）到 `~/.ekm/recent.json`
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 9.1, 9.2, 9.4_
  - [x] 3.2 实现文件系统监听器 `packages/core/src/file-watcher.ts`
    - 使用 `chokidar` 监听 Vault 目录变更，聚合去抖（100~300ms）
    - 变更事件触发 LinkIndex 增量更新与 SearchEngine 索引更新
    - _Requirements: 9.3, 6.6_
  - [x] 3.3 实现 Vault 关闭时持久化编辑器状态到 `.ekm/workspace.json`
    - 保存当前打开的 Tab 列表、分屏布局、滚动位置
    - 下次打开时恢复状态
    - _Requirements: 1.6, 21.5_
  - [ ]* 3.4 为 VaultManager 编写单元测试
    - 测试初始化、重复打开、文件读写、路径规范化等边界情况
    - _Requirements: 1.2, 1.4, 9.4_

- [x] 4. 实现本地 SQLite 数据库层
  - [x] 4.1 实现 `packages/core/src/database.ts`，封装 `better-sqlite3`
    - 建表：`notes`、`links`、`tags`、`note_tags`、`embeddings`、`index_state`
    - 所有写操作包裹在事务中，保证原子性
    - 启动时检测数据库完整性（`PRAGMA integrity_check`），损坏则删除并重建
    - _Requirements: 17.1, 17.4, 17.5_
  - [ ]* 4.2 为数据库事务编写属性测试
    - **Property 5: 数据耐久性（P5）** — 写入确认后模拟崩溃，重启后数据完整
    - **Validates: Requirements 17.5**

- [x] 5. 实现双向链接索引系统
  - [x] 5.1 实现 `packages/core/src/link-index.ts` 中的 `LinkIndex` 类
    - `rebuild()`: 全量扫描所有 `.md` 文件，解析 WikiLink 语法，写入 `links` 表
    - `updateByPath(path)`: 增量更新单个文件的链接关系
    - `getBacklinks(path)`: 查询指向目标文件的所有来源
    - 支持 `[[目标]]`、`[[目标|别名]]`、`[[目标#标题]]`、`[[目标^block-id]]`、`![[嵌入]]` 语法
    - Vault 打开时 10,000 Notes 内 5 秒完成全量构建
    - _Requirements: 1.3, 4.1, 4.2, 4.5, 4.6, 4.7_
  - [x] 5.2 实现笔记重命名时自动更新所有 WikiLink 引用
    - 重命名后 3 秒内完成 10,000 Notes 规模的全量引用更新
    - _Requirements: 4.4, 9.4_
  - [ ]* 5.3 为 LinkIndex 编写属性测试
    - **Property 1: 索引一致性（P1）** — 每条 links 表记录的 source_path 必须对应存在的 `.md` 文件
    - **Validates: Requirements 4.1, 4.8**
  - [ ]* 5.4 为反向链接查询编写属性测试
    - **Property 2: 引用可逆性（P2）** — 若 A 链接 B，则 `getBacklinks(B)` 必然包含 A
    - **Validates: Requirements 4.3, 4.8**

- [x] 6. Checkpoint — 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户提问。

- [ ] 7. 实现 Markdown 解析与渲染引擎
  - [-] 7.1 实现 `packages/markdown/src/parser.ts`，基于 `unified/remark` 构建 Markdown AST 处理管线
    - 支持 CommonMark + 扩展：表格、任务列表、脚注、数学（KaTeX）、代码高亮（highlight.js）、Mermaid
    - 实现 WikiLink / Embed / Callout 自定义 remark 插件
    - _Requirements: 2.4, 3.1, 3.2, 3.3, 3.5, 3.6_
  - [~] 7.2 实现渲染管线：MDAST → rehype → React 组件树
    - WikiLink 渲染为可点击链接；未解析链接渲染为"悬挂链接"样式
    - Embed 语法内联渲染被引用笔记的 HTML 内容
    - 50,000 字符以内的笔记渲染时间 < 300ms
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [~] 7.3 实现增量渲染：笔记更新时仅重新渲染变更段落（< 100ms）
    - _Requirements: 3.8_
  - [ ]* 7.4 为 Markdown 渲染器编写属性测试
    - **Property 3: 幂等渲染** — 对任意合法 Markdown 文档，二次渲染产生语义等价的 HTML
    - **Validates: Requirements 3.7**

- [ ] 8. 实现 CodeMirror 6 编辑器组件
  - [~] 8.1 实现 `apps/desktop/src/renderer/editor.ts`，集成 CodeMirror 6
    - 支持三种视图模式：Editing_Mode（源码）、Reading_Mode（预览）、Live_Preview（实时预览）
    - 实现标题与代码块折叠
    - Undo/Redo 历史深度 ≥ 200 操作
    - _Requirements: 2.1, 2.8, 2.10_
  - [~] 8.2 实现 WikiLink 自动补全扩展
    - 输入 `[[` 时 100ms 内弹出笔记标题补全下拉框
    - 输入 `#` 时 100ms 内弹出 Tag 补全下拉框
    - _Requirements: 2.2, 2.3_
  - [~] 8.3 实现图片粘贴处理
    - 粘贴图片时保存到 `assets/` 目录并插入 Markdown 图片引用
    - _Requirements: 2.5_
  - [~] 8.4 实现 Vim 键位模式（可选，通过设置开关）
    - _Requirements: 2.6_
  - [~] 8.5 实现防抖自动保存（最后一次按键后 2 秒写盘）与 Ctrl+S 立即保存（< 200ms）
    - _Requirements: 2.7, 18.6_
  - [~] 8.6 实现 Frontmatter 解析与属性面板展示
    - _Requirements: 2.9_

- [ ] 9. 实现全文搜索系统
  - [~] 9.1 实现 `packages/search/src/search-engine.ts`，集成 FlexSearch
    - 索引笔记内容、标题、Tags、Frontmatter 字段
    - 支持查询运算符：`AND`、`OR`、`NOT`、`"短语"`、`field:value`、`tag:name`、`path:folder`、`/regex/`
    - 10,000 Notes 规模下查询响应 < 500ms
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  - [~] 9.2 实现搜索结果高亮与排序（相关度、修改时间、创建时间）
    - _Requirements: 6.4, 6.8_
  - [~] 9.3 实现文件变更后 2 秒内增量更新搜索索引
    - _Requirements: 6.6_
  - [~] 9.4 实现 Quick_Switcher 组件（Ctrl+O），模糊搜索笔记标题，50ms 内返回结果
    - _Requirements: 16.2_

- [ ] 10. 实现 Graph View 图谱视图
  - [~] 10.1 实现 `packages/graph/src/layout-worker.ts`，在 Worker 线程中运行 `d3-force` 布局计算
    - 5,000 Notes 规模下初始布局 < 3 秒
    - 支持物理模拟参数配置（斥力、引力、碰撞半径）
    - _Requirements: 5.2, 5.3_
  - [~] 10.2 实现 `packages/graph/src/graph-renderer.ts`，使用 sigma.js（WebGL）渲染图谱
    - 节点点击：高亮节点及直接邻居，显示笔记标题 tooltip
    - 节点双击：在编辑器中打开对应笔记
    - 支持缩放（0.1x–10x）与平移
    - _Requirements: 5.1, 5.4, 5.5, 5.9_
  - [~] 10.3 实现图谱过滤功能（按 Tag、文件夹路径、链接深度 1–5 跳）与局部图模式
    - _Requirements: 5.6, 5.7_
  - [~] 10.4 实现笔记增删时图谱增量更新（< 500ms，无需全量重渲染）
    - 大图（>500 元素）启用视窗裁剪，维持 60fps
    - _Requirements: 5.8, 15.5_

- [~] 11. Checkpoint — 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户提问。

- [ ] 12. 实现插件系统
  - [~] 12.1 实现 `packages/plugin-sdk/src/plugin-api.ts`，定义插件 API 命名空间
    - `app.vault`（文件操作）、`app.workspace`（布局/视图）、`app.metadataCache`（LinkIndex 查询）、`app.commands`（命令注册）、`app.settings`（设置访问）
    - _Requirements: 7.1, 7.7_
  - [~] 12.2 实现插件沙箱加载器 `packages/plugin-sdk/src/plugin-sandbox.ts`
    - 隔离全局对象，能力白名单授权（文件、网络、剪贴板分别控制）
    - 捕获插件未处理异常，禁用插件并显示错误通知，不崩溃主应用
    - _Requirements: 7.2, 7.4_
  - [~] 12.3 实现插件命令注册与命令面板集成
    - 插件加载后 100ms 内命令可在命令面板中使用
    - _Requirements: 7.8, 16.1_
  - [~] 12.4 实现企业插件白名单校验（Enterprise_Admin 配置 allowlist 时仅加载白名单插件）
    - _Requirements: 7.6_

- [ ] 13. 实现主题系统
  - [~] 13.1 实现内置亮色/暗色主题，基于 CSS 自定义属性（design token）
    - 主题切换无需重启，200ms 内生效
    - _Requirements: 8.1, 8.2_
  - [~] 13.2 实现主题热重载：主题 CSS 文件磁盘变更后 500ms 内自动应用
    - _Requirements: 8.7_
  - [~] 13.3 实现自定义 CSS 片段叠加（按设置顺序应用在主题之上）
    - _Requirements: 8.5_

- [ ] 14. 实现多标签页与分屏布局
  - [~] 14.1 实现 Tab 管理器：支持多标签页打开、中键点击链接新建 Tab、拖拽排序
    - _Requirements: 21.1, 21.2, 21.7_
  - [~] 14.2 实现水平/垂直 Split_View：拖拽 Tab 到编辑区边缘触发分屏
    - _Requirements: 21.3_
  - [~] 14.3 实现 Popout_Window：在独立 OS 窗口中打开笔记，共享同一 Vault 上下文
    - _Requirements: 21.4_
  - [ ] 14.4 实现 Tab 关联笔记被删除时自动关闭 Tab 并通知用户
    - _Requirements: 21.6_

- [ ] 15. 实现大纲面板、每日笔记与模板系统
  - [ ] 15.1 实现 `Outline_Panel` 组件，实时解析当前笔记 ATX 标题（H1–H6）并展示层级结构
    - 标题变更后 200ms 内更新；点击标题 100ms 内滚动到对应位置
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_
  - [ ] 15.2 实现每日笔记功能
    - "打开今日笔记"命令：按配置日期格式创建或打开当日笔记
    - 支持上一篇/下一篇导航命令
    - 新建时自动应用配置的模板并替换变量
    - _Requirements: 23.1, 23.2, 23.3, 23.4_
  - [ ] 15.3 实现模板系统
    - 支持指定模板文件夹，"插入模板"命令在光标处插入模板内容
    - 内置变量：`{{date}}`、`{{time}}`、`{{title}}`、`{{author}}`
    - _Requirements: 24.1, 24.2, 24.3_

- [ ] 16. 实现全局命令面板
  - [ ] 16.1 实现命令面板组件（Ctrl+P / Cmd+P），列出所有核心与插件注册的命令
    - 模糊匹配过滤，50ms 内返回结果
    - _Requirements: 16.1, 16.2_
  - [ ] 16.2 实现自定义快捷键绑定与冲突检测
    - 检测到冲突时显示警告，要求用户解决后才能保存
    - _Requirements: 16.3, 16.4_

- [ ] 17. Checkpoint — 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户提问。

- [ ] 18. 实现企业权限系统（服务端）
  - [ ] 18.1 实现 `apps/server` Fastify 服务骨架，集成 Prisma + PostgreSQL
    - 建表：`users`、`workspaces`、`workspace_members`、`roles`、`permissions`、`audit_logs`
    - 租户隔离：所有企业级表包含 `tenant_id` 字段
    - _Requirements: 12.1, 12.2, 17.2_
  - [ ] 18.2 实现 RBAC 权限判定中间件
    - 角色层级：`Owner > Admin > Editor > Commenter > Viewer`
    - `Viewer` 角色写操作被拒绝并返回权限错误
    - _Requirements: 12.1, 12.2, 12.3_
  - [ ] 18.3 实现审计日志写入（时间戳、用户 ID、操作类型、资源路径）
    - _Requirements: 12.7_
  - [ ] 18.4 实现 SSO 集成：SAML 2.0（node-saml）与 OAuth 2.0 / OIDC（openid-client）
    - _Requirements: 12.4_
  - [ ] 18.5 实现 LDAP/Active Directory 用户目录同步（可配置间隔，最小 15 分钟）
    - _Requirements: 12.5_
  - [ ] 18.6 实现用户账户停用时 60 秒内吊销所有活跃 Session
    - _Requirements: 12.6_
  - [ ]* 18.7 为权限判定编写属性测试
    - **Property 4: 权限安全性（P4）** — 对任意未授权用户的写操作请求，权限判定必然返回拒绝
    - **Validates: Requirements 12.3**

- [ ] 19. 实现多端同步服务
  - [ ] 19.1 实现 `packages/sync/src/sync-client.ts`，基于 Yjs CRDT + WebSocket
    - 消息类型：`sync:init`、`sync:op`、`sync:ack`、`sync:resync`
    - 断线自动重连，在线设备 10 秒内收到变更
    - _Requirements: 11.1, 11.2, 11.3_
  - [ ] 19.2 实现离线队列（SQLite 持久化），重连后按序重放，`op_id` 去重保证幂等
    - _Requirements: 11.5_
  - [ ] 19.3 实现冲突解决器：CRDT 自动合并文本冲突；文件级冲突创建副本并提示用户 diff 解决
    - _Requirements: 11.3, 11.4_
  - [ ] 19.4 实现同步状态展示（已同步/同步中/冲突/离线）
    - _Requirements: 11.6_
  - [ ]* 19.5 为离线队列重放编写属性测试
    - **Property 3: 操作幂等性（P3）** — 重复提交相同 `op_id` 不产生副作用
    - **Validates: Requirements 11.3**

- [ ] 20. 实现团队协作功能
  - [ ] 20.1 实现实时协同编辑：多用户同时编辑同一笔记，变更 500ms 内可见
    - 显示每位用户的光标位置与选区（不同颜色 + 用户名标签）
    - _Requirements: 13.1, 13.2_
  - [ ] 20.2 实现内联评论系统：支持对特定文本范围添加评论与线程回复
    - 评论添加/解决后 2 秒内通知所有打开该笔记的用户
    - _Requirements: 13.3, 13.4_
  - [ ] 20.3 实现版本历史：Team_Vault 笔记保留 90 天版本，支持任意两版本可视化 diff
    - _Requirements: 13.5, 13.6_
  - [ ] 20.4 实现 @mention：在笔记内容和评论中 @团队成员，触发应用内与邮件通知
    - _Requirements: 13.7_

- [ ] 21. 实现私有化部署配置
  - [ ] 21.1 编写 `infra/docker/docker-compose.yml`，包含 Sync_Service、Auth Service、PostgreSQL、Redis 服务
    - 暴露 `/health/live` 与 `/health/ready` 健康检查端点
    - _Requirements: 14.1, 14.6_
  - [ ] 21.2 编写 `infra/helm/` Helm Chart，支持 Kubernetes 水平扩展部署
    - _Requirements: 14.2_
  - [ ] 21.3 实现所有外部服务端点可配置化（auth server、sync server、plugin registry 均可指向内网 URL）
    - 支持 air-gapped 环境（无出站互联网连接）
    - _Requirements: 14.3, 14.4_
  - [ ] 21.4 配置 TLS 1.2 / 1.3 支持，证书路径可配置
    - _Requirements: 14.7_

- [ ] 22. 实现国际化与导入导出
  - [ ] 22.1 实现 i18n 框架，支持 zh-CN、zh-TW、en-US、ja-JP 四种语言
    - OS locale 自动检测；缺失翻译 key 回退到 en-US
    - _Requirements: 19.1, 19.2, 19.4_
  - [ ] 22.2 实现导入功能：支持 Obsidian Vault、Notion ZIP、Roam Research JSON、纯 Markdown 文件夹
    - Notion 导入时将内部链接格式转换为 WikiLink 语法
    - _Requirements: 20.1, 20.2_
  - [ ] 22.3 实现导出功能：静态 HTML 站点、PDF 文档、Markdown ZIP 压缩包
    - HTML 导出保留 WikiLink 为相对超链接；PDF 正确渲染格式、图片、数学公式
    - _Requirements: 20.3, 20.4, 20.5_

- [ ] 23. 性能优化与可靠性
  - [ ] 23.1 实现 Worker 线程池（min 2，max CPU-1），将索引构建、搜索、图布局计算移入 Worker
    - _Requirements: 10.6_
  - [ ] 23.2 实现笔记内容懒加载（仅在打开或搜索时加载文件内容到内存）
    - 50,000 Notes 规模下渲染进程内存 < 512MB
    - _Requirements: 18.3, 18.4_
  - [ ] 23.3 实现崩溃恢复缓冲区：异常崩溃后下次启动时恢复未保存内容
    - _Requirements: 18.5_
  - [ ] 23.4 实现 electron-updater 自动更新：后台下载，提示用户重启安装
    - _Requirements: 10.7_

- [ ] 24. Final Checkpoint — 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户提问。

---

## Notes

- 标有 `*` 的子任务为可选测试任务，可跳过以加快 MVP 交付
- 每个任务均引用了具体的需求条款，确保可追溯性
- 属性测试（P1–P5）对应 design.md 第 16 节"正确性属性"
- 建议按 Milestone 顺序执行：任务 1–11（Milestone 1）→ 任务 12–17（Milestone 2）→ 任务 18–21（Milestone 3）→ 任务 22–24（Milestone 4）
- 所有代码任务均可由代码生成 Agent 独立执行，无需人工干预
