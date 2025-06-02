import { LitElement, html } from 'lit';

export class ModelSelector extends LitElement {
    static properties = {
        selectedModel: { type: String }, showModelSelector: { type: Boolean }, models: { type: Array },
        modelsLoading: { type: Boolean }, modelsError: { type: String }, ollamaUrl: { type: String },
        showUrlEditor: { type: Boolean }, tempUrl: { type: String }, connectionStatus: { type: String },
        newModelMode: { type: Boolean }, newModelUrl: { type: String }, newModelProgress: { type: Object },
        newModelError: { type: String }, onToggleModelSelector: { type: Function }, onSelectModel: { type: Function },
        onSaveUrl: { type: Function }, onSaveNewModel: { type: Function }, onLoadModels: { type: Function }
    };

    constructor() {
        super();
        Object.assign(this, {
            selectedModel: null, showModelSelector: false, models: [], modelsLoading: true,
            modelsError: null, ollamaUrl: "", showUrlEditor: false, tempUrl: "",
            connectionStatus: "checking", newModelMode: false, newModelUrl: "",
            newModelProgress: null, newModelError: null
        });
    }

    createRenderRoot() { return this; }

    get currentModel() { return this.models.find(m => m.id === this.selectedModel) || this.models[0]; }
    get filteredModels() { return this.models || []; }

    render() {
        return html`
            <div class="model-selector">
                <button class="model-trigger" @click=${() => this.onToggleModelSelector?.()} ?disabled=${this.modelsLoading}>
                    <span class="model-name">${this.currentModel?.name || "Select Model"}</span>
                    <span class="chevron ${this.showModelSelector ? 'open' : ''}">▼</span>
                </button>
                ${this.showModelSelector ? html`
                    <div class="model-dropdown">
                        <div class="server-config-compact">
                            ${this.showUrlEditor ? html`
                                <div class="server-status-indicator status-editing"></div>
                                <input type="text" .value=${this.tempUrl} @input=${e => this.tempUrl = e.target.value}
                                    placeholder="http://localhost:11434" class="server-url-input" />
                                <button class="server-action-btn save" @click=${() => this.onSaveUrl?.(this.tempUrl)} title="Save">✓</button>
                                <button class="server-action-btn cancel" @click=${() => this.showUrlEditor = false} title="Cancel">✕</button>
                            ` : html`
                                <div class="server-status-indicator status-${this.connectionStatus}"></div>
                                <span class="server-url-display">${this.ollamaUrl}</span>
                                <button class="server-action-btn edit" @click=${() => {
                        this.showUrlEditor = true;
                        this.tempUrl = this.ollamaUrl;
                    }} title="Edit">✎</button>
                            `}
                        </div>
                        ${this.modelsLoading ? html`
                            <div class="model-loading">
                                <div class="loading-spinner"></div>
                                <span>Loading models...</span>
                            </div>
                        ` : this.models.length > 0 ? html`
                            <div class="models-grid scrollable-model-list">
                                ${this.filteredModels.map(model => html`
                                    <button class="model-card single-line ${model.id === this.selectedModel ? 'selected' : ''}"
                                        @click=${() => this.onSelectModel?.(model.id)}>
                                        <span class="model-title-display" title="${model.name}">${model.name}</span>
                                        <span class="model-badges">
                                            <span class="badge size" title="Size">${model.size}</span>
                                            <span class="badge format" title="Format">${model.format}</span>
                                            <span class="badge arch" title="Architecture">${model.arch}</span>
                                        </span>
                                        ${model.link ? html`
                                            <a href="${model.link}" target="_blank" class="model-link-icon" title="Open details"
                                                @click=${e => e.stopPropagation()}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                    <polyline points="15,3 21,3 21,9"></polyline>
                                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                                </svg>
                                            </a>
                                        ` : ''}
                                    </button>
                                `)}
                                ${this.newModelMode ? html`
                                    <div class="model-card single-line new-model-row">
                                        <input class="new-model-input" type="text" .value=${this.newModelUrl}
                                            @input=${e => this.newModelUrl = e.target.value}
                                            placeholder="model name or URL (e.g. llama3)" autofocus
                                            @keydown=${e => {
                            e.key === "Enter" && this.onSaveNewModel?.(this.newModelUrl);
                            e.key === "Escape" && Object.assign(this, { newModelMode: false, newModelUrl: "", newModelProgress: null, newModelError: null });
                        }}
                                            ?disabled=${!!this.newModelProgress} />
                                        <button class="server-action-btn save" @click=${() => this.onSaveNewModel?.(this.newModelUrl)}
                                            ?disabled=${!this.newModelUrl.trim() || !!this.newModelProgress} title="Pull model">✓</button>
                                        <button class="server-action-btn cancel" @click=${() => Object.assign(this, {
                            newModelMode: false, newModelUrl: "", newModelProgress: null, newModelError: null
                        })} title="Cancel">✕</button>
                                        ${this.newModelProgress ? html`<span class="new-model-progress">
                                            ${this.newModelProgress.status}${typeof this.newModelProgress.percent === "number" ? ` (${this.newModelProgress.percent}%)` : ''}
                                        </span>` : ''}
                                        ${this.newModelError ? html`<span class="new-model-error">${this.newModelError}</span>` : ''}
                                    </div>
                                ` : html`
                                    <button class="model-card single-line new-model-row" @click=${() => Object.assign(this, {
                            newModelMode: true, newModelUrl: "", newModelProgress: null, newModelError: null
                        })} title="Pull new model">
                                        <span class="model-title-display">+ New model</span>
                                    </button>
                                `}
                            </div>
                        ` : html`
                            <div class="no-connection">
                                <div class="no-connection-icon">🔌</div>
                                <span>No connection to Ollama</span>
                                <button @click=${() => this.onLoadModels?.()} class="retry-btn-compact">↻ Retry</button>
                            </div>
                        `}
                    </div>
                ` : ''}
            </div>
        `;
    }
}

customElements.define('model-selector', ModelSelector);
