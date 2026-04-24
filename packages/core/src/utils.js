import { createHash } from "node:crypto";
export function normalizeToPosixPath(input) {
    return input.replaceAll("\\", "/");
}
export function toTitleFromPath(path) {
    const filename = path.split("/").pop() ?? path;
    return filename.replace(/\.md$/i, "");
}
export function sha256(input) {
    return createHash("sha256").update(input, "utf8").digest("hex");
}
export function scoreTextMatch(keyword, text) {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword)
        return 0;
    const lowerText = text.toLowerCase();
    let idx = lowerText.indexOf(normalizedKeyword);
    let count = 0;
    while (idx !== -1) {
        count += 1;
        idx = lowerText.indexOf(normalizedKeyword, idx + normalizedKeyword.length);
    }
    if (count === 0)
        return 0;
    return Math.min(100, 20 + count * 10);
}
export function snippetAroundKeyword(keyword, text, radius = 48) {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword)
        return text.slice(0, radius * 2);
    const lower = text.toLowerCase();
    const hit = lower.indexOf(normalizedKeyword);
    if (hit === -1)
        return text.slice(0, radius * 2);
    const start = Math.max(0, hit - radius);
    const end = Math.min(text.length, hit + normalizedKeyword.length + radius);
    return text.slice(start, end).replace(/\s+/g, " ").trim();
}
//# sourceMappingURL=utils.js.map