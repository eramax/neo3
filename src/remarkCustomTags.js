import { visit } from "unist-util-visit";

export const remarkCustomTags = (options = {}) => {
    const registeredTags = new Map(Object.entries(options.tags || {}));

    return (tree) => {
        const nodesToRemove = [];
        let openTag = null;
        let content = '';
        let startIndex = -1;
        let parentNode = null;

        visit(tree, (node, index, parent) => {
            if (node.type === 'html' && parent) {
                for (const [tagName, config] of registeredTags) {
                    if (node.value.includes(`<${tagName}>`)) {
                        if (!openTag) {
                            openTag = tagName;
                            content = node.value.split(`<${tagName}>`)[1] || '';
                            startIndex = index;
                            parentNode = parent;

                            if (content.includes(`</${tagName}>`)) {
                                parent.children[index] = {
                                    type: tagName,
                                    tagName,
                                    value: content.split(`</${tagName}>`)[0].trim(),
                                    config
                                };
                                openTag = null;
                                return;
                            }
                        }
                    }

                    if (openTag === tagName && node.value.includes(`</${tagName}>`)) {
                        content += node.value.split(`</${tagName}>`)[0];

                        parentNode.children[startIndex] = {
                            type: tagName,
                            tagName,
                            value: content.trim(),
                            config
                        };

                        for (let i = startIndex + 1; i <= index; i++) {
                            nodesToRemove.push({ parent: parentNode, index: i });
                        }

                        openTag = null;
                        return;
                    }
                }

                if (openTag && index !== startIndex) {
                    content += node.value;
                    nodesToRemove.push({ parent, index });
                }
            } else if (openTag && parent) {
                const nodeText = node.type === 'text' ? node.value : '';
                content += nodeText;
                nodesToRemove.push({ parent, index });
            }
        });

        if (openTag && parentNode) {
            parentNode.children[startIndex] = {
                type: openTag,
                tagName: openTag,
                value: content.trim(),
                config: registeredTags.get(openTag)
            };
        }

        nodesToRemove.reverse().forEach(({ parent, index }) => {
            parent.children.splice(index, 1);
        });
    };
};

export const createDefaultTags = () => ({
    'think': {
        renderer: (content) => `
            <details class="think-block">
                <summary>Thinking process</summary>
                <div class="think-content">${content}</div>
            </details>
        `
    }
});
