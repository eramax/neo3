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
                    fill: #1a1a2e;
                    stroke: #4a9eff;
                    stroke-width: 1.5px;
                    filter: drop-shadow(0 0 6px rgba(74, 158, 255, 0.2));
                }
                .edgePath .path {
                    stroke: #64748b;
                    stroke-width: 2px;
                    stroke-dasharray: 8,4;
                    animation: flowMove 3s linear infinite;
                }
                .arrowheadPath {
                    fill: #4a9eff;
                    stroke: #4a9eff;
                    animation: arrowPulse 2s ease-in-out infinite;
                }
                .edgeLabel {
                    background-color: rgba(26, 26, 46, 0.85);
                    color: #d1d5db;
                    border-radius: 4px;
                    padding: 2px 6px;
                }
                .label {
                    color: #d1d5db;
                    fill: #d1d5db;
                    font-weight: 400;
                }
                .cluster rect {
                    fill: rgba(30, 41, 59, 0.4);
                    stroke: #374151;
                    stroke-width: 1px;
                    stroke-dasharray: 5,5;
                }
                .flowchart-link {
                    stroke: #64748b;
                    stroke-dasharray: 8,4;
                    animation: flowMove 3s linear infinite;
                }
                .actor {
                    fill: #1a1a2e;
                    stroke: #4a9eff;
                    stroke-width: 1.5px;
                }
                text, text.actor, .messageText, .noteText {
                    fill: #d1d5db;
                    color: #d1d5db;
                    font-weight: 400;
                }
                .messageLine0, .messageLine1 {
                    stroke: #64748b;
                    stroke-width: 1.5px;
                    stroke-dasharray: 6,3;
                    animation: flowMove 4s linear infinite;
                }
                text[text-anchor], .nodeLabel, .edgeLabel {
                    fill: #d1d5db;
                }
                @keyframes flowMove {
                    0% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: 12; }
                }
                @keyframes arrowPulse {
                    0%, 100% { opacity: 0.7; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.1); }
                }
            `,
            themeVariables: {
                primaryColor: '#1a1a2e',
                primaryTextColor: '#d1d5db',
                primaryBorderColor: '#4a9eff',
                lineColor: '#64748b',
                sectionBkgColor: '#0f172a',
                altSectionBkgColor: '#1a1a2e',
                gridColor: '#374151',
                secondaryColor: '#1e293b',
                tertiaryColor: '#0f172a',
                background: '#0f172a',
                mainBkg: '#1a1a2e',
                secondBkg: '#1e293b',
                tertiaryBkg: '#374151',
                nodeBorder: '#4a9eff',
                clusterBkg: '#1e293b',
                clusterBorder: '#374151',
                defaultLinkColor: '#64748b',
                titleColor: '#d1d5db',
                edgeLabelBackground: '#1a1a2e',
                actorBorder: '#4a9eff',
                actorBkg: '#1a1a2e',
                actorTextColor: '#d1d5db',
                actorLineColor: '#64748b',
                signalColor: '#d1d5db',
                signalTextColor: '#d1d5db',
                c0: '#4a9eff',
                c1: '#3b82f6',
                c2: '#2563eb',
                c3: '#1d4ed8'
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
        element.innerHTML = svg;
        element.classList.add('mermaid-rendered');

        setTimeout(() => {
            const svgElement = element.querySelector('svg');
            if (svgElement) {
                const style = document.createElement('style');
                style.textContent = `
                    .edgePath .path, .flowchart-link {
                        stroke-dasharray: 8,4;
                        animation: flowMove 3s linear infinite;
                    }
                    .arrowheadPath {
                        animation: arrowPulse 2s ease-in-out infinite;
                    }
                    .messageLine0, .messageLine1 {
                        stroke-dasharray: 6,3;
                        animation: flowMove 4s linear infinite;
                    }
                    @keyframes flowMove {
                        0% { stroke-dashoffset: 0; }
                        100% { stroke-dashoffset: 12; }
                    }
                    @keyframes arrowPulse {
                        0%, 100% { opacity: 0.7; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.1); }
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
