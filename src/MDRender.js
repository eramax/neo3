import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { remarkSyntaxHighlight } from "./syntax-highlighter.js";
import { DomUtils } from "./DomUtils.js";
import { remarkCustomTags } from "./remarkCustomTags.js";
import { HTMLGenerators } from "./HTMLGenerators.js";
import { renderMermaidDiagram, isMermaidCode } from "./Mermaid.js";

// Constants
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
        this.registerCustomTag('think', {
            renderer: (content) => `
                <div class="think-block">
                    <div class="think-header">Thinking process</div>
                    <div class="think-content hidden">${content}</div>
                </div>
            `
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
        this._internalContent = value;
        this._updateRenderedContent();
    }

    get copyIcon() {
        return this.htmlGenerators.copyIcon;
    }

    // Content preprocessing
    _preprocessContent(value) {
        return value;
    }    // Event handling
    _setupEventListeners() {
        this._container.addEventListener('click', (event) => {
            const thinkHeader = event.target.closest('.think-header');
            if (thinkHeader) {
                const thinkContent = thinkHeader.nextElementSibling;
                if (thinkContent) {
                    thinkContent.classList.toggle('hidden');
                }
            }

            const copyButton = event.target.closest('.copy-code-btn');
            if (copyButton) {
                const codeElement = copyButton.closest('.code-block-container')?.querySelector('pre code');
                if (codeElement && window.copyCodeToClipboard) {
                    window.copyCodeToClipboard(copyButton, codeElement.textContent);
                }
            } const previewButton = event.target.closest('.preview-btn');
            if (previewButton) {
                const container = previewButton.closest('.code-block-container');
                const codeElement = container?.querySelector('pre code');
                const mermaidCode = codeElement?.textContent;

                if (mermaidCode) {
                    let previewDiv = container.querySelector('.mermaid-preview-popup');
                    if (previewDiv) {
                        previewDiv.remove();
                        return;
                    }

                    previewDiv = document.createElement('div');
                    previewDiv.className = 'mermaid-preview-popup';
                    previewDiv.innerHTML = '<div class="mermaid-loading">Rendering diagram...</div>';
                    container.appendChild(previewDiv);

                    renderMermaidDiagram(mermaidCode, previewDiv);
                }
            }
        });
    }

    // DOM management
    _clearContainerDOM() {
        this._container.innerHTML = '';
    }

    _createElementFromHTML(htmlString) {
        if (!htmlString || typeof htmlString !== 'string') return null;
        const div = document.createElement('div');
        div.innerHTML = htmlString.trim();
        return div.firstChild;
    }

    // Main rendering logic
    _updateRenderedContent() {
        if (!this.content) {
            this._clearContainerDOM();
            this.processedLength = 0;
            this._lastProcessedAst = null;
            return;
        }

        const newAst = this.processor.parse(this.content);
        const transformedAst = this.processor.runSync(newAst);

        this._updateDOM(transformedAst);
        this._lastProcessedAst = transformedAst;
        this.processedLength = this.content.length;
    }

    _createOrUpdateElement(newNode, oldNode, existingElement) {
        if (existingElement && oldNode && this._canUpdateInPlace(newNode, oldNode)) {
            this._updateElementInPlace(existingElement, newNode, oldNode);
            return existingElement;
        }

        const html = this.htmlGenerators.createHTMLFromNode(newNode);
        const element = this._createElementFromHTML(html);

        return element;
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

    _applyDOMChanges(updatedIndices, newDomElements) {
        const oldDomNodes = Array.from(this._container.children);

        // Replace changed elements
        updatedIndices.forEach(index => {
            const newElement = newDomElements[index];
            const oldElement = oldDomNodes[index];

            if (newElement && oldElement && newElement !== oldElement) {
                this._container.replaceChild(newElement, oldElement);
            }
        });

        // Handle length differences
        this._adjustContainerLength(newDomElements, oldDomNodes);
    }

    _adjustContainerLength(newDomElements, oldDomNodes) {
        const newCount = newDomElements.length;
        const oldCount = oldDomNodes.length;

        if (newCount > oldCount) {
            const fragment = document.createDocumentFragment();
            for (let i = oldCount; i < newCount; i++) {
                if (newDomElements[i]) {
                    fragment.appendChild(newDomElements[i]);
                }
            }
            this._container.appendChild(fragment);
        } else if (newCount < oldCount) {
            for (let i = oldCount - 1; i >= newCount; i--) {
                if (oldDomNodes[i]) {
                    this._container.removeChild(oldDomNodes[i]);
                }
            }
        }
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
            default: () => this._updateChildrenInPlace(element, newNode.children, oldNode.children)
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
        this._updateChildrenInPlace(element, newNode.children, oldNode.children);
        return true;
    }

    _updateLinkNode(element, newNode, oldNode) {
        if (newNode.url !== oldNode.url) {
            element.href = newNode.url;
        }
        this._updateChildrenInPlace(element, newNode.children, oldNode.children);
        return true;
    }

    _updateListNode(element, newNode, oldNode) {
        if (newNode.ordered !== oldNode.ordered) return false;
        this._updateChildrenInPlace(element, newNode.children, oldNode.children);
        return true;
    }

    _updateHtmlNode(element, newNode) {
        element.innerHTML = newNode.value;
        return true;
    } _updateCodeBlock(element, newNode, oldNode) {
        const codeElement = element.querySelector('pre code');
        const languageSpan = element.querySelector('.code-language');

        if (codeElement && newNode.value !== oldNode.value) {
            codeElement.innerHTML = newNode.highlighted || this.htmlGenerators.escapeHtml(newNode.value);
        }

        if (languageSpan && newNode.lang !== oldNode.lang) {
            languageSpan.textContent = newNode.lang || "plaintext";
        }
    }

    _updateMathNode(element, newNode) {
        const html = this.htmlGenerators.renderMath(newNode.value, newNode.type === 'math');
        element.innerHTML = html;
        return true;
    }

    _updateChildrenInPlace(element, newChildren, oldChildren) {
        if (!newChildren) {
            element.innerHTML = '';
            return;
        }

        const oldChildNodes = Array.from(element.childNodes);
        const newChildrenCount = newChildren.length;

        for (let i = 0; i < newChildrenCount; i++) {
            this._updateOrCreateChild(element, newChildren[i], oldChildren?.[i], oldChildNodes[i], i);
        }

        // Remove excess children
        for (let i = oldChildNodes.length - 1; i >= newChildrenCount; i--) {
            if (oldChildNodes[i]) {
                element.removeChild(oldChildNodes[i]);
            }
        }
    }

    _updateOrCreateChild(element, newChild, oldChild, existingChild, index) {
        if (newChild.type === 'text') {
            this._handleTextChild(element, newChild, existingChild);
        } else {
            this._handleElementChild(element, newChild, oldChild, existingChild);
        }
    }

    _handleTextChild(element, newChild, existingChild) {
        if (existingChild?.nodeType === Node.TEXT_NODE) {
            existingChild.textContent = newChild.value;
        } else {
            const textNode = document.createTextNode(newChild.value);
            if (existingChild) {
                element.replaceChild(textNode, existingChild);
            } else {
                element.appendChild(textNode);
            }
        }
    }

    _handleElementChild(element, newChild, oldChild, existingChild) {
        const canUpdate = existingChild?.nodeType === Node.ELEMENT_NODE &&
            oldChild && this._canUpdateInPlace(newChild, oldChild);

        if (canUpdate) {
            this._updateElementInPlace(existingChild, newChild, oldChild);
        } else {
            const html = this.htmlGenerators.createHTMLFromNode(newChild);
            const newElement = this._createElementFromHTML(html);
            if (newElement) {
                existingChild ? element.replaceChild(newElement, existingChild) : element.appendChild(newElement);
            }
        }
    }

    // Node comparison
    _nodesEqual(node1, node2) {
        if (!node1 || !node2 || node1.type !== node2.type) return false;

        if (this.customTags.has(node1.type)) {
            return node1.value === node2.value;
        }

        const checkers = {
            text: () => node1.value === node2.value,
            inlineCode: () => node1.value === node2.value,
            html: () => node1.value === node2.value,
            heading: () => node1.depth === node2.depth && this._childrenEqual(node1.children, node2.children),
            code: () => node1.value === node2.value && node1.lang === node2.lang,
            link: () => node1.url === node2.url && this._childrenEqual(node1.children, node2.children),
            list: () => node1.ordered === node2.ordered && this._childrenEqual(node1.children, node2.children),
            inlineMath: () => node1.value === node2.value,
            math: () => node1.value === node2.value
        };

        return checkers[node1.type]?.() ?? this._childrenEqual(node1.children, node2.children);
    }

    _childrenEqual = (c1, c2) => !c1 && !c2 ? true : c1?.length === c2?.length && c1?.every((child, i) => this._nodesEqual(child, c2[i]));
}

customElements.define('incremental-markdown', IncrementalMarkdown);
