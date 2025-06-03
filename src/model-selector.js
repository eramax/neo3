import { LitElement, html } from 'lit';

export class ModelSelector extends LitElement {
    static properties = {
        selectedModel: { type: String }, selectedProvider: { type: String }, showModelSelector: { type: Boolean },
        models: { type: Array }, modelsLoading: { type: Boolean }, modelsError: { type: String },
        providers: { type: Object }, showProviderConfig: { type: Boolean }, editingProvider: { type: String },
        tempConfig: { type: Object }, connectionStatus: { type: String },
        expandedProviders: { type: Set }, loadingProviders: { type: Set },
        onToggleModelSelector: { type: Function }, onSelectModel: { type: Function },
        onSelectProvider: { type: Function }, onSaveProviderConfig: { type: Function },
        onLoadModels: { type: Function }
    };

    constructor() {
        super();
        Object.assign(this, {
            selectedModel: null, selectedProvider: 'ollama', showModelSelector: false, models: [],
            modelsLoading: true, modelsError: null, providers: {},
            showProviderConfig: false, editingProvider: null, tempConfig: {}, connectionStatus: "checking",
            expandedProviders: new Set(), loadingProviders: new Set()
        });
    }

    createRenderRoot() { return this; }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('selectedProvider')) {
            this.expandedProviders = new Set([this.selectedProvider]);
        }
    }

    get currentModel() { return this.models.find(m => m.id === this.selectedModel) || null; }

    get currentProvider() { return this.providers[this.selectedProvider] || this.providers.ollama; }

    getModelsForProvider(providerId) {
        return this.models.filter(model => model.provider === providerId);
    }

    toggleProvider(providerId) {
        this.expandedProviders.clear();
        this.expandedProviders.add(providerId);

        if (!this.getModelsForProvider(providerId).length && !this.loadingProviders.has(providerId)) {
            this.loadingProviders.add(providerId);
            this.onLoadModels?.(providerId);
        }
        this.requestUpdate();
    }

    selectModel(modelId, providerId) {
        this.selectedProvider = providerId;
        this.onSelectProvider?.(providerId);
        this.onSelectModel?.(modelId);
    }

    onModelsLoaded(providerId) {
        this.loadingProviders.delete(providerId);
        this.requestUpdate();
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
        this.clearProviderModels(this.editingProvider);
        this.onSaveProviderConfig?.(this.editingProvider, this.tempConfig);

        // Auto-reload models if provider is expanded
        if (this.expandedProviders.has(this.editingProvider)) {
            this.loadingProviders.add(this.editingProvider);
            this.onLoadModels?.(this.editingProvider);
        }

        Object.assign(this, { showProviderConfig: false, editingProvider: null, tempConfig: {} });
    }

    clearProviderModels(providerId) {
        this.models = this.models.filter(model => model.provider !== providerId);
        this.loadingProviders.delete(providerId);
        this.requestUpdate();
    }

    onProviderConfigSaved(providerId) {
        this.clearProviderModels(providerId);
        if (this.expandedProviders.has(providerId)) {
            this.loadingProviders.add(providerId);
            this.onLoadModels?.(providerId);
        }
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
    }

    render() {
        return html`
            <div class="model-selector">
                <button class="model-trigger" @click=${() => this.onToggleModelSelector?.()} ?disabled=${this.modelsLoading}>
                    <span class="provider-badge">${this.currentProvider.name}</span>
                    <span class="model-name">${this.currentModel?.name || "Select Model"}</span>
                    <span class="chevron ${this.showModelSelector ? 'open' : ''}">▼</span>
                </button>
                ${this.showModelSelector ? html`
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
                                            ${this.loadingProviders.has(id) ? html`
                                                <div class="model-loading">
                                                    <div class="loading-spinner"></div>
                                                    <span>Loading models...</span>
                                                </div>
                                            ` : this.getModelsForProvider(id).length > 0 ? html`
                                                <div class="models-grid">
                                                    ${this.getModelsForProvider(id).map(model => html`                                                        <button class="model-card ${model.id === this.selectedModel ? 'selected' : ''}"
                                                            @click=${() => this.selectModel(model.id, id)}>
                                                            <div class="model-status-icon">
                                                                <div class="status-indicator status-${provider.requiresApiKey && !provider.apiKey ? 'error' : this.connectionStatus}"></div>
                                                            </div>
                                                            <span class="model-title-display" title="${model.name}">${model.name}</span>
                                                        </button>
                                                    `)}
                                                </div>
                                            ` : html`
                                                <div class="no-connection">
                                                    <div class="no-connection-icon">🔌</div>
                                                    <span>No models available for ${provider.name}</span>
                                                    ${!this.loadingProviders.has(id) ? html`
                                                        <button @click=${() => {
                            this.loadingProviders.add(id);
                            this.onLoadModels?.(id);
                        }} class="retry-btn-compact">↻ Retry</button>
                                                    ` : ''}
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
