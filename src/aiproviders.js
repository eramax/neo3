import OpenAI from 'openai';

export class AIProvider {
    static providerName = 'unknown';

    constructor(config = {}) {
        this.config = config;
        this.client = null;
        this.abortController = null;
    }

    async initClient() {
        this.client = new OpenAI({
            apiKey: this.config.apiKey || 'dummy',
            baseURL: this.config.url || this.config.host, // Fix: use url from config, fallback to host
            dangerouslyAllowBrowser: true,
        });
    }

    async loadModels() {
        try {
            const { data } = await this.client.models.list();
            return this.formatModels(data);
        } catch (error) {
            console.warn(`Failed to load models for ${this.constructor.name}:`, error);
            return [];
        }
    }

    formatModels(models) {
        const providerName = this.constructor.providerName;
        console.log(`Formatting models for ${this.constructor.name}, provider: ${providerName}`);
        return models.map(model => ({
            id: model.id,
            name: model.id,
            arch: 'Unknown',
            size: 'Unknown',
            format: 'API',
            link: '',
            provider: providerName
        }));
    }

    async *chat(model, messages) {
        this.abortController = new AbortController();
        const stream = await this.client.chat.completions.create({
            model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            stream: true
        }, { signal: this.abortController.signal });

        for await (const chunk of stream) {
            yield chunk.choices[0]?.delta?.content || '';
        }
    }

    abort() {
        this.abortController?.abort();
        this.abortController = null;
    }

    async generateTitle(userMessage, model) {
        const instructions = "Generate a short, descriptive title for this user request in exactly 7 words or less. Do not think or reason and don't return markdown formatting. Just respond with the title directly.";
        let title = 'New Chat';
        try {
            const response = await this.client.chat.completions.create({
                model,
                reasoning_effort: "low",
                messages: [
                    { role: 'system', content: instructions },
                    { role: 'user', content: userMessage }
                ],
                stream: false
            });

            const content = response.choices[0]?.message?.content || '';
            console.log('Title generation response:', content);
            const cleaned = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
                .replace(/<\/?answer>/gi, '').replace(/[*_`#\[\]()]/g, '').trim()
                .split(/\s+/).filter(w => w.length).slice(0, 7).join(' ');
            if (cleaned) title = cleaned;
        } catch { }
        return title || 'New Chat';
    }

    static getProviders(storedProviders = {}) {
        const defaultProviders = {
            ollama: { name: 'Ollama', url: 'http://localhost:11434', apiKey: '', requiresApiKey: false },
            openai: { name: 'OpenAI', url: 'https://api.openai.com/v1', apiKey: '', requiresApiKey: true },
            openrouter: { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', apiKey: '', requiresApiKey: true },
            deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', apiKey: '', requiresApiKey: true },
            anthropic: { name: 'Anthropic', url: 'https://api.anthropic.com/v1', apiKey: '', requiresApiKey: true },
            google: { name: 'Google AI', url: 'https://generativelanguage.googleapis.com/v1', apiKey: '', requiresApiKey: true }
        };
        return { ...defaultProviders, ...storedProviders };
    }

    static mergeProviderConfig(providers, providerId, config) {
        return { ...providers, [providerId]: { ...providers[providerId], ...config } };
    }
}

export class OllamaProvider extends AIProvider {
    static providerName = 'ollama';
}

export class OpenAIProvider extends AIProvider {
    static providerName = 'openai';

    formatModels(models) {
        return models.filter(m => m.id.includes('gpt')).map(model => ({
            id: model.id,
            name: this.formatModelName(model.id),
            arch: 'Transformer',
            size: this.getModelSize(model.id),
            format: 'API',
            link: 'https://openai.com/api',
            provider: 'openai'
        }));
    }

    formatModelName(id) {
        return id.replace(/^gpt-/, 'GPT-').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    getModelSize(id) {
        if (id.includes('4o')) return 'Large';
        if (id.includes('mini')) return 'Small';
        if (id.includes('3.5')) return 'Medium';
        return 'Unknown';
    }
}

export class OpenRouterProvider extends AIProvider {
    static providerName = 'openrouter';

    async initClient() {
        this.client = new OpenAI({
            apiKey: this.config.apiKey || 'dummy',
            baseURL: this.config.url || this.config.host, // Fix: use url from config, fallback to host
            dangerouslyAllowBrowser: true,
            defaultHeaders: {
                "HTTP-Referer": "https://neo3.vercel.app/", // Optional: Your site URL for rankings
                "X-Title": "neo3", // This sets your app name
            },
        });
    }
    async loadModels() {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
            });
            const { data } = await response.json();
            return this.formatModels(data);
        } catch (error) {
            console.warn('Failed to load OpenRouter models:', error);
            return [];
        }
    }

    formatModels(models) {
        return models.map(model => ({
            id: model.id,
            name: model.name || model.id,
            arch: 'Transformer',
            size: this.getModelSize(model.context_length || 0),
            format: 'API',
            link: `https://openrouter.ai/models/${model.id}`,
            provider: 'openrouter'
        }));
    }

    getModelSize(contextLength) {
        if (contextLength > 100000) return 'XLarge';
        if (contextLength > 50000) return 'Large';
        if (contextLength > 10000) return 'Medium';
        return 'Small';
    }
}

export class DeepSeekProvider extends AIProvider {
    static providerName = 'deepseek';

    formatModels(models) {
        return models.filter(m => m.id.includes('deepseek')).map(model => ({
            id: model.id,
            name: this.formatModelName(model.id),
            arch: 'Transformer',
            size: 'Large',
            format: 'API',
            link: 'https://platform.deepseek.com',
            provider: 'deepseek'
        }));
    }

    formatModelName(id) {
        return id.replace('deepseek-', 'DeepSeek ').replace(/\b\w/g, l => l.toUpperCase());
    }
}

export class AnthropicProvider extends AIProvider {
    static providerName = 'anthropic';

    async loadModels() {
        try {
            const response = await fetch('https://api.anthropic.com/v1/models', {
                headers: {
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            });
            const { data } = await response.json();
            return this.formatModels(data);
        } catch (error) {
            console.warn('Failed to load Anthropic models:', error);
            return [];
        }
    }

    formatModels(models) {
        return models.filter(m => m.id.includes('claude')).map(model => ({
            id: model.id,
            name: this.formatModelName(model.id),
            arch: 'Transformer',
            size: this.getModelSize(model.id),
            format: 'API',
            link: 'https://anthropic.com/claude',
            provider: 'anthropic'
        }));
    }

    formatModelName(id) {
        return id.replace(/claude-(\d)-(\d+)-(\w+)-(\d+)/, 'Claude $1.$2 $3').replace(/\b\w/g, l => l.toUpperCase());
    }

    getModelSize(id) {
        if (id.includes('opus')) return 'XLarge';
        if (id.includes('sonnet')) return 'Large';
        if (id.includes('haiku')) return 'Medium';
        return 'Unknown';
    }
}

export class GoogleProvider extends AIProvider {
    static providerName = 'google';

    async loadModels() {
        try {
            const response = await fetch(`${this.config.url}/models?key=${this.config.apiKey}`);
            const { models } = await response.json();
            return this.formatModels(models.filter(m => m.name.includes('gemini')));
        } catch (error) {
            console.warn('Failed to load Google models:', error);
            return [];
        }
    }

    formatModels(models) {
        return models.map(model => {
            const id = model.name.split('/').pop();
            return {
                id,
                name: this.formatModelName(id),
                arch: 'Gemini',
                size: this.getModelSize(id),
                format: 'API',
                link: 'https://ai.google.dev',
                provider: 'google'
            };
        });
    }

    formatModelName(id) {
        return id.replace(/gemini-(\d+\.?\d*)-(\w+)/, 'Gemini $1 $2').replace(/\b\w/g, l => l.toUpperCase());
    }

    getModelSize(id) {
        if (id.includes('pro')) return 'Large';
        if (id.includes('flash')) return 'Medium';
        return 'Unknown';
    }
}

export const ProviderFactory = {
    ollama: OllamaProvider,
    openai: OpenAIProvider,
    openrouter: OpenRouterProvider,
    deepseek: DeepSeekProvider,
    anthropic: AnthropicProvider,
    google: GoogleProvider
};
