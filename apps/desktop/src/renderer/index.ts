type SearchResult = {
  path: string;
  title: string;
  score: number;
  snippet: string;
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
    };
  }
}

const noteListEl = document.querySelector<HTMLUListElement>("#note-list");
const notePathInput = document.querySelector<HTMLInputElement>("#note-path");
const editorEl = document.querySelector<HTMLTextAreaElement>("#editor");
const saveBtn = document.querySelector<HTMLButtonElement>("#save-btn");
const searchInput = document.querySelector<HTMLInputElement>("#search-input");
const previewEl = document.querySelector<HTMLElement>("#preview");
const backlinksEl = document.querySelector<HTMLUListElement>("#backlinks");

let activePath = "";
let allNotes: string[] = [];
let previewTimer: number | undefined;

async function refreshNotes(filter = "") {
  if (!noteListEl) return;
  allNotes = await window.ekm.listNotes();
  const keyword = filter.trim().toLowerCase();
  const notes = keyword ? allNotes.filter((n) => n.toLowerCase().includes(keyword)) : allNotes;

  noteListEl.innerHTML = "";
  for (const path of notes) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = `note-item ${path === activePath ? "active" : ""}`;
    btn.textContent = path;
    btn.addEventListener("click", async () => {
      await openNote(path);
    });
    li.appendChild(btn);
    noteListEl.appendChild(li);
  }

  if (!notes.length) {
    noteListEl.innerHTML = '<li class="empty">没有匹配的笔记</li>';
  }
}

async function openNote(path: string) {
  activePath = path;
  const content = await window.ekm.readNote(path);
  if (notePathInput) notePathInput.value = path;
  if (editorEl) editorEl.value = content;
  await Promise.all([refreshPreview(), refreshBacklinks(path), refreshNotes(searchInput?.value ?? "")]);
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
  await Promise.all([refreshNotes(searchInput?.value ?? ""), refreshPreview(), refreshBacklinks(path)]);
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
    refreshNotes(searchInput.value).catch((error) => console.error(error));
  });
}

saveBtn?.addEventListener("click", () => {
  saveNote().catch((error) => console.error(error));
});

setupPreviewLinkNavigation();
setupEditorLivePreview();
setupSearchFilter();

refreshNotes()
  .then(async () => {
    if (allNotes.length > 0) {
      await openNote(allNotes[0]);
      return;
    }

    if (notePathInput) notePathInput.value = "inbox/first-note.md";
    if (editorEl) editorEl.value = "# Welcome\n\n这是一个更接近 Obsidian 的原型。\n\n试试创建 [[second-note]]。";
    await refreshPreview();
    await refreshBacklinks("inbox/first-note.md");
  })
  .catch((error) => console.error(error));

export {};
