import { LitElement, html, unsafeCSS } from 'lit';
import { ChatApp } from "./core.js";
import "./MDRenderer.js";
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

        // Ensure we have a chat ID
        if (!this.currentChatId) {
            const newChatId = this.app.createChat();
            this.navigateToChat(newChatId);
        }

        // Add user message
        const userMsg = {
            role: "user",
            content: userMessage,
            time,
            metadata: { model: this.selectedModel }
        };

        this.currentMessages = this.app.addMessage(this.currentChatId, userMsg);

        // Check if we need to generate a title (first user message)
        const isFirstMessage = this.currentMessages.filter(m => m.role === "user").length === 1;
        if (isFirstMessage && this.selectedModel) {
            this.app.generateTitleAsync(this.currentChatId, userMessage, this.selectedModel);
        }

        // Add empty AI message
        const aiMsg = {
            role: "ai",
            content: "",
            time: new Date().toLocaleTimeString(),
            metadata: { model: this.selectedModel }
        };
        this.currentMessages = this.app.addMessage(this.currentChatId, aiMsg);
        const aiMessageIndex = this.currentMessages.length - 1;
        const currentChatId = this.currentChatId; // Capture for closure

        this.isStreaming = true;
        this.scrollToBottom();

        await this.app.streamResponse(
            this.selectedModel,
            this.currentMessages.filter((m) => m.role === "user" || m.role === "ai"),
            (chunk) => {
                // Only update if we're still on the same chat
                if (this.currentChatId === currentChatId && this.currentMessages[aiMessageIndex]) {
                    this.currentMessages[aiMessageIndex].content = chunk;
                    this.scrollToBottom();
                    this.requestUpdate();
                }
            },
            (final) => {
                // Only update if we're still on the same chat
                if (this.currentChatId === currentChatId && this.currentMessages[aiMessageIndex]) {
                    this.currentMessages[aiMessageIndex].content = final || this.currentMessages[aiMessageIndex].content;
                    this.app.saveState();
                    this.isStreaming = false;
                    this.showToast("Message completed", "success");
                    this.scrollToBottom();
                }
            },
            (error, aborted) => {
                this.isStreaming = false;
                if (aborted) {
                    // Remove the AI message if aborted and still on same chat
                    if (this.currentChatId === currentChatId) {
                        this.currentMessages.splice(aiMessageIndex, 1);
                        this.app.saveState();
                        this.showToast("Message cancelled", "info");
                    }
                } else {
                    // Update with error message if still on same chat
                    if (this.currentChatId === currentChatId && this.currentMessages[aiMessageIndex]) {
                        this.currentMessages[aiMessageIndex].content = `Error: ${error}`;
                        this.app.saveState();
                        this.showToast(`Error: ${error}`, "error");
                    }
                }
                this.scrollToBottom();
            }
        );
    }

    showToast(message, type = "info") {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // Style the toast
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '10000',
            opacity: '0',
            transform: 'translateY(-20px)',
            transition: 'all 0.3s ease',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6'
        };
        toast.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
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
                            ${!msg.content
                            ? html`<div class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`
                            : html`<markdown-block .content=${msg.content}></markdown-x>`
                        }
                            </div>
                        </div>
                        </div>
                    `)}
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
