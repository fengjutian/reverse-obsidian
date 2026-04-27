import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";

export interface EditorConfig {
  parent: HTMLElement;
  value?: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
}

export class MarkdownEditor {
  private view: EditorView;
  private onChange?: (content: string) => void;
  private onSave?: () => void;

  constructor(config: EditorConfig) {
    this.onChange = config.onChange;
    this.onSave = config.onSave;

    const extensions = [
      EditorView.lineWrapping,
      markdown({ codeLanguages: languages }),
      oneDark,
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
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
      EditorView.updateListener.of((update) => {
        if (update.docChanged && this.onChange) {
          const content = update.state.doc.toString();
          this.onChange(content);
        }
      }),
      config.readOnly ? EditorState.readOnly.of(true) : [],
    ];

    const state = EditorState.create({
      doc: config.value || "",
      extensions,
    });

    this.view = new EditorView({
      state,
      parent: config.parent,
    });
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
    this.view.destroy();
  }
}
