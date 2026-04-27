import type { SearchResult } from "@ekm/shared-types";

export interface SearchDocument {
  path: string;
  title: string;
  content: string;
  tags?: string[];
  frontmatter?: Record<string, unknown>;
  /** ISO 8601 — used for sort by modified */
  modifiedAt?: string;
  /** ISO 8601 — used for sort by created */
  createdAt?: string;
}

export interface SearchOptions {
  limit?: number;
  sort?: "relevance" | "modified" | "created";
}

// ── Query parsing ──────────────────────────────────────────────────────────

interface ParsedQuery {
  type: "regex" | "tag" | "path" | "phrase" | "boolean" | "simple";
  regex?: RegExp;
  value?: string;
  operator?: "AND" | "OR" | "NOT";
  left?: ParsedQuery;
  right?: ParsedQuery;
  operand?: ParsedQuery;
}

function tokenise(query: string): string[] {
  const tokens: string[] = [];
  const re = /"[^"]*"|\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

function parseToken(token: string): ParsedQuery {
  if (token.startsWith("/") && token.endsWith("/") && token.length > 2) {
    try {
      return { type: "regex", regex: new RegExp(token.slice(1, -1), "i") };
    } catch {
      return { type: "simple", value: token };
    }
  }
  if (token.startsWith('"') && token.endsWith('"')) {
    return { type: "phrase", value: token.slice(1, -1).toLowerCase() };
  }
  if (token.toLowerCase().startsWith("tag:")) {
    return { type: "tag", value: token.slice(4).toLowerCase() };
  }
  if (token.toLowerCase().startsWith("path:")) {
    return { type: "path", value: token.slice(5).toLowerCase() };
  }
  return { type: "simple", value: token.toLowerCase() };
}

function parseTokens(tokens: string[]): ParsedQuery | null {
  if (tokens.length === 0) return null;

  const orIdx = tokens.lastIndexOf("OR");
  if (orIdx > 0 && orIdx < tokens.length - 1) {
    const left = parseTokens(tokens.slice(0, orIdx));
    const right = parseTokens(tokens.slice(orIdx + 1));
    if (left && right) return { type: "boolean", operator: "OR", left, right };
  }

  const andIdx = tokens.lastIndexOf("AND");
  if (andIdx > 0 && andIdx < tokens.length - 1) {
    const left = parseTokens(tokens.slice(0, andIdx));
    const right = parseTokens(tokens.slice(andIdx + 1));
    if (left && right) return { type: "boolean", operator: "AND", left, right };
  }

  if (tokens[0] === "NOT" && tokens.length > 1) {
    const operand = parseTokens(tokens.slice(1));
    if (operand) return { type: "boolean", operator: "NOT", operand };
  }

  if (tokens.length > 1) {
    const left = parseToken(tokens[0]);
    const right = parseTokens(tokens.slice(1));
    if (right) return { type: "boolean", operator: "AND", left, right };
    return left;
  }

  return parseToken(tokens[0]);
}

// ── Matching ───────────────────────────────────────────────────────────────

function matchDoc(query: ParsedQuery, doc: SearchDocument): boolean {
  switch (query.type) {
    case "regex":
      return query.regex!.test(doc.title) || query.regex!.test(doc.content);
    case "tag":
      return (doc.tags ?? []).some((t) => t.toLowerCase() === query.value!);
    case "path":
      return doc.path.toLowerCase().includes(query.value!);
    case "phrase":
    case "simple": {
      const v = query.value!;
      return doc.title.toLowerCase().includes(v) || doc.content.toLowerCase().includes(v);
    }
    case "boolean":
      if (query.operator === "AND") return matchDoc(query.left!, doc) && matchDoc(query.right!, doc);
      if (query.operator === "OR") return matchDoc(query.left!, doc) || matchDoc(query.right!, doc);
      if (query.operator === "NOT") return !matchDoc(query.operand!, doc);
      return false;
    default:
      return false;
  }
}

// ── Scoring ────────────────────────────────────────────────────────────────

function scoreDoc(keyword: string, doc: SearchDocument): number {
  const kw = keyword.toLowerCase();
  const titleLower = doc.title.toLowerCase();
  const contentLower = doc.content.toLowerCase();
  let score = 0;

  if (titleLower === kw) score += 100;
  else if (titleLower.startsWith(kw)) score += 60;
  else if (titleLower.includes(kw)) score += 40;

  let idx = contentLower.indexOf(kw);
  let count = 0;
  while (idx !== -1) { count++; idx = contentLower.indexOf(kw, idx + kw.length); }
  score += Math.min(50, count * 5);

  if ((doc.tags ?? []).some((t) => t.toLowerCase().includes(kw))) score += 20;
  return score;
}

// ── Highlighting ───────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSnippet(keyword: string, text: string, radius = 80): string {
  if (!keyword || !text) return text.slice(0, radius * 2);
  const kw = keyword.toLowerCase();
  const lower = text.toLowerCase();
  const hit = lower.indexOf(kw);
  const start = hit === -1 ? 0 : Math.max(0, hit - radius);
  const end = hit === -1 ? Math.min(text.length, radius * 2) : Math.min(text.length, hit + kw.length + radius);
  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  snippet = snippet.replace(new RegExp(escapeRegex(keyword), "gi"), (m) => `<mark>${m}</mark>`);
  return snippet;
}

// ── Fuzzy title match ──────────────────────────────────────────────────────

function fuzzyScore(query: string, title: string): number {
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800;
  if (t.includes(q)) return 600;
  let qi = 0, score = 0, consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { qi++; consecutive++; score += 10 + consecutive * 2; }
    else { consecutive = 0; }
  }
  return qi < q.length ? 0 : score;
}

// ── EkmSearchEngine ────────────────────────────────────────────────────────

export class EkmSearchEngine {
  private docs = new Map<string, SearchDocument>();

  addDocument(doc: SearchDocument): void {
    this.docs.set(doc.path, doc);
  }

  updateByPath(path: string, doc: SearchDocument): void {
    this.docs.set(path, doc);
  }

  removeByPath(path: string): void {
    this.docs.delete(path);
  }

  query(keyword: string, options: SearchOptions = {}): SearchResult[] {
    const { limit = 20, sort = "relevance" } = options;
    const trimmed = keyword.trim();
    if (!trimmed) return [];

    const tokens = tokenise(trimmed);
    const parsed = parseTokens(tokens);
    if (!parsed) return [];

    const plainKeyword = tokens
      .filter((t) => t !== "AND" && t !== "OR" && t !== "NOT")
      .map((t) => t.replace(/^["\/]|["\/]$/g, "").replace(/^(tag:|path:)/i, ""))
      .join(" ");

    const results: SearchResult[] = [];
    for (const doc of this.docs.values()) {
      if (!matchDoc(parsed, doc)) continue;
      results.push({
        path: doc.path,
        title: doc.title,
        score: scoreDoc(plainKeyword, doc),
        snippet: buildSnippet(plainKeyword, doc.content),
      });
    }

    if (sort === "modified") {
      results.sort((a, b) => (this.docs.get(b.path)?.modifiedAt ?? "").localeCompare(this.docs.get(a.path)?.modifiedAt ?? ""));
    } else if (sort === "created") {
      results.sort((a, b) => (this.docs.get(b.path)?.createdAt ?? "").localeCompare(this.docs.get(a.path)?.createdAt ?? ""));
    } else {
      results.sort((a, b) => b.score - a.score);
    }

    return results.slice(0, limit);
  }

  quickSwitch(query: string, limit = 10): SearchResult[] {
    const q = query.trim();
    if (!q) return [];
    const results: Array<SearchResult & { _fs: number }> = [];
    for (const doc of this.docs.values()) {
      const fs = fuzzyScore(q, doc.title);
      if (fs <= 0) continue;
      results.push({ path: doc.path, title: doc.title, score: fs, snippet: "", _fs: fs });
    }
    return results.sort((a, b) => b._fs - a._fs).slice(0, limit).map(({ _fs: _, ...r }) => r);
  }
}
