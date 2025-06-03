import katex from "katex";
import { isMermaidCode } from "./Mermaid.js";

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
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, match => HTML_ESCAPE_MAP[match]);
    }

    renderMath(expression, displayMode = false) {
        try {
            return katex.renderToString(expression, {
                displayMode,
                throwOnError: false
            });
        } catch (err) {
            return `<span class="math-error">${this.escapeHtml(expression)}</span>`;
        }
    }

    createHTMLFromNode(node) {
        if (!node) return '';

        if (this.customTags.has(node.type)) {
            return this.createCustomTagHTML(node);
        }

        const htmlGenerators = {
            paragraph: () => `<p>${this.createHTMLFromChildren(node.children)}</p>`,
            heading: () => `<h${node.depth}>${this.createHTMLFromChildren(node.children)}</h${node.depth}>`,
            text: () => this.escapeHtml(node.value),
            strong: () => `<strong>${this.createHTMLFromChildren(node.children)}</strong>`,
            emphasis: () => `<em>${this.createHTMLFromChildren(node.children)}</em>`,
            inlineCode: () => `<code class="inline-code">${this.escapeHtml(node.value)}</code>`,
            code: () => isMermaidCode(node) ? this.createMermaidHTML(node) : this.createCodeBlockHTML(node),
            blockquote: () => `<blockquote>${this.createHTMLFromChildren(node.children)}</blockquote>`,
            list: () => {
                const tag = node.ordered ? "ol" : "ul";
                return `<${tag}>${this.createHTMLFromChildren(node.children)}</${tag}>`;
            },
            listItem: () => `<li>${this.createHTMLFromChildren(node.children)}</li>`,
            link: () => `<a href="${this.escapeHtml(node.url)}">${this.createHTMLFromChildren(node.children)}</a>`,
            break: () => "<br>",
            thematicBreak: () => "<hr>",
            html: () => node.value,
            inlineMath: () => this.renderMath(node.value, false),
            math: () => this.renderMath(node.value, true),
            table: () => `<table>${this.createHTMLFromChildren(node.children)}</table>`,
            tableRow: () => `<tr>${this.createHTMLFromChildren(node.children)}</tr>`,
            tableCell: () => {
                const isHeader = node.children?.[0]?.type === "strong";
                const tag = isHeader ? "th" : "td";
                return `<${tag}>${this.createHTMLFromChildren(node.children)}</${tag}>`;
            },
            default: () => node.children ? this.createHTMLFromChildren(node.children) : ''
        };

        const generator = htmlGenerators[node.type] || htmlGenerators.default;
        return generator();
    }

    createHTMLFromChildren(children) {
        return children?.map(child => this.createHTMLFromNode(child)).join('') || '';
    }

    createCodeBlockHTML(node) {
        const language = node.lang || "plaintext"
        const escapedLanguage = this.escapeHtml(language)
        const codeContent = node.highlighted || this.escapeHtml(node.value)

        return `
            <div class="code-block-container">
                <div class="code-block-header">
                    <span class="code-language">${escapedLanguage}</span>
                    <button class="copy-code-btn">
                        ${COPY_ICON_SVG}<span class="copy-text"/>
                    </button>
                </div>
                <pre class="code-block"><code class="language-${escapedLanguage}">${codeContent}</code></pre>
            </div>
        `;
    }

    createMermaidHTML(node) {
        return `<div class="mermaid-container" data-mermaid-code="${this.escapeHtml(node.value)}">
            <div class="mermaid-loading">Loading diagram...</div>
        </div>`;
    }

    createCustomTagHTML(node) {
        const config = this.customTags.get(node.tagName);
        return config ? config.renderer(node.value) : `<div class="unknown-tag">${node.value}</div>`;
    }

    get copyIcon() {
        return COPY_ICON_SVG;
    }
}
