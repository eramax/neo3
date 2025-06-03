// Optimized core app class
import { AIProvider } from './aiproviders.js';

export class ChatApp {
    constructor() {
        this.worker = new Worker(new URL('./neo-worker.js', import.meta.url), { type: 'module' });
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.chats = this.load('chats', []);
        this.messages = this.load('chatMessages', {});
        this.initialized = false;
        this.setupWorker();
        this.initPromise = this.initWorker();
    }

    setupWorker() {
        this.worker.onmessage = ({ data: { type, id, data, error, success } }) => {
            const req = this.pendingRequests.get(id);
            if (!req) return;

            if (error) {
                req.reject?.(new Error(error));
                this.pendingRequests.delete(id);
                return;
            }

            switch (type) {
                case 'init':
                case 'loadModels':
                case 'generateTitle':
                case 'abort':
                    if (success || data !== undefined) req.resolve?.(data);
                    this.pendingRequests.delete(id);
                    break;
                case 'streamChat':
                    if (data.type === 'chunk') {
                        req.onChunk?.(data.content);
                    } else if (data.type === 'complete') {
                        req.onComplete?.(data.content);
                        this.pendingRequests.delete(id);
                    } else {
                        req.onError?.(data.error, data.aborted);
                        this.pendingRequests.delete(id);
                    }
                    break;
                case 'pullModel':
                    req.onProgress?.(data);
                    if (data.complete || data.error) {
                        data.error ? req.reject?.(new Error(data.error)) : req.resolve?.();
                        this.pendingRequests.delete(id);
                    }
                    break;
            }
        };
    } async initWorker() {
        const providers = this.getProviders();
        const currentProvider = this.getStoredProvider();
        const providerConfig = providers[currentProvider] || providers.ollama;

        await this.sendWorkerMessage('init', {
            url: providerConfig.url, // Fix: use 'url' instead of 'host'
            provider: currentProvider,
            apiKey: providerConfig.apiKey
        });
        this.initialized = true;
    }

    async switchProvider(providerId) {
        const providers = this.getProviders();
        const providerConfig = providers[providerId];

        if (providerConfig) {
            this.saveProvider(providerId);
            this.initialized = false;
            this.initPromise = this.initWorker();
            await this.initPromise;
        }
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initPromise;
        }
    }

    sendWorkerMessage(type, data = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            this.pendingRequests.set(id, { resolve, reject });
            this.worker.postMessage({ type, id, data });
        });
    }

    save(key, data) {
        localStorage?.setItem(`neo2_${key}`, JSON.stringify(data));
    }

    load(key, fallback = null) {
        try {
            return JSON.parse(localStorage?.getItem(`neo2_${key}`)) || fallback;
        } catch {
            return fallback;
        }
    }

    saveState() {
        this.save('chats', this.chats);
        this.save('chatMessages', this.messages);
    }

    updateChatTitle(chatId, title) {
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            chat.title = title;
            this.saveState();
            window.dispatchEvent(new CustomEvent('chatTitleUpdated', {
                detail: { chatId, newTitle: title }
            }));
        }
    } async loadModels(providerId, providerConfig = null) {
        await this.ensureInitialized();
        const config = providerConfig || this.getProviders()[providerId];
        const models = await this.sendWorkerMessage('loadModels', {
            provider: providerId,
            config
        });
        return models;
    } async pullModel(modelUrl, onProgress) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            this.pendingRequests.set(id, { resolve, reject, onProgress });
            this.worker.postMessage({ type: 'pullModel', id, data: { modelUrl } });
        });
    }

    createChat() {
        const id = Date.now().toString();
        this.chats.unshift({ id, title: 'New Chat', category: 'Today' });
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

    addMessageWithTitleGeneration(chatId, message, model) {
        if (!this.messages[chatId]) this.messages[chatId] = [];
        const isFirst = this.messages[chatId].length === 0 && message.role === 'user';
        this.messages[chatId].push(message);
        this.saveState();
        if (isFirst && model && message.content) this.generateTitleAsync(chatId, message.content, model);
        return [...this.messages[chatId]];
    }

    async generateTitleAsync(chatId, userMessage, model) {
        try {
            const { title } = await this.sendWorkerMessage('generateTitle', { userMessage, model });
            this.updateChatTitle(chatId, title);
        } catch (e) {
            console.warn('Title generation failed:', e);
        }
    } async streamResponse(model, messages, onChunk, onComplete, onError) {
        await this.ensureInitialized();
        return new Promise(resolve => {
            const id = ++this.requestId;
            this.pendingRequests.set(id, {
                onChunk,
                onComplete: content => {
                    onComplete(content);
                    resolve();
                },
                onError: (error, aborted) => {
                    onError?.(error, aborted);
                    resolve();
                }
            });
            this.worker.postMessage({ type: 'streamChat', id, data: { model, messagesArray: messages } });
        });
    }

    async abort(chatId) {
        await this.sendWorkerMessage('abort');
        if (chatId && this.messages[chatId]?.length > 0) {
            const msgs = this.messages[chatId];
            if (msgs[msgs.length - 1]?.role === 'assistant') msgs.pop();
            if (msgs.length > 0 && msgs[msgs.length - 1]?.role === 'user') msgs.pop();
            this.saveState();
            return [...this.messages[chatId]];
        }
        return null;
    }

    saveModel(model) {
        this.save('selectedModel', model);
    }

    getChats() {
        return [...this.chats];
    }

    getMessages(chatId) {
        return this.messages[chatId] ? [...this.messages[chatId]] : [];
    }

    getChat(chatId) {
        return this.chats.find(c => c.id === chatId) || null;
    }

    getStoredModel() {
        return this.load('selectedModel');
    }

    getStoredProvider() {
        return this.load('selectedProvider', 'ollama');
    }

    saveProvider(providerId) {
        this.save('selectedProvider', providerId);
    }

    getProviders() {
        return AIProvider.getProviders(this.load('providers', {}));
    }

    async saveProviderConfig(providerId, config) {
        const currentProviders = this.load('providers', {});
        const updatedProviders = AIProvider.mergeProviderConfig(currentProviders, providerId, config);
        this.save('providers', updatedProviders);

        // Clear the provider from cache to force reinitialization
        if (this.worker) {
            await this.sendWorkerMessage('clearProvider', { providerId });
        }

        if (providerId === this.getStoredProvider()) {
            this.initialized = false;
            this.initPromise = this.initWorker();
            await this.initPromise;
        }

        // Notify UI to clear models for this provider
        window.dispatchEvent(new CustomEvent('providerConfigSaved', {
            detail: { providerId }
        }));
    }
}
