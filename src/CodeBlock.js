// Generic code block component with action system
const COPY_ICON_SVG = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>`;
const EXPAND_ICON_SVG = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466zm0 7.068v3.932a.25.25 0 0 1-.41.192l-2.36-1.966c-.12-.1-.12-.284 0-.384l2.36-1.966A.25.25 0 0 1 8 11.534z"/></svg>`;
const COLLAPSE_ICON_SVG = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 11.534V15.5a.25.25 0 0 1-.41.192l-2.36-1.966c-.12-.1-.12-.284 0-.384l2.36-1.966A.25.25 0 0 1 8 11.534zm0-7.068V.466a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>`;
const PREVIEW_ICON_SVG = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/></svg>`;

// Language-specific actions registry
const LANGUAGE_ACTIONS = {
    mermaid: [
        {
            name: 'Preview',
            icon: PREVIEW_ICON_SVG,
            loader: () => import('./Mermaid.js'),
            execute: async (code, container, previewContainer) => {
                const { renderMermaidDiagram } = await LANGUAGE_ACTIONS.mermaid[0].loader();
                renderMermaidDiagram(code, previewContainer);
            }
        }
    ],
    html: [
        {
            name: 'Preview',
            icon: PREVIEW_ICON_SVG,
            loader: () => Promise.resolve({ renderHTMLPreview: window.renderHTMLPreview }),
            execute: async (code, container, previewContainer) => {
                const htmlPreview = document.createElement('html-preview');
                htmlPreview.source = code;
                previewContainer.innerHTML = '';
                previewContainer.appendChild(htmlPreview);
            }
        }
    ]
};

// HTML Preview Component
class HTMLPreview extends HTMLElement {
    constructor() {
        super();
        this._source = '';
    }

    get source() { return this._source; }
    set source(value) {
        this._source = value;
        this.render();
    }

    render() {
        this.innerHTML = `
            <iframe 
                class="html-preview-iframe" 
                sandbox="allow-scripts allow-same-origin"
                src="data:text/html;charset=utf-8,${encodeURIComponent(this._source)}">
            </iframe>
        `;
    }
}

customElements.define('html-preview', HTMLPreview);

export class CodeBlockManager {
    static createCodeBlockHTML(node) {
        const language = node.lang || "plaintext";
        const escapedLanguage = this.escapeHtml(language);
        const codeContent = node.highlighted || this.escapeHtml(node.value);

        const actions = LANGUAGE_ACTIONS[language.toLowerCase()] || [];
        const actionButtons = actions.map(action =>
            `<button class="action-btn" data-action="${action.name.toLowerCase()}" data-lang="${language}">
                ${action.icon}<span class="action-text">${action.name}</span>
            </button>`
        ).join('');

        return `
            <div class="code-block-container" data-lang="${language}">
                <div class="code-block-header">
                    <span class="code-language">${escapedLanguage}</span>
                    <div class="code-actions">
                        <button class="expand-collapse-btn" data-expanded="true">
                            ${COLLAPSE_ICON_SVG}<span class="expand-text">Collapse</span>
                        </button>
                        ${actionButtons}
                        <button class="copy-code-btn">
                            ${COPY_ICON_SVG}<span class="copy-text">Copy</span>
                        </button>
                    </div>
                </div>
                <div class="code-content">
                    <pre class="code-block"><code class="language-${escapedLanguage}">${codeContent}</code></pre>
                </div>
                <div class="preview-section hidden">
                    <div class="preview-header">
                        <span class="preview-title">Preview</span>
                    </div>
                    <div class="preview-content"></div>
                </div>
            </div>
        `;
    }

    static escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text?.replace(/[&<>"']/g, m => map[m]) || '';
    }    
    
    static async handleCodeBlockAction(container, actionName, language) {
        const actions = LANGUAGE_ACTIONS[language.toLowerCase()];
        const action = actions?.find(a => a.name.toLowerCase() === actionName);

        if (!action) return;

        const codeElement = container.querySelector('pre code');
        const code = codeElement?.textContent;
        const previewSection = container.querySelector('.preview-section');
        const previewContent = container.querySelector('.preview-content');
        const codeContent = container.querySelector('.code-content');
        const actionBtn = container.querySelector(`[data-action="${actionName}"]`);

        if (!code || !previewSection || !previewContent) return;

        // Check if preview is currently visible - toggle it
        const isPreviewVisible = !previewSection.classList.contains('hidden');
        
        if (isPreviewVisible) {
            // Hide preview
            previewSection.classList.add('hidden');
            actionBtn?.classList.remove('active');
            
            // Expand code if it was collapsed
            if (codeContent.classList.contains('collapsed')) {
                codeContent.classList.remove('collapsed');
                const expandBtn = container.querySelector('.expand-collapse-btn');
                if (expandBtn) {
                    expandBtn.innerHTML = `${COLLAPSE_ICON_SVG}<span class="expand-text">Collapse</span>`;
                    expandBtn.dataset.expanded = 'true';
                }
            }
        } else {
            // Show preview section and collapse code
            previewSection.classList.remove('hidden');
            actionBtn?.classList.add('active');
            codeContent.classList.add('collapsed');

            // Update expand/collapse button
            const expandBtn = container.querySelector('.expand-collapse-btn');
            if (expandBtn) {
                expandBtn.innerHTML = `${EXPAND_ICON_SVG}<span class="expand-text">Expand</span>`;
                expandBtn.dataset.expanded = 'false';
            }

            try {
                previewContent.innerHTML = '<div class="loading">Rendering preview...</div>';
                await action.execute(code, container, previewContent);
            } catch (err) {
                previewContent.innerHTML = `<div class="error">Failed to render preview: ${err.message}</div>`;
            }
        }
    }    
    
    static toggleCodeBlock(container) {
        const expandBtn = container.querySelector('.expand-collapse-btn');
        const codeContent = container.querySelector('.code-content');
        const previewSection = container.querySelector('.preview-section');
        const isExpanded = expandBtn.dataset.expanded === 'true';

        if (isExpanded) {
            codeContent.classList.add('collapsed');
            expandBtn.innerHTML = `${EXPAND_ICON_SVG}<span class="expand-text">Expand</span>`;
            expandBtn.dataset.expanded = 'false';
        } else {
            codeContent.classList.remove('collapsed');
            expandBtn.innerHTML = `${COLLAPSE_ICON_SVG}<span class="expand-text">Collapse</span>`;
            expandBtn.dataset.expanded = 'true';
            
            // If preview is open when expanding code, hide preview and remove active state
            if (previewSection && !previewSection.classList.contains('hidden')) {
                previewSection.classList.add('hidden');
                const actionBtn = container.querySelector('.action-btn.active');
                actionBtn?.classList.remove('active');
            }
        }
    }

    static closePreview(container) {
        const previewSection = container.querySelector('.preview-section');
        if (previewSection) {
            previewSection.classList.add('hidden');
        }
    }
}

// Global registry for easy access
window.CodeBlockManager = CodeBlockManager;
