import { renderMermaidDiagram, isMermaidCode } from "./Mermaid.js";

export class DomUtils {
    // DOM management
    _clearContainerDOM() {
        this._container.innerHTML = '';
    }

    _createElementFromHTML(htmlString) {
        if (!htmlString?.trim()) return null;
        const div = document.createElement('div');
        div.innerHTML = htmlString.trim();
        return div.firstChild;
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

        newChildren.forEach((newNode, i) => {
            const oldNode = oldChildren[i];
            const existingElement = this._container.children[i];

            if (!oldNode || !this._nodesEqual(newNode, oldNode)) {
                updatedIndices.push(i);
                newDomElements[i] = this._createOrUpdateElement(newNode, oldNode, existingElement);
            } else {
                newDomElements[i] = existingElement;
            }
        });

        return { updatedIndices, newDomElements };
    }

    _createOrUpdateElement(newNode, oldNode, existingElement) {
        if (existingElement && oldNode && this._canUpdateInPlace(newNode, oldNode)) {
            this._updateElementInPlace(existingElement, newNode, oldNode);
            return existingElement;
        }

        const html = this.createHTMLFromNode(newNode);
        return this._createElementFromHTML(html);
    }

    _applyDOMChanges(updatedIndices, newDomElements) {
        const oldDomNodes = [...this._container.children];

        updatedIndices.forEach(index => {
            const newEl = newDomElements[index];
            const oldEl = oldDomNodes[index];

            if (newEl && oldEl && newEl !== oldEl) {
                this._container.replaceChild(newEl, oldEl);
            }
        });

        this._adjustContainerLength(newDomElements, oldDomNodes);
    }

    _adjustContainerLength(newDomElements, oldDomNodes) {
        const newCount = newDomElements.length;
        const oldCount = oldDomNodes.length;

        if (newCount > oldCount) {
            const fragment = document.createDocumentFragment();
            for (let i = oldCount; i < newCount; i++) {
                newDomElements[i] && fragment.appendChild(newDomElements[i]);
            }
            this._container.appendChild(fragment);
        } else if (newCount < oldCount) {
            for (let i = oldCount - 1; i >= newCount; i--) {
                oldDomNodes[i] && this._container.removeChild(oldDomNodes[i]);
            }
        }
    }
}
