# Requirements Document

## Introduction

本系统是一套面向企业级场景的知识管理平台，基于 Electron 桌面客户端构建，功能对标 Obsidian，并在其基础上扩展多用户协作、权限管理、私有化部署、团队知识库等企业级能力。系统以本地 Markdown 文件为核心数据载体，支持双向链接、图谱视图、插件扩展、主题定制、全文搜索，并通过企业级同步服务实现多端数据一致性。

目标用户：企业知识管理员、研发团队、产品团队、运营团队及个人知识工作者。

---

## Glossary

- **EKM_System**: 企业知识管理系统（Enterprise Knowledge Management System），本文档描述的整体软件系统
- **Vault**: 知识库，一个以本地文件夹为根目录的 Markdown 文档集合
- **Note**: 笔记，Vault 中的单个 Markdown 文件
- **Workspace**: 工作区，用户在客户端中打开的一个 Vault 实例
- **Backlink**: 反向链接，指向当前 Note 的所有其他 Note 的引用集合
- **WikiLink**: 双向链接语法，格式为 `[[Note Title]]` 或 `[[Note Title|Alias]]`
- **Graph_View**: 图谱视图，以节点和边可视化展示 Note 之间链接关系的交互式图形界面
- **Plugin**: 插件，遵循插件 API 规范、可动态加载的功能扩展模块
- **Theme**: 主题，控制界面视觉风格的 CSS 变量集合与样式文件
- **Renderer**: Markdown 渲染器，将 Markdown 源文本转换为 HTML 的处理模块
- **Sync_Service**: 同步服务，负责多端数据同步的后端服务
- **Search_Engine**: 搜索引擎，提供全文检索与语义检索能力的模块
- **Permission_Manager**: 权限管理器，控制用户对 Vault/Note 访问权限的模块
- **Main_Process**: Electron 主进程，运行 Node.js 环境，负责系统级操作
- **Renderer_Process**: Electron 渲染进程，运行 Chromium 环境，负责 UI 渲染
- **IPC**: 进程间通信（Inter-Process Communication），Main_Process 与 Renderer_Process 之间的消息传递机制
- **Link_Index**: 链接索引，记录所有 Note 之间 WikiLink 关系的内存/持久化数据结构
- **Tag**: 标签，Note 中以 `#tag` 语法标记的分类标识符
- **Frontmatter**: YAML 元数据块，位于 Note 文件头部，以 `---` 分隔
- **Embed**: 嵌入引用，以 `![[Note Title]]` 语法将另一个 Note 内容内联展示
- **Canvas**: 画布，支持自由排列卡片与连线的可视化编辑界面
- **Enterprise_Admin**: 企业管理员，拥有用户管理、权限配置、系统设置权限的角色
- **Team_Vault**: 团队知识库，多用户共享、受权限控制的 Vault 实例
- **Private_Vault**: 私人知识库，仅当前用户可访问的 Vault 实例
- **Conflict_Resolver**: 冲突解决器，处理多端同步时文件版本冲突的模块
- **CRDT**: 无冲突复制数据类型（Conflict-free Replicated Data Type），用于协同编辑的数据结构
- **LSP**: 语言服务协议（Language Server Protocol），为编辑器提供智能补全的标准协议
- **Tab**: 标签页，编辑器工作区中可独立打开 Note 的单个页签
- **Split_View**: 分屏视图，将编辑器区域水平或垂直分割为多个独立窗格
- **Popout_Window**: 弹出窗口，将单个 Note 在独立的操作系统窗口中打开
- **Outline_Panel**: 大纲面板，实时展示当前 Note 标题层级结构的侧边栏组件
- **Daily_Note**: 每日笔记，以当天日期为标题自动创建的 Note
- **Template**: 模板，包含预定义内容和变量占位符的 Markdown 文件
- **Quick_Switcher**: 快速切换器，通过模糊搜索快速跳转到任意 Note 的浮层组件
- **Bookmark**: 书签，用户收藏的 Note、文件夹或搜索查询的快捷入口
- **File_Explorer**: 文件浏览器，以树形结构展示 Vault 目录和文件的侧边栏面板
- **Tag_Pane**: 标签浏览器，展示 Vault 中所有 Tag 层级结构的侧边栏面板
- **Reading_Mode**: 阅读模式，仅展示渲染后 HTML、不可编辑的视图状态
- **Editing_Mode**: 编辑模式，仅展示 Markdown 源码的纯文本编辑视图状态
- **Live_Preview**: 实时预览模式，在源码编辑的同时即时渲染 Markdown 的混合视图状态
- **Properties_Panel**: 属性面板，跨 Vault 汇总展示所有 Frontmatter 字段统计的管理界面
- **Dataview**: 数据视图，使用类 SQL 查询语法聚合 Frontmatter 数据并生成表格或列表的内置模块
- **Kanban_Board**: 看板，基于 Frontmatter 状态字段将 Note 以卡片形式展示在泳道中的视图
- **Timeline_View**: 时间线视图，按 Frontmatter 日期字段将 Note 排列在时间轴上的视图
- **DLP**: 数据防泄漏（Data Loss Prevention），防止敏感企业数据通过打印或导出渠道泄露的安全机制
- **Watermark**: 水印，嵌入导出文档中包含用户身份信息的可见或隐形标记
- **Analytics_Dashboard**: 分析仪表盘，展示知识库使用统计、活跃度和贡献者数据的可视化界面
- **Approval_Workflow**: 审批工作流，文档发布前需经指定审批人确认的流程机制
- **Vault_Template**: 知识库模板，企业统一定义的初始目录结构、规范文件和配置的预设包
- **Note_Encryption**: 笔记加密，对单个 Note 文件内容进行密码保护的安全功能
- **PII_Scanner**: PII 扫描器，自动检测 Note 中包含个人身份信息的安全模块
- **Audit_Report**: 审计报告，按时间范围导出的操作日志文档
- **Webhook**: 网络钩子，Note 变更时向外部系统发送 HTTP 回调请求的事件推送机制
- **REST_API**: 表述性状态转移应用程序接口，供第三方系统通过 HTTP 读写知识库内容的标准接口
- **Git_Integration**: Git 集成，内置 Git 版本控制操作（commit/push/pull/diff）的功能模块
- **Storage_Backend**: 存储后端，替代本地文件系统作为 Vault 数据存储层的外部服务（如 S3、WebDAV、OneDrive）
- **Web_Clipper**: 网页剪藏工具，浏览器插件形式的内容采集工具，将网页内容保存到 Vault
- **Mobile_Client**: 移动端客户端，运行于 iOS 和 Android 平台的 EKM_System 原生应用
- **Web_Client**: Web 端客户端，运行于浏览器中的 EKM_System 在线访问界面

---

## Requirements

### Requirement 1: 知识库（Vault）管理

**User Story:** As an 企业用户, I want to 创建、打开和管理多个知识库, so that 我可以按项目或团队组织知识资产。

#### Acceptance Criteria

1. THE EKM_System SHALL support opening multiple Vault instances simultaneously in separate windows.
2. WHEN a user selects a local folder, THE EKM_System SHALL initialize it as a Vault by creating a `.ekm/` configuration directory within the selected folder.
3. WHEN a Vault is opened, THE EKM_System SHALL scan all `.md` files recursively and build the Link_Index within 5 seconds for Vaults containing up to 10,000 Notes.
4. IF a selected folder is already a Vault, THEN THE EKM_System SHALL open it directly without re-initializing the `.ekm/` directory.
5. THE EKM_System SHALL display a list of recently opened Vaults on the home screen, retaining up to 20 entries.
6. WHEN a Vault is closed, THE EKM_System SHALL persist the current editor state, open tabs, and scroll positions to `.ekm/workspace.json`.
7. WHERE Team_Vault is configured, THE EKM_System SHALL enforce Permission_Manager rules before allowing read or write operations on any Note.

---

### Requirement 2: Markdown 编辑器

**User Story:** As a 知识工作者, I want to 使用功能完整的 Markdown 编辑器编写笔记, so that 我可以高效记录和格式化知识内容。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a split-pane editor supporting simultaneous source editing and live preview rendering.
2. WHEN a user types `[[`, THE EKM_System SHALL display an autocomplete dropdown listing all Note titles in the current Vault within 100ms.
3. WHEN a user types `#`, THE EKM_System SHALL display an autocomplete dropdown listing all existing Tags in the current Vault within 100ms.
4. THE Renderer SHALL support the CommonMark specification and the following extensions: tables, task lists, footnotes, math (KaTeX), code highlighting (highlight.js), and Mermaid diagrams.
5. WHEN a user pastes an image, THE EKM_System SHALL save the image to the configured attachment folder and insert a Markdown image reference into the Note.
6. THE EKM_System SHALL support vim keybindings as an optional editor mode configurable per user.
7. WHEN a user saves a Note (Ctrl+S / Cmd+S), THE EKM_System SHALL persist the file to disk within 200ms.
8. THE EKM_System SHALL provide undo/redo history with a minimum depth of 200 operations per editing session.
9. WHEN a Note contains Frontmatter, THE EKM_System SHALL parse and display the metadata fields in a structured properties panel.
10. THE EKM_System SHALL support folding of headings and code blocks in the source editor.

---

### Requirement 3: Markdown 渲染机制

**User Story:** As a 读者, I want to 查看格式化后的笔记内容, so that 我可以清晰阅读结构化知识。

#### Acceptance Criteria

1. WHEN a Note is opened in preview mode, THE Renderer SHALL convert Markdown source to HTML and display it within 300ms for Notes up to 50,000 characters.
2. THE Renderer SHALL render WikiLink syntax `[[Note Title]]` as clickable hyperlinks that navigate to the referenced Note.
3. THE Renderer SHALL render Embed syntax `![[Note Title]]` by inlining the referenced Note's rendered HTML content.
4. WHEN a WikiLink references a non-existent Note, THE Renderer SHALL render it as a visually distinct "unresolved link" that, when clicked, creates a new Note with that title.
5. THE Renderer SHALL render math expressions using KaTeX, supporting both inline `$...$` and block `$$...$$` syntax.
6. THE Renderer SHALL render Mermaid diagram syntax as SVG graphics.
7. FOR ALL valid Markdown documents, THE Renderer SHALL produce HTML output that, when re-parsed and re-rendered, produces semantically equivalent HTML (idempotent rendering).
8. WHEN a Note is updated, THE Renderer SHALL incrementally re-render only the changed sections within 100ms.

---

### Requirement 4: 双向链接系统

**User Story:** As a 知识工作者, I want to 通过双向链接关联笔记, so that 我可以发现知识之间的隐性联系。

#### Acceptance Criteria

1. THE EKM_System SHALL maintain a Link_Index that records all WikiLink relationships between Notes in the current Vault.
2. WHEN a Note is created, updated, or deleted, THE EKM_System SHALL update the Link_Index within 500ms.
3. WHEN a user views a Note, THE EKM_System SHALL display all Backlinks (Notes that link to the current Note) in a dedicated panel.
4. WHEN a Note is renamed, THE EKM_System SHALL automatically update all WikiLinks referencing the old title across the entire Vault within 3 seconds for Vaults up to 10,000 Notes.
5. THE EKM_System SHALL support aliased WikiLinks in the format `[[Note Title|Display Text]]`.
6. THE EKM_System SHALL support heading-level links in the format `[[Note Title#Heading]]`.
7. THE EKM_System SHALL support block-level links in the format `[[Note Title^block-id]]`.
8. FOR ALL WikiLink insertions and Note renames, THE Link_Index SHALL reflect the updated state such that querying Backlinks immediately after the operation returns accurate results (consistency invariant).

---

### Requirement 5: Graph View（图谱视图）

**User Story:** As a 知识工作者, I want to 可视化查看笔记之间的链接关系图谱, so that 我可以理解知识结构并发现关联。

#### Acceptance Criteria

1. THE EKM_System SHALL render a Graph_View displaying all Notes as nodes and all WikiLink relationships as directed edges.
2. WHEN the Graph_View is opened, THE EKM_System SHALL render the initial layout within 3 seconds for Vaults containing up to 5,000 Notes.
3. THE EKM_System SHALL use a force-directed layout algorithm (e.g., D3-force) to position nodes, with physics simulation parameters configurable by the user.
4. WHEN a user clicks a node in the Graph_View, THE EKM_System SHALL highlight the node and its direct neighbors, and display the Note title in a tooltip.
5. WHEN a user double-clicks a node in the Graph_View, THE EKM_System SHALL open the corresponding Note in the editor.
6. THE EKM_System SHALL support filtering the Graph_View by Tag, folder path, and link depth (1–5 hops).
7. THE EKM_System SHALL support a local graph mode that displays only the current Note and its neighbors up to a configurable depth.
8. WHEN a Note is added or removed, THE EKM_System SHALL update the Graph_View incrementally without full re-render within 500ms.
9. THE EKM_System SHALL support zoom (0.1x–10x) and pan interactions in the Graph_View.

---

### Requirement 6: 搜索系统

**User Story:** As a 知识工作者, I want to 快速搜索知识库中的内容, so that 我可以在大量笔记中精准定位信息。

#### Acceptance Criteria

1. THE Search_Engine SHALL support full-text search across all Note content, titles, Tags, and Frontmatter fields within the current Vault.
2. WHEN a user submits a search query, THE Search_Engine SHALL return results within 500ms for Vaults containing up to 10,000 Notes.
3. THE Search_Engine SHALL support the following query operators: `AND`, `OR`, `NOT`, phrase search with `"..."`, field-specific search with `field:value`, Tag search with `tag:name`, and path filter with `path:folder`.
4. THE Search_Engine SHALL highlight matched terms in search result snippets.
5. THE Search_Engine SHALL support regular expression search when the query is wrapped in `/regex/` syntax.
6. WHEN the Vault content changes, THE Search_Engine SHALL update its index within 2 seconds of the file change event.
7. WHERE semantic search is enabled, THE Search_Engine SHALL support natural language queries by computing vector embeddings and returning semantically similar Notes.
8. THE Search_Engine SHALL support sorting results by relevance score, last modified date, and creation date.

---

### Requirement 7: 插件系统

**User Story:** As a 开发者, I want to 开发和安装插件扩展系统功能, so that 我可以根据团队需求定制知识管理工具。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Plugin API that allows plugins to register custom commands, editor extensions, view types, and settings panels.
2. WHEN a plugin is installed, THE EKM_System SHALL load it in an isolated sandbox environment that restricts access to system resources beyond the Plugin API.
3. THE EKM_System SHALL support loading plugins from: the official plugin marketplace, a local folder path, and a private enterprise plugin registry URL.
4. WHEN a plugin throws an unhandled exception, THE EKM_System SHALL catch the exception, disable the plugin, and display an error notification without crashing the application.
5. THE EKM_System SHALL provide a plugin settings UI where users can enable, disable, configure, and uninstall plugins.
6. WHERE Enterprise_Admin has configured an allowlist, THE EKM_System SHALL only load plugins whose IDs appear in the allowlist.
7. THE EKM_System SHALL expose the following Plugin API namespaces: `app.vault` (file operations), `app.workspace` (layout/view), `app.metadataCache` (Link_Index queries), `app.commands` (command registration), and `app.settings` (settings access).
8. WHEN a plugin registers a command, THE EKM_System SHALL make the command available in the command palette within 100ms of plugin load.

---

### Requirement 8: 主题系统

**User Story:** As a 用户, I want to 切换和自定义界面主题, so that 我可以在舒适的视觉环境中工作。

#### Acceptance Criteria

1. THE EKM_System SHALL ship with a built-in light theme and a dark theme, switchable via a toggle in the settings panel.
2. THE EKM_System SHALL apply theme changes without requiring application restart, within 200ms of the user's selection.
3. THE EKM_System SHALL support installing community themes from a theme marketplace and from local CSS files.
4. A Theme SHALL be defined as a CSS file that overrides a set of CSS custom properties (variables) documented in the EKM_System's design token specification.
5. WHERE a user has defined custom CSS snippets, THE EKM_System SHALL apply them on top of the active Theme in the order they are listed in the settings.
6. THE EKM_System SHALL support per-Vault theme configuration, allowing different Vaults to use different themes.
7. WHEN a Theme file is modified on disk, THE EKM_System SHALL hot-reload the Theme within 500ms without restarting the application.

---

### Requirement 9: 文件系统架构

**User Story:** As a 系统架构师, I want to 系统以本地文件为单一数据源, so that 数据可移植、可版本控制、不依赖专有格式。

#### Acceptance Criteria

1. THE EKM_System SHALL store all Note content as plain UTF-8 encoded `.md` files directly on the local file system.
2. THE EKM_System SHALL store Vault configuration in a `.ekm/` directory at the Vault root, containing: `config.json` (Vault settings), `workspace.json` (editor state), `plugins/` (plugin data), and `cache/` (index cache).
3. THE EKM_System SHALL watch the Vault directory for external file changes using OS-level file system events and reflect changes in the UI within 1 second.
4. WHEN a Note is moved or renamed via the EKM_System UI, THE EKM_System SHALL update the file on disk and update all WikiLinks referencing the moved Note atomically.
5. THE EKM_System SHALL support configuring attachment folders per Vault, with a default of `assets/` at the Vault root.
6. THE EKM_System SHALL never modify Note files without explicit user action, preserving file modification timestamps for external tools.
7. IF a file write operation fails due to insufficient disk space or permissions, THEN THE EKM_System SHALL display a descriptive error message and retain the unsaved content in the editor buffer.

---

### Requirement 10: Electron 架构

**User Story:** As a 桌面应用开发者, I want to 系统基于安全、高性能的 Electron 架构, so that 应用稳定运行并具备良好的安全边界。

#### Acceptance Criteria

1. THE EKM_System SHALL run the Main_Process with Node.js integration enabled only for trusted internal modules, with `contextIsolation: true` and `nodeIntegration: false` in all Renderer_Process windows.
2. THE EKM_System SHALL expose all file system, OS, and native API operations exclusively through a typed IPC channel defined in a `preload.ts` script, using `contextBridge.exposeInMainWorld`.
3. THE EKM_System SHALL implement IPC message validation in the Main_Process, rejecting any message that does not conform to the defined schema.
4. WHEN the Main_Process receives a file read request via IPC, THE Main_Process SHALL validate that the requested path is within the currently opened Vault directory before executing the operation.
5. THE EKM_System SHALL support multiple Renderer_Process windows, each managing an independent Workspace instance.
6. THE EKM_System SHALL implement a worker thread pool in the Main_Process for CPU-intensive operations (indexing, search, graph layout), with a pool size of min 2, max (CPU cores - 1) threads.
7. WHEN the application is updated, THE EKM_System SHALL support auto-update via electron-updater, downloading updates in the background and prompting the user to restart.

---

### Requirement 11: 多端同步架构

**User Story:** As a 企业用户, I want to 在多台设备间同步知识库, so that 我可以在任何设备上访问最新的知识内容。

#### Acceptance Criteria

1. THE Sync_Service SHALL support end-to-end encrypted synchronization of Vault content between multiple client devices registered to the same user account.
2. WHEN a Note is modified on one device, THE Sync_Service SHALL propagate the change to all other online devices within 10 seconds.
3. THE Sync_Service SHALL use CRDT-based merge strategies for concurrent edits to the same Note, preserving all non-conflicting changes.
4. WHEN a merge conflict cannot be automatically resolved, THE Conflict_Resolver SHALL present both versions to the user with a visual diff and require explicit resolution.
5. THE Sync_Service SHALL support offline operation, queuing local changes and synchronizing when connectivity is restored.
6. THE EKM_System SHALL display the sync status (synced, syncing, conflict, offline) for each Note and for the Vault as a whole.
7. WHERE Enterprise_Admin has configured a private Sync_Service endpoint, THE EKM_System SHALL connect exclusively to that endpoint for all synchronization operations.
8. THE Sync_Service SHALL maintain a change history of at least 30 days, allowing users to restore any Note to a previous version.

---

### Requirement 12: 企业用户与权限管理

**User Story:** As an Enterprise_Admin, I want to 管理用户账户和知识库访问权限, so that 企业知识资产得到安全保护。

#### Acceptance Criteria

1. THE Permission_Manager SHALL support role-based access control (RBAC) with the following built-in roles: `Owner`, `Editor`, `Commenter`, and `Viewer`.
2. THE Permission_Manager SHALL enforce permissions at the Vault level and at the folder level within a Vault.
3. WHEN a user with `Viewer` role attempts a write operation on a Note, THE Permission_Manager SHALL reject the operation and return a permission denied error.
4. THE EKM_System SHALL support Single Sign-On (SSO) via SAML 2.0 and OAuth 2.0 / OIDC protocols for enterprise identity provider integration.
5. THE EKM_System SHALL support LDAP/Active Directory user directory synchronization, updating user accounts and group memberships on a configurable schedule (minimum interval: 15 minutes).
6. WHEN a user account is deactivated by Enterprise_Admin, THE EKM_System SHALL revoke all active sessions for that user within 60 seconds.
7. THE EKM_System SHALL log all permission-sensitive operations (read, write, delete, share) to an audit log with timestamp, user ID, operation type, and resource path.
8. THE Permission_Manager SHALL support sharing individual Notes or folders with external users via time-limited, permission-scoped share links.

---

### Requirement 13: 团队协作

**User Story:** As a 团队成员, I want to 与同事协同编辑和评论笔记, so that 团队可以共同构建知识库。

#### Acceptance Criteria

1. THE EKM_System SHALL support real-time collaborative editing of Notes in Team_Vault, with changes from multiple users visible within 500ms.
2. WHEN multiple users edit the same Note simultaneously, THE EKM_System SHALL display each user's cursor position and selection with a distinct color and username label.
3. THE EKM_System SHALL support inline comments on specific text ranges within a Note, with threaded replies.
4. WHEN a comment is added or resolved, THE EKM_System SHALL notify all users who have the Note open within 2 seconds.
5. THE EKM_System SHALL maintain a version history for each Note in Team_Vault, retaining all versions for at least 90 days.
6. WHEN a user views version history, THE EKM_System SHALL display a visual diff between any two selected versions.
7. THE EKM_System SHALL support @mention of team members in Note content and comments, triggering in-app and email notifications.

---

### Requirement 14: 私有化部署

**User Story:** As an Enterprise_Admin, I want to 在企业内网部署所有服务, so that 数据不离开企业边界。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Docker Compose configuration that deploys all server-side services (Sync_Service, authentication, database) on a single host for small deployments.
2. THE EKM_System SHALL provide a Kubernetes Helm chart for production-grade deployments with horizontal scaling support.
3. THE EKM_System SHALL support configuring all external service endpoints (auth server, sync server, plugin registry) to point to internal URLs.
4. WHEN deployed in air-gapped environments, THE EKM_System SHALL function fully without any outbound internet connectivity, including plugin installation from local registry.
5. THE EKM_System SHALL provide a web-based admin console for Enterprise_Admin to manage users, monitor system health, configure integrations, and view audit logs.
6. THE EKM_System SHALL expose health check endpoints (`/health/live` and `/health/ready`) for all server-side services, returning HTTP 200 when healthy.
7. THE EKM_System SHALL support TLS 1.2 and TLS 1.3 for all network communications, with configurable certificate paths.

---

### Requirement 15: Canvas（画布）

**User Story:** As a 知识工作者, I want to 在自由画布上排列笔记卡片和连线, so that 我可以进行视觉化思维整理。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Canvas view where users can place Note cards, text cards, image cards, and web bookmark cards as freely positionable elements.
2. WHEN a user drags a Note from the file explorer onto the Canvas, THE EKM_System SHALL create a Note card displaying the Note's rendered content.
3. THE EKM_System SHALL allow users to draw directed and undirected edges between Canvas elements with optional label text.
4. THE EKM_System SHALL persist Canvas state as a `.canvas` JSON file in the Vault directory.
5. WHEN a Canvas contains more than 500 elements, THE EKM_System SHALL use viewport culling to render only visible elements, maintaining 60fps interaction performance.

---

### Requirement 16: 全局命令面板

**User Story:** As a 键盘用户, I want to 通过命令面板快速执行任何操作, so that 我可以不依赖鼠标高效操作系统。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a command palette accessible via `Ctrl+P` / `Cmd+P` that lists all registered commands from core and plugins.
2. WHEN a user types in the command palette, THE EKM_System SHALL filter commands using fuzzy matching and display results within 50ms.
3. THE EKM_System SHALL support assigning custom keyboard shortcuts to any command via the settings panel.
4. WHEN a keyboard shortcut conflict is detected, THE EKM_System SHALL display a warning and require the user to resolve the conflict before saving.

---

### Requirement 17: 数据库与持久化

**User Story:** As a 系统架构师, I want to 系统使用合理的数据库架构持久化元数据, so that 索引和配置数据高效存储和查询。

#### Acceptance Criteria

1. THE EKM_System SHALL use SQLite (via better-sqlite3) as the local metadata database, storing the Link_Index, search index metadata, and plugin data.
2. THE EKM_System SHALL use PostgreSQL as the server-side relational database for user accounts, permissions, audit logs, and Team_Vault metadata.
3. THE EKM_System SHALL use a vector database (e.g., pgvector extension on PostgreSQL) for storing Note embeddings to support semantic search.
4. WHEN the local SQLite database is corrupted, THE EKM_System SHALL detect the corruption on startup, delete the corrupted database, and rebuild it from the source Markdown files within 60 seconds for Vaults up to 10,000 Notes.
5. THE EKM_System SHALL perform all SQLite write operations within a transaction, ensuring atomicity of multi-step index updates.

---

### Requirement 18: 性能与可靠性

**User Story:** As a 用户, I want to 系统在大型知识库下保持流畅响应, so that 我的工作效率不受性能瓶颈影响。

#### Acceptance Criteria

1. THE EKM_System SHALL achieve application cold start (from launch to interactive Vault) within 3 seconds on hardware with an SSD and 8GB RAM.
2. THE EKM_System SHALL maintain UI frame rate at 60fps during normal editing and navigation operations.
3. WHILE a Vault containing 50,000 Notes is open, THE EKM_System SHALL keep memory usage of the Renderer_Process below 512MB.
4. THE EKM_System SHALL lazy-load Note content, loading file content into memory only when a Note is opened or searched.
5. WHEN the EKM_System crashes unexpectedly, THE EKM_System SHALL recover unsaved Note content from a crash recovery buffer on next launch.
6. THE EKM_System SHALL implement debounced auto-save, persisting Note content to disk 2 seconds after the last keystroke.

---

### Requirement 19: 国际化与本地化

**User Story:** As a 全球企业用户, I want to 使用母语操作系统界面, so that 降低使用门槛并符合本地化合规要求。

#### Acceptance Criteria

1. THE EKM_System SHALL support the following UI languages at launch: Simplified Chinese (zh-CN), Traditional Chinese (zh-TW), English (en-US), Japanese (ja-JP).
2. THE EKM_System SHALL detect the OS locale on first launch and set the UI language accordingly, with manual override available in settings.
3. THE EKM_System SHALL support right-to-left (RTL) text rendering for future Arabic and Hebrew locale additions without requiring architectural changes.
4. WHEN a locale file is missing a translation key, THE EKM_System SHALL fall back to the English (en-US) string without displaying a raw key.

---

### Requirement 20: 导入与导出

**User Story:** As a 用户, I want to 从其他工具迁移数据并导出知识库, so that 数据不被锁定在单一平台。

#### Acceptance Criteria

1. THE EKM_System SHALL support importing Vaults from Obsidian (`.obsidian/` config detection), Notion (exported ZIP), Roam Research (JSON export), and plain Markdown folders.
2. WHEN importing from Notion, THE EKM_System SHALL convert Notion's internal link format to WikiLink syntax.
3. THE EKM_System SHALL support exporting a Vault or selected Notes to: a static HTML site, a PDF document, and a plain Markdown ZIP archive.
4. WHEN exporting to PDF, THE EKM_System SHALL render all Markdown formatting, images, and math expressions correctly in the output document.
5. THE EKM_System SHALL preserve all WikiLinks as relative hyperlinks in HTML export output.

---

### Requirement 21: 多标签页与分屏布局管理

**User Story:** As a 知识工作者, I want to 同时打开多个标签页并进行分屏布局, so that 我可以在不同笔记之间高效对比和参考。

#### Acceptance Criteria

1. THE EKM_System SHALL support opening multiple Notes simultaneously as Tabs within a single Workspace window.
2. WHEN a user middle-clicks a WikiLink or selects "Open in new tab", THE EKM_System SHALL open the target Note in a new Tab without closing the current Tab.
3. THE EKM_System SHALL support horizontal and vertical Split_View by allowing users to drag a Tab to the left, right, top, or bottom edge of the editor area.
4. WHEN a user selects "Open in new window" on a Note, THE EKM_System SHALL open the Note in a Popout_Window as an independent OS-level window sharing the same Vault context.
5. THE EKM_System SHALL persist the Tab layout and Split_View configuration to `.ekm/workspace.json` and restore it on next Vault open.
6. WHEN a Tab's Note is deleted from the Vault, THE EKM_System SHALL close the corresponding Tab and display a notification to the user.
7. THE EKM_System SHALL support reordering Tabs via drag-and-drop within the tab bar.

---

### Requirement 22: 大纲面板（Outline Panel）

**User Story:** As a 知识工作者, I want to 在大纲面板中查看当前笔记的标题层级, so that 我可以快速导航到长文档的任意章节。

#### Acceptance Criteria

1. THE EKM_System SHALL display an Outline_Panel that lists all ATX headings (H1–H6) of the currently active Note in hierarchical order.
2. WHEN the active Note is edited and a heading is added, removed, or modified, THE Outline_Panel SHALL update its content within 200ms.
3. WHEN a user clicks a heading entry in the Outline_Panel, THE EKM_System SHALL scroll the editor to the corresponding heading position within 100ms.
4. THE Outline_Panel SHALL visually indent heading entries according to their heading level (H1–H6), reflecting the document hierarchy.
5. WHEN the active Note contains no headings, THE Outline_Panel SHALL display a placeholder message indicating no outline is available.

---

### Requirement 23: 日记 / 每日笔记（Daily Notes）

**User Story:** As a 知识工作者, I want to 自动按日期创建每日笔记, so that 我可以持续记录日常工作和思考。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a "Open Today's Daily Note" command that creates or opens a Daily_Note for the current calendar date.
2. WHEN a Daily_Note is created, THE EKM_System SHALL generate the Note filename using a user-configurable date format (default: `YYYY-MM-DD`) and place it in a user-configurable folder (default: `Daily Notes/`).
3. WHEN a Daily_Note is created and a default Template is configured for Daily Notes, THE EKM_System SHALL populate the new Note with the Template content after variable substitution.
4. THE EKM_System SHALL provide navigation commands "Open Previous Daily Note" and "Open Next Daily Note" to traverse Daily Notes chronologically.
5. WHEN the user opens the EKM_System on a new day, THE EKM_System SHALL display a notification offering to open or create the Daily_Note for the current date.
6. THE EKM_System SHALL support a calendar widget in the sidebar that highlights dates for which a Daily_Note exists and navigates to the corresponding Note on click.

---

### Requirement 24: 模板系统（Templates）

**User Story:** As a 知识工作者, I want to 使用预定义模板快速创建结构化笔记, so that 我可以保持笔记格式一致并减少重复输入。

#### Acceptance Criteria

1. THE EKM_System SHALL support designating a folder as the Templates folder, from which all `.md` files are treated as Templates.
2. WHEN a user invokes "Insert Template", THE EKM_System SHALL display a list of available Templates and insert the selected Template's content at the current cursor position.
3. THE EKM_System SHALL support the following built-in Template variables: `{{date}}` (current date), `{{time}}` (current time), `{{title}}` (Note filename without extension), `{{author}}` (current user's display name).
4. WHEN a Template is inserted, THE EKM_System SHALL replace all recognized variable placeholders with their computed values before inserting the content.
5. IF a Template file references an undefined variable, THEN THE EKM_System SHALL leave the placeholder text unchanged and display a warning notification listing the unresolved variables.
6. THE EKM_System SHALL support assigning a default Template to a folder, so that all new Notes created within that folder are automatically populated with the assigned Template.

---

### Requirement 25: 快速切换（Quick Switcher）

**User Story:** As a 键盘用户, I want to 通过快速切换器跳转到任意笔记, so that 我可以不依赖文件浏览器高效导航知识库。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Quick_Switcher accessible via `Ctrl+O` / `Cmd+O` that accepts text input and searches Note titles across the current Vault.
2. WHEN a user types in the Quick_Switcher, THE EKM_System SHALL display matching Note titles using fuzzy matching and rank results by recency and relevance within 50ms.
3. WHEN a user selects a result in the Quick_Switcher and presses Enter, THE EKM_System SHALL open the selected Note in the current editor pane within 200ms.
4. WHEN a user selects a result and presses `Ctrl+Enter` / `Cmd+Enter`, THE EKM_System SHALL open the selected Note in a new Tab.
5. THE Quick_Switcher SHALL display the relative folder path of each result to disambiguate Notes with identical titles.
6. WHEN the Quick_Switcher input does not match any existing Note title, THE EKM_System SHALL offer an option to create a new Note with the entered text as the title.

---

### Requirement 26: 书签 / 收藏（Bookmarks）

**User Story:** As a 知识工作者, I want to 收藏常用笔记、文件夹和搜索查询, so that 我可以快速访问高频使用的知识资源。

#### Acceptance Criteria

1. THE EKM_System SHALL allow users to bookmark individual Notes, folders, and saved search queries, storing them in a persistent Bookmarks list.
2. WHEN a user right-clicks a Note or folder in the File_Explorer, THE EKM_System SHALL display a context menu option "Add to Bookmarks".
3. THE EKM_System SHALL display all Bookmarks in a dedicated Bookmarks panel in the sidebar, organized in user-defined groups.
4. WHEN a user clicks a Bookmark entry for a Note, THE EKM_System SHALL open the corresponding Note in the editor within 200ms.
5. WHEN a bookmarked Note is renamed or moved, THE EKM_System SHALL automatically update the Bookmark entry to reflect the new path and title.
6. WHEN a bookmarked Note is deleted, THE EKM_System SHALL remove the corresponding Bookmark entry and display a notification to the user.
7. THE EKM_System SHALL support reordering Bookmark entries and groups via drag-and-drop within the Bookmarks panel.

---

### Requirement 27: 文件浏览器（File Explorer）

**User Story:** As a 知识工作者, I want to 通过树形文件浏览器管理知识库目录结构, so that 我可以直观地组织和访问笔记文件。

#### Acceptance Criteria

1. THE EKM_System SHALL display a File_Explorer panel showing the Vault's folder and file hierarchy as an expandable/collapsible tree.
2. WHEN a user expands a folder node in the File_Explorer, THE EKM_System SHALL display its immediate children (subfolders and `.md` files) sorted by user-configurable order (name ascending, name descending, or last modified).
3. THE EKM_System SHALL support drag-and-drop reordering and moving of files and folders within the File_Explorer, updating the file system and Link_Index accordingly.
4. WHEN a user right-clicks a file or folder in the File_Explorer, THE EKM_System SHALL display a context menu with options: New Note, New Folder, Rename, Delete, Move to, Copy path, Add to Bookmarks, and Reveal in OS file manager.
5. THE EKM_System SHALL support multi-selection in the File_Explorer via `Ctrl+Click` / `Cmd+Click` and `Shift+Click`, enabling batch move and delete operations.
6. WHEN a file is created, renamed, or deleted externally (outside the EKM_System), THE File_Explorer SHALL reflect the change within 1 second via file system event watching.
7. THE EKM_System SHALL display Note word count and last modified date as optional columns in the File_Explorer.

---

### Requirement 28: 标签浏览器（Tag Pane）

**User Story:** As a 知识工作者, I want to 在标签浏览器中查看和过滤所有标签, so that 我可以通过标签体系快速定位相关笔记。

#### Acceptance Criteria

1. THE EKM_System SHALL display a Tag_Pane listing all Tags used across the current Vault, grouped by their hierarchical namespace (e.g., `#project/alpha` nested under `#project`).
2. WHEN a user clicks a Tag entry in the Tag_Pane, THE EKM_System SHALL open a search results view displaying all Notes containing that Tag.
3. THE Tag_Pane SHALL display the count of Notes associated with each Tag next to the Tag name.
4. WHEN a Note is edited and its Tags change, THE Tag_Pane SHALL update the Tag list and counts within 500ms.
5. THE EKM_System SHALL support renaming a Tag from the Tag_Pane context menu, updating the Tag in all affected Notes atomically.
6. THE Tag_Pane SHALL support filtering its own list by typing in a search box within the panel, using prefix matching.

---

### Requirement 29: 阅读模式 / 编辑模式 / 实时预览三态切换

**User Story:** As a 知识工作者, I want to 在阅读、编辑和实时预览三种模式间自由切换, so that 我可以根据当前任务选择最合适的视图。

#### Acceptance Criteria

1. THE EKM_System SHALL support three distinct view states for each open Note: Reading_Mode, Editing_Mode, and Live_Preview.
2. WHEN a user switches between view states, THE EKM_System SHALL transition to the selected state within 100ms while preserving the current scroll position.
3. WHILE in Reading_Mode, THE EKM_System SHALL render the Note as formatted HTML and disable all text editing interactions.
4. WHILE in Editing_Mode, THE EKM_System SHALL display the raw Markdown source in a plain text editor with syntax highlighting and no rendered preview.
5. WHILE in Live_Preview, THE EKM_System SHALL render Markdown formatting inline as the user types, displaying formatted output for completed syntax and raw source for the line currently being edited.
6. THE EKM_System SHALL provide a keyboard shortcut to cycle through the three view states (default: `Ctrl+E` / `Cmd+E` to toggle between Editing_Mode and Reading_Mode).
7. THE EKM_System SHALL persist the last-used view state per Note and restore it when the Note is reopened.

---

### Requirement 30: 属性全局管理（Properties）

**User Story:** As a 知识管理员, I want to 跨知识库查看所有 Frontmatter 字段的统计信息, so that 我可以了解元数据使用情况并规范属性命名。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Properties_Panel that aggregates all unique Frontmatter field names used across the current Vault and displays the count of Notes containing each field.
2. WHEN a user clicks a field name in the Properties_Panel, THE EKM_System SHALL display all Notes containing that field along with their field values in a list view.
3. THE Properties_Panel SHALL display the inferred data type (text, number, date, boolean, list) for each Frontmatter field based on the values observed across the Vault.
4. THE EKM_System SHALL support renaming a Frontmatter field globally from the Properties_Panel, updating the field name in all affected Notes atomically.
5. WHEN a Note's Frontmatter is modified, THE Properties_Panel SHALL update its aggregated statistics within 1 second.
6. THE Properties_Panel SHALL support filtering the field list by name using a search input with prefix matching.

---

### Requirement 31: 数据视图（Dataview）

**User Story:** As a 知识工作者, I want to 使用类 SQL 查询语法聚合笔记元数据, so that 我可以动态生成任务列表、项目索引等结构化视图。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Dataview module that evaluates fenced code blocks with language identifier `dataview` as queries against the Vault's Frontmatter metadata.
2. THE Dataview module SHALL support a query language with the following clauses: `TABLE`, `LIST`, `TASK`, `FROM` (source filter), `WHERE` (condition filter), `SORT` (ordering), and `LIMIT` (result count cap).
3. WHEN a Dataview query is rendered, THE EKM_System SHALL execute the query against the in-memory metadata index and display results within 500ms for Vaults up to 10,000 Notes.
4. WHEN the Vault metadata changes (Note added, deleted, or Frontmatter updated), THE EKM_System SHALL re-evaluate all visible Dataview queries and refresh their output within 2 seconds.
5. IF a Dataview query contains a syntax error, THEN THE EKM_System SHALL display a descriptive error message within the query block indicating the line and nature of the error.
6. THE Dataview module SHALL support computed fields using arithmetic and string expressions within query clauses.
7. FOR ALL valid Dataview queries, executing the same query twice against an unchanged Vault SHALL produce identical results (determinism invariant).

---

### Requirement 32: 看板视图（Kanban）

**User Story:** As a 项目管理者, I want to 将笔记以看板卡片形式按状态分组展示, so that 我可以直观管理任务和项目进度。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Kanban_Board view that groups Notes as cards into swimlanes based on a user-specified Frontmatter status field.
2. WHEN a user opens a Kanban_Board, THE EKM_System SHALL read the distinct values of the configured status field across all Notes in the specified scope and create one swimlane per value.
3. THE EKM_System SHALL support drag-and-drop of cards between swimlanes; WHEN a card is dropped into a new swimlane, THE EKM_System SHALL update the corresponding Note's Frontmatter status field within 500ms.
4. WHEN a user clicks a card in the Kanban_Board, THE EKM_System SHALL open the corresponding Note in the editor.
5. THE EKM_System SHALL support configuring which Frontmatter fields are displayed on each card (e.g., title, due date, assignee, tags).
6. THE EKM_System SHALL persist Kanban_Board configuration (status field, swimlane order, card display fields) as a `.kanban` file in the Vault directory.
7. WHEN a Note's status Frontmatter field is updated via the editor, THE Kanban_Board SHALL move the corresponding card to the correct swimlane within 1 second.

---

### Requirement 33: 时间线视图（Timeline）

**User Story:** As a 知识工作者, I want to 按日期字段将笔记排列在时间轴上, so that 我可以从时间维度回顾知识积累和项目历程。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Timeline_View that renders Notes as events on a horizontal or vertical time axis, positioned according to a user-specified Frontmatter date field.
2. WHEN a user opens the Timeline_View, THE EKM_System SHALL query all Notes containing the configured date field and render them in chronological order within 1 second for up to 1,000 Notes.
3. THE Timeline_View SHALL support zoom levels ranging from daily to yearly granularity, adjustable via scroll or pinch gesture.
4. WHEN a user clicks an event on the Timeline_View, THE EKM_System SHALL open the corresponding Note in the editor.
5. THE Timeline_View SHALL support filtering displayed Notes by Tag, folder, or a secondary Frontmatter field value.
6. WHEN a Note's date Frontmatter field is updated, THE Timeline_View SHALL reposition the corresponding event within 1 second.

---

### Requirement 34: 水印与 DLP（数据防泄漏）

**User Story:** As an Enterprise_Admin, I want to 在企业文档导出时自动嵌入用户水印, so that 可追溯文档来源并防止敏感信息泄露。

#### Acceptance Criteria

1. WHERE DLP is enabled by Enterprise_Admin, THE EKM_System SHALL embed a visible Watermark containing the exporting user's display name, email address, and export timestamp into all exported PDF documents.
2. WHERE DLP is enabled, THE EKM_System SHALL embed an invisible steganographic Watermark into exported HTML and PDF documents that encodes the user ID and export timestamp.
3. WHEN a user attempts to print a Note while DLP is enabled, THE EKM_System SHALL inject the Watermark into the print layout before sending to the printer.
4. THE EKM_System SHALL allow Enterprise_Admin to configure the Watermark text template, font size, opacity, and tile density via the admin console.
5. WHERE DLP is enabled, THE EKM_System SHALL log every export and print operation to the audit log with user ID, document path, operation type, and timestamp.
6. IF a user attempts to export a Note classified as "Confidential" or higher sensitivity level without DLP enabled, THEN THE EKM_System SHALL block the export and display a policy violation notification.

---

### Requirement 35: 知识库统计与分析仪表盘

**User Story:** As an Enterprise_Admin, I want to 查看知识库的使用统计和贡献者数据, so that 我可以评估知识管理效果并激励团队贡献。

#### Acceptance Criteria

1. THE EKM_System SHALL provide an Analytics_Dashboard displaying the following metrics: total Note count, total word count, Notes created per day (30-day trend), active contributors count, average links per Note, and orphan Note count (Notes with no incoming or outgoing links).
2. THE Analytics_Dashboard SHALL display a contributor leaderboard ranking team members by number of Notes created, Notes edited, and comments added within a configurable time range.
3. WHEN a user selects a time range filter on the Analytics_Dashboard, THE EKM_System SHALL refresh all displayed metrics within 3 seconds.
4. THE Analytics_Dashboard SHALL display a link density heatmap showing which folders have the highest and lowest average WikiLink counts per Note.
5. THE EKM_System SHALL export Analytics_Dashboard data as a CSV file upon user request.
6. THE Analytics_Dashboard SHALL update its metrics at most every 5 minutes to avoid excessive database load.

---

### Requirement 36: 工作流审批（Review/Approve）

**User Story:** As a 内容管理员, I want to 要求重要文档在发布前经过指定人审批, so that 确保对外发布的知识内容质量和准确性。

#### Acceptance Criteria

1. THE EKM_System SHALL support configuring an Approval_Workflow for designated folders, requiring at least one approver to approve a Note before it transitions to "Published" status.
2. WHEN a user submits a Note for review, THE EKM_System SHALL notify all configured approvers via in-app notification and email within 60 seconds.
3. WHEN an approver opens a Note pending review, THE EKM_System SHALL display the Note content with inline commenting enabled and action buttons for "Approve" and "Request Changes".
4. WHEN all required approvers have approved a Note, THE EKM_System SHALL automatically update the Note's Frontmatter `status` field to `published` and notify the author.
5. WHEN an approver requests changes, THE EKM_System SHALL notify the author with the reviewer's comments and revert the Note status to "Draft".
6. THE EKM_System SHALL maintain a complete audit trail of all review actions (submitted, approved, rejected, published) with timestamps and user IDs for each Note.
7. THE EKM_System SHALL support configuring approval rules with conditions: require all approvers, require any one approver, or require a minimum quorum count.

---

### Requirement 37: 知识库模板（Vault Template）

**User Story:** As an Enterprise_Admin, I want to 使用统一的知识库模板初始化新团队的知识库, so that 所有团队从一致的目录结构和规范文件开始工作。

#### Acceptance Criteria

1. THE EKM_System SHALL allow Enterprise_Admin to define a Vault_Template as a ZIP archive containing a predefined folder structure, starter Notes, Templates, and `.ekm/config.json` settings.
2. WHEN a user creates a new Team_Vault and selects a Vault_Template, THE EKM_System SHALL extract the template contents into the new Vault directory and apply the configuration settings.
3. THE EKM_System SHALL support storing Vault_Templates in the enterprise plugin registry, making them available to all users in the organization.
4. WHEN a Vault_Template is updated by Enterprise_Admin, THE EKM_System SHALL notify owners of Vaults created from that template and offer an optional migration to apply the updated structure.
5. THE EKM_System SHALL support parameterized Vault_Templates where placeholder values (e.g., team name, project code) are substituted during Vault initialization.
6. THE EKM_System SHALL allow Enterprise_Admin to mark specific Vault_Templates as mandatory for certain departments, automatically applying them when users in those departments create new Vaults.

---

### Requirement 38: 笔记加密（Note-level Encryption）

**User Story:** As a 知识工作者, I want to 对单个敏感笔记进行密码加密, so that 即使文件被他人访问也无法读取内容。

#### Acceptance Criteria

1. THE EKM_System SHALL support encrypting individual Notes with a user-provided password using AES-256-GCM encryption.
2. WHEN a user enables encryption on a Note, THE EKM_System SHALL encrypt the Note content and store it as a binary-encoded `.md` file with an encryption header marker.
3. WHEN a user opens an encrypted Note, THE EKM_System SHALL prompt for the password and decrypt the content in memory; THE EKM_System SHALL never write the decrypted content to disk outside the editor buffer.
4. IF a user provides an incorrect password for an encrypted Note, THEN THE EKM_System SHALL display an authentication failure message and deny access to the Note content.
5. THE EKM_System SHALL exclude encrypted Notes from full-text search indexing and Dataview queries to prevent content leakage through metadata.
6. THE EKM_System SHALL support changing the password of an encrypted Note by requiring the current password before accepting a new one.
7. WHEN an encrypted Note is synchronized via Sync_Service, THE EKM_System SHALL transmit only the encrypted ciphertext, ensuring the Sync_Service never has access to plaintext content.

---

### Requirement 39: 敏感内容扫描

**User Story:** As an Enterprise_Admin, I want to 自动检测知识库中包含个人身份信息的笔记, so that 防止 PII 数据在知识库中意外留存并满足合规要求。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a PII_Scanner that scans Note content for the following PII patterns: email addresses, phone numbers (international formats), national ID numbers (configurable per locale), credit card numbers, and IP addresses.
2. WHEN a Note is saved, THE PII_Scanner SHALL scan the Note content and flag it if PII patterns are detected, completing the scan within 1 second for Notes up to 100,000 characters.
3. WHEN PII is detected in a Note, THE EKM_System SHALL display an inline warning banner within the Note editor and add the Note to a "PII Alerts" list in the admin console.
4. THE EKM_System SHALL allow Enterprise_Admin to configure the PII_Scanner sensitivity level (strict, standard, relaxed) and add custom regex patterns for organization-specific sensitive data formats.
5. THE EKM_System SHALL generate a weekly PII scan summary report for Enterprise_Admin listing all Notes with detected PII, the PII types found, and the Note owners.
6. IF a user attempts to share a Note containing detected PII via a public share link, THEN THE EKM_System SHALL display a warning and require explicit confirmation before proceeding.

---

### Requirement 40: 合规导出报告

**User Story:** As an Enterprise_Admin, I want to 按时间范围导出操作审计日志, so that 满足企业合规审计和监管要求。

#### Acceptance Criteria

1. THE EKM_System SHALL support exporting the audit log as a CSV file containing: timestamp, user ID, user display name, operation type, resource path, source IP address, and operation result (success/failure).
2. THE EKM_System SHALL support exporting the audit log as a PDF Audit_Report with a formatted table, cover page including export metadata, and digital signature of the exporting admin.
3. WHEN generating an Audit_Report, THE EKM_System SHALL allow Enterprise_Admin to filter by time range, user, operation type, and resource path.
4. THE EKM_System SHALL complete the generation of an Audit_Report covering 90 days of logs within 60 seconds.
5. THE EKM_System SHALL retain audit logs for a minimum of 365 days, with configurable retention periods up to 7 years.
6. WHEN an Audit_Report is exported, THE EKM_System SHALL log the export action itself to the audit log, including the admin's user ID and the filter parameters used.

---

### Requirement 41: Webhook / 外部事件推送

**User Story:** As a 系统集成工程师, I want to 在笔记变更时触发外部系统的回调, so that 知识库可以与企业现有工具链自动联动。

#### Acceptance Criteria

1. THE EKM_System SHALL support configuring Webhooks that send HTTP POST requests to user-specified URLs when the following events occur: Note created, Note updated, Note deleted, Note published, and comment added.
2. WHEN a Webhook event is triggered, THE EKM_System SHALL deliver the HTTP POST request within 5 seconds of the triggering event.
3. THE EKM_System SHALL include the following fields in the Webhook payload: event type, timestamp, Vault ID, Note path, Note title, user ID, and a SHA-256 HMAC signature of the payload using a user-configured secret key.
4. IF a Webhook delivery fails (non-2xx HTTP response or connection timeout), THEN THE EKM_System SHALL retry delivery with exponential backoff for up to 3 attempts over 30 minutes.
5. THE EKM_System SHALL maintain a Webhook delivery log showing the last 100 delivery attempts per Webhook, including status code, response time, and error details.
6. THE EKM_System SHALL support filtering Webhook triggers by folder path and Note Tag, so that only matching Notes trigger the Webhook.
7. THE EKM_System SHALL allow Enterprise_Admin to configure Webhooks at the organization level, applying them across all Team_Vaults.

---

### Requirement 42: REST API / OpenAPI

**User Story:** As a 第三方开发者, I want to 通过标准 REST API 读写知识库内容, so that 我可以将企业知识库集成到自定义工具和工作流中。

#### Acceptance Criteria

1. THE EKM_System SHALL expose a REST_API with an OpenAPI 3.0 specification document available at `/api/v1/openapi.json`.
2. THE REST_API SHALL support the following operations: list Vaults, list Notes in a folder, get Note content (Markdown and rendered HTML), create Note, update Note content, delete Note, get Note metadata, and search Notes.
3. THE REST_API SHALL use OAuth 2.0 Bearer token authentication, with tokens issued by the EKM_System's authentication service.
4. WHEN an API request is received with an invalid or expired token, THE REST_API SHALL return HTTP 401 with a descriptive error body.
5. THE REST_API SHALL enforce the same Permission_Manager rules as the desktop client, returning HTTP 403 when the authenticated user lacks permission for the requested operation.
6. THE REST_API SHALL support pagination for list endpoints using `limit` and `cursor` query parameters, with a maximum page size of 100 items.
7. THE REST_API SHALL apply rate limiting of 1,000 requests per minute per API token, returning HTTP 429 with a `Retry-After` header when the limit is exceeded.
8. FOR ALL REST_API write operations, the response SHALL include the updated resource representation, ensuring clients can verify the applied changes without a subsequent GET request (round-trip consistency).

---

### Requirement 43: Git 集成

**User Story:** As a 开发者, I want to 在知识库中使用内置 Git 版本控制, so that 我可以追踪笔记变更历史并与团队协作管理文档版本。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Git_Integration module that initializes a Git repository in the Vault root directory if one does not already exist.
2. THE EKM_System SHALL support the following Git operations via the UI: stage changes, commit with a message, push to remote, pull from remote, and view diff of uncommitted changes.
3. WHEN a user configures a remote repository URL and credentials, THE EKM_System SHALL support push and pull operations to GitHub, GitLab, Gitea, and any standard Git remote over HTTPS or SSH.
4. THE EKM_System SHALL support auto-commit on a user-configurable schedule (e.g., every 30 minutes or on each Note save), with an auto-generated commit message including the list of changed files.
5. WHEN a user views the Git history for a Note, THE EKM_System SHALL display a list of commits that modified the file, with commit hash, author, timestamp, and message.
6. WHEN a user selects two commits in the Git history, THE EKM_System SHALL display a visual line-by-line diff of the Note content between those commits.
7. IF a Git pull operation results in a merge conflict, THEN THE EKM_System SHALL display the conflicting files and provide a three-way merge editor to resolve conflicts.

---

### Requirement 44: 第三方存储后端

**User Story:** As an Enterprise_Admin, I want to 将知识库存储在企业现有的云存储服务上, so that 数据管理符合企业 IT 策略并利用现有存储基础设施。

#### Acceptance Criteria

1. THE EKM_System SHALL support configuring the following Storage_Backend providers as the Vault storage layer: Amazon S3 (and S3-compatible services), WebDAV, and Microsoft OneDrive.
2. WHEN a Storage_Backend is configured, THE EKM_System SHALL transparently read and write Note files to the remote storage, presenting the same file system abstraction to the editor as local storage.
3. THE EKM_System SHALL maintain a local cache of recently accessed Notes to support offline editing when the Storage_Backend is unreachable.
4. WHEN the Storage_Backend connection is restored after an offline period, THE EKM_System SHALL synchronize local changes to the remote storage and resolve conflicts using the Conflict_Resolver.
5. THE EKM_System SHALL encrypt all data in transit to the Storage_Backend using TLS 1.2 or higher.
6. WHEN a Storage_Backend operation fails (authentication error, quota exceeded, network timeout), THE EKM_System SHALL display a descriptive error notification and retain unsaved changes in the local cache.
7. THE EKM_System SHALL support configuring Storage_Backend credentials using environment variables or a secrets manager integration, avoiding plaintext credential storage in configuration files.

---

### Requirement 45: Web Clipper

**User Story:** As a 知识工作者, I want to 通过浏览器插件一键将网页内容保存到知识库, so that 我可以高效采集外部信息并整合到个人知识体系中。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Web_Clipper browser extension for Google Chrome and Mozilla Firefox that allows users to save web page content to a configured Vault.
2. WHEN a user activates the Web_Clipper on a web page, THE EKM_System SHALL offer the following clipping modes: full page, selected text, article (main content only), and URL bookmark.
3. WHEN a clip is saved, THE EKM_System SHALL convert the web page content to Markdown format, preserving headings, lists, bold/italic formatting, and images (saved as attachments).
4. THE Web_Clipper SHALL automatically populate the clipped Note's Frontmatter with: `source_url`, `clipped_date`, `page_title`, and `author` (if detectable from page metadata).
5. THE Web_Clipper SHALL allow users to select the destination folder, add Tags, and apply a Template before saving the clip.
6. WHEN the Web_Clipper saves a clip, THE EKM_System SHALL display a confirmation notification in the browser with a link to open the saved Note.
7. THE Web_Clipper SHALL support authentication with the EKM_System using OAuth 2.0, requiring the user to authorize the extension once per device.

---

### Requirement 46: 移动端客户端（iOS / Android）

**User Story:** As a 移动办公用户, I want to 在手机和平板上访问和编辑知识库, so that 我可以随时随地记录和查阅知识。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Mobile_Client application for iOS (version 16.0 and above) and Android (version 10.0 and above).
2. THE Mobile_Client SHALL support viewing and editing Notes with Markdown rendering, WikiLink navigation, and Tag filtering.
3. THE Mobile_Client SHALL synchronize with the Sync_Service, reflecting changes made on other devices within 30 seconds when connected to the internet.
4. THE Mobile_Client SHALL support offline editing, queuing changes locally and synchronizing when connectivity is restored.
5. THE Mobile_Client SHALL support biometric authentication (Face ID, Touch ID, fingerprint) as an additional access control layer.
6. WHEN a user creates a new Note on the Mobile_Client, THE EKM_System SHALL support voice-to-text input using the device's native speech recognition API.
7. THE Mobile_Client SHALL support sharing content from other mobile apps (e.g., browser, PDF reader) to the EKM_System via the OS share sheet, creating a new Note with the shared content.
8. THE Mobile_Client SHALL display a widget on the device home screen showing the user's most recently accessed Notes and a quick-capture button.

---

### Requirement 47: Web 端访问（Browser-based viewer/editor）

**User Story:** As a 企业用户, I want to 通过浏览器访问和编辑知识库, so that 我可以在没有安装桌面客户端的设备上使用知识管理功能。

#### Acceptance Criteria

1. THE EKM_System SHALL provide a Web_Client accessible via a standard web browser (Chrome 110+, Firefox 110+, Safari 16+, Edge 110+) without requiring any browser extension or plugin installation.
2. THE Web_Client SHALL support the core editing features: Markdown editing with Live_Preview, WikiLink navigation, Tag management, full-text search, and file explorer.
3. THE Web_Client SHALL authenticate users via the same SSO and OAuth 2.0 / OIDC mechanisms as the desktop client.
4. THE Web_Client SHALL enforce the same Permission_Manager rules as the desktop client, restricting access based on the authenticated user's role.
5. WHEN a user edits a Note in the Web_Client, THE EKM_System SHALL auto-save changes to the server within 2 seconds of the last keystroke.
6. THE Web_Client SHALL support real-time collaborative editing with the same CRDT-based conflict resolution as the desktop client, displaying co-editor cursors within 500ms.
7. THE Web_Client SHALL be responsive and support viewport widths from 768px (tablet) to 2560px (wide desktop), adapting the sidebar and editor layout accordingly.
8. WHEN the Web_Client loses network connectivity, THE EKM_System SHALL display a connectivity status indicator and buffer unsaved changes locally in the browser's IndexedDB for up to 24 hours.
