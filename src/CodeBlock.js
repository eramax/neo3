import hljs from "highlight.js";

const COPY_ICON_SVG = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>`;

const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

export class CodeBlock extends HTMLElement {
    static get observedAttributes() {
        return ['language', 'code'];
    }

    constructor() {
        super();
        this._setupEventListeners();
    }

    connectedCallback() {
        this.render();
    }

    // attributeChangedCallback() {
    //     if (this.isConnected) {
    //         this.render();
    //     }
    // }

    get language() {
        return this.getAttribute('language') || 'plaintext';
    }

    set language(value) {
        this.setAttribute('language', value || 'plaintext');
    }

    get code() {
        return this.getAttribute('code') || '';
    }

    set code(value) {
        this.setAttribute('code', value || '');
        if (this.isConnected) {
            this.render();
        }
    }

    render() {
        const language = this.language;
        const code = this.code;
        const highlightedCode = this.highlightCode(code, language);

        this.innerHTML = `
            <div class="code-block-container">
                <div class="code-block-header">
                    <span class="code-language">${this.escapeHtml(language)}</span>
                    <button class="copy-code-btn">
                        ${COPY_ICON_SVG}<span class="copy-text">Copy</span>
                    </button>
                </div>
                <pre class="code-block"><code class="hljs language-${this.escapeHtml(language)}">${highlightedCode}</code></pre>
            </div>
        `;
    }

    updateCode(newCode, newLanguage) {
        if (newCode !== this.code) {
            this.code = newCode;
        }
        if (newLanguage !== this.language) {
            this.language = newLanguage;
        }
    }

    _setupEventListeners() {
        this.addEventListener('click', (event) => {
            const copyButton = event.target.closest('.copy-code-btn');
            if (copyButton) {
                CodeBlock.copyCode(copyButton);
            }
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, match => HTML_ESCAPE_MAP[match]);
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

    static async copyCode(button) {
        try {
            const codeContainer = button.closest('.code-block-container');
            const codeElement = codeContainer?.querySelector('pre code');

            if (!codeElement) return;

            await navigator.clipboard.writeText(codeElement.textContent);
            CodeBlock._showCopyFeedback(button, "Copied!");
        } catch {
            CodeBlock._showCopyFeedback(button, null, true);
        }
    }

    static _showCopyFeedback(button, message, isError = false) {
        const textSpan = button.querySelector(".copy-text");

        if (isError) {
            button.classList.add("copy-error");
            setTimeout(() => button.classList.remove("copy-error"), 2000);
            return;
        }

        textSpan.textContent = message;
        button.classList.add("copied");
        setTimeout(() => {
            textSpan.textContent = "Copy";
            button.classList.remove("copied");
        }, 2000);
    }
}

customElements.define('code-block', CodeBlock);
