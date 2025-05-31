// Icons
export const modelLinkIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

// Constants
const TITLE_PROMPT = "Generate a short, descriptive title for this conversation in exactly 7 words or fewer. Do not use any thinking tags or markdown formatting. Just respond with the title directly:";

// Main app class - manages state and delegates processing to worker
export class ChatApp {
    constructor() {
        this.worker = new Worker(new URL('./neo-worker.js', import.meta.url), { type: 'module' });
        this.requestId = 0;
        this.pendingRequests = new Map();

        // State management
        this.chats = this.load('chats', []);
        this.messages = this.load('chatMessages', {});

        this.setupWorker();
        if (typeof window !== 'undefined') window.copyCodeToClipboard = this.copyCode.bind(this);

        // Initialize worker
        this.initWorker();
    }

    setupWorker() {
        this.worker.onmessage = (e) => {
            const { type, id, data, error, success } = e.data;

            const request = this.pendingRequests.get(id);
            if (!request) return;

            if (error) {
                request.reject?.(new Error(error));
                this.pendingRequests.delete(id);
                return;
            }

            switch (type) {
                case 'init':
                case 'loadModels':
                case 'generateTitle':
                    if (success || data !== undefined) {
                        request.resolve?.(data);
                    }
                    this.pendingRequests.delete(id);
                    break;

                case 'abort':
                    request.resolve?.(data);
                    this.pendingRequests.delete(id);
                    break;

                case 'streamChat':
                    if (data.type === 'chunk') {
                        request.onChunk?.(data.content);
                    } else if (data.type === 'complete') {
                        request.onComplete?.(data.content);
                        this.pendingRequests.delete(id);
                    } else if (data.type === 'error') {
                        request.onError?.(data.error, data.aborted);
                        this.pendingRequests.delete(id);
                    }
                    break;

                case 'pullModel':
                    request.onProgress?.(data);
                    if (data.complete || data.error) {
                        if (data.error) {
                            request.reject?.(new Error(data.error));
                        } else {
                            request.resolve?.();
                        }
                        this.pendingRequests.delete(id);
                    }
                    break;
            }
        };
    }

    async initWorker() {
        return this.sendWorkerMessage('init', {
            host: this.load('ollamaUrl', 'http://localhost:11434')
        });
    }

    sendWorkerMessage(type, data = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            this.pendingRequests.set(id, { resolve, reject });
            this.worker.postMessage({ type, id, data });
        });
    }

    // Storage utilities
    save(key, data) {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`neo2_${key}`, JSON.stringify(data));
        }
    }

    load(key, fallback = null) {
        if (typeof localStorage === 'undefined') return fallback;
        try { return JSON.parse(localStorage.getItem(`neo2_${key}`)) || fallback; }
        catch { return fallback; }
    }

    // State management methods
    saveState() {
        this.save('chats', this.chats);
        this.save('chatMessages', this.messages);
    }

    updateChatTitle(chatId, title) {
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            chat.title = title;
            this.saveState();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('chatTitleUpdated', {
                    detail: { chatId, newTitle: title }
                }));
            }
        }
    }

    // Code copying functionality
    copyCode(button, code) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                const originalHTML = button.innerHTML;
                button.innerHTML = '✓ Copied!';
                setTimeout(() => button.innerHTML = originalHTML, 2000);
            }).catch(() => {
                this.fallbackCopyTextToClipboard(code, button);
            });
        } else {
            this.fallbackCopyTextToClipboard(code, button);
        }
    }

    fallbackCopyTextToClipboard(text, button) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            const originalHTML = button.innerHTML;
            button.innerHTML = '✓ Copied!';
            setTimeout(() => button.innerHTML = originalHTML, 2000);
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }
        document.body.removeChild(textArea);
    }

    // Model management
    async loadModels() {
        return this.sendWorkerMessage('loadModels');
    }

    async pullModel(modelUrl, onProgress) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            this.pendingRequests.set(id, { resolve, reject, onProgress });
            this.worker.postMessage({ type: 'pullModel', id, data: { modelUrl } });
        });
    }

    // Chat management - now handles state locally
    createChat() {
        const id = Date.now().toString();
        const newChat = { id, title: 'New Chat', category: 'Today' };
        this.chats.unshift(newChat);
        this.messages[id] = [];
        this.saveState();
        return id;
    }

    addMessage(chatId, message) {
        if (!this.messages[chatId]) this.messages[chatId] = [];
        this.messages[chatId].push(message);
        this.saveState();
        return [...this.messages[chatId]];
    }

    async addMessageWithTitleGeneration(chatId, message, model) {
        if (!this.messages[chatId]) this.messages[chatId] = [];
        const isFirstUserMessage = this.messages[chatId].length === 0 && message.role === 'user';

        this.messages[chatId].push(message);
        this.saveState();

        if (isFirstUserMessage && model && message.content) {
            // Generate title asynchronously and update immediately when response arrives
            this.generateTitleAsync(chatId, message.content, model);
        }

        return [...this.messages[chatId]];
    }

    async generateTitleAsync(chatId, userMessage, model) {
        if (!userMessage || !model) return;

        try {
            const result = await this.sendWorkerMessage('generateTitle', {
                userMessage,
                model
            });
            this.updateChatTitle(chatId, result.title);
        } catch (error) {
            console.warn('Title generation failed:', error);
        }
    }

    // Streaming
    async streamResponse(model, messages, onChunk, onComplete, onError) {
        return new Promise((resolve) => {
            const id = ++this.requestId;
            this.pendingRequests.set(id, {
                onChunk,
                onComplete: (content) => {
                    onComplete(content);
                    resolve();
                },
                onError: (error, aborted) => {
                    onError?.(error, aborted);
                    resolve();
                }
            });
            this.worker.postMessage({
                type: 'streamChat',
                id,
                data: { model, messagesArray: messages }
            });
        });
    }

    async abort(chatId) {
        await this.sendWorkerMessage('abort');

        // Remove the last user message and any trailing assistant message if chatId is provided
        if (chatId && this.messages[chatId] && this.messages[chatId].length > 0) {
            const msgs = this.messages[chatId];
            // If the last message is assistant, remove it
            if (msgs[msgs.length - 1]?.role === 'assistant') {
                msgs.pop();
            }
            // If the new last message is user, remove it
            if (msgs.length > 0 && msgs[msgs.length - 1]?.role === 'user') {
                msgs.pop();
            }
            this.saveState();
            return [...this.messages[chatId]];
        }
        return null;
    }

    // State management
    async saveUrl(url) {
        this.save('ollamaUrl', url);
        await this.sendWorkerMessage('init', { host: url });
    }

    saveModel(model) {
        this.save('selectedModel', model);
    }

    // Getters - now synchronous since state is local
    getChats() {
        return [...this.chats];
    }

    getMessages(chatId) {
        return this.messages[chatId] ? [...this.messages[chatId]] : [];
    }

    getChat(chatId) {
        return this.chats.find(c => c.id === chatId) || null;
    }

    getStoredModel() { return this.load('selectedModel'); }
    getStoredUrl() { return this.load('ollamaUrl', 'http://localhost:11434'); }
}
