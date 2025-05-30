import { Ollama } from "ollama/browser";

// Icons
export const modelLinkIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

// Main app class - now a lightweight interface to the worker
export class ChatApp {
    constructor() {
        this.worker = new Worker(new URL('./neo-worker.js', import.meta.url), { type: 'module' });
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.localChats = this.load('chats', []);
        this.localMessages = this.load('chatMessages', {});
        this.setupWorker();
        if (typeof window !== 'undefined') window.copyCodeToClipboard = this.copyCode.bind(this);

        // Initialize worker with current state
        this.initWorker();
    }

    setupWorker() {
        this.worker.onmessage = (e) => {
            const { type, id, data, error, success } = e.data;

            // Handle special events that don't have request IDs
            if (type === 'saveToStorage') {
                localStorage.setItem(data.key, data.value);
                return;
            }

            if (type === 'chatTitleUpdated') {
                this.localChats = data.chats;
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('chatTitleUpdated', {
                        detail: { chatId: data.chatId, newTitle: data.newTitle }
                    }));
                }
                return;
            }

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
                case 'getChats':
                case 'getMessages':
                case 'getChat':
                case 'createChat':
                case 'addMessage':
                case 'addMessageWithTitleGeneration':
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
            host: this.load('ollamaUrl', 'http://localhost:11434'),
            state: {
                chats: this.localChats,
                messages: this.localMessages
            }
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
        typeof localStorage !== 'undefined' && localStorage.setItem(`neo2_${key}`, JSON.stringify(data));
    }

    load(key, fallback = null) {
        if (typeof localStorage === 'undefined') return fallback;
        try { return JSON.parse(localStorage.getItem(`neo2_${key}`)) || fallback; }
        catch { return fallback; }
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

    // Chat management - now delegated to worker
    async createChat() {
        const result = await this.sendWorkerMessage('createChat');
        this.localChats = result.chats;
        return result.id;
    }

    async addMessage(chatId, message) {
        const result = await this.sendWorkerMessage('addMessage', { chatId, message });
        if (this.localMessages[chatId]) {
            this.localMessages[chatId] = result;
        }
        return result;
    }

    async addMessageWithTitleGeneration(chatId, message, model) {
        const result = await this.sendWorkerMessage('addMessageWithTitleGeneration', { chatId, message, model });
        if (this.localMessages[chatId]) {
            this.localMessages[chatId] = result;
        }
        return result;
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
        const result = await this.sendWorkerMessage('abort', { chatId });
        if (result?.messages && chatId) {
            this.localMessages[chatId] = result.messages;
        }
        return result;
    }

    // State management
    async saveUrl(url) {
        this.save('ollamaUrl', url);
        await this.sendWorkerMessage('init', {
            host: url,
            state: {
                chats: this.localChats,
                messages: this.localMessages
            }
        });
    }

    saveModel(model) {
        this.save('selectedModel', model);
    }

    // Getters - now async and delegated to worker
    async getChats() {
        this.localChats = await this.sendWorkerMessage('getChats');
        return this.localChats;
    }

    async getMessages(chatId) {
        const result = await this.sendWorkerMessage('getMessages', { chatId });
        this.localMessages[chatId] = result;
        return result;
    }

    async getChat(chatId) {
        return this.sendWorkerMessage('getChat', { chatId });
    }

    getStoredModel() { return this.load('selectedModel'); }
    getStoredUrl() { return this.load('ollamaUrl', 'http://localhost:11434'); }
}
