export function renderMarkdownWithWikiLink(markdown) {
    const escaped = escapeHtml(markdown);
    const html = escaped
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br />")
        .replace(/(!)?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_, bang, target, alias) => {
        const text = alias || target;
        const href = target.endsWith(".md") ? target : `${target}.md`;
        if (bang) {
            return `<span class=\"embed\" data-target=\"${escapeHtml(href)}\">!${escapeHtml(text)}</span>`;
        }
        return `<a class=\"wikilink\" href=\"${escapeHtml(href)}\">${escapeHtml(text)}</a>`;
    });
    return `<p>${html}</p>`;
}
function escapeHtml(raw) {
    return raw
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
//# sourceMappingURL=markdown.js.map