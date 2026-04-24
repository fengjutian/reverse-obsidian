type SearchResult = {
  path: string;
  title: string;
  score: number;
  snippet: string;
};

type TreeNode = {
  name: string;
  fullPath: string;
  isFile: boolean;
  children: Map<string, TreeNode>;
};

declare global {
  interface Window {
    ekm: {
      listNotes(): Promise<string[]>;
      readNote(path: string): Promise<string>;
      writeNote(path: string, content: string): Promise<void>;
      renderNote(markdown: string): Promise<string>;
      getBacklinks(path: string): Promise<string[]>;
      search(keyword: string, limit?: number): Promise<SearchResult[]>;
      deleteNote?(path: string): Promise<void>;
    };
  }
}


const noteListEl = document.querySelector<HTMLUListElement>("#note-list");
const notePathInput = document.querySelector<HTMLInputElement>("#note-path");
const editorEl = document.querySelector<HTMLTextAreaElement>("#editor");
const saveBtn = document.querySelector<HTMLButtonElement>("#save-btn");
const newNoteBtn = document.querySelector<HTMLButtonElement>("#new-note-btn");
const searchInput = document.querySelector<HTMLInputElement>("#search-input");
const previewEl = document.querySelector<HTMLElement>("#preview");
const backlinksEl = document.querySelector<HTMLUListElement>("#backlinks");
const cmdBtn = document.querySelector<HTMLButtonElement>("#cmd-btn");
const paletteEl = document.querySelector<HTMLElement>("#command-palette");
const paletteInput = document.querySelector<HTMLInputElement>("#palette-input");
const paletteList = document.querySelector<HTMLUListElement>("#palette-list");
const appShell = document.querySelector<HTMLElement>(".app-shell");
const gutterLeft = document.querySelector<HTMLElement>(".gutter-left");
const gutterRight = document.querySelector<HTMLElement>(".gutter-right");
const globalSearchInput = document.querySelector<HTMLInputElement>("#search-global-input");
const globalSearchResults = document.querySelector<HTMLUListElement>("#search-results");
const modeToggleBtn = document.querySelector<HTMLButtonElement>("#mode-toggle-btn");
const contextMenuEl = document.querySelector<HTMLElement>("#context-menu");



let activePath = "";
let allNotes: string[] = [];
let previewTimer: number | undefined;
let foldedDirs = new Set<string>();
let paletteCandidates: string[] = [];
let contextMenuTargetPath: string | null = null;

type ViewMode = "split" | "edit" | "preview";
let viewMode: ViewMode = "split";

function setViewMode(mode: ViewMode) {
  viewMode = mode;
  if (!appShell) return;
  appShell.classList.remove("mode-split", "mode-edit", "mode-preview");
  appShell.classList.add(`mode-${mode}`);
}

const MIN_LEFT = 200;
const MIN_RIGHT = 200;

let isDragging: "left" | "right" | null = null;
let startX = 0;
let startCols: [number, number] = [0, 0];

function createRootNode(): TreeNode {
  return {
    name: "root",
    fullPath: "",
    isFile: false,
    children: new Map<string, TreeNode>()
  };
}

function buildTree(paths: string[]): TreeNode {
  const root = createRootNode();

  for (const path of paths) {
    const segments = path.split("/");
    let current = root;
    let running = "";

    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i] ?? "";
      running = running ? `${running}/${seg}` : seg;
      const isFile = i === segments.length - 1;

      if (!current.children.has(seg)) {
        current.children.set(seg, {
          name: seg,
          fullPath: running,
          isFile,
          children: new Map<string, TreeNode>()
        });
      }

      current = current.children.get(seg)!;
      if (isFile) current.isFile = true;
    }
  }

  return root;
}

function orderedChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

function renderTreeNode(node: TreeNode, container: HTMLElement): void {
  const children = orderedChildren(node);

  for (const child of children) {
    if (child.isFile) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = `note-item ${child.fullPath === activePath ? "active" : ""}`;
      btn.textContent = child.name;
      btn.title = child.fullPath;
      btn.addEventListener("click", async () => {
        await openNote(child.fullPath);
      });
      btn.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        showContextMenu(event.clientX, event.clientY, child.fullPath);
      });
      li.appendChild(btn);
      container.appendChild(li);
      continue;
    }

    const li = document.createElement("li");
    li.className = "folder-node";

    const header = document.createElement("button");
    header.className = "folder-toggle";
    const folded = foldedDirs.has(child.fullPath);
    header.innerHTML = `<span class="folder-chevron">${folded ? "▸" : "▾"}</span><span>${child.name}</span>`;
    header.addEventListener("click", () => {
      if (foldedDirs.has(child.fullPath)) {
        foldedDirs.delete(child.fullPath);
      } else {
        foldedDirs.add(child.fullPath);
      }
      renderTree();
    });

    li.appendChild(header);

    if (!folded) {
      const nested = document.createElement("ul");
      nested.className = "note-tree-nested";
      renderTreeNode(child, nested);
      li.appendChild(nested);
    }

    container.appendChild(li);
  }
}

function renderTree(): void {
  if (!noteListEl) return;
  const filter = (searchInput?.value ?? "").trim().toLowerCase();
  const filtered = filter
    ? allNotes.filter((n) => n.toLowerCase().includes(filter))
    : [...allNotes];

  noteListEl.innerHTML = "";
  if (!filtered.length) {
    noteListEl.innerHTML = '<li class="empty">没有匹配的笔记</li>';
    return;
  }

  const tree = buildTree(filtered);
  renderTreeNode(tree, noteListEl);
}

async function refreshNotes() {
  allNotes = await window.ekm.listNotes();
  paletteCandidates = [...allNotes];
  renderTree();
}

async function openNote(path: string) {
  activePath = path;
  const content = await window.ekm.readNote(path);
  if (notePathInput) notePathInput.value = path;
  if (editorEl) editorEl.value = content;
  await Promise.all([refreshPreview(), refreshBacklinks(path)]);
  renderTree();
}

async function saveNote() {
  const path = notePathInput?.value.trim() || activePath;
  if (!path) {
    alert("请先输入笔记路径");
    return;
  }

  const content = editorEl?.value ?? "";
  await window.ekm.writeNote(path, content);
  activePath = path;
  await Promise.all([refreshNotes(), refreshPreview(), refreshBacklinks(path)]);
}

async function createNote(path: string, initialContent?: string) {
  const cleaned = path.trim();
  if (!cleaned) return;
  const mdPath = cleaned.endsWith(".md") ? cleaned : `${cleaned}.md`;
  const title = mdPath.split("/").pop() ?? "Untitled";
  const content = initialContent ?? `# ${title.replace(/\.md$/, "")}\n\n`;
  await window.ekm.writeNote(mdPath, content);
  await refreshNotes();
  await openNote(mdPath);
}


async function refreshPreview() {
  if (!previewEl) return;
  const markdown = editorEl?.value ?? "";
  const html = await window.ekm.renderNote(markdown);
  previewEl.innerHTML = html;
}

async function refreshBacklinks(path: string) {
  if (!backlinksEl) return;
  const backlinks = await window.ekm.getBacklinks(path);
  backlinksEl.innerHTML = "";

  if (!backlinks.length) {
    backlinksEl.innerHTML = '<li class="empty">暂无反向链接</li>';
    return;
  }

  for (const p of backlinks) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = p;
    btn.addEventListener("click", () => {
      openNote(p).catch((error) => console.error(error));
    });
    li.appendChild(btn);
    backlinksEl.appendChild(li);
  }
}

function toNotePathFromWikiHref(href: string): string {
  const cleaned = href.trim().replace(/^\/+/, "");
  return cleaned.endsWith(".md") ? cleaned : `${cleaned}.md`;
}

function setupPreviewLinkNavigation() {
  previewEl?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest("a.wikilink") as HTMLAnchorElement | null;
    if (!link) return;

    event.preventDefault();
    const path = toNotePathFromWikiHref(link.getAttribute("href") ?? "");
    openNote(path).catch((error) => {
      console.error(error);
      alert(`无法打开链接笔记：${path}`);
    });
  });
}

function setupEditorLivePreview() {
  editorEl?.addEventListener("input", () => {
    if (previewTimer) window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      refreshPreview().catch((error) => console.error(error));
    }, 120);
  });
}

function setupSearchFilter() {
  searchInput?.addEventListener("input", () => {
    renderTree();
  });
}

function hideContextMenu() {
  contextMenuEl?.classList.add("hidden");
  contextMenuTargetPath = null;
}

function showContextMenu(x: number, y: number, path: string) {
  contextMenuTargetPath = path;
  if (!contextMenuEl) return;
  contextMenuEl.classList.remove("hidden");
  const rect = contextMenuEl.getBoundingClientRect();
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const left = Math.min(x, winW - rect.width - 12);
  const top = Math.min(y, winH - rect.height - 12);
  contextMenuEl.style.left = `${left}px`;
  contextMenuEl.style.top = `${top}px`;
}

async function deleteNote(path: string) {
  if (!path) return;
  const confirmed = confirm(`确认删除笔记「${path}」？此操作不可撤销。`);
  if (!confirmed) return;
  try {
    await window.ekm.deleteNote?.(path);
  } catch (error) {
    console.error(error);
    alert("删除失败。");
    return;
  }
  hideContextMenu();
  await refreshNotes();
  if (activePath === path) {
    activePath = "";
    if (editorEl) editorEl.value = "";
    if (previewEl) previewEl.innerHTML = "";
    if (backlinksEl) backlinksEl.innerHTML = "";
  }
}


async function renameNote(oldPath: string) {
  if (!oldPath) return;
  const newPathRaw = prompt("输入新路径（例如 inbox/renamed.md）：", oldPath);
  if (!newPathRaw || newPathRaw === oldPath) {
    hideContextMenu();
    return;
  }
  const newPath = newPathRaw.endsWith(".md") ? newPathRaw : `${newPathRaw}.md`;
  try {
    const content = await window.ekm.readNote(oldPath);
    await window.ekm.writeNote(newPath, content);
    await window.ekm.deleteNote?.(oldPath);
    hideContextMenu();
    await refreshNotes();
    if (activePath === oldPath) {
      await openNote(newPath);
    }
  } catch (error) {
    console.error(error);
    alert("重命名失败。");
    hideContextMenu();
  }
}

async function moveNote(oldPath: string) {
  if (!oldPath) return;
  const lastSlash = oldPath.lastIndexOf("/");
  const name = lastSlash >= 0 ? oldPath.slice(lastSlash + 1) : oldPath;
  const newPathRaw = prompt("输入新目录（例如 archive/）：", lastSlash >= 0 ? oldPath.slice(0, lastSlash) : "");
  if (newPathRaw === null) {
    hideContextMenu();
    return;
  }
  const targetDir = newPathRaw.trim() || "";
  const newPath = targetDir ? `${targetDir}/${name}` : name;
  if (newPath === oldPath) {
    hideContextMenu();
    return;
  }
  try {
    const content = await window.ekm.readNote(oldPath);
    await window.ekm.writeNote(newPath, content);
    await window.ekm.deleteNote?.(oldPath);
    hideContextMenu();
    await refreshNotes();
    if (activePath === oldPath) {
      await openNote(newPath);
    }
  } catch (error) {
    console.error(error);
    alert("移动失败。");
    hideContextMenu();
  }
}

function setupContextMenu() {
  document.addEventListener("click", (e) => {
    const isInsideMenu = e.target === contextMenuEl || contextMenuEl?.contains(e.target as Node);
    if (!isInsideMenu) hideContextMenu();
  });
  contextMenuEl?.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!btn || !contextMenuTargetPath) return;
    const action = btn.getAttribute("data-action");
    if (action === "open") {
      await openNote(contextMenuTargetPath);
      hideContextMenu();
    } else if (action === "rename") {
      await renameNote(contextMenuTargetPath);
    } else if (action === "move") {
      await moveNote(contextMenuTargetPath);
    } else if (action === "delete") {
      await deleteNote(contextMenuTargetPath);
    }
  });
}


function openCommandPalette() {
  if (!paletteEl || !paletteInput) return;
  paletteEl.classList.remove("hidden");
  paletteInput.value = "";
  renderPaletteList("");
  setTimeout(() => paletteInput.focus(), 0);
}

function closeCommandPalette() {
  paletteEl?.classList.add("hidden");
}

function renderPaletteList(filter: string) {
  if (!paletteList) return;
  const key = filter.trim().toLowerCase();
  const candidates = key
    ? paletteCandidates.filter((p) => p.toLowerCase().includes(key))
    : paletteCandidates;

  paletteList.innerHTML = "";

  if (!candidates.length) {
    paletteList.innerHTML = '<li class="empty">没有匹配的文件</li>';
    return;
  }

  for (const path of candidates.slice(0, 30)) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "palette-item";
    btn.textContent = path;
    btn.addEventListener("click", () => {
      closeCommandPalette();
      openNote(path).catch((error) => console.error(error));
    });
    li.appendChild(btn);
    paletteList.appendChild(li);
  }
}

function setupCommandPalette() {
  cmdBtn?.addEventListener("click", () => openCommandPalette());

  paletteEl?.addEventListener("click", (event) => {
    if (event.target === paletteEl) closeCommandPalette();
  });

  paletteInput?.addEventListener("input", () => {
    renderPaletteList(paletteInput.value);
  });

  paletteInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommandPalette();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const first = paletteList?.querySelector<HTMLButtonElement>(".palette-item");
      first?.click();
    }
  });

  window.addEventListener("keydown", (event) => {
    const isCmdP = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p";
    if (isCmdP) {
      event.preventDefault();
      openCommandPalette();
      return;
    }

    if (event.key === "Escape" && paletteEl && !paletteEl.classList.contains("hidden")) {
      event.preventDefault();
      closeCommandPalette();
    }
  });
}

function setupGlobalSearch() {
  if (!globalSearchInput || !globalSearchResults) return;

  globalSearchInput.addEventListener("input", async () => {
    const query = globalSearchInput.value.trim();
    if (!query) {
      globalSearchResults.innerHTML = '<li class="empty">输入关键词搜索</li>';
      return;
    }

    try {
      const results = await window.ekm.search(query, 20);
      globalSearchResults.innerHTML = "";

      if (!results.length) {
        globalSearchResults.innerHTML = '<li class="empty">没有找到匹配结果</li>';
        return;
      }

      for (const result of results) {
        const li = document.createElement("li");
        li.className = "search-result-item";
        li.innerHTML = `
          <div class="search-result-title">${result.title}</div>
          <div class="search-result-path">${result.path}</div>
          <div class="search-result-snippet">${result.snippet}</div>
        `;
        li.addEventListener("click", () => {
          openNote(result.path).catch((error) => console.error(error));
        });
        globalSearchResults.appendChild(li);
      }
    } catch (error) {
      console.error(error);
      globalSearchResults.innerHTML = '<li class="empty">搜索失败</li>';
    }
  });

  globalSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      globalSearchInput.blur();
    }
  });
}

saveBtn?.addEventListener("click", () => {
  saveNote().catch((error) => console.error(error));
});

setupPreviewLinkNavigation();
setupEditorLivePreview();
setupSearchFilter();
setupCommandPalette();
setupGlobalSearch();
setupContextMenu();
setupGutters();
modeToggleBtn?.addEventListener("click", () => {
  const next: ViewMode[] = ["split", "edit", "preview"];
  const curIdx = next.indexOf(viewMode);
  const nextMode = next[(curIdx + 1) % next.length];
  setViewMode(nextMode);
});



newNoteBtn?.addEventListener("click", () => {
  const base = (notePathInput?.value || "inbox/new-note.md").trim();
  const target = base || "inbox/new-note.md";
  createNote(target).catch((error) => console.error(error));
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    saveNote().catch((error) => console.error(error));
  }
  if (event.key.toLowerCase() === "n" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    const base = (notePathInput?.value || "inbox/new-note.md").trim();
    const target = base || "inbox/new-note.md";
    createNote(target).catch((error) => console.error(error));
  }
  if (event.key.toLowerCase() === "e" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    const next: ViewMode[] = ["split", "edit", "preview"];
    const curIdx = next.indexOf(viewMode);
    const nextMode = next[(curIdx + 1) % next.length];
    setViewMode(nextMode);
  }
  if (event.key.toLowerCase() === "f" && (event.ctrlKey || event.metaKey) && event.shiftKey) {
    event.preventDefault();
    globalSearchInput?.focus();
  }
});


function setupGutters() {
  if (!appShell) return;
  const getCols = (): [number, number] => {
    const style = getComputedStyle(appShell);
    const cols = style.gridTemplateColumns.split(" ");
    // pattern: left | gutter | center | gutter | right
    return [parseInt(cols[0]), parseInt(cols[4])];
  };

  const setCols = (left: number, right: number) => {
    const clampedLeft = Math.max(MIN_LEFT, Math.min(left, 520));
    const clampedRight = Math.max(MIN_RIGHT, Math.min(right, 640));
    appShell.style.gridTemplateColumns = `${clampedLeft}px 6px 1fr 6px ${clampedRight}px`;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const [left0, right0] = startCols;
    if (isDragging === "left") {
      setCols(left0 + dx, right0);
    } else {
      setCols(left0, right0 - dx);
    }
  };
  const onMouseUp = () => {
    if (!isDragging) return;
    startCols = getCols();
    isDragging = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  const beginDrag = (side: "left" | "right", e: MouseEvent) => {
    isDragging = side;
    startX = e.clientX;
    startCols = getCols();
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  gutterLeft?.addEventListener("mousedown", (e) => beginDrag("left", e));
  gutterRight?.addEventListener("mousedown", (e) => beginDrag("right", e));
}



refreshNotes()
  .then(async () => {
    if (allNotes.length > 0) {
      await openNote(allNotes[0]);
      return;
    }

    if (notePathInput) notePathInput.value = "inbox/first-note.md";
    if (editorEl) editorEl.value = "# Welcome\n\n现在支持目录树和命令面板（Ctrl/Cmd+P）。\n\n试试创建 [[second-note]]。";
    await refreshPreview();
    await refreshBacklinks("inbox/first-note.md");
  })
  .catch((error) => console.error(error));

export {};

