// Optimized markdown renderer with lazy loading
let hljs = null;
const loadHighlight = async () => {
    if (!hljs) {
        const module = await import('highlight.js');
        hljs = module.default;
    }
    return hljs;
};

export class IncrementalMarkdown extends HTMLElement {
    constructor() {
        super();
        this._content = '';
        this._container = document.createElement('div');
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

    async _render() {
        if (!this.content) {
            this._container.innerHTML = '';
            return;
        }
        try {
            this._container.innerHTML = await this._parseMarkdown(this.content);
        } catch (e) {
            this._container.innerHTML = `<p>${this._escapeHtml(this.content)}</p>`;
        }
    }

    async _parseMarkdown(text) {
        // Process code blocks first
        text = await this._processCodeBlocks(text);

        // Process other markdown elements
        return text
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/\n/g, '<br>');
    }

    async _processCodeBlocks(text) {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        const matches = [...text.matchAll(codeBlockRegex)];

        if (matches.length === 0) return text;

        let result = text;
        for (const [fullMatch, lang, code] of matches) {
            const blockHtml = await this._renderCodeBlock(lang, code);
            result = result.replace(fullMatch, blockHtml);
        }

        return result;
    }

    async _renderCodeBlock(lang, code) {
        const isDetails = lang === 'details';

        if (isDetails) {
            return `<details class="think-block"><summary>💭 Thinking...</summary><div class="think-content">${this._escapeHtml(code)}</div></details>`;
        }

        let highlightedCode = this._escapeHtml(code);

        if (lang) {
            try {
                const highlight = await loadHighlight();
                if (highlight.getLanguage(lang)) {
                    highlightedCode = highlight.highlight(code, { language: lang }).value;
                }
            } catch (e) {
                // Fallback to escaped HTML
            }
        }

        return `<div class="code-block-container">
            <div class="code-block-header">
                <span class="code-language">${lang || 'text'}</span>
                <button class="copy-code-btn" title="Copy code">⧉</button>
            </div>
            <pre class="code-block"><code class="hljs ${lang || ''}">${highlightedCode}</code></pre>
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
