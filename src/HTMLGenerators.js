import katex from "katex";
import { CodeBlockManager } from "./CodeBlock.js";

// Constants
const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};


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
            code: n => CodeBlockManager.createCodeBlockHTML(n),
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
    } createHTMLFromChildren = children => children?.map(child => this.createHTMLFromNode(child)).join('') || '';

    createCustomTagHTML(node) {
        const config = this.customTags.get(node.tagName);
        return config ? config.renderer(node.value) : `<div class="unknown-tag">${node.value}</div>`;
    }

}
