import katex from "katex";

// Constants
const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

const COPY_ICON_SVG = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>`;

export class HTMLGenerators {
    constructor(customTags = new Map()) {
        this.customTags = customTags;
        this.generators = this._createGenerators();
    }

    escapeHtml = text => text?.replace(/[&<>"']/g, m => HTML_ESCAPE_MAP[m]) || '';

    renderMath(expression, displayMode = false) {
        try {
            return katex.renderToString(expression, { displayMode, throwOnError: false });
        } catch {
            return `<span class="math-error">${this.escapeHtml(expression)}</span>`;
        }
    }

    _createGenerators() {
        return {
            paragraph: n => `<p>${this.createHTMLFromChildren(n.children)}</p>`,
            heading: n => `<h${n.depth}>${this.createHTMLFromChildren(n.children)}</h${n.depth}>`,
            text: n => this.escapeHtml(n.value),
            strong: n => `<strong>${this.createHTMLFromChildren(n.children)}</strong>`,
            emphasis: n => `<em>${this.createHTMLFromChildren(n.children)}</em>`,
            inlineCode: n => `<code class="inline-code">${this.escapeHtml(n.value)}</code>`,
            code: n => (n?.type === 'code' && n?.lang?.toLowerCase() === 'mermaid') ? this.createMermaidHTML(n) : this.createCodeBlockHTML(n),
            blockquote: n => `<blockquote>${this.createHTMLFromChildren(n.children)}</blockquote>`,
            list: n => {
                const tag = n.ordered ? "ol" : "ul";
                return `<${tag}>${this.createHTMLFromChildren(n.children)}</${tag}>`;
            },
            listItem: n => `<li>${this.createHTMLFromChildren(n.children)}</li>`,
            link: n => `<a href="${this.escapeHtml(n.url)}">${this.createHTMLFromChildren(n.children)}</a>`,
            break: () => "<br>",
            thematicBreak: () => "<hr>",
            html: n => n.value,
            inlineMath: n => this.renderMath(n.value, false),
            math: n => this.renderMath(n.value, true),
            table: n => `<table>${this.createHTMLFromChildren(n.children)}</table>`,
            tableRow: n => `<tr>${this.createHTMLFromChildren(n.children)}</tr>`,
            tableCell: n => {
                const tag = n.children?.[0]?.type === "strong" ? "th" : "td";
                return `<${tag}>${this.createHTMLFromChildren(n.children)}</${tag}>`;
            }
        };
    }

    createHTMLFromNode(node) {
        if (!node) return '';

        if (this.customTags.has(node.type)) {
            return this.createCustomTagHTML(node);
        }

        const generator = this.generators[node.type];
        return generator ? generator(node) : (node.children ? this.createHTMLFromChildren(node.children) : '');
    }

    createHTMLFromChildren = children => children?.map(child => this.createHTMLFromNode(child)).join('') || ''; createCodeBlockHTML(node) {
        const language = node.lang || "plaintext";
        const escapedLanguage = this.escapeHtml(language);
        const codeContent = node.highlighted || this.escapeHtml(node.value);

        const isMermaid = language.toLowerCase() === 'mermaid';
        const previewButton = isMermaid ? `<button class="preview-btn">${COPY_ICON_SVG}<span class="preview-text">Preview</span></button>` : '';

        return `<div class="code-block-container"><div class="code-block-header"><span class="code-language">${escapedLanguage}</span>${previewButton}<button class="copy-code-btn">${COPY_ICON_SVG}<span class="copy-text"/></button></div><pre class="code-block"><code class="language-${escapedLanguage}">${codeContent}</code></pre></div>`;
    }

    createMermaidHTML = node => this.createCodeBlockHTML(node);

    createCustomTagHTML(node) {
        const config = this.customTags.get(node.tagName);
        return config ? config.renderer(node.value) : `<div class="unknown-tag">${node.value}</div>`;
    }

    get copyIcon() { return COPY_ICON_SVG; }
}
