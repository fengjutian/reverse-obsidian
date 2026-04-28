import { EditorView, keymap, EditorView as CodeMirrorView } from "@codemirror/view";
import { EditorState, StateEffect, StateField, Extension } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  foldGutter,
  foldKeymap,
} from "@codemirror/language";
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";

const lightTheme = CodeMirrorView.theme({
  "&": {
    backgroundColor: "#ffffff",
    color: "#1a1a2e",
  },
  ".cm-content": {
    caretColor: "#1a73e8",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#1a73e8",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "#d2e3fc",
  },
  ".cm-gutters": {
    backgroundColor: "#f5f5f5",
    color: "#6c7086",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#e8e8e8",
  },
  ".cm-activeLine": {
    backgroundColor: "#f5f5f5",
  },
  ".cm-line": {
    color: "#1a1a2e",
  },
});

export interface EditorConfig {
  parent: HTMLElement;
  value?: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  onAutoSave?: () => void;
  onImagePaste?: (file: File) => Promise<string>;
  readOnly?: boolean;
  vimMode?: boolean;
  autoSaveMs?: number;
}

export type ViewMode = "editing" | "reading" | "live-preview";

export class MarkdownEditor {
  private view: EditorView;
  private onChange?: (content: string) => void;
  private onSave?: () => void;
  private onAutoSave?: () => void;
  private onImagePaste?: (file: File) => Promise<string>;
  private autoSaveMs: number;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private noteList: string[] = [];
  private tagList: string[] = [];
  private currentMode: ViewMode = "live-preview";
  private previewEl: HTMLElement | null = null;
  private containerEl: HTMLElement;

  constructor(config: EditorConfig) {
    this.onChange = config.onChange;
    this.onSave = config.onSave;
    this.onAutoSave = config.onAutoSave;
    this.onImagePaste = config.onImagePaste;
    this.autoSaveMs = config.autoSaveMs ?? 2000;
    this.containerEl = config.parent;

    const extensions: Extension[] = [
      EditorView.lineWrapping,
      markdown({ codeLanguages: languages }),
      oneDark,
      // Task 8.1: history depth >= 200
      history({ minDepth: 200 }),
      // Task 8.1: fold gutter for headings and code blocks
      foldGutter(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab,
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            this.onSave?.();
            return true;
          },
        },
      ]),
      // Task 8.2: WikiLink and tag autocomplete
      autocompletion({
        override: [this.wikiLinkCompletion.bind(this), this.tagCompletion.bind(this)],
        activateOnTyping: true,
      }),
      // Task 8.3: image paste handler
      EditorView.domEventHandlers({
        paste: (event: ClipboardEvent, view: EditorView) => {
          return this.handlePaste(event, view);
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          if (this.onChange) {
            const content = update.state.doc.toString();
            this.onChange(content);
          }
          // Task 8.5: debounced autosave
          this.scheduleAutoSave();
        }
      }),
      config.readOnly ? EditorState.readOnly.of(true) : [],
    ];

    // Task 8.4: optional vim mode
    if (config.vimMode) {
      // vim extension is loaded dynamically to keep it optional
      this.loadVimMode(extensions);
    }

    const state = EditorState.create({
      doc: config.value || "",
      extensions,
    });

    this.view = new EditorView({
      state,
      parent: config.parent,
    });
  }

  // Task 8.4: load vim mode dynamically (requires @replit/codemirror-vim to be installed)
  private loadVimMode(_extensions: Extension[]): void {
    // Dynamically import vim extension — silently skip if not installed
    // Install with: pnpm add @replit/codemirror-vim
    const vimPkg = "@replit/codemirror-vim";
    import(/* @vite-ignore */ vimPkg).then((mod: { vim?: () => unknown }) => {
      if (this.view && typeof mod.vim === "function") {
        this.view.dispatch({
          effects: StateEffect.appendConfig.of(mod.vim() as Extension),
        });
      }
    }).catch(() => {
      // vim package not installed — silently skip
    });
  }

  // Task 8.2: WikiLink autocomplete
  private wikiLinkCompletion(context: CompletionContext): CompletionResult | null {
    // Match [[ followed by optional text
    const match = context.matchBefore(/\[\[[^\]]*$/);
    if (!match) return null;

    const typed = match.text.slice(2); // strip [[
    const options = this.noteList
      .filter((n) => n.toLowerCase().includes(typed.toLowerCase()))
      .map((n) => ({
        label: n,
        apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
          view.dispatch({
            changes: { from, to, insert: `${n}]]` },
          });
        },
      }));

    return {
      from: match.from + 2,
      options,
      validFor: /^[^\]]*$/,
    };
  }

  // Task 8.2: tag autocomplete
  private tagCompletion(context: CompletionContext): CompletionResult | null {
    const match = context.matchBefore(/#\w*$/);
    if (!match) return null;

    const typed = match.text.slice(1); // strip #
    const options = this.tagList
      .filter((t) => t.toLowerCase().startsWith(typed.toLowerCase()))
      .map((t) => ({
        label: `#${t}`,
        apply: t,
      }));

    if (options.length === 0) return null;

    return {
      from: match.from + 1,
      options,
      validFor: /^\w*$/,
    };
  }

  // Task 8.3: image paste handler
  private handlePaste(event: ClipboardEvent, view: EditorView): boolean {
    if (!this.onImagePaste || !event.clipboardData) return false;

    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return false;

    const file = imageItem.getAsFile();
    if (!file) return false;

    event.preventDefault();

    this.onImagePaste(file).then((path) => {
      const filename = file.name || "image";
      const insertion = `![${filename}](${path})`;
      const pos = view.state.selection.main.head;
      view.dispatch({
        changes: { from: pos, insert: insertion },
        selection: { anchor: pos + insertion.length },
      });
    });

    return true;
  }

  // Task 8.5: schedule debounced autosave
  private scheduleAutoSave(): void {
    if (!this.onAutoSave) return;
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      this.onAutoSave?.();
    }, this.autoSaveMs);
  }

  // Task 8.1: set view mode
  setMode(mode: ViewMode): void {
    this.currentMode = mode;
    const editorDom = this.view.dom;

    switch (mode) {
      case "editing":
        editorDom.style.display = "";
        if (this.previewEl) this.previewEl.style.display = "none";
        break;
      case "reading":
        editorDom.style.display = "none";
        if (this.previewEl) this.previewEl.style.display = "";
        break;
      case "live-preview":
      default:
        editorDom.style.display = "";
        if (this.previewEl) this.previewEl.style.display = "";
        break;
    }
  }

  // Allow caller to register the preview element for mode switching
  setPreviewElement(el: HTMLElement): void {
    this.previewEl = el;
    // Apply current mode immediately
    this.setMode(this.currentMode);
  }

  // Task 8.2: update note list for WikiLink autocomplete
  setNoteList(notes: string[]): void {
    this.noteList = notes;
  }

  // Task 8.2: update tag list for tag autocomplete
  setTagList(tags: string[]): void {
    this.tagList = tags;
  }

  setTheme(theme: "dark" | "light"): void {
    const themeExtension = theme === "dark" ? oneDark : lightTheme;
    this.view.dispatch({
      effects: StateEffect.appendConfig.of(themeExtension),
    });
  }

  // Task 8.6: parse YAML frontmatter
  getFrontmatter(): Record<string, unknown> | null {
    const content = this.view.state.doc.toString();
    // Must start with ---
    if (!content.startsWith("---")) return null;

    const endIndex = content.indexOf("\n---", 3);
    if (endIndex === -1) return null;

    const yamlBlock = content.slice(3, endIndex).trim();
    if (!yamlBlock) return null;

    const result: Record<string, unknown> = {};
    for (const line of yamlBlock.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const rawValue = line.slice(colonIdx + 1).trim();
      if (!key) continue;

      // Parse value: boolean, number, or string
      if (rawValue === "true") {
        result[key] = true;
      } else if (rawValue === "false") {
        result[key] = false;
      } else if (rawValue !== "" && !isNaN(Number(rawValue))) {
        result[key] = Number(rawValue);
      } else {
        // Strip surrounding quotes if present
        result[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    }

    return result;
  }

  getValue(): string {
    return this.view.state.doc.toString();
  }

  setValue(content: string): void {
    const transaction = this.view.state.update({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: content,
      },
    });
    this.view.dispatch(transaction);
  }

  focus(): void {
    this.view.focus();
  }

  destroy(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
    }
    this.view.destroy();
  }
}
