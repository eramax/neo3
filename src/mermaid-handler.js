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
            suppressErrorRendering: true,
            logLevel: 'error',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            darkMode: true,
            themeCSS: `
                .node rect, .node circle, .node ellipse, .node polygon, .node path {
                    fill: #1e293b !important;
                    stroke: #475569 !important;
                    stroke-width: 1px !important;
                }
                .edgePath .path {
                    stroke: #64748b !important;
                    stroke-width: 1.5px !important;
                }
                .edgeLabel {
                    background-color: transparent !important;
                    color: #e2e8f0 !important;
                }
                .label {
                    color: #e2e8f0 !important;
                    fill: #e2e8f0 !important;
                }
                .cluster rect {
                    fill: #1e293b !important;
                    stroke: #475569 !important;
                    stroke-width: 1px !important;
                }
                .flowchart-link {
                    stroke: #64748b !important;
                }
                .actor {
                    fill: #1e293b !important;
                    stroke: #475569 !important;
                }
                text, text.actor, .messageText, .noteText {
                    fill: #e2e8f0 !important;
                    color: #e2e8f0 !important;
                }
                .messageLine0, .messageLine1 {
                    stroke: #64748b !important;
                }
                text[text-anchor], .nodeLabel, .edgeLabel {
                    fill: #e2e8f0 !important;
                }
            `,
            themeVariables: {
                primaryColor: '#1e293b',
                primaryTextColor: '#e2e8f0',
                primaryBorderColor: '#475569',
                lineColor: '#64748b',
                sectionBkgColor: '#0f172a',
                altSectionBkgColor: '#1e293b',
                gridColor: '#475569',
                secondaryColor: '#334155',
                tertiaryColor: '#0f172a',
                background: '#0f172a',
                mainBkg: '#1e293b',
                secondBkg: '#334155',
                tertiaryBkg: '#475569'
            }
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
        const processedSvg = svg.replace('<svg ', '<svg data-theme="dark" ');

        element.innerHTML = processedSvg;
        element.classList.add('mermaid-rendered');

        setTimeout(() => {
            const svgElement = element.querySelector('svg');
            if (svgElement) {
                const style = document.createElement('style');
                style.textContent = `
                    svg[data-theme="dark"] .node rect,
                    svg[data-theme="dark"] .node circle,
                    svg[data-theme="dark"] .node ellipse,
                    svg[data-theme="dark"] .node polygon,
                    svg[data-theme="dark"] .node path {
                        fill: #1e293b !important;
                        stroke: #475569 !important;
                    }
                    svg[data-theme="dark"] .edgePath .path {
                        stroke: #64748b !important;
                    }
                    svg[data-theme="dark"] text {
                        fill: #e2e8f0 !important;
                    }
                `;
                svgElement.appendChild(style);
            }
        }, 50);

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
