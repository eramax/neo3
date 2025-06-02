import { LitElement, html } from 'lit';
import { ChatApp } from "./core.js";
import "./MDRender.js";
import "./sidebar.js";
import "./model-selector.js";

export class ChatPage extends LitElement {
    createRenderRoot() {
        return this;
    } static properties = {
        selectedChat: { state: true }, message: { state: true }, selectedModel: { state: true },
        selectedProvider: { state: true }, providers: { state: true }, showModelSelector: { state: true },
        sidebarCollapsed: { state: true }, models: { state: true }, modelsLoading: { state: true },
        modelsError: { state: true }, ollamaUrl: { state: true }, chats: { state: true },
        streamingMessage: { state: true }, isStreaming: { state: true }, currentChatId: { state: true },
        currentMessages: { state: true }, currentChat: { state: true }, isNewChat: { state: true },
        newModelMode: { state: true }, newModelUrl: { state: true }, newModelProgress: { state: true },
        newModelError: { state: true }, connectionStatus: { state: true }
    }; constructor() {
        super();
        this.app = new ChatApp();
        Object.assign(this, {
            selectedChat: "New Chat", message: "", selectedModel: this.app.getStoredModel(),
            selectedProvider: this.app.getStoredProvider() || 'ollama', providers: this.app.getProviders(),
            showModelSelector: false, sidebarCollapsed: false, models: [], modelsLoading: true,
            modelsError: null, streamingMessage: "", isStreaming: false, currentChatId: null,
            currentMessages: [], currentChat: null, isNewChat: false, newModelMode: false,
            newModelUrl: "", newModelProgress: null, newModelError: null, chats: [],
            connectionStatus: "checking"
        });
        this.ollamaUrl = this.app.getStoredUrl();
        this.loadChats();
    }

    loadChats() { this.chats = this.app.getChats(); } connectedCallback() {
        super.connectedCallback();
        // Only load models for the selected provider on initial load
        setTimeout(() => this.loadModels(this.selectedProvider), 100);
        const updateFromUrl = () => {
            const chatId = window.location.pathname.substring(1);
            if (chatId !== this.currentChatId) this.updateCurrentChat(chatId);
        };
        window.addEventListener('popstate', updateFromUrl);
        window.addEventListener("chatTitleUpdated", (e) => {
            const { chatId, newTitle } = e.detail;
            this.loadChats();
            if (chatId === this.currentChatId) {
                this.selectedChat = newTitle;
                this.currentChat = this.app.getChat(chatId);
            }
        });
        updateFromUrl();
    } async loadModels(providerId = null) {
        const targetProvider = providerId || this.selectedProvider;
        const targetConfig = this.providers[targetProvider];
        this.modelsLoading = true;
        this.modelsError = null;
        try {
            const newModels = await this.app.loadModels(targetProvider, targetConfig);

            this.models = this.models.filter(m => m.provider !== targetProvider);
            this.models = [...this.models, ...newModels];

            if (targetProvider === this.selectedProvider) {
                const providerModels = newModels;
                const storedModel = this.app.getStoredModel();
                const firstProviderModel = providerModels[0]?.id;

                if (storedModel && providerModels.find(m => m.id === storedModel)) {
                    this.selectedModel = storedModel;
                } else if (firstProviderModel) {
                    this.selectedModel = firstProviderModel;
                    this.app.saveModel(firstProviderModel);
                }
            }
        } catch (err) {
            console.error('Failed to load models:', err);
            this.modelsError = err.message || `Failed to connect to ${this.providers[targetProvider]?.name || 'server'}`;
        } finally {
            this.modelsLoading = false;
            const modelSelector = this.querySelector('model-selector');
            if (modelSelector && targetProvider) {
                modelSelector.onModelsLoaded(targetProvider);
            }
        }
    }

    updateCurrentChat(chatId) {
        const currentChat = this.app.getChat(chatId);
        const currentMessages = this.app.getMessages(chatId);
        Object.assign(this, {
            currentChatId: chatId, currentChat, currentMessages,
            isNewChat: !currentChat, selectedChat: currentChat?.title || "New Chat"
        });
        this.chats = this.app.getChats();
        setTimeout(() => this.scrollToBottom(), 10);
    }

    scrollToBottom() {
        const container = this.querySelector('.messages'); // Changed from shadowRoot to this
        if (container) requestAnimationFrame(() => container.scrollTop = container.scrollHeight);
    }

    async createNewChat() {
        const id = this.app.createChat();
        this.chats = this.app.getChats();
        this.navigateToChat(id);
    }

    navigateToChat(id) {
        window.history.pushState({}, '', `/${id}`);
        this.updateCurrentChat(id);
    }

    async sendMessage() {
        if (!this.message.trim() || this.isStreaming) return;
        const userMessage = this.message;
        this.message = "";
        const userMsg = {
            role: "user", content: userMessage, time: new Date().toLocaleTimeString(),
            metadata: { model: this.selectedModel }
        };
        this.currentMessages = this.app.addMessageWithTitleGeneration(this.currentChatId, userMsg, this.selectedModel);
        this.streamingMessage = "";
        this.isStreaming = true;

        await this.app.streamResponse(
            this.selectedModel,
            this.currentMessages.filter(m => m.role === "user" || m.role === "ai"),
            chunk => { this.streamingMessage = chunk; this.scrollToBottom(); },
            final => {
                const aiMsg = {
                    role: "ai", content: final, time: new Date().toLocaleTimeString(),
                    metadata: { model: this.selectedModel }
                };
                this.currentMessages = this.app.addMessage(this.currentChatId, aiMsg);
                this.streamingMessage = "";
                this.isStreaming = false;
                this.scrollToBottom();
            },
            (error, aborted) => {
                this.streamingMessage = aborted ? "" : error;
                this.isStreaming = false;
                this.scrollToBottom();
            }
        );
    }

    async abortStream() {
        if (this.isStreaming) {
            const updatedMessages = await this.app.abort(this.currentChatId);
            if (updatedMessages) this.currentMessages = updatedMessages;
            this.streamingMessage = "";
            this.isStreaming = false;
            this.chats = this.app.getChats();
        }
    }

    handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    handleInput(e) { this.message = e.target.value; }
    toggleSidebar() { this.sidebarCollapsed = !this.sidebarCollapsed; }
    toggleModelSelector() { this.showModelSelector = !this.showModelSelector; } selectModel(modelId) {
        this.selectedModel = modelId;
        this.showModelSelector = false;
        this.app.saveModel(modelId);
    }

    async saveNewModel(modelUrl) {
        this.newModelMode = true;
        this.newModelUrl = modelUrl;
        this.newModelProgress = null;
        this.newModelError = null;
        try {
            await this.app.pullModel(modelUrl, progress => {
                this.newModelProgress = progress;
                if (progress.error) this.newModelError = progress.error;
            }); Object.assign(this, { newModelMode: false, newModelUrl: "", newModelProgress: null, newModelError: null });
            this.loadModels('ollama'); // Only reload Ollama models after pulling
        } catch (error) {
            this.newModelError = error.message;
        }
    } selectProvider(providerId) {
        this.selectedProvider = providerId;
        this.selectedModel = null; // Clear selected model when switching providers
        this.app.saveProvider(providerId);
        this.loadModels(providerId);
    } async saveProviderConfig(providerId, config) {
        await this.app.saveProviderConfig(providerId, config);
        this.loadModels(providerId);
    }

    render() {
        return html`
            <div class="app">
                <sidebar-component
                    .collapsed=${this.sidebarCollapsed} .chats=${this.chats} .currentChatId=${this.currentChatId}
                    .onNewChat=${() => this.createNewChat()} .onNavigateToChat=${id => this.navigateToChat(id)}>
                </sidebar-component>
                <main class="main-content ${this.sidebarCollapsed ? 'sidebar-collapsed' : ''}">
                    <div class="chat-header">
                        <button class="toggle-sidebar-btn" @click=${this.toggleSidebar}>
                            ${this.sidebarCollapsed ? "☰" : "✕"}
                        </button>
                        <h1 class="chat-title">${this.selectedChat}</h1>                        <model-selector
                            .selectedModel=${this.selectedModel} .selectedProvider=${this.selectedProvider}
                            .providers=${this.providers} .showModelSelector=${this.showModelSelector}
                            .models=${this.models} .modelsLoading=${this.modelsLoading} .modelsError=${this.modelsError}
                            .connectionStatus=${this.connectionStatus} .newModelMode=${this.newModelMode}
                            .newModelUrl=${this.newModelUrl} .newModelProgress=${this.newModelProgress}
                            .newModelError=${this.newModelError} .onToggleModelSelector=${() => this.toggleModelSelector()}
                            .onSelectModel=${modelId => this.selectModel(modelId)} .onSelectProvider=${providerId => this.selectProvider(providerId)}
                            .onSaveProviderConfig=${(providerId, config) => this.saveProviderConfig(providerId, config)}
                            .onSaveNewModel=${modelUrl => this.saveNewModel(modelUrl)}                            .onLoadModels=${(providerId) => this.loadModels(providerId)}>
                        </model-selector>
                    </div>
                    <div class="messages">
                        ${this.isNewChat ? html`
                            <div class="welcome-screen">
                                <div class="welcome-content">
                                    <h2>Start a new conversation</h2>
                                    <p>Ask me anything, and I'll help you with coding, explanations, or general questions.</p>
                                </div>
                            </div>` :
                !Array.isArray(this.currentMessages) || this.currentMessages.length === 0 ? html`
                            <div class="empty-state">
                                <div class="empty-content">
                                    <p>No messages in this chat yet.</p>
                                </div>
                            </div>` : html`
                            ${this.currentMessages.map(msg => html`
                                <div class="message ${msg.role === 'ai' ? 'ai-message' : 'user-message'}">
                                    <div class="avatar">${msg.role === "ai" ? "🤖" : "👤"}</div>
                                    <div class="message-content">
                                        <div class="message-header">
                                            <span class="sender">${msg.role === "ai" ? msg.metadata?.model || "AI" : "User"}</span>
                                            <span class="time">${msg.time}</span>
                                        </div>
                                        <div class="content">
                                            <incremental-markdown .content=${msg.content}></incremental-markdown>
                                        </div>
                                    </div>
                                </div>
                            `)}
                            ${this.isStreaming ? html`
                                <div class="message ai-message streaming">
                                    <div class="avatar">🤖</div>
                                    <div class="message-content">
                                        <div class="message-header">
                                            <span class="sender">${this.selectedModel}</span>
                                            <span class="time">${new Date().toLocaleTimeString()}</span>
                                        </div>
                                        ${this.streamingMessage ? html`
                                            <div class="content">
                                                <incremental-markdown .content=${this.streamingMessage}></incremental-markdown>
                                            </div>` : html`
                                            <div class="loading-dots">
                                                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                                            </div>`}
                                    </div>
                                </div>` : ''}
                        `}
                    </div>
                    <div class="input-area">
                        <div class="input-container">
                            <textarea placeholder="Send a Message" class="message-input" rows="1" 
                                ?disabled=${this.isStreaming} .value=${this.message}
                                @input=${this.handleInput} @keydown=${this.handleKeyDown}></textarea>
                            <button class="send-btn ${this.isStreaming ? 'abort' : ''}" 
                                @click=${this.isStreaming ? this.abortStream : this.sendMessage}
                                ?disabled=${!this.isStreaming && !this.message.trim()}
                                title="${this.isStreaming ? 'Cancel' : 'Send'}">
                                ${this.isStreaming ? "⏹" : "⬆"}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        `;
    }
}

customElements.define('chat-page', ChatPage);
