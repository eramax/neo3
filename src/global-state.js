import { StorageFactory } from './storage-providers.js';
import { AIProvider } from './aiproviders.js';

export class GlobalState {
    constructor() {
        this.storageProvider = new StorageFactory.localStorage();
        this.aiProviders = AIProvider.getProviders(this.storageProvider.load('providers', {}));
        this.currentAIProvider = this.storageProvider.load('selectedProvider', 'ollama');
        this.currentModel = this.storageProvider.load('selectedModel');
        this.currentChat = null;
        this.currentStorageProvider = 'localStorage';
        this.streamingChats = new Map(); // Track streaming chats
        this.listeners = new Map();
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    // Storage methods
    save(key, data) {
        this.storageProvider.save(key, data);
        this.emit('dataChanged', { key, data });
    }

    load(key, fallback = null) {
        return this.storageProvider.load(key, fallback);
    }

    // AI Provider methods
    setCurrentAIProvider(providerId) {
        this.currentAIProvider = providerId;
        this.save('selectedProvider', providerId);
        this.emit('aiProviderChanged', providerId);
    }

    setCurrentModel(modelId) {
        this.currentModel = modelId;
        this.save('selectedModel', modelId);
        this.emit('modelChanged', modelId);
    }

    updateAIProvider(providerId, config) {
        this.aiProviders[providerId] = { ...this.aiProviders[providerId], ...config };
        this.save('providers', this.aiProviders);
        this.emit('aiProviderConfigChanged', { providerId, config });
    }

    // Chat methods
    setCurrentChat(chatId) {
        this.currentChat = chatId;
        this.emit('chatChanged', chatId);
    }    // Streaming management
    addStreamingChat(chatId, streamInfo) {
        this.streamingChats.set(chatId, streamInfo);
        this.emit('streamingStarted', { chatId, streamInfo });
    }

    removeStreamingChat(chatId) {
        this.streamingChats.delete(chatId);
        this.emit('streamingEnded', { chatId });
    }

    getStreamingChat(chatId) {
        return this.streamingChats.get(chatId);
    }

    isStreamingForChat(chatId) {
        return this.streamingChats.has(chatId);
    }

    hasAnyStreaming() {
        return this.streamingChats.size > 0;
    }

    // Getters
    getCurrentAIProvider() {
        return this.aiProviders[this.currentAIProvider];
    }

    getAllAIProviders() {
        return this.aiProviders;
    }
}

// Global instance
export const globalState = new GlobalState();
