import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { normalizeToPosixPath } from "./utils.js";

export interface FileChangeEvent {
  type: "add" | "change" | "unlink";
  path: string; // relative POSIX path within notesRoot
}

export type FileChangeHandler = (events: FileChangeEvent[]) => Promise<void>;

export class VaultFileWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEvents: Map<string, FileChangeEvent> = new Map();
  private readonly debounceMs: number;

  constructor(
    private readonly notesRoot: string,
    private readonly handler: FileChangeHandler,
    debounceMs = 200,
  ) {
    this.debounceMs = debounceMs;
  }

  start(): void {
    if (this.watcher) return;

    this.watcher = watch(this.notesRoot, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      // Only handle .md files, ignore .tmp files (from atomic writes)
      if (!filename.endsWith(".md") || filename.endsWith(".tmp")) return;

      // On recursive fs.watch, filename is already relative to the watched dir
      const relativePath = normalizeToPosixPath(filename);

      // Deduplicate: last event for a given path wins within the debounce window
      const event: FileChangeEvent = {
        type: eventType === "rename" ? "change" : "change",
        path: relativePath,
      };
      this.pendingEvents.set(relativePath, event);

      this.scheduleFlush();
    });
  }

  async stop(): Promise<void> {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Flush any remaining pending events
    if (this.pendingEvents.size > 0) {
      await this.flush();
    }
  }

  private scheduleFlush(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flush();
    }, this.debounceMs);
  }

  private async flush(): Promise<void> {
    if (this.pendingEvents.size === 0) return;

    const events = Array.from(this.pendingEvents.values());
    this.pendingEvents.clear();

    await this.handler(events);
  }
}
