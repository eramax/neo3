import { LitElement, html } from 'lit';

export class ModelSelector extends LitElement {
    static properties = {
        selectedModel: { type: String }, selectedProvider: { type: String }, showModelSelector: { type: Boolean },
        models: { type: Array }, modelsLoading: { type: Boolean }, modelsError: { type: String },
        providers: { type: Object }, showProviderConfig: { type: Boolean }, editingProvider: { type: String },
        tempConfig: { type: Object }, connectionStatus: { type: String }, newModelMode: { type: Boolean },
        newModelUrl: { type: String }, newModelProgress: { type: Object }, newModelError: { type: String },
        expandedProviders: { type: Set }, onToggleModelSelector: { type: Function }, onSelectModel: { type: Function },
        onSelectProvider: { type: Function }, onSaveProviderConfig: { type: Function }, onSaveNewModel: { type: Function },
        onLoadModels: { type: Function }
    };

    static defaultProviders = {
        ollama: { name: 'Ollama', url: 'http://localhost:11434', apiKey: '', requiresApiKey: false },
        openai: { name: 'OpenAI', url: 'https://api.openai.com/v1', apiKey: '', requiresApiKey: true },
        openrouter: { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', apiKey: '', requiresApiKey: true },
        deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', apiKey: '', requiresApiKey: true },
        anthropic: { name: 'Anthropic', url: 'https://api.anthropic.com/v1', apiKey: '', requiresApiKey: true },
        google: { name: 'Google AI', url: 'https://generativelanguage.googleapis.com/v1', apiKey: '', requiresApiKey: true }
    }; constructor() {
        super();
        Object.assign(this, {
            selectedModel: null, selectedProvider: 'ollama', showModelSelector: false, models: [],
            modelsLoading: true, modelsError: null, providers: { ...ModelSelector.defaultProviders },
            showProviderConfig: false, editingProvider: null, tempConfig: {}, connectionStatus: "checking",
            newModelMode: false, newModelUrl: "", newModelProgress: null, newModelError: null,
            expandedProviders: new Set(['ollama']) // Start with Ollama expanded
        });
    } createRenderRoot() { return this; } get currentModel() { return this.filteredModels.find(m => m.id === this.selectedModel) || null; }
    get currentProvider() { return this.providers[this.selectedProvider] || this.providers.ollama; } get filteredModels() {
        return (this.models || []).filter(model => model.provider === this.selectedProvider);
    } toggleProvider(providerId) {
        const newExpanded = new Set(this.expandedProviders);
        if (newExpanded.has(providerId)) {
            newExpanded.delete(providerId);
        } else {
            newExpanded.add(providerId);
        }
        this.expandedProviders = newExpanded;
        this.requestUpdate();
    }

    selectProvider(providerId) {
        this.selectedProvider = providerId;
        this.onSelectProvider?.(providerId);
        // Auto-expand when selecting a provider
        if (!this.expandedProviders.has(providerId)) {
            this.toggleProvider(providerId);
        }
    }

    startProviderEdit(providerId) {
        Object.assign(this, {
            editingProvider: providerId,
            tempConfig: { ...this.providers[providerId] },
            showProviderConfig: true
        });
    }

    saveProviderConfig() {
        this.providers[this.editingProvider] = { ...this.tempConfig };
        this.onSaveProviderConfig?.(this.editingProvider, this.tempConfig);
        Object.assign(this, { showProviderConfig: false, editingProvider: null, tempConfig: {} });
    }

    cancelProviderEdit() {
        Object.assign(this, { showProviderConfig: false, editingProvider: null, tempConfig: {} });
    }

    renderProviderConfig() {
        if (!this.showProviderConfig || !this.editingProvider) return '';
        const config = this.tempConfig;
        return html`
            <div class="provider-config-overlay">
                <div class="provider-config-modal">
                    <div class="provider-config-header">
                        <h3>Configure ${config.name}</h3>
                        <button class="close-btn" @click=${this.cancelProviderEdit}>✕</button>
                    </div>
                    <div class="provider-config-form">
                        <label>Server URL:</label>
                        <input type="text" .value=${config.url} @input=${e => this.tempConfig = { ...this.tempConfig, url: e.target.value }}
                            placeholder="https://api.example.com/v1" />
                        ${config.requiresApiKey ? html`
                            <label>API Key:</label>
                            <input type="password" .value=${config.apiKey} @input=${e => this.tempConfig = { ...this.tempConfig, apiKey: e.target.value }}
                                placeholder="Enter your API key" />
                        ` : ''}
                    </div>
                    <div class="provider-config-actions">
                        <button class="save-btn" @click=${this.saveProviderConfig}>Save</button>
                        <button class="cancel-btn" @click=${this.cancelProviderEdit}>Cancel</button>
                    </div>
                </div>
            </div>
        `;
    } render() {
        return html`
            <div class="model-selector">
                <button class="model-trigger" @click=${() => this.onToggleModelSelector?.()} ?disabled=${this.modelsLoading}>
                    <span class="provider-badge">${this.currentProvider.name}</span>
                    <span class="model-name">${this.currentModel?.name || "Select Model"}</span>
                    <span class="chevron ${this.showModelSelector ? 'open' : ''}">▼</span>
                </button>${this.showModelSelector ? html`
                    <div class="model-dropdown">
                        <div class="provider-accordion">
                            ${Object.entries(this.providers).map(([id, provider]) => html`
                                <div class="accordion-item ${this.selectedProvider === id ? 'selected' : ''}">
                                    <div class="accordion-header" @click=${() => this.toggleProvider(id)}>
                                        <div class="provider-info">
                                            <span class="provider-name">${provider.name}</span>
                                            ${this.selectedProvider === id ? html`<span class="active-badge">Active</span>` : ''}
                                        </div>
                                        <div class="accordion-controls">
                                            <button class="provider-config-btn" @click=${e => {
                e.stopPropagation();
                this.startProviderEdit(id);
            }} title="Configure ${provider.name}">⚙️</button>
                                            <span class="accordion-chevron ${this.expandedProviders.has(id) ? 'expanded' : ''}">▼</span>
                                        </div>
                                    </div>
                                    ${this.expandedProviders.has(id) ? html`
                                        <div class="accordion-content">
                                            ${this.selectedProvider === id ? html`
                                                <div class="provider-status">
                                                    <div class="status-indicator status-${this.connectionStatus}"></div>
                                                    <span class="status-text">
                                                        ${this.connectionStatus === 'connected' ? 'Connected' :
                        this.connectionStatus === 'error' ? 'Connection failed' : 'Connecting...'}
                                                    </span>
                                                </div>
                                            ` : ''}
                                            
                                            ${this.selectedProvider !== id ? html`
                                                <button class="select-provider-btn" @click=${() => this.selectProvider(id)}>
                                                    Select ${provider.name}
                                                </button>
                                            ` : this.modelsLoading ? html`
                                                <div class="model-loading">
                                                    <div class="loading-spinner"></div>
                                                    <span>Loading models...</span>
                                                </div>
                                            ` : this.filteredModels.length > 0 ? html`
                                                <div class="models-grid">
                                                    ${this.filteredModels.map(model => html`
                                                        <button class="model-card ${model.id === this.selectedModel ? 'selected' : ''}"
                                                            @click=${() => this.onSelectModel?.(model.id)}>
                                                            <span class="model-title-display" title="${model.name}">${model.name}</span>
                                                            <span class="model-badges">
                                                                ${model.size ? html`<span class="badge size" title="Size">${model.size}</span>` : ''}
                                                                ${model.format ? html`<span class="badge format" title="Format">${model.format}</span>` : ''}
                                                                ${model.arch ? html`<span class="badge arch" title="Architecture">${model.arch}</span>` : ''}
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
                                                    ${id === 'ollama' ? html`
                                                        ${this.newModelMode ? html`
                                                            <div class="model-card new-model-row">
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
                                                            <button class="model-card new-model-row" @click=${() => Object.assign(this, {
                                newModelMode: true, newModelUrl: "", newModelProgress: null, newModelError: null
                            })} title="Pull new model">
                                                                <span class="model-title-display">+ New model</span>
                                                            </button>
                                                        `}
                                                    ` : ''}
                                                </div>
                                            ` : html`
                                                <div class="no-connection">
                                                    <div class="no-connection-icon">🔌</div>
                                                    <span>No connection to ${provider.name}</span>
                                                    <button @click=${() => this.onLoadModels?.()} class="retry-btn-compact">↻ Retry</button>
                                                </div>
                                            `}
                                        </div>
                                    ` : ''}
                                </div>
                            `)}
                        </div>
                    </div>
                ` : ''}
                ${this.renderProviderConfig()}
            </div>
        `;
    }
}

customElements.define('model-selector', ModelSelector);
