let mermaidLoaded = false;
let mermaidInstance = null;

const loadMermaid = async () => {
    if (mermaidLoaded && mermaidInstance) return mermaidInstance;

    try {
        const mermaidModule = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
        mermaidInstance = mermaidModule.default;

        mermaidInstance.initialize({
            theme: 'base',
            startOnLoad: false,
            securityLevel: 'loose',
            suppressErrorRendering: true,
            logLevel: 'error',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            darkMode: true,
            themeVariables: {
                primaryColor: '#23272e',
                primaryTextColor: '#cbd5e1',
                primaryBorderColor: '#334155',
                lineColor: '#475569',
                sectionBkgColor: '#23272e',
                altSectionBkgColor: '#1e222a',
                gridColor: '#334155',
                secondaryColor: '#23272e',
                tertiaryColor: '#1e222a',
                background: '#181a20',
                mainBkg: '#23272e',
                secondBkg: '#1e222a',
                tertiaryBkg: '#334155',
                nodeBorder: '#334155',
                clusterBkg: '#23272e',
                clusterBorder: '#334155',
                defaultLinkColor: '#475569',
                titleColor: '#cbd5e1',
                edgeLabelBackground: '#23272e',
                actorBorder: '#334155',
                actorBkg: '#23272e',
                actorTextColor: '#cbd5e1',
                actorLineColor: '#475569',
                signalColor: '#cbd5e1',
                signalTextColor: '#cbd5e1',
                c0: '#23272e',
                c1: '#1e222a',
                c2: '#334155',
                c3: '#475569'
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
                svgElement.style.background = '#181a20';
                const elements = svgElement.querySelectorAll('*');
                elements.forEach(el => {
                    if (el.tagName === 'rect' || el.tagName === 'circle' || el.tagName === 'ellipse' || el.tagName === 'polygon') {
                        el.style.fill = '#23272e';
                        el.style.stroke = '#334155';
                        el.style.transition = 'fill 0.3s, stroke 0.3s, filter 0.3s';
                    }
                    if (el.tagName === 'text') {
                        el.style.fill = '#cbd5e1';
                        el.style.transition = 'fill 0.3s';
                    }
                    if (el.tagName === 'path') {
                        el.style.stroke = '#475569';
                        el.style.strokeDasharray = '6,3';
                        el.style.animation = 'flowPulse 2s linear infinite';
                        el.style.transition = 'stroke 0.3s, filter 0.3s';
                    }
                });

                const style = document.createElement('style');
                style.textContent = `
                    @keyframes flowPulse {
                        0% { stroke-dashoffset: 0; opacity: 0.6; }
                        50% { opacity: 1; }
                        100% { stroke-dashoffset: -9; opacity: 0.6; }
                    }
                    @keyframes arrowPulse {
                        0%, 100% { opacity: 0.7; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.1); }
                    }
                    .arrowheadPath {
                        animation: arrowPulse 2s ease-in-out infinite;
                    }
                    .edgePath .path, .flowchart-link, path {
                        stroke: #475569;
                        stroke-width: 2px;
                        stroke-dasharray: 6,3;
                        animation: flowPulse 2s linear infinite;
                        transition: stroke 0.3s, filter 0.3s;
                    }
                    .edgePath:hover .path, .flowchart-link:hover, path:hover {
                        stroke: #38bdf8;
                        filter: drop-shadow(0 0 4px #38bdf8);
                        stroke-width: 3px;
                    }
                    .node:hover rect, .node:hover circle, .node:hover ellipse, .node:hover polygon {
                        fill: #1e293b;
                        stroke: #64748b;
                        filter: drop-shadow(0 0 6px #64748b);
                    }
                    .node:hover text {
                        fill: #e2e8f0;
                    }
                `;
                svgElement.appendChild(style);
            }
        }, 100);

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
