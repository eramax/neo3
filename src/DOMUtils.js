export class DOMUtils {
    _clearContainerDOM() {
        this._container.innerHTML = '';
    }

    _createElementFromHTML(htmlString) {
        if (!htmlString || typeof htmlString !== 'string') return null;
        const div = document.createElement('div');
        div.innerHTML = htmlString.trim();
        return div.firstChild;
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
            const html = this.createHTMLFromNode(newChild);
            const newElement = this._createElementFromHTML(html);
            if (newElement) {
                if (isMermaidCode(newChild)) {
                    setTimeout(() => renderMermaidDiagram(newChild.value, newElement), 0);
                }
                if (existingChild) {
                    element.replaceChild(newElement, existingChild);
                } else {
                    element.appendChild(newElement);
                }
            }
        }
    }
}
