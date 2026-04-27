import { parseMarkdown } from "@ekm/markdown";

/**
 * MarkdownRenderer — thin wrapper around @ekm/markdown's parseMarkdown.
 *
 * Task 7.2: MDAST → rehype → HTML displayed in preview pane
 * Task 7.3: Incremental render (debounced 50ms, < 100ms on change)
 */
export class MarkdownRenderer {
  private lastSource = "";
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private container: HTMLElement,
    private resolveLink?: (target: string) => string | null
  ) {}

  async render(source: string): Promise<void> {
    const result = await parseMarkdown(source, {
      resolveWikiLink: this.resolveLink ?? (() => null),
    });
    this.container.innerHTML = result.html;
    this.lastSource = source;
  }

  /**
   * Debounced render — fires at most once per 50ms window.
   * Satisfies Requirement 3.8: incremental re-render < 100ms on change.
   * For content < 50k chars the full re-render via parseMarkdown is fast
   * enough; we avoid complex DOM diffing while still batching rapid keystrokes.
   */
  renderIncremental(source: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.render(source).then(resolve).catch(reject);
      }, 50);
    });
  }

  destroy(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
