import { LitElement, html, unsafeCSS } from 'lit';
import { ChatApp } from "./core.js";
import "./MDRender.js";
import "./sidebar.js";
import "./model-selector.js";
import styles from './app.scss?inline';

export class ChatPage extends LitElement {
    static styles = unsafeCSS(styles);

    static properties = {
        selectedChat: { state: true },
        message: { state: true },
        selectedModel: { state: true },
        showModelSelector: { state: true },
        sidebarCollapsed: { state: true },
        models: { state: true },
        modelsLoading: { state: true },
        modelsError: { state: true },
        ollamaUrl: { state: true },
        chats: { state: true },
        streamingMessage: { state: true },
        isStreaming: { state: true },
        currentChatId: { state: true },
        currentMessages: { state: true },
        currentChat: { state: true },
        isNewChat: { state: true },
        newModelMode: { state: true },
        newModelUrl: { state: true },
        newModelProgress: { state: true },
        newModelError: { state: true }
    };

    constructor() {
        super();
        // Initialize all state
        Object.assign(this, {
            selectedChat: "New Chat",
            message: "",
            selectedModel: null,
            showModelSelector: false,
            sidebarCollapsed: false,
            models: [],
            modelsLoading: true,
            modelsError: null,
            streamingMessage: "",
            isStreaming: false,
            currentChatId: null,
            currentMessages: [],
            currentChat: null,
            isNewChat: false,
            newModelMode: false,
            newModelUrl: "",
            newModelProgress: null,
            newModelError: null,
            chats: []
        });

        this.app = new ChatApp();
        this.ollamaUrl = this.app.getStoredUrl();
        this.loadChats();
    }

    loadChats() {
        this.chats = this.app.getChats();
    }

    connectedCallback() {
        super.connectedCallback();
        this.loadModels();

        // Handle URL changes
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
    }

    async loadModels() {
        this.modelsLoading = true;
        try {
            const models = await this.app.loadModels();
            this.models = models;
            this.selectedModel = this.selectedModel || this.app.getStoredModel() || models[0]?.id;
            this.modelsError = null;
        } catch (err) {
            this.modelsError = err.message;
        }
        this.modelsLoading = false;
    }

    updateCurrentChat(chatId) {
        const currentChat = this.app.getChat(chatId);
        const currentMessages = this.app.getMessages(chatId);

        Object.assign(this, {
            currentChatId: chatId,
            currentChat,
            currentMessages,
            isNewChat: !currentChat,
            selectedChat: currentChat?.title || "New Chat"
        });

        this.chats = this.app.getChats();
        setTimeout(() => this.scrollToBottom(), 10);
    }

    scrollToBottom() {
        const messagesContainer = this.shadowRoot?.querySelector('.messages');
        if (messagesContainer) {
            requestAnimationFrame(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
        }
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
        const time = new Date().toLocaleTimeString();

        const userMsg = {
            role: "user",
            content: userMessage,
            time,
            metadata: { model: this.selectedModel }
        };

        this.currentMessages = this.app.addMessageWithTitleGeneration(
            this.currentChatId,
            userMsg,
            this.selectedModel
        );

        this.streamingMessage = "";
        this.isStreaming = true;

        await this.app.streamResponse(
            this.selectedModel,
            this.currentMessages.filter((m) => m.role === "user" || m.role === "ai"),
            (chunk) => {
                this.streamingMessage = chunk;
                this.scrollToBottom();
            },
            (final) => {
                const aiMsg = {
                    role: "ai",
                    content: final,
                    time: new Date().toLocaleTimeString(),
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
            if (updatedMessages) {
                this.currentMessages = updatedMessages;
            }
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

    handleInput(e) {
        this.message = e.target.value;
    }

    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
    }

    toggleModelSelector() {
        this.showModelSelector = !this.showModelSelector;
    }

    selectModel(modelId) {
        this.selectedModel = modelId;
        this.showModelSelector = false;
        this.app.saveModel(modelId);
    }

    async saveUrl(url) {
        await this.app.saveUrl(url);
        this.ollamaUrl = url;
        this.loadModels();
    }

    async saveNewModel(modelUrl) {
        this.newModelMode = true;
        this.newModelUrl = modelUrl;
        this.newModelProgress = null;
        this.newModelError = null;

        try {
            await this.app.pullModel(modelUrl, (progress) => {
                this.newModelProgress = progress;
                if (progress.error) {
                    this.newModelError = progress.error;
                }
            });

            Object.assign(this, {
                newModelMode: false,
                newModelUrl: "",
                newModelProgress: null,
                newModelError: null
            });
            this.loadModels();
        } catch (error) {
            this.newModelError = error.message;
        }
    }

    render() {
        return html`
            <div class="app">
                <sidebar-component
                    .collapsed=${this.sidebarCollapsed}
                    .chats=${this.chats}
                    .currentChatId=${this.currentChatId}
                    .onNewChat=${() => this.createNewChat()}
                    .onNavigateToChat=${(id) => this.navigateToChat(id)}>
                </sidebar-component>
                <main class="main-content ${this.sidebarCollapsed ? 'sidebar-collapsed' : ''}">
                    <div class="chat-header">
                        <button class="toggle-sidebar-btn" @click=${this.toggleSidebar}>
                            ${this.sidebarCollapsed ? "☰" : "✕"}
                        </button>
                        <h1 class="chat-title">${this.selectedChat}</h1>
                        <model-selector
                            .selectedModel=${this.selectedModel}
                            .showModelSelector=${this.showModelSelector}
                            .models=${this.models}
                            .modelsLoading=${this.modelsLoading}
                            .modelsError=${this.modelsError}
                            .ollamaUrl=${this.ollamaUrl}
                            .newModelMode=${this.newModelMode}
                            .newModelUrl=${this.newModelUrl}
                            .newModelProgress=${this.newModelProgress}
                            .newModelError=${this.newModelError}
                            .onToggleModelSelector=${() => this.toggleModelSelector()}
                            .onSelectModel=${(modelId) => this.selectModel(modelId)}
                            .onSaveUrl=${(url) => this.saveUrl(url)}
                            .onSaveNewModel=${(modelUrl) => this.saveNewModel(modelUrl)}
                            .onLoadModels=${() => this.loadModels()}>
                        </model-selector>
                    </div>
                    <div class="messages">
                        ${this.isNewChat ?
                html`<div class="welcome-screen"><div class="welcome-content">
                                <h2>Start a new conversation</h2>
                                <p>Ask me anything, and I'll help you with coding, explanations, or general questions.</p>
                            </div></div>` :
                !Array.isArray(this.currentMessages) || this.currentMessages.length === 0 ?
                    html`<div class="empty-state"><div class="empty-content">
                                    <p>No messages in this chat yet.</p>
                                </div></div>` :
                    html`${this.currentMessages.map(msg => html`
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
                                            ${this.streamingMessage ?
                                html`<div class="content"><incremental-markdown .content=${this.streamingMessage}></incremental-markdown></div>` :
                                html`<div class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`
                            }
                                        </div>
                                    </div>
                                ` : ''}
                        `}
                    </div>
                    <div class="input-area">
                        <div class="input-container">
                            <textarea 
                                placeholder="Send a Message" 
                                class="message-input" 
                                rows="1" 
                                ?disabled=${this.isStreaming}
                                .value=${this.message}
                                @input=${this.handleInput}
                                @keydown=${this.handleKeyDown}></textarea>
                            <button 
                                class="send-btn ${this.isStreaming ? 'abort' : ''}" 
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
