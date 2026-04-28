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

import { MarkdownEditor } from "./editor.js";
import { MarkdownRenderer } from "./markdown-renderer.js";

const noteListEl = document.querySelector<HTMLUListElement>("#note-list");
const notePathInput = document.querySelector<HTMLInputElement>("#note-path");
const editorEl = document.querySelector<HTMLDivElement>("#editor");
const saveBtn = document.querySelector<HTMLButtonElement>("#save-btn");
const newNoteBtn = document.querySelector<HTMLButtonElement>("#new-note-btn");
const searchInput = document.querySelector<HTMLInputElement>("#search-input");
const previewEl = document.querySelector<HTMLElement>("#preview");
const backlinksEl = document.querySelector<HTMLUListElement>("#backlinks");
const cmdBtn = document.querySelector<HTMLButtonElement>("#cmd-btn");
const paletteEl = document.querySelector<HTMLElement>("#command-palette");
const paletteInput = document.querySelector<HTMLInputElement>("#palette-input");
const paletteList = document.querySelector<HTMLUListElement>("#palette-list");
const globalSearchInput = document.querySelector<HTMLInputElement>("#search-global-input");
const globalSearchResults = document.querySelector<HTMLUListElement>("#search-results");
const modeToggleBtn = document.querySelector<HTMLButtonElement>("#mode-toggle-btn");
const contextMenuEl = document.querySelector<HTMLElement>("#context-menu");
const themeToggleBtn = document.querySelector<HTMLButtonElement>("#theme-toggle-btn");

let activePath = "";
let allNotes: string[] = [];
let previewTimer: number | undefined;
let foldedDirs = new Set<string>();
let paletteCandidates: string[] = [];
let contextMenuTargetPath: string | null = null;
let currentTheme: "dark" | "light" = "dark";

type ViewMode = "split" | "edit" | "preview";
let viewMode: ViewMode = "split";

let markdownEditor: MarkdownEditor | null = null;
let markdownRenderer: MarkdownRenderer | null = null;

function setViewMode(mode: ViewMode) {
  viewMode = mode;
  const editorContainer = document.querySelector(".editor-container");
  if (!editorContainer) return;

  editorContainer.classList.remove("mode-split", "mode-edit", "mode-preview");
  editorContainer.classList.add(`mode-${mode}`);
}

function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = currentTheme === "dark" ? "🌙" : "☀️";
  }
  if (markdownEditor) {
    markdownEditor.setTheme(currentTheme);
  }
}

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
      const btn = document.createElement("div");
      btn.className = `tree-item ${child.fullPath === activePath ? "active" : ""}`;
      btn.innerHTML = `<span class="tree-item-icon">📄</span><span>${child.name}</span>`;
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
    const header = document.createElement("div");
    header.className = "tree-item";
    const folded = foldedDirs.has(child.fullPath);
    header.innerHTML = `<span class="tree-item-icon">${folded ? "📁" : "📂"}</span><span>${child.name}</span>`;
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
      nested.className = "nested";
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
    noteListEl.innerHTML = '<li class="empty-state">No matching notes</li>';
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
  if (markdownEditor) {
    markdownEditor.setValue(content);
  }
  await Promise.all([refreshPreview(), refreshBacklinks(path)]);
  renderTree();
}

async function saveNote() {
  const path = notePathInput?.value.trim() || activePath;
  if (!path) {
    alert("Please enter note path first");
    return;
  }

  const content = markdownEditor?.getValue() ?? "";
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
  const source = markdownEditor?.getValue() ?? "";

  if (markdownRenderer) {
    await markdownRenderer.render(source);
    return;
  }

  try {
    const html = await window.ekm.renderNote(source);
    previewEl.innerHTML = html;
  } catch {
    previewEl.innerHTML = "";
  }
}

async function refreshPreviewIncremental() {
  if (!previewEl) return;
  const source = markdownEditor?.getValue() ?? "";

  if (markdownRenderer) {
    await markdownRenderer.renderIncremental(source);
    return;
  }

  await refreshPreview();
}

async function refreshBacklinks(path: string) {
  if (!backlinksEl) return;
  const backlinks = await window.ekm.getBacklinks(path);
  backlinksEl.innerHTML = "";

  if (!backlinks.length) {
    backlinksEl.innerHTML = '<li class="empty-state">No backlinks</li>';
    return;
  }

  for (const p of backlinks) {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = p;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openNote(p).catch((error) => console.error(error));
    });
    li.appendChild(link);
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
      alert(`Cannot open linked note: ${path}`);
    });
  });
}

function setupEditorLivePreview() {
  if (editorEl && !markdownEditor) {
    if (previewEl) {
      markdownRenderer = new MarkdownRenderer(previewEl, (target) => {
        const mdPath = target.endsWith(".md") ? target : `${target}.md`;
        return allNotes.includes(mdPath) ? `/${mdPath}` : null;
      });
    }

    markdownEditor = new MarkdownEditor({
      parent: editorEl,
      value: "",
      onChange: () => {
        if (previewTimer) window.clearTimeout(previewTimer);
        previewTimer = window.setTimeout(() => {
          refreshPreviewIncremental().catch((error) => console.error(error));
        }, 300);
      },
      onSave: () => {
        saveNote().catch((error) => console.error(error));
      },
    });
  }
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
  const confirmed = confirm(`Confirm delete note "${path}"? This action cannot be undone.`);
  if (!confirmed) return;
  try {
    await window.ekm.deleteNote?.(path);
  } catch (error) {
    console.error(error);
    alert("Delete failed.");
    return;
  }
  hideContextMenu();
  await refreshNotes();
  if (activePath === path) {
    activePath = "";
    if (markdownEditor) markdownEditor.setValue("");
    if (previewEl) previewEl.innerHTML = "";
    if (backlinksEl) backlinksEl.innerHTML = "";
  }
}

async function renameNote(oldPath: string) {
  if (!oldPath) return;
  const newPathRaw = prompt("Enter new path (e.g., inbox/renamed.md):", oldPath);
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
    alert("Rename failed.");
    hideContextMenu();
  }
}

async function moveNote(oldPath: string) {
  if (!oldPath) return;
  const lastSlash = oldPath.lastIndexOf("/");
  const name = lastSlash >= 0 ? oldPath.slice(lastSlash + 1) : oldPath;
  const newPathRaw = prompt("Enter new directory (e.g., archive/):", lastSlash >= 0 ? oldPath.slice(0, lastSlash) : "");
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
    alert("Move failed.");
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
    paletteList.innerHTML = '<li class="empty-state">No matching files</li>';
    return;
  }

  for (const path of candidates.slice(0, 30)) {
    const li = document.createElement("li");
    li.className = "palette-item";
    li.innerHTML = `<span class="palette-item-icon">📄</span><span class="palette-item-text">${path}</span>`;
    li.addEventListener("click", () => {
      closeCommandPalette();
      openNote(path).catch((error) => console.error(error));
    });
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
      const first = paletteList?.querySelector<HTMLLIElement>(".palette-item");
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
      globalSearchResults.innerHTML = '<li class="empty-state">Enter keyword to search</li>';
      return;
    }

    try {
      const results = await window.ekm.search(query, 20);
      globalSearchResults.innerHTML = "";

      if (!results.length) {
        globalSearchResults.innerHTML = '<li class="empty-state">No results found</li>';
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
      globalSearchResults.innerHTML = '<li class="empty-state">Search failed</li>';
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

themeToggleBtn?.addEventListener("click", () => {
  toggleTheme();
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

refreshNotes()
  .then(async () => {
    if (allNotes.length > 0) {
      await openNote(allNotes[0]);
      return;
    }

    if (notePathInput) notePathInput.value = "inbox/first-note.md";
    const welcomeContent = "# Welcome\n\nNow supports file tree and command palette (Ctrl/Cmd+P).\n\nTry creating [[second-note]].";
    if (markdownEditor) {
      markdownEditor.setValue(welcomeContent);
    }
    await refreshPreview();
    await refreshBacklinks("inbox/first-note.md");
  })
  .catch((error) => console.error(error));

export {};