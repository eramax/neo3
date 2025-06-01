import { Ollama } from "ollama/browser";

let ollama = null;
let currentAbortController = null;

// Initialize Ollama instance
function initOllama(host) {
    ollama = new Ollama({ host });
}

// Create chat response
async function askAI(model, messages, think = false, stream = true) {
    return await ollama.chat({
        model,
        messages,
        stream,
        //think
    });
}

// Streaming implementation
async function streamChat(requestId, { model, messages, think = true }) {
    try {
        // Create new AbortController for this request
        currentAbortController = new AbortController();

        let fullContent = '';
        const response = await askAI(model, messages, think, true);
        for await (const chunk of response) {
            // Check if aborted before processing chunk
            if (currentAbortController.signal.aborted) {
                break;
            }

            fullContent += chunk.message.content || '';
            if (requestId) {
                postMessage({
                    type: 'streamChat',
                    id: requestId,
                    data: { type: 'chunk', value: fullContent }
                });
            }
        }

        // Only send complete if not aborted
        if (requestId && !currentAbortController.signal.aborted) {
            postMessage({
                type: 'streamChat',
                id: requestId,
                data: { type: 'complete' }
            });
        }
    } catch (error) {
        if (requestId) {
            const isAborted = error.name === 'AbortError' || error.message.includes('aborted') || currentAbortController?.signal.aborted;
            postMessage({
                type: 'streamChat',
                id: requestId,
                data: {
                    type: isAborted ? 'aborted' : 'error',
                    error: isAborted ? 'Request cancelled' : error.message
                }
            });
        }
    } finally {
        currentAbortController = null;
    }
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
    if (currentAbortController) {
        currentAbortController.abort();
    }
    if (ollama) {
        ollama.abort();
    }
}

async function generateTitleAsync(userMessage, model) {
    if (!userMessage || !model) return 'New Chat';

    const TITLE_PROMPT = "Generate a short, descriptive title for this conversation in exactly 7 words or fewer. Do not use any thinking tags or markdown formatting. Just respond with the title directly:";

    try {
        const response = await askAI(model,
            [{ role: 'user', content: `${TITLE_PROMPT} "${userMessage}"` }],
            false,
            false
        );

        // Validate response structure
        if (!response?.message?.content) {
            console.warn('Title generation: Invalid response structure');
            return 'New Chat';
        }

        let title = response.message.content;
        return cleanTitle(title);
    } catch (error) {
        console.warn('Title generation failed:', error.message);
        return 'New Chat';
    }
}

function cleanTitle(title) {
    if (!title) return 'New Chat';
    // Remove <think>...</think> and <answer> tags, but keep special characters/icons
    return title
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
        .replace(/<\/?answer>/gi, '')
        .replace(/<\/?script.*?>/gi, '') // Remove <script> tags
        .trim()
        .split(/\s+/)
        .filter(w => w.length)
        .slice(0, 7)
        .join(' ') || 'New Chat';
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
