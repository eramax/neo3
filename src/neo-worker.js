import { Ollama } from "ollama/browser";

let ollama = null;
let abortController = null;

// Initialize Ollama instance
function initOllama(host) {
    ollama = new Ollama({ host });
}

// Chat with Ollama - separated for reusability
async function chatWithOllama(model, messagesArray, stream = true) {
    return await ollama.chat({
        model,
        messages: messagesArray.map(m => ({ role: m.role, content: m.content })),
        stream
    });
}

// Streaming implementation
async function streamChatInternal(model, messagesArray, requestId, onChunk, onComplete, onError) {
    let content = '';
    try {
        const response = await chatWithOllama(model, messagesArray);

        abortController = response;

        for await (const chunk of response) {
            content += chunk.message.content || '';
            if (onChunk) onChunk(content);
            if (requestId) {
                postMessage({
                    type: 'streamChat',
                    id: requestId,
                    data: { type: 'chunk', content }
                });
            }
        }

        if (onComplete) onComplete(content);
        if (requestId) {
            postMessage({
                type: 'streamChat',
                id: requestId,
                data: { type: 'complete', content }
            });
        }

        abortController = null;
    } catch (error) {
        abortController = null;
        const isAborted = error.name === 'AbortError';
        const errorMsg = isAborted ? 'Stream cancelled' : `Error: ${error.message}`;

        if (onError) onError(errorMsg, isAborted);
        if (requestId) {
            postMessage({
                type: 'streamChat',
                id: requestId,
                data: { type: 'error', error: errorMsg, aborted: isAborted }
            });
        }
    }
}

async function streamChat(requestId, { model, messagesArray }) {
    await streamChatInternal(model, messagesArray, requestId);
}

async function pullModel(requestId, { modelUrl }) {
    try {
        const res = await ollama.pull({
            model: modelUrl,
            stream: true
        });

        let lastStatus = "";
        let percent = 0;

        for await (const chunk of res) {
            lastStatus = chunk.status || "";
            if (chunk.total && chunk.completed != null) {
                percent = Math.round((chunk.completed / chunk.total) * 100);
            } else {
                percent = 0;
            }

            postMessage({
                type: 'pullModel',
                id: requestId,
                data: { status: lastStatus, percent, model: modelUrl }
            });
        }

        postMessage({
            type: 'pullModel',
            id: requestId,
            data: { status: "Done!", percent: 100, model: modelUrl, complete: true }
        });
    } catch (error) {
        postMessage({
            type: 'pullModel',
            id: requestId,
            data: { status: null, percent: 0, model: modelUrl, error: error.message }
        });
    }
}

async function loadModels() {
    const response = await ollama.list();
    const models = response.models.map(model => {
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
    return models;
}

function formatSize(bytes) {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 ** 3);
    return gb >= 1 ? `${gb.toFixed(1)}GB` : `${(bytes / (1024 ** 2)).toFixed(0)}MB`;
}

function abortStream() {
    if (abortController) {
        ollama.abort();
        abortController = null;
    }
}

async function generateTitleAsync(userMessage, model) {
    if (!userMessage || !model) return 'New Chat';
    const TITLE_PROMPT = "Generate a short, descriptive title for this conversation in exactly 7 words or fewer. Do not use any thinking tags or markdown formatting. Just respond with the title directly:";

    try {
        let lastValidTitle = 'New Chat';
        await streamChatInternal(
            model,
            [{ role: 'user', content: `${TITLE_PROMPT} "${userMessage}"` }],
            null, // no request id for title generation
            chunk => {
                const cleaned = cleanTitleResponse(chunk);
                if (cleaned && cleaned !== 'New Chat' && cleaned.trim()) {
                    lastValidTitle = cleaned;
                }
            },
            final => lastValidTitle = cleanTitleResponse(final) || lastValidTitle,
            () => lastValidTitle
        );
        return lastValidTitle;
    } catch {
        return 'New Chat';
    }
}

function cleanTitleResponse(response) {
    if (!response) return 'New Chat';
    return response.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
        .replace(/<\/?answer>/gi, '')
        .replace(/[*_`#\[\]()]/g, '')
        .trim().split(/\s+/).filter(w => w.length).slice(0, 7).join(' ') || 'New Chat';
}

// Handle messages from main thread
self.onmessage = async function (e) {
    const { type, id, data } = e.data;

    try {
        switch (type) {
            case 'init':
                initOllama(data.host);
                postMessage({ type: 'init', id, success: true });
                break;

            case 'loadModels':
                const models = await loadModels();
                postMessage({ type: 'loadModels', id, data: models });
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
