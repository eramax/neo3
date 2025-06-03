import { ProviderFactory } from './aiproviders.js';

let currentProvider = null;
let providers = new Map();

const getProvider = async (providerId, config) => {
    if (!providers.has(providerId)) {
        const ProviderClass = ProviderFactory[providerId];
        if (!ProviderClass) throw new Error(`Unknown provider: ${providerId}`);

        const provider = new ProviderClass(config);
        await provider.initClient();
        providers.set(providerId, provider);
    }
    return providers.get(providerId);
};

const streamChatInternal = async (model, messagesArray, requestId) => {
    let content = '';
    try {
        for await (const chunk of currentProvider.chat(model, messagesArray)) {
            content += chunk;
            requestId && postMessage({ type: 'streamChat', id: requestId, data: { type: 'chunk', content } });
        }
        requestId && postMessage({ type: 'streamChat', id: requestId, data: { type: 'complete', content } });
    } catch (error) {
        const isAborted = error.name === 'AbortError';
        const errorMsg = isAborted ? 'Stream cancelled' : `Error: ${error.message}`;
        requestId && postMessage({ type: 'streamChat', id: requestId, data: { type: 'error', error: errorMsg, aborted: isAborted } });
    }
};

const pullModel = async (requestId, { modelUrl }) => {
    if (currentProvider.constructor.name !== 'OllamaProvider') {
        postMessage({ type: 'pullModel', id: requestId, data: { error: 'Model pulling only supported for Ollama' } });
        return;
    }

    try {
        const res = await currentProvider.client.pull({ model: modelUrl, stream: true });
        let lastStatus = "", percent = 0;

        for await (const chunk of res) {
            lastStatus = chunk.status || "";
            percent = chunk.total && chunk.completed != null ? Math.round((chunk.completed / chunk.total) * 100) : 0;
            postMessage({ type: 'pullModel', id: requestId, data: { status: lastStatus, percent, model: modelUrl } });
        }

        postMessage({ type: 'pullModel', id: requestId, data: { status: "Done!", percent: 100, model: modelUrl, complete: true } });
    } catch (error) {
        postMessage({ type: 'pullModel', id: requestId, data: { error: error.message } });
    }
};

self.onmessage = async ({ data: { type, id, data } }) => {
    try {
        switch (type) {
            case 'init':
                currentProvider = await getProvider(data.provider, {
                    url: data.url,
                    apiKey: data.apiKey
                });
                postMessage({ type: 'init', id, success: true });
                break;
            case 'loadModels':
                const provider = await getProvider(data.provider, data.config);
                const models = await provider.loadModels();
                postMessage({ type: 'loadModels', id, data: models });
                break;
            case 'clearProvider':
                providers.delete(data.providerId);
                postMessage({ type: 'clearProvider', id, success: true });
                break;
            case 'streamChat':
                await streamChatInternal(data.model, data.messagesArray, id);
                break;
            case 'pullModel':
                await pullModel(id, data);
                break;
            case 'abort':
                currentProvider?.abort();
                postMessage({ type: 'abort', id, success: true });
                break;
            case 'generateTitle':
                const title = await currentProvider.generateTitle(data.userMessage, data.model);
                postMessage({ type: 'generateTitle', id, data: { title } });
                break;
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        postMessage({ type, id, error: error.message });
    }
};
