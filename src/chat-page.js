import { LitElement, html } from 'lit';
import { ChatApp } from "./core.js";
import { globalState } from './global-state.js';
import { Utils } from './utils.js';
import "./MDRender.js";
import "./sidebar.js";
import "./model-selector.js";
import "./toast.js";

export class ChatPage extends LitElement {
    createRenderRoot() {
        return this;
    }

    static properties = {
        selectedChat: { state: true }, message: { state: true },
        showModelSelector: { state: true }, sidebarCollapsed: { state: true },
        models: { state: true }, modelsLoading: { state: true }, modelsError: { state: true },
        chats: { state: true }, streamingMessage: { state: true }, isStreaming: { state: true },
        currentChatId: { state: true }, currentMessages: { state: true }, currentChat: { state: true },
        isNewChat: { state: true }, connectionStatus: { state: true }
    };

    constructor() {
        super();
        this.app = new ChatApp();

        // Local component state
        this.selectedChat = "New Chat";
        this.message = "";
        this.showModelSelector = false;
        this.sidebarCollapsed = false;
        this.models = [];
        this.modelsLoading = true;
        this.modelsError = null;
        this.streamingMessage = "";
        this.isStreaming = false;
        this.currentChatId = null;
        this.currentMessages = [];
        this.currentChat = null;
        this.isNewChat = false;
        this.chats = [];
        this.connectionStatus = "checking";

        this.loadChats();
        this.setupGlobalStateListeners();
    }

    setupGlobalStateListeners() {
        // Listen for background streaming completion
        globalState.on('backgroundStreamComplete', (data) => {
            const toast = this.querySelector('toast-notification');
            if (toast) {
                toast.show(
                    data.message,
                    'info',
                    0, // No auto-hide
                    () => this.navigateToChat(data.chatId)
                );
            }
        });

        // Listen for global state changes
        globalState.on('aiProviderChanged', () => this.requestUpdate());
        globalState.on('modelChanged', () => this.requestUpdate());
        globalState.on('chatChanged', (chatId) => {
            if (chatId !== this.currentChatId) {
                this.updateCurrentChat(chatId);
            }
        });
    }

    loadChats() {
        this.chats = this.app.getChats();
    }

    // Global state getters
    get selectedModel() { return globalState.currentModel; }
    get selectedProvider() { return globalState.currentAIProvider; }
    get providers() { return globalState.getAllAIProviders(); } connectedCallback() {
        super.connectedCallback();
        setTimeout(() => this.loadModels(this.selectedProvider), 100);

        const updateFromUrl = () => {
            const chatId = window.location.pathname.substring(1);
            if (chatId !== this.currentChatId) {
                this.updateCurrentChat(chatId);
                globalState.setCurrentChat(chatId);
            }
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
    }
    async loadModels(providerId = null) {
        const targetProvider = providerId || this.selectedProvider;
        const targetConfig = this.providers[targetProvider];

        if (this.loadingProviders?.has?.(targetProvider)) return;

        this.modelsLoading = targetProvider === this.selectedProvider;
        this.modelsError = null;

        try {
            const newModels = await this.app.loadModels(targetProvider, targetConfig);
            this.models = this.models.filter(m => m.provider !== targetProvider);
            this.models = [...this.models, ...newModels];

            if (targetProvider === this.selectedProvider && !this.selectedModel) {
                const firstModel = newModels[0]?.id;
                if (firstModel) {
                    this.selectedModel = firstModel;
                    this.app.saveModel(firstModel);
                }
            }
        } catch (err) {
            this.modelsError = err.message;
        } finally {
            this.modelsLoading = false;
            const modelSelector = this.querySelector('model-selector');
            modelSelector?.onModelsLoaded?.(targetProvider);
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
    } scrollToBottom() {
        const container = this.querySelector('.messages');
        Utils.scrollToBottom(container);
    }

    async createNewChat() {
        const id = this.app.createChat();
        this.chats = this.app.getChats();
        this.navigateToChat(id);
    }

    navigateToChat(id) {
        window.history.pushState({}, '', `/${id}`);
        this.updateCurrentChat(id);
    } async sendMessage() {
        if (!this.message.trim() || this.isStreaming) return;

        // Auto-create chat if none exists
        if (!this.currentChatId || this.isNewChat) {
            const newChatId = this.app.createChat();
            this.chats = this.app.getChats();
            this.navigateToChat(newChatId);
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        const userMessage = this.message;
        this.message = "";
        const userMsg = {
            role: "user",
            content: userMessage,
            time: Utils.formatTime(),
            metadata: { model: this.selectedModel }
        };

        this.currentMessages = this.app.addMessageWithTitleGeneration(this.currentChatId, userMsg, this.selectedModel);
        this.streamingMessage = "";
        this.isStreaming = true;

        await this.app.streamResponse(
            this.selectedModel,
            this.currentMessages.filter(m => m.role === "user" || m.role === "ai"),
            chunk => {
                this.streamingMessage = chunk;
                this.scrollToBottom();
            },
            final => {
                const aiMsg = {
                    role: "ai",
                    content: final,
                    time: Utils.formatTime(),
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
            },
            this.currentChatId // Pass chatId for background streaming support
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
    } handleInput(e) { this.message = e.target.value; }

    toggleSidebar() {
        Utils.toggle(this, 'sidebarCollapsed');
    }

    toggleModelSelector() {
        Utils.toggle(this, 'showModelSelector');
    }

    selectModel(modelId) {
        globalState.setCurrentModel(modelId);
        this.showModelSelector = false;
    } async selectProvider(providerId) {
        globalState.setCurrentAIProvider(providerId);
        globalState.setCurrentModel(null);
        await this.app.switchProvider(providerId);
        this.loadModels(providerId);
    }

    async saveProviderConfig(providerId, config) {
        await this.app.saveProviderConfig(providerId, config);
        this.loadModels(providerId);
    } render() {
        return html`
            <toast-notification></toast-notification>
            <div class="app">
                <sidebar-component
                    .collapsed=${this.sidebarCollapsed} 
                    .chats=${this.chats} 
                    .currentChatId=${this.currentChatId}
                    .onNewChat=${() => this.createNewChat()} 
                    .onNavigateToChat=${id => this.navigateToChat(id)}>
                </sidebar-component>
                <main class="main-content ${this.sidebarCollapsed ? 'sidebar-collapsed' : ''}">
                    <div class="chat-header">
                        <button class="toggle-sidebar-btn" @click=${this.toggleSidebar}>
                            ${this.sidebarCollapsed ? "☰" : "✕"}
                        </button>
                        <h1 class="chat-title">${this.selectedChat}</h1>
                        <model-selector
                            .selectedModel=${this.selectedModel} 
                            .selectedProvider=${this.selectedProvider}
                            .providers=${this.providers} 
                            .showModelSelector=${this.showModelSelector}
                            .models=${this.models} 
                            .modelsLoading=${this.modelsLoading} 
                            .modelsError=${this.modelsError}
                            .connectionStatus=${this.connectionStatus}
                            .onToggleModelSelector=${() => this.toggleModelSelector()}
                            .onSelectModel=${modelId => this.selectModel(modelId)} 
                            .onSelectProvider=${providerId => this.selectProvider(providerId)}
                            .onSaveProviderConfig=${(providerId, config) => this.saveProviderConfig(providerId, config)}
                            .onLoadModels=${(providerId) => this.loadModels(providerId)}>
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
                                            <span class="time">${Utils.formatTime()}</span>
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
