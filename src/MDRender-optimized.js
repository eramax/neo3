import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js";

export class IncrementalMarkdown extends HTMLElement {
    constructor() {
        super();
        this._content = '';
        this._container = document.createElement('div');
        this.processor = unified().use(remarkParse).use(remarkGfm);
        this.appendChild(this._container);
        this._container.addEventListener('click', e => {
            const btn = e.target.closest('.copy-code-btn');
            if (btn) this.copyCode(btn);
        });
    }

    get content() { return this._content; }

    set content(value) {
        if (this._content === value) return;
        this._content = this._preprocessContent(value);
        this._render();
    }

    _preprocessContent(value) {
        if (!value) return value;
        const openThinkCount = (value.match(/<think>/g) || []).length;
        const closeThinkCount = (value.match(/<\/think>/g) || []).length;
        let processed = value;
        if (openThinkCount > closeThinkCount) processed += "</think>";
        return processed.replace(/<think>([\s\S]*?)<\/think>/g, "```details\n$1\n```");
    }

    _render() {
        if (!this.content) {
            this._container.innerHTML = '';
            return;
        }
        try {
            const ast = this.processor.parse(this.content);
            this._container.innerHTML = this._astToHtml(ast);
        } catch (e) {
            this._container.innerHTML = `<p>${this._escapeHtml(this.content)}</p>`;
        }
    }

    _astToHtml(node) {
        if (!node) return '';

        switch (node.type) {
            case 'root':
                return node.children.map(child => this._astToHtml(child)).join('');
            case 'paragraph':
                return `<p>${node.children.map(child => this._astToHtml(child)).join('')}</p>`;
            case 'text':
                return this._escapeHtml(node.value);
            case 'strong':
                return `<strong>${node.children.map(child => this._astToHtml(child)).join('')}</strong>`;
            case 'emphasis':
                return `<em>${node.children.map(child => this._astToHtml(child)).join('')}</em>`;
            case 'inlineCode':
                return `<code class="inline-code">${this._escapeHtml(node.value)}</code>`;
            case 'code':
                return this._renderCodeBlock(node);
            case 'heading':
                const level = Math.min(node.depth, 6);
                return `<h${level}>${node.children.map(child => this._astToHtml(child)).join('')}</h${level}>`;
            case 'link':
                const href = this._escapeHtml(node.url);
                return `<a href="${href}" target="_blank" rel="noopener noreferrer">${node.children.map(child => this._astToHtml(child)).join('')}</a>`;
            case 'list':
                const tag = node.ordered ? 'ol' : 'ul';
                return `<${tag}>${node.children.map(child => this._astToHtml(child)).join('')}</${tag}>`;
            case 'listItem':
                return `<li>${node.children.map(child => this._astToHtml(child)).join('')}</li>`;
            case 'blockquote':
                return `<blockquote>${node.children.map(child => this._astToHtml(child)).join('')}</blockquote>`;
            case 'break':
                return '<br>';
            case 'thematicBreak':
                return '<hr>';
            case 'table':
                return `<table>${node.children.map(child => this._astToHtml(child)).join('')}</table>`;
            case 'tableRow':
                return `<tr>${node.children.map(child => this._astToHtml(child)).join('')}</tr>`;
            case 'tableCell':
                const cellTag = node.type === 'tableHead' ? 'th' : 'td';
                return `<${cellTag}>${node.children.map(child => this._astToHtml(child)).join('')}</${cellTag}>`;
            default:
                return node.children ? node.children.map(child => this._astToHtml(child)).join('') : '';
        }
    }

    _renderCodeBlock(node) {
        const lang = node.lang || '';
        const code = node.value;
        const isDetails = lang === 'details';

        if (isDetails) {
            return `<details class="think-block"><summary>💭 Thinking...</summary><div class="think-content">${this._escapeHtml(code)}</div></details>`;
        }

        let highlightedCode = code;
        if (lang && hljs.getLanguage(lang)) {
            try {
                highlightedCode = hljs.highlight(code, { language: lang }).value;
            } catch (e) {
                highlightedCode = this._escapeHtml(code);
            }
        } else {
            highlightedCode = this._escapeHtml(code);
        }

        return `<div class="code-block-container">
            <div class="code-block-header">
                <span class="code-language">${lang || 'text'}</span>
                <button class="copy-code-btn" title="Copy code">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                        <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                    </svg>
                </button>
            </div>
            <pre class="code-block"><code class="hljs ${lang}">${highlightedCode}</code></pre>
        </div>`;
    }

    _escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    copyCode(button) {
        const codeBlock = button.closest('.code-block-container')?.querySelector('code');
        if (!codeBlock) return;

        const code = codeBlock.textContent;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => this._showCopyFeedback(button))
                .catch(() => this._fallbackCopy(code, button));
        } else {
            this._fallbackCopy(code, button);
        }
    }

    _fallbackCopy(text, button) {
        const textarea = Object.assign(document.createElement('textarea'), {
            value: text,
            style: 'position:fixed;left:-999999px;top:-999999px'
        });
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this._showCopyFeedback(button);
    }

    _showCopyFeedback(button) {
        const original = button.innerHTML;
        button.innerHTML = '✓ Copied!';
        setTimeout(() => button.innerHTML = original, 2000);
    }
}

customElements.define('incremental-markdown', IncrementalMarkdown);
