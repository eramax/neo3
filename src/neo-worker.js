import { Ollama } from "ollama/browser";

let ollama = null;
let abortController = null;
let chats = [];
let messages = {};

// Storage utilities for worker
function save(key, data) {
    // Send to main thread to save
    postMessage({ type: 'saveToStorage', data: { key: `neo2_${key}`, value: JSON.stringify(data) } });
}

function load(key, fallback = null) {
    // This will be initialized from main thread
    return fallback;
}

// Initialize worker state
function initializeState(initialData) {
    chats = initialData.chats || [];
    messages = initialData.messages || {};
}

// Initialize Ollama instance
function initOllama(host) {
    ollama = new Ollama({ host });
}

// Chat management
function createChat() {
    const id = Date.now().toString();
    chats.unshift({ id, title: 'New Chat', category: 'Today' });
    messages[id] = [];
    save('chats', chats);
    save('chatMessages', messages);
    return { id, chats, messages: messages[id] };
}

function addMessage(chatId, message) {
    if (!messages[chatId]) messages[chatId] = [];
    messages[chatId].push(message);
    save('chats', chats);
    save('chatMessages', messages);
    return messages[chatId];
}

function addMessageWithTitleGeneration(chatId, message, model) {
    if (!messages[chatId]) messages[chatId] = [];
    const isFirstUserMessage = messages[chatId].length === 0 && message.role === 'user';
    messages[chatId].push(message);
    save('chats', chats);
    save('chatMessages', messages);

    if (isFirstUserMessage && model && message.content) {
        setTimeout(() => generateTitleAsync(chatId, message.content, model), 0);
    }
    return messages[chatId];
}

async function generateTitleAsync(chatId, userMessage, model) {
    if (!chatId || !userMessage || !model) return;
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
                    updateChatTitle(chatId, lastValidTitle);
                }
            },
            final => updateChatTitle(chatId, cleanTitleResponse(final) || lastValidTitle),
            () => updateChatTitle(chatId, lastValidTitle)
        );
    } catch {
        updateChatTitle(chatId, 'New Chat');
    }
}

function cleanTitleResponse(response) {
    if (!response) return 'New Chat';
    return response.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
        .replace(/<\/?answer>/gi, '')
        .replace(/[*_`#\[\]()]/g, '')
        .trim().split(/\s+/).filter(w => w.length).slice(0, 7).join(' ') || 'New Chat';
}

function updateChatTitle(chatId, title) {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        chat.title = title;
        save('chats', chats);
        save('chatMessages', messages);
        postMessage({
            type: 'chatTitleUpdated',
            data: { chatId, newTitle: title, chats }
        });
    }
}

// Streaming implementation
async function streamChatInternal(model, messagesArray, requestId, onChunk, onComplete, onError) {
    let content = '';
    try {
        const response = await ollama.chat({
            model,
            messages: messagesArray.map(m => ({ role: m.role, content: m.content })),
            stream: true
        });

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

function abortStream(chatId) {
    if (abortController) {
        ollama.abort();
        abortController = null;
    }

    // Remove the last user message and any trailing assistant message if chatId is provided
    if (chatId && messages[chatId] && messages[chatId].length > 0) {
        const msgs = messages[chatId];
        // If the last message is assistant, remove it
        if (msgs[msgs.length - 1]?.role === 'assistant') {
            msgs.pop();
        }
        // If the new last message is user, remove it
        if (msgs.length > 0 && msgs[msgs.length - 1]?.role === 'user') {
            msgs.pop();
        }
        save('chats', chats);
        save('chatMessages', messages);
        return messages[chatId];
    }
    return null;
}

// Handle messages from main thread
self.onmessage = async function (e) {
    const { type, id, data } = e.data;

    try {
        switch (type) {
            case 'init':
                initOllama(data.host);
                initializeState(data.state || {});
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
                const updatedMessages = abortStream(data.chatId);
                postMessage({ type: 'abort', id, data: { messages: updatedMessages } });
                break;

            case 'createChat':
                const newChatData = createChat();
                postMessage({ type: 'createChat', id, data: newChatData });
                break;

            case 'addMessage':
                const updatedMsg = addMessage(data.chatId, data.message);
                postMessage({ type: 'addMessage', id, data: updatedMsg });
                break;

            case 'addMessageWithTitleGeneration':
                const updatedMsgWithTitle = addMessageWithTitleGeneration(data.chatId, data.message, data.model);
                postMessage({ type: 'addMessageWithTitleGeneration', id, data: updatedMsgWithTitle });
                break;

            case 'getChats':
                postMessage({ type: 'getChats', id, data: chats });
                break;

            case 'getMessages':
                postMessage({ type: 'getMessages', id, data: messages[data.chatId] || [] });
                break;

            case 'getChat':
                const chat = chats.find(c => c.id === data.chatId);
                postMessage({ type: 'getChat', id, data: chat });
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        postMessage({ type, id, error: error.message });
    }
};
