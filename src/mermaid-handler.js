let mermaidLoaded = false;
let mermaidInstance = null;

const loadMermaid = async () => {
    if (mermaidLoaded && mermaidInstance) return mermaidInstance;

    try {
        const mermaidModule = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
        mermaidInstance = mermaidModule.default;

        mermaidInstance.initialize({
            theme: 'dark',
            startOnLoad: false,
            securityLevel: 'loose',
            fontFamily: 'monospace',
            darkMode: true
        });

        mermaidLoaded = true;
        return mermaidInstance;
    } catch (err) {
        console.error('Failed to load Mermaid:', err);
        throw err;
    }
};

export const renderMermaidDiagram = async (code, element) => {
    try {
        const mermaid = await loadMermaid();
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        element.innerHTML = '<div class="mermaid-loading">Rendering diagram...</div>';

        const { svg } = await mermaid.render(id, code.trim());
        element.innerHTML = svg;
        element.classList.add('mermaid-rendered');
        element.classList.remove('mermaid-loading');
    } catch (err) {
        console.error('Mermaid render error:', err);
        element.innerHTML = `<div class="mermaid-error">
            <p>Failed to render Mermaid diagram</p>
            <pre>${code}</pre>
        </div>`;
        element.classList.add('mermaid-error-container');
    }
};

export const isMermaidCode = (node) => node.type === 'code' && node.lang?.toLowerCase() === 'mermaid';
