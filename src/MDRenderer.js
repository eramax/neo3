import MDTokenizer from "./MDTokenizer.js";
import "./CodeBlock.js"; // Ensure CodeBlock is registered


export class MDRenderer extends HTMLElement {
    constructor() {
        super();
        this._internalContent = '';
        this._container = document.createElement('div');
        this._lastProcessedTokens = null;

        // Use MDTokenizer instead of marked
        this.lexer = new MDTokenizer();
    }

    connectedCallback() {
        if (!this._container.parentNode) {
            this.appendChild(this._container);
        }
        // If content is set and we haven't rendered yet
        if (this._internalContent && !this._lastProcessedTokens) {
            this._updateRenderedContent();
        }
    }

    get content() {
        return this._internalContent;
    }

    set content(value) {
        if (this._internalContent === value) return;
        this._internalContent = value
        this._updateRenderedContent();
    }

    _tokenHasChildren(token) {
        if (!token) return false;
        switch (token.type) {
            case 'list': return token.items && token.items.length > 0;
            case 'blockquote':
            case 'list_item':
            case 'paragraph':
            case 'heading':
            case 'strong':
            case 'em':
            case 'del':
            case 'link':
            case 'text': // Added 'text'
                return token.tokens && token.tokens.length > 0;
            case 'table': // Diffing table internals granularly is complex.
                // For now, table is replaced if raw content changes.
                return false;
            default:
                return false;
        }
    }

    _getChildTokens(token) {
        if (!token) return [];
        switch (token.type) {
            case 'list': return token.items || [];
            case 'blockquote':
            case 'list_item':
            case 'paragraph':
            case 'heading':
            case 'strong':
            case 'em':
            case 'del':
            case 'link':
            case 'text': // Added 'text'
                return token.tokens || [];
            default:
                return [];
        }
    }

    _getChildContainerForTokenElement(element, tokenType) {
        if (!element) return null;
        // For most block or inline elements that contain children,
        // the element itself is the container.
        return element;
    }

    _createDOMElementForToken(token) {
        let el;
        switch (token.type) {
            case 'space':
                return document.createTextNode('\n');
            case 'hr':
                el = document.createElement('hr');
                break;
            case 'heading':
                el = document.createElement(`h${token.depth}`);
                this._renderInlineTokens(el, token.tokens || [{ type: 'text', text: token.text, raw: token.text }]);
                break;
            case 'code':
                el = document.createElement('code-block');
                el.setAttribute('language', token.lang || 'plaintext');
                el.setAttribute('code', token.text);
                break;
            case 'table':
                el = document.createElement('table');
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                token.header.forEach(headerCell => {
                    const th = document.createElement('th');
                    this._renderInlineTokens(th, headerCell.tokens || [{ type: 'text', text: headerCell.text, raw: headerCell.text }]);
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                el.appendChild(thead);
                const tbody = document.createElement('tbody');
                token.rows.forEach(row => {
                    const tr = document.createElement('tr');
                    row.forEach(cell => {
                        const td = document.createElement('td');
                        this._renderInlineTokens(td, cell.tokens || [{ type: 'text', text: cell.text, raw: cell.text }]);
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });
                el.appendChild(tbody);
                break;
            case 'blockquote':
                el = document.createElement('blockquote');
                this._renderTokensToParent(el, token.tokens || []);
                break;
            case 'list':
                el = document.createElement(token.ordered ? 'ol' : 'ul');
                if (token.start && token.ordered) {
                    el.setAttribute('start', token.start);
                }
                token.items.forEach(item => {
                    el.appendChild(this._createDOMElementForToken(item));
                });
                break;
            case 'list_item':
                el = document.createElement('li');
                if (token.task) {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.disabled = true;
                    checkbox.checked = token.checked;
                    el.appendChild(checkbox);
                    el.classList.add('task-list-item');
                    if (token.checked) el.classList.add('checked');
                }
                this._renderTokensToParent(el, token.tokens || []);
                break;
            case 'paragraph':
                el = document.createElement('p');
                this._renderInlineTokens(el, token.tokens || [{ type: 'text', text: token.text, raw: token.text }]);
                break;
            case 'html':
                // Use a template element to parse HTML string to DOM nodes
                const template = document.createElement('template');
                template.innerHTML = token.text.trim();
                if (template.content.childNodes.length === 1 && template.content.firstChild.nodeType !== Node.TEXT_NODE) {
                    el = template.content.firstChild; // Return the element itself if it's a single root
                } else {
                    // Otherwise, wrap in a div or return a fragment (though fragments are harder to manage as single `el`)
                    el = document.createElement('div');
                    el.appendChild(template.content);
                }
                break;
            case 'text':
                // If a text token has nested tokens, render them instead of plain text
                if (token.tokens && token.tokens.length > 0) {
                    const fragment = document.createDocumentFragment();
                    this._renderInlineTokens(fragment, token.tokens);
                    return fragment;
                }
                return document.createTextNode(token.text); // Fallback to plain text
            case 'escape':
                return document.createTextNode(token.text);
            case 'link':
                el = document.createElement('a');
                el.href = token.href;
                if (token.title) el.title = token.title;
                this._renderInlineTokens(el, token.tokens || [{ type: 'text', text: token.text, raw: token.text }]);
                break;
            case 'image':
                el = document.createElement('img');
                el.src = token.href;
                el.alt = token.text;
                if (token.title) el.title = token.title;
                break;
            case 'strong':
                el = document.createElement('strong');
                this._renderInlineTokens(el, token.tokens || [{ type: 'text', text: token.text, raw: token.text }]);
                break;
            case 'em':
                el = document.createElement('em');
                this._renderInlineTokens(el, token.tokens || [{ type: 'text', text: token.text, raw: token.text }]);
                break;
            case 'codespan':
                el = document.createElement('code');
                el.textContent = token.text;
                el.className = 'inline-code'; // Added class
                break;
            case 'br':
                el = document.createElement('br');
                break;
            case 'del':
                el = document.createElement('del');
                this._renderInlineTokens(el, token.tokens || [{ type: 'text', text: token.text, raw: token.text }]);
                break;
            case 'think':
                el = document.createElement('details');
                el.classList.add('thinking-details'); // Added class
                el.open = false; // closed by default to show thinking state
                const summary = document.createElement('summary');
                summary.classList.add('thinking-summary'); // Added class
                summary.textContent = 'Thinking...';
                el.appendChild(summary);
                // Wrap text content in a paragraph or div for better styling control if needed
                // For now, direct text node as per original logic
                const contentNode = document.createTextNode(token.text);
                el.appendChild(contentNode);
                break;
            default:
                el = document.createComment(`Unhandled token: ${token.type}`);
        }
        if (el && el.nodeType !== Node.COMMENT_NODE && el.nodeType !== Node.TEXT_NODE) {
            el._mdToken = token; // Associate token for potential future advanced diffing
        }
        return el;
    }

    _renderInlineTokens(parentElement, inlineTokens) {
        inlineTokens.forEach(inlineToken => {
            parentElement.appendChild(this._createDOMElementForToken(inlineToken));
        });
    }

    _renderTokensToParent(parentElement, tokens) {
        tokens.forEach(token => {
            parentElement.appendChild(this._createDOMElementForToken(token));
        });
    }

    _diffAndUpdateDOM(parentElement, oldTokens, newTokens) {
        const requests = [];
        const newLen = newTokens.length;
        const oldLen = oldTokens.length;
        const maxLen = Math.max(oldLen, newLen);

        for (let i = 0; i < maxLen; i++) {
            const oldToken = oldTokens[i];
            const newToken = newTokens[i];
            const domNode = parentElement.childNodes[i];

            if (newToken && oldToken) {
                // Specific handling for 'think' token text updates
                if (newToken.type === 'think' && oldToken.type === 'think' &&
                    domNode && domNode.nodeName === 'DETAILS' && newToken.text !== oldToken.text) {

                    // Attempt to update the text node directly.
                    // This assumes the text node is the last child of the <details> element, after the <summary>.
                    if (domNode.lastChild && domNode.lastChild.nodeType === Node.TEXT_NODE) {
                        domNode.lastChild.nodeValue = newToken.text;
                        domNode._mdToken = newToken; // Update token association
                    } else {
                        // Fallback: Unexpected structure or no text node, replace the element
                        if (domNode) { // Ensure domNode exists before attempting removal
                            requests.push({ action: 'remove', element: domNode });
                        }
                        const newElement = this._createDOMElementForToken(newToken);
                        requests.push({ action: 'add', parentElement, element: newElement, token: newToken, atIndex: i });
                    }
                } // Original general diffing logic
                else if (newToken.type === oldToken.type &&
                    newToken.raw === oldToken.raw &&
                    this._tokenHasChildren(newToken) === this._tokenHasChildren(oldToken)) {
                    if (domNode) {
                        domNode._mdToken = newToken; // Update token association
                        if (this._tokenHasChildren(newToken)) {
                            const childOldTokens = this._getChildTokens(oldToken);
                            const childNewTokens = this._getChildTokens(newToken);
                            const childContainer = this._getChildContainerForTokenElement(domNode, newToken.type);
                            if (childContainer) {
                                requests.push(...this._diffAndUpdateDOM(childContainer, childOldTokens, childNewTokens));
                            }
                        }
                    }
                } else { // Element needs replacement (type changed, raw changed generally, or children status changed)
                    if (domNode) {
                        requests.push({ action: 'remove', element: domNode });
                    }
                    const newElement = this._createDOMElementForToken(newToken);
                    requests.push({ action: 'add', parentElement, element: newElement, token: newToken, atIndex: i });
                }
            } else if (newToken) {
                const newElement = this._createDOMElementForToken(newToken);
                requests.push({ action: 'add', parentElement, element: newElement, token: newToken, atIndex: i });
            } else if (oldToken) {
                if (domNode) {
                    requests.push({ action: 'remove', element: domNode });
                }
            }
        }
        return requests;
    }

    _applyDOMUpdates(requests) {
        requests.filter(req => req.action === 'remove').forEach(req => {
            if (req.element && req.element.parentNode) {
                req.element.parentNode.removeChild(req.element);
            }
        });

        requests.filter(req => req.action === 'add').forEach(req => {
            const targetNode = req.parentElement.childNodes[req.atIndex];
            req.parentElement.insertBefore(req.element, targetNode || null);
        });
    }

    _updateRenderedContent() {
        if (!this.isConnected) return;

        const newTokens = this.lexer.tokenize(this._internalContent || '');

        if (!this._lastProcessedTokens) {
            this._container.innerHTML = '';
            this._renderTokensToParent(this._container, newTokens);
        } else {
            const updateRequests = this._diffAndUpdateDOM(this._container, this._lastProcessedTokens, newTokens);
            this._applyDOMUpdates(updateRequests);
        }

        this._lastProcessedTokens = JSON.parse(JSON.stringify(newTokens));
    }
}

customElements.define('markdown-block', MDRenderer);