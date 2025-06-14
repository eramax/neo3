let mermaidInstance = null;

const loadMermaid = async () => {
    if (mermaidInstance) return mermaidInstance;

    const { default: mermaid } = await import('mermaid');

    mermaid.initialize({
        theme: 'dark',
        startOnLoad: false,
        securityLevel: 'loose',
        suppressErrorRendering: false,
        logLevel: 'error',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 14,
        themeVariables: {
            background: '#181a20',
            primaryColor: '#23272e',
            primaryTextColor: '#cbd5e1',
            primaryBorderColor: '#334155',
            lineColor: '#475569',
            secondaryColor: '#1e222a',
            tertiaryColor: '#334155',
            mainBkg: '#23272e',
            secondBkg: '#1e222a',
            nodeBorder: '#334155',
            clusterBkg: '#23272e',
            titleColor: '#cbd5e1'
        }
    });

    return mermaidInstance = mermaid;
};

export const renderMermaidDiagram = async (code, previewDiv) => {
    const mermaid = await loadMermaid();
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    previewDiv.innerHTML = '<div class="mermaid-loading">Rendering diagram...</div>';

    try {
        const { svg } = await mermaid.render(id, code.trim());
        previewDiv.innerHTML = svg;
    } catch (err) {
        previewDiv.innerHTML = `<div class="mermaid-error-container"><div class="mermaid-error"><p>Invalid Mermaid diagram: ${err.message || 'Syntax error'}</p></div></div>`;
    }
};
