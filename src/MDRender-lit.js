import { LitElement, html, css } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js";

export class IncrementalMarkdown extends LitElement {
    static properties = {
        content: { type: String },
        processedLength: { type: Number }
    };


    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.content = '';
        this.processedLength = 0;
        this.processor = unified().use(remarkParse).use(remarkGfm);
        this._lastProcessedAst = null;
        this._renderedElements = [];
    }

    render() {
        if (!this.content) {
            return html``;
        }

        const ast = this.processor.parse(this.content);
        const astChildren = ast.children || [];

        // Check if we need to update the rendered elements
        if (!this._lastProcessedAst || !this._astEqual(ast, this._lastProcessedAst)) {
            this._renderedElements = this._renderAstNodes(astChildren);
            this._lastProcessedAst = ast;
        }

        return html`<div @click=${this._handleClick}>${this._renderedElements}</div>`;
    }

    _handleClick(event) {
        if (event.target.closest('.copy-code-btn')) {
            const button = event.target.closest('.copy-code-btn');
            this.copyCode(button);
        }
    }

    _renderAstNodes(nodes) {
        if (!nodes) return [];
        return repeat(
            nodes,
            (node, index) => `${node.type}-${index}-${this._getNodeKey(node)}`,
            (node) => this._renderAstNode(node)
        );
    }

    _getNodeKey(node) {
        // Generate a key based on node content for better tracking
        switch (node.type) {
            case 'text':
            case 'inlineCode':
            case 'html':
                return node.value?.slice(0, 50) || '';
            case 'heading':
                return `${node.depth}-${node.children?.[0]?.value?.slice(0, 20) || ''}`;
            case 'code':
                return `${node.lang || 'plain'}-${node.value?.slice(0, 30) || ''}`;
            case 'link':
                return node.url || '';
            case 'list':
                return `${node.ordered ? 'ol' : 'ul'}-${node.children?.length || 0}`;
            default:
                return node.children?.length?.toString() || '0';
        }
    }

    _renderAstNode(node) {
        if (!node) return html``;

        switch (node.type) {
            case "paragraph":
                return html`<p>${this._renderAstNodes(node.children)}</p>`;
            case "heading":
                switch (node.depth) {
                    case 1: return html`<h1>${this._renderAstNodes(node.children)}</h1>`;
                    case 2: return html`<h2>${this._renderAstNodes(node.children)}</h2>`;
                    case 3: return html`<h3>${this._renderAstNodes(node.children)}</h3>`;
                    case 4: return html`<h4>${this._renderAstNodes(node.children)}</h4>`;
                    case 5: return html`<h5>${this._renderAstNodes(node.children)}</h5>`;
                    case 6: return html`<h6>${this._renderAstNodes(node.children)}</h6>`;
                    default: return html`<h1>${this._renderAstNodes(node.children)}</h1>`;
                }
            case "text":
                return html`${node.value}`;
            case "strong":
                return html`<strong>${this._renderAstNodes(node.children)}</strong>`;
            case "emphasis":
                return html`<em>${this._renderAstNodes(node.children)}</em>`;
            case "inlineCode":
                return html`<code class="inline-code">${node.value}</code>`;
            case "code":
                return this._renderCodeBlock(node);
            case "blockquote":
                return html`<blockquote>${this._renderAstNodes(node.children)}</blockquote>`;
            case "list":
                if (node.ordered) {
                    return html`<ol>${this._renderAstNodes(node.children)}</ol>`;
                } else {
                    return html`<ul>${this._renderAstNodes(node.children)}</ul>`;
                }
            case "listItem":
                return html`<li>${this._renderAstNodes(node.children)}</li>`;
            case "link":
                return html`<a href="${node.url}">${this._renderAstNodes(node.children)}</a>`;
            case "break":
                return html`<br>`;
            case "thematicBreak":
                return html`<hr>`;
            case "html":
                if (node.value.includes("<think>")) {
                    return this._renderThinkBlock(node.value);
                }
                return node.value ? unsafeHTML(node.value) : html``;
            case "table":
                return html`<table>${this._renderAstNodes(node.children)}</table>`;
            case "tableRow":
                return html`<tr>${this._renderAstNodes(node.children)}</tr>`;
            case "tableCell":
                const isHeader = node.children && node.children[0] && node.children[0].type === "strong";
                if (isHeader) {
                    return html`<th>${this._renderAstNodes(node.children)}</th>`;
                } else {
                    return html`<td>${this._renderAstNodes(node.children)}</td>`;
                }
            default:
                if (node.children) {
                    return html`${this._renderAstNodes(node.children)}`;
                }
                return html``;
        }
    }

    _renderCodeBlock(node) {
        const language = node.lang || "plaintext";
        const highlightedCode = this.highlightCode(node.value, node.lang);

        return html`
            <div class="code-block-container">
                <div class="code-block-header">
                    <span class="code-language">${language}</span>
                    <button class="copy-code-btn">
                        ${unsafeHTML(this.copyIcon)}<span class="copy-text">Copy</span>
                    </button>
                </div>
                <pre class="code-block"><code class="hljs language-${language}">${unsafeHTML(highlightedCode)}</code></pre>
            </div>
        `;
    }

    _renderThinkBlock(htmlContent) {
        const content = htmlContent.replace(/<\/?think>/g, "");
        return html`
            <details class="think-block">
                <summary>Thinking process</summary>
                <div class="think-content">${unsafeHTML(content)}</div>
            </details>
        `;
    }

    _astEqual(ast1, ast2) {
        if (!ast1 || !ast2) return false;
        return JSON.stringify(ast1) === JSON.stringify(ast2);
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, (match) => {
            const escapeMap = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return escapeMap[match];
        });
    }

    highlightCode(code, language) {
        const trimmedCode = code.trim();
        if (language && hljs.getLanguage(language)) {
            try {
                return hljs.highlight(trimmedCode, { language }).value;
            } catch (err) {
                console.warn("Highlighting failed:", err);
            }
        }
        return hljs.highlightAuto(trimmedCode).value;
    }

    async copyCode(button) {
        try {
            const codeContainer = button.closest('.code-block-container');
            if (!codeContainer) return;

            const codeElement = codeContainer.querySelector('pre code');
            if (!codeElement) return;

            const code = codeElement.textContent;

            await navigator.clipboard.writeText(code);
            const textSpan = button.querySelector(".copy-text");
            textSpan.textContent = "Copied!";
            button.classList.add("copied");
            setTimeout(() => {
                textSpan.textContent = "Copy";
                button.classList.remove("copied");
            }, 2000);
        } catch {
            button.classList.add("copy-error");
            setTimeout(() => button.classList.remove("copy-error"), 2000);
        }
    }

    get copyIcon() {
        return `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>`;
    }
}

customElements.define('incremental-markdown', IncrementalMarkdown);
