import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { remarkSyntaxHighlight } from "./syntax-highlighter.js";
import { DOMUtils } from "./DOMUtils.js";
import { remarkCustomTags, createDefaultTags } from "./remarkCustomTags.js";
import { renderMermaidDiagram, isMermaidCode } from "./mermaid-handler.js";

// Constants
const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

const COPY_ICON_SVG = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>`;

const UPDATABLE_NODE_TYPES = new Set([
    'text', 'inlineCode', 'html', 'code', 'paragraph',
    'heading', 'strong', 'emphasis', 'blockquote',
    'list', 'listItem', 'link', 'inlineMath', 'math'
]);

export class IncrementalMarkdown extends HTMLElement {
    constructor() {
        super();
        this._internalContent = '';
        this._container = document.createElement('div');
        this._lastProcessedAst = null;
        this.processedLength = 0;
        this.customTags = new Map();
        this.domUtils = new DOMUtils();
        this._setupProcessor();
        this._setupEventListeners();
        this._registerDefaultTags();

        // Apply DomUtils as mixin
        Object.assign(this, new DomUtils());

        // Setup HTML generators
        this.htmlGenerators = new HTMLGenerators(this.customTags);
    }

    _setupProcessor() {
        this.processor = unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkMath)
            .use(remarkSyntaxHighlight)
            .use(remarkCustomTags, { tags: Object.fromEntries(this.customTags) });
    }

    _registerDefaultTags() {
        const defaultTags = createDefaultTags();
        Object.entries(defaultTags).forEach(([tagName, config]) => {
            this.customTags.set(tagName, config);
        });
    }

    registerCustomTag(tagName, config) {
        this.customTags.set(tagName.toLowerCase(), {
            renderer: config.renderer || ((content) => `<div class="custom-tag-${tagName}">${content}</div>`)
        });
        this._setupProcessor();
        this.htmlGenerators = new HTMLGenerators(this.customTags);
    }

    connectedCallback() {
        if (!this._container.parentNode) {
            this.appendChild(this._container);
        }
    }

    get content() {
        return this._internalContent;
    }

    set content(value) {
        if (this._internalContent === value) return;
        this._internalContent = this._preprocessContent(value);
        this._updateRenderedContent();
    }

    get copyIcon() {
        return this.htmlGenerators.copyIcon;
    }

    // Content preprocessing
    _preprocessContent(value) {
        return value;
    }

    // Event handling
    _setupEventListeners() {
        this._container.addEventListener('click', (event) => {
            const copyButton = event.target.closest('.copy-code-btn');
            if (copyButton) {
                const codeContainer = copyButton.closest('.code-block-container');
                const codeElement = codeContainer?.querySelector('pre code');
                if (codeElement && window.copyCodeToClipboard) {
                    window.copyCodeToClipboard(copyButton, codeElement.textContent);
                }
            }
        });
    }

    // DOM management
    _clearContainerDOM() {
        this.domUtils._clearContainerDOM.call(this);
    }

    _createElementFromHTML(htmlString) {
        return this.domUtils._createElementFromHTML(htmlString);
    }

    // Main rendering logic
    _updateRenderedContent() {
        if (!this.content) {
            this._clearContainerDOM();
            this._resetState();
            return;
        }

        const newAst = this.processor.parse(this.content);
        const transformedAst = this.processor.runSync(newAst);

        this._updateDOM(transformedAst);
        this._lastProcessedAst = transformedAst;
        this.processedLength = this.content.length;
    }

    _resetState() {
        this.processedLength = 0;
        this._lastProcessedAst = null;
    }

    _updateDOM(newAst) {
        const newChildren = newAst.children || [];
        const oldChildren = this._lastProcessedAst?.children || [];

        const { updatedIndices, newDomElements } = this._processNodeChanges(newChildren, oldChildren);
        this._applyDOMChanges(updatedIndices, newDomElements);
    }

    _processNodeChanges(newChildren, oldChildren) {
        const updatedIndices = [];
        const newDomElements = [];

        for (let i = 0; i < newChildren.length; i++) {
            const newNode = newChildren[i];
            const oldNode = oldChildren[i];
            const existingElement = this._container.children[i];

            if (!oldNode || !this._nodesEqual(newNode, oldNode)) {
                updatedIndices.push(i);
                newDomElements[i] = this._createOrUpdateElement(newNode, oldNode, existingElement);
            } else {
                newDomElements[i] = existingElement;
            }
        }

        return { updatedIndices, newDomElements };
    }

    _createOrUpdateElement(newNode, oldNode, existingElement) {
        if (existingElement && oldNode && this._canUpdateInPlace(newNode, oldNode)) {
            this._updateElementInPlace(existingElement, newNode, oldNode);
            return existingElement;
        }

        const html = this.createHTMLFromNode(newNode);
        const element = this._createElementFromHTML(html);

        if (isMermaidCode(newNode)) {
            setTimeout(() => renderMermaidDiagram(newNode.value, element), 0);
        }

        return element;
    }

    _applyDOMChanges(updatedIndices, newDomElements) {
        this.domUtils._applyDOMChanges.call(this, updatedIndices, newDomElements);
    }

    _adjustContainerLength(newDomElements, oldDomNodes) {
        this.domUtils._adjustContainerLength.call(this, newDomElements, oldDomNodes);
    }

    // Node comparison and updating
    _canUpdateInPlace(newNode, oldNode) {
        return newNode.type === oldNode.type && (UPDATABLE_NODE_TYPES.has(newNode.type) || this.customTags.has(newNode.type));
    }

    _updateElementInPlace(element, newNode, oldNode) {
        if (this.customTags.has(newNode.type)) {
            return this._updateCustomTag(element, newNode, oldNode);
        }

        const updateHandlers = {
            text: () => this._updateTextNode(element, newNode),
            inlineCode: () => element.textContent = newNode.value,
            code: () => this._updateCodeBlock(element, newNode, oldNode),
            heading: () => this._updateHeadingNode(element, newNode, oldNode),
            link: () => this._updateLinkNode(element, newNode, oldNode),
            list: () => this._updateListNode(element, newNode, oldNode),
            html: () => this._updateHtmlNode(element, newNode),
            inlineMath: () => this._updateMathNode(element, newNode),
            math: () => this._updateMathNode(element, newNode),
            default: () => this.domUtils._updateChildrenInPlace.call(this, element, newNode.children, oldNode.children)
        };

        const handler = updateHandlers[newNode.type] || updateHandlers.default;
        return handler();
    }

    _updateCustomTag(element, newNode, oldNode) {
        const config = this.customTags.get(newNode.tagName);
        if (config && newNode.value !== oldNode?.value) {
            const contentDiv = element.querySelector('.think-content');
            if (contentDiv) {
                contentDiv.textContent = newNode.value;
            } else {
                element.innerHTML = config.renderer(newNode.value);
            }
        }
        return true;
    }

    _updateTextNode(element, newNode) {
        element.textContent = newNode.value;
    }

    _updateHeadingNode(element, newNode, oldNode) {
        if (newNode.depth !== oldNode.depth) return false;
        this.domUtils._updateChildrenInPlace.call(this, element, newNode.children, oldNode.children);
        return true;
    }

    _updateLinkNode(element, newNode, oldNode) {
        if (newNode.url !== oldNode.url) {
            element.href = newNode.url;
        }
        this.domUtils._updateChildrenInPlace.call(this, element, newNode.children, oldNode.children);
        return true;
    }

    _updateListNode(element, newNode, oldNode) {
        if (newNode.ordered !== oldNode.ordered) return false;
        this.domUtils._updateChildrenInPlace.call(this, element, newNode.children, oldNode.children);
        return true;
    }

    _updateHtmlNode(element, newNode) {
        element.innerHTML = newNode.value;
        return true;
    }

    _updateCodeBlock(element, newNode, oldNode) {
        if (isMermaidCode(newNode)) {
            if (newNode.value !== oldNode?.value) {
                renderMermaidDiagram(newNode.value, element);
            }
            return;
        }

        const codeElement = element.querySelector('pre code');
        const languageSpan = element.querySelector('.code-language');

        if (codeElement && newNode.value !== oldNode.value) {
            codeElement.innerHTML = newNode.highlighted || this.escapeHtml(newNode.value);
        }

        if (languageSpan && newNode.lang !== oldNode.lang) {
            languageSpan.textContent = newNode.lang || "plaintext";
        }
    }

    _updateMathNode(element, newNode) {
        try {
            const html = this.htmlGenerators.renderMath(newNode.value, newNode.type === 'math');
            element.innerHTML = html;
        } catch (err) {
            element.textContent = newNode.value;
        }
        return true;
    }

    // Node comparison
    _nodesEqual(node1, node2) {
        if (!node1 || !node2 || node1.type !== node2.type) return false;

        if (this.customTags.has(node1.type)) {
            return node1.value === node2.value;
        }

        const equalityCheckers = {
            text: () => node1.value === node2.value,
            inlineCode: () => node1.value === node2.value,
            html: () => node1.value === node2.value,
            heading: () => node1.depth === node2.depth && this._childrenEqual(node1.children, node2.children),
            code: () => node1.value === node2.value && node1.lang === node2.lang,
            link: () => node1.url === node2.url && this._childrenEqual(node1.children, node2.children),
            list: () => node1.ordered === node2.ordered && this._childrenEqual(node1.children, node2.children),
            inlineMath: () => node1.value === node2.value,
            math: () => node1.value === node2.value,
            default: () => this._childrenEqual(node1.children, node2.children)
        };

        const checker = equalityCheckers[node1.type] || equalityCheckers.default;
        return checker();
    }

    _childrenEqual(children1, children2) {
        if (!children1 && !children2) return true;
        if (!children1 || !children2 || children1.length !== children2.length) return false;
        return children1.every((child, index) => this._nodesEqual(child, children2[index]));
    }

    // HTML generation
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
            code: () => this.createCodeBlockHTML(node),
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
        if (isMermaidCode(node)) {
            return `<div class="mermaid-container">
                <div class="mermaid-loading">Loading diagram...</div>
            </div>`;
        }

        const language = node.lang || "plaintext"
        const escapedLanguage = this.escapeHtml(language)
        const codeContent = node.highlighted || this.escapeHtml(node.value)

        return `
            <div class="code-block-container">
                <div class="code-block-header">
                    <span class="code-language">${escapedLanguage}</span>
                    <button class="copy-code-btn">
                        ${this.copyIcon}<span class="copy-text"/>
                    </button>
                </div>
                <pre class="code-block"><code class="language-${escapedLanguage}">${codeContent}</code></pre>
            </div>
        `;
    }

    createCustomTagHTML(node) {
        const config = this.customTags.get(node.tagName);
        return config ? config.renderer(node.value) : `<div class="unknown-tag">${node.value}</div>`;
    }

    // Utility methods
    escapeHtml(text) {
        return this.htmlGenerators.escapeHtml(text);
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
}

customElements.define('incremental-markdown', IncrementalMarkdown);
