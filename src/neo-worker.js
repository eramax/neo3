// Optimized Neo3 worker with lazy loading
let Ollama = null;
let ollama = null;
let abortController = null;
let currentProvider = 'ollama';
let providerConfig = {};

const loadOllama = async () => {
    if (!Ollama) {
        const module = await import('ollama/browser');
        Ollama = module.Ollama;
    }
    return Ollama;
};

const initOllama = async (host, provider = 'ollama', apiKey = '') => {
    const OllamaClass = await loadOllama();
    currentProvider = provider;
    providerConfig = { host, provider, apiKey };
    ollama = new OllamaClass({ host });
    return ollama;
};

const chatWithOllama = async (model, messagesArray, stream = true) =>
    await ollama.chat({
        model,
        messages: messagesArray.map(m => ({ role: m.role, content: m.content })),
        stream
    });

const streamChatInternal = async (model, messagesArray, requestId, onChunk, onComplete, onError) => {
    let content = '';
    try {
        const response = await chatWithOllama(model, messagesArray);
        abortController = response;

        for await (const chunk of response) {
            content += chunk.message.content || '';
            onChunk && onChunk(content);
            requestId && postMessage({ type: 'streamChat', id: requestId, data: { type: 'chunk', content } });
        }

        onComplete && onComplete(content);
        requestId && postMessage({ type: 'streamChat', id: requestId, data: { type: 'complete', content } });
        abortController = null;
    } catch (error) {
        abortController = null;
        const isAborted = error.name === 'AbortError';
        const errorMsg = isAborted ? 'Stream cancelled' : `Error: ${error.message}`;
        onError && onError(errorMsg, isAborted);
        requestId && postMessage({ type: 'streamChat', id: requestId, data: { type: 'error', error: errorMsg, aborted: isAborted } });
    }
};

const streamChat = async (requestId, { model, messagesArray }) => await streamChatInternal(model, messagesArray, requestId);

const pullModel = async (requestId, { modelUrl }) => {
    try {
        const res = await ollama.pull({ model: modelUrl, stream: true });
        let lastStatus = "", percent = 0;

        for await (const chunk of res) {
            lastStatus = chunk.status || "";
            percent = chunk.total && chunk.completed != null ? Math.round((chunk.completed / chunk.total) * 100) : 0;
            postMessage({ type: 'pullModel', id: requestId, data: { status: lastStatus, percent, model: modelUrl } });
        }

        postMessage({ type: 'pullModel', id: requestId, data: { status: "Done!", percent: 100, model: modelUrl, complete: true } });
    } catch (error) {
        postMessage({ type: 'pullModel', id: requestId, data: { status: null, percent: 0, model: modelUrl, error: error.message } });
    }
};

const loadModels = async () => {
    const { models } = await ollama.list();
    return models.map(model => {
        const baseName = model.name.split(':')[0];
        let displayName = baseName;
        let link = `https://ollama.com/library/${displayName}`;

        if (baseName.startsWith('hf.co/')) {
            const hfPath = baseName.substring(6);
            displayName = hfPath.split('/').pop().replace(/-GGUF$/i, '');
            link = `https://huggingface.co/${hfPath}`;
        }

        return {
            id: model.name,
            name: displayName,
            arch: model.details?.family || 'Unknown',
            size: formatSize(model.size),
            format: model.details?.format?.toUpperCase() || 'Unknown',
            link,
            details: model.details || {}
        };
    });
};

const formatSize = bytes => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 ** 3);
    return gb >= 1 ? `${gb.toFixed(1)}GB` : `${(bytes / (1024 ** 2)).toFixed(0)}MB`;
};

const abortStream = () => {
    if (abortController) {
        ollama.abort();
        abortController = null;
    }
};

const generateTitleAsync = async (userMessage, model) => {
    if (!userMessage || !model) return 'New Chat';
    const TITLE_PROMPT = "Generate a short, descriptive title for this conversation in exactly 7 words or fewer. Do not use any thinking tags or markdown formatting. Just respond with the title directly:";

    try {
        let lastValidTitle = 'New Chat';
        await streamChatInternal(
            model,
            [{ role: 'user', content: `${TITLE_PROMPT} "${userMessage}"` }],
            null,
            chunk => {
                const cleaned = cleanTitleResponse(chunk);
                if (cleaned && cleaned !== 'New Chat' && cleaned.trim()) {
                    lastValidTitle = cleaned;
                }
            },
            final => {
                const cleaned = cleanTitleResponse(final);
                if (cleaned) lastValidTitle = cleaned;
            },
            () => lastValidTitle
        );
        return lastValidTitle;
    } catch {
        return 'New Chat';
    }
};

const cleanTitleResponse = response => {
    if (!response) return 'New Chat';
    return response.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
        .replace(/<\/?answer>/gi, '')
        .replace(/[*_`#\[\]()]/g, '')
        .trim().split(/\s+/).filter(w => w.length).slice(0, 7).join(' ') || 'New Chat';
};

self.onmessage = async ({ data: { type, id, data } }) => {
    try {
        switch (type) {
            case 'init':
                await initOllama(data.host, data.provider, data.apiKey);
                postMessage({ type: 'init', id, success: true });
                break;
            case 'loadModels':
                postMessage({ type: 'loadModels', id, data: await loadModels() });
                break;
            case 'streamChat':
                await streamChat(id, data);
                break;
            case 'pullModel':
                await pullModel(id, data);
                break;
            case 'abort':
                abortStream();
                postMessage({ type: 'abort', id, success: true });
                break;
            case 'generateTitle':
                const title = await generateTitleAsync(data.userMessage, data.model);
                postMessage({ type: 'generateTitle', id, data: { title } });
                break;
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        postMessage({ type, id, error: error.message });
    }
};
