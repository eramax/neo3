// Optimized core app class without workers
import { AIProvider, ProviderFactory } from './aiproviders.js';
import { globalState } from './global-state.js';

export class ChatApp {
    constructor() {
        this.aiProviders = new Map();
        this.currentProvider = null;
        this.chats = globalState.load('chats', []);
        this.messages = globalState.load('chatMessages', {});
        this.initialized = false;
        this.abortControllers = new Map();
        this.initPromise = this.initProvider();
    }    async getProvider(providerId, config) {
        if (!this.aiProviders.has(providerId)) {
            const ProviderClass = ProviderFactory[providerId];
            if (!ProviderClass) throw new Error(`Unknown provider: ${providerId}`);

            const provider = new ProviderClass(config);
            await provider.initClient();
            this.aiProviders.set(providerId, provider);
        }
        return this.aiProviders.get(providerId);
    }

    async initProvider() {
        const currentProvider = globalState.currentAIProvider;
        const providerConfig = globalState.getCurrentAIProvider();

        this.currentProvider = await this.getProvider(currentProvider, providerConfig);
        this.initialized = true;
    }

    async switchProvider(providerId) {
        const providerConfig = globalState.getAllAIProviders()[providerId];

        if (providerConfig) {
            globalState.setCurrentAIProvider(providerId);
            this.initialized = false;
            this.currentProvider = await this.getProvider(providerId, providerConfig);
            this.initialized = true;
        }
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initPromise;
        }
    }    save(key, data) {
        globalState.save(key, data);
    }

    load(key, fallback = null) {
        return globalState.load(key, fallback);
    }

    saveState() {
        this.save('chats', this.chats);
        this.save('chatMessages', this.messages);
    }    async loadModels(providerId, providerConfig = null) {
        await this.ensureInitialized();
        const config = providerConfig || globalState.getAllAIProviders()[providerId];
        const provider = await this.getProvider(providerId, config);        return await provider.loadModels();
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
    }    async generateTitleAsync(chatId, userMessage, model) {
        try {
            const title = await this.currentProvider.generateTitle(userMessage, model);
            this.updateChatTitle(chatId, title);
        } catch (e) {
            console.warn('Title generation failed:', e);
        }
    }

    async streamResponse(model, messages, onChunk, onComplete, onError, chatId = null) {
        await this.ensureInitialized();
        
        const abortController = new AbortController();
        if (chatId) {
            this.abortControllers.set(chatId, abortController);
            globalState.addStreamingChat(chatId, { model, messages });
        }

        try {
            let content = '';
            const provider = this.currentProvider;
            provider.abortController = abortController;

            for await (const chunk of provider.chat(model, messages)) {
                if (abortController.signal.aborted) break;
                content += chunk;
                onChunk?.(content);
            }

            if (!abortController.signal.aborted) {
                onComplete?.(content);
                if (chatId) {
                    globalState.removeStreamingChat(chatId);
                    // Show toast notification for background streaming
                    if (globalState.currentChat !== chatId) {
                        globalState.emit('backgroundStreamComplete', { 
                            chatId, 
                            message: `AI response completed in background chat` 
                        });
                    }
                }
            }
        } catch (error) {
            const isAborted = error.name === 'AbortError';
            onError?.(isAborted ? 'Stream cancelled' : error.message, isAborted);
            if (chatId) globalState.removeStreamingChat(chatId);
        } finally {
            if (chatId) this.abortControllers.delete(chatId);
        }
    }

    async abort(chatId) {
        const abortController = this.abortControllers.get(chatId);
        if (abortController) {
            abortController.abort();
            this.abortControllers.delete(chatId);
            globalState.removeStreamingChat(chatId);
        }

        if (chatId && this.messages[chatId]?.length > 0) {
            const msgs = this.messages[chatId];
            if (msgs[msgs.length - 1]?.role === 'assistant') msgs.pop();
            if (msgs.length > 0 && msgs[msgs.length - 1]?.role === 'user') msgs.pop();
            this.saveState();
            return [...this.messages[chatId]];
        }
        return null;
    }    saveModel(model) {
        globalState.setCurrentModel(model);
    }

    getStoredModel() {
        return globalState.currentModel;
    }

    getStoredProvider() {
        return globalState.currentAIProvider;
    }

    saveProvider(providerId) {
        globalState.setCurrentAIProvider(providerId);
    }

    getProviders() {
        return globalState.getAllAIProviders();
    }

    async saveProviderConfig(providerId, config) {
        globalState.updateAIProvider(providerId, config);
        
        // Clear the provider from cache to force reinitialization
        this.aiProviders.delete(providerId);

        if (providerId === globalState.currentAIProvider) {
            this.initialized = false;
            this.initPromise = this.initProvider();
            await this.initPromise;
        }
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
}
