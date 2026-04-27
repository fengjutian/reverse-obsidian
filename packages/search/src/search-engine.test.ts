import { describe, it, expect, beforeEach } from "vitest";
import { EkmSearchEngine } from "./search-engine.js";
import type { SearchDocument } from "./search-engine.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<SearchDocument> & { path: string }): SearchDocument {
  return {
    title: overrides.path.replace(/\.md$/, "").split("/").pop() ?? overrides.path,
    content: "",
    tags: [],
    ...overrides,
  };
}

// ── Task 9.1 — Basic search ────────────────────────────────────────────────

describe("EkmSearchEngine — basic search (9.1)", () => {
  let engine: EkmSearchEngine;

  beforeEach(() => {
    engine = new EkmSearchEngine();
    engine.addDocument(makeDoc({ path: "notes/alpha.md", title: "Alpha Note", content: "The quick brown fox" }));
    engine.addDocument(makeDoc({ path: "notes/beta.md", title: "Beta Note", content: "Lazy dog jumps over" }));
    engine.addDocument(makeDoc({ path: "notes/gamma.md", title: "Gamma Note", content: "Quick brown fox again" }));
  });

  it("returns empty array for empty query", () => {
    expect(engine.query("")).toEqual([]);
    expect(engine.query("   ")).toEqual([]);
  });

  it("finds documents by content substring", () => {
    const results = engine.query("quick");
    expect(results.length).toBeGreaterThanOrEqual(2);
    const paths = results.map((r) => r.path);
    expect(paths).toContain("notes/alpha.md");
    expect(paths).toContain("notes/gamma.md");
  });

  it("finds documents by title", () => {
    const results = engine.query("Alpha");
    expect(results[0].path).toBe("notes/alpha.md");
  });

  it("respects limit option", () => {
    const results = engine.query("Note", { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("supports tag:name operator", () => {
    engine.addDocument(makeDoc({ path: "notes/tagged.md", title: "Tagged", content: "some content", tags: ["typescript"] }));
    const results = engine.query("tag:typescript");
    expect(results.length).toBe(1);
    expect(results[0].path).toBe("notes/tagged.md");
  });

  it("supports path:folder operator", () => {
    engine.addDocument(makeDoc({ path: "work/project.md", title: "Project", content: "work stuff" }));
    const results = engine.query("path:work");
    expect(results.length).toBe(1);
    expect(results[0].path).toBe("work/project.md");
  });

  it('supports "phrase" exact match', () => {
    const results = engine.query('"quick brown fox"');
    const paths = results.map((r) => r.path);
    expect(paths).toContain("notes/alpha.md");
    expect(paths).toContain("notes/gamma.md");
    expect(paths).not.toContain("notes/beta.md");
  });

  it("supports /regex/ operator", () => {
    const results = engine.query("/fox/");
    const paths = results.map((r) => r.path);
    expect(paths).toContain("notes/alpha.md");
    expect(paths).toContain("notes/gamma.md");
  });

  it("supports AND operator", () => {
    const results = engine.query("quick AND fox");
    const paths = results.map((r) => r.path);
    expect(paths).toContain("notes/alpha.md");
    expect(paths).toContain("notes/gamma.md");
    expect(paths).not.toContain("notes/beta.md");
  });

  it("supports OR operator", () => {
    const results = engine.query("Alpha OR Beta");
    const paths = results.map((r) => r.path);
    expect(paths).toContain("notes/alpha.md");
    expect(paths).toContain("notes/beta.md");
  });

  it("supports NOT operator", () => {
    const results = engine.query("Note NOT Alpha");
    const paths = results.map((r) => r.path);
    expect(paths).not.toContain("notes/alpha.md");
    expect(paths).toContain("notes/beta.md");
  });
});

// ── Task 9.2 — Highlighting and sorting ───────────────────────────────────

describe("EkmSearchEngine — highlighting and sorting (9.2)", () => {
  let engine: EkmSearchEngine;

  beforeEach(() => {
    engine = new EkmSearchEngine();
    engine.addDocument(makeDoc({
      path: "a.md", title: "A", content: "hello world",
      modifiedAt: "2024-01-10T00:00:00Z", createdAt: "2024-01-01T00:00:00Z",
    }));
    engine.addDocument(makeDoc({
      path: "b.md", title: "B", content: "hello there",
      modifiedAt: "2024-01-20T00:00:00Z", createdAt: "2024-01-05T00:00:00Z",
    }));
    engine.addDocument(makeDoc({
      path: "c.md", title: "C", content: "hello again",
      modifiedAt: "2024-01-15T00:00:00Z", createdAt: "2024-01-03T00:00:00Z",
    }));
  });

  it("wraps matched terms in <mark> tags in snippet", () => {
    const results = engine.query("hello");
    for (const r of results) {
      expect(r.snippet).toContain("<mark>");
    }
  });

  it("sorts by modified (newest first)", () => {
    const results = engine.query("hello", { sort: "modified" });
    expect(results[0].path).toBe("b.md");
    expect(results[1].path).toBe("c.md");
    expect(results[2].path).toBe("a.md");
  });

  it("sorts by created (newest first)", () => {
    const results = engine.query("hello", { sort: "created" });
    expect(results[0].path).toBe("b.md");
    expect(results[1].path).toBe("c.md");
    expect(results[2].path).toBe("a.md");
  });

  it("sorts by relevance by default (title match scores higher)", () => {
    engine.addDocument(makeDoc({ path: "exact.md", title: "hello", content: "something else" }));
    const results = engine.query("hello", { sort: "relevance" });
    expect(results[0].path).toBe("exact.md");
  });
});

// ── Task 9.3 — Incremental index update ───────────────────────────────────

describe("EkmSearchEngine — incremental update (9.3)", () => {
  it("updateByPath replaces existing document", () => {
    const engine = new EkmSearchEngine();
    engine.addDocument(makeDoc({ path: "note.md", title: "Old Title", content: "old content" }));
    engine.updateByPath("note.md", makeDoc({ path: "note.md", title: "New Title", content: "new content" }));

    const results = engine.query("new content");
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("New Title");

    const old = engine.query("old content");
    expect(old.length).toBe(0);
  });

  it("removeByPath removes document from index", () => {
    const engine = new EkmSearchEngine();
    engine.addDocument(makeDoc({ path: "note.md", title: "Removable", content: "unique content xyz" }));
    engine.removeByPath("note.md");

    const results = engine.query("unique content xyz");
    expect(results.length).toBe(0);
  });
});

// ── Task 9.4 — Quick Switcher ──────────────────────────────────────────────

describe("EkmSearchEngine — quickSwitch (9.4)", () => {
  let engine: EkmSearchEngine;

  beforeEach(() => {
    engine = new EkmSearchEngine();
    engine.addDocument(makeDoc({ path: "notes/meeting-notes.md", title: "Meeting Notes" }));
    engine.addDocument(makeDoc({ path: "notes/project-plan.md", title: "Project Plan" }));
    engine.addDocument(makeDoc({ path: "notes/daily-2024.md", title: "Daily 2024" }));
    engine.addDocument(makeDoc({ path: "notes/readme.md", title: "README" }));
  });

  it("returns empty array for empty query", () => {
    expect(engine.quickSwitch("")).toEqual([]);
  });

  it("finds notes by title substring", () => {
    const results = engine.quickSwitch("meet");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe("notes/meeting-notes.md");
  });

  it("respects limit parameter", () => {
    const results = engine.quickSwitch("notes", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns results synchronously (no async)", () => {
    // quickSwitch must be synchronous — if it returned a Promise this would fail
    const result = engine.quickSwitch("plan");
    expect(Array.isArray(result)).toBe(true);
  });

  it("ranks exact title match highest", () => {
    const results = engine.quickSwitch("README");
    expect(results[0].path).toBe("notes/readme.md");
  });

  it("is fast enough for 10,000 documents (< 50ms)", () => {
    const bigEngine = new EkmSearchEngine();
    for (let i = 0; i < 10_000; i++) {
      bigEngine.addDocument(makeDoc({ path: `notes/note-${i}.md`, title: `Note ${i}` }));
    }
    const start = performance.now();
    bigEngine.quickSwitch("Note 999");
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});

// ── Performance — 10,000 docs query < 500ms ────────────────────────────────

describe("EkmSearchEngine — performance (9.1)", () => {
  it("queries 10,000 documents in < 500ms", () => {
    const engine = new EkmSearchEngine();
    for (let i = 0; i < 10_000; i++) {
      engine.addDocument(makeDoc({
        path: `notes/note-${i}.md`,
        title: `Note ${i}`,
        content: `This is the content of note number ${i} with some random text.`,
        tags: [`tag-${i % 50}`],
      }));
    }
    const start = performance.now();
    const results = engine.query("content note");
    const elapsed = performance.now() - start;
    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});
