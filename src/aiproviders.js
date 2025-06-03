import OpenAI from 'openai';

export class AIProvider {
    constructor(config = {}) {
        this.config = config;
        this.client = null;
        this.abortController = null;
    }

    async initClient() {
        this.client = new OpenAI({
            apiKey: this.config.apiKey || 'dummy',
            baseURL: this.config.url || this.config.host, // Fix: use url from config, fallback to host
            dangerouslyAllowBrowser: true
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
        return models.map(model => ({
            id: model.id,
            name: model.id,
            arch: 'Unknown',
            size: 'Unknown',
            format: 'API',
            link: '',
            provider: this.constructor.name.toLowerCase().replace('provider', '')
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
        const prompt = "Generate a short, descriptive title for this conversation in exactly 7 words or fewer. Do not use any thinking tags or markdown formatting. Just respond with the title directly:";
        let title = 'New Chat';
        try {
            for await (const chunk of this.chat(model, [{ role: 'user', content: `${prompt} "${userMessage}"` }])) {
                const cleaned = chunk.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
                    .replace(/<\/?answer>/gi, '').replace(/[*_`#\[\]()]/g, '').trim()
                    .split(/\s+/).filter(w => w.length).slice(0, 7).join(' ');
                if (cleaned) title = cleaned;
            }
        } catch { }
        return title || 'New Chat';
    }
}

export class OllamaProvider extends AIProvider {

    // formatModels(models) {
    //     return models.map(model => {
    //         const baseName = model.name.split(':')[0];
    //         let displayName = baseName;
    //         let link = `https://ollama.com/library/${displayName}`;

    //         if (baseName.startsWith('hf.co/')) {
    //             const hfPath = baseName.substring(6);
    //             displayName = hfPath.split('/').pop().replace(/-GGUF$/i, '');
    //             link = `https://huggingface.co/${hfPath}`;
    //         }

    //         return {
    //             id: model.name,
    //             name: displayName,
    //             arch: model.details?.family || 'Unknown',
    //             size: this.formatSize(model.size),
    //             format: model.details?.format?.toUpperCase() || 'Unknown',
    //             link,
    //             provider: 'ollama'
    //         };
    //     });
    // }

    // formatSize(bytes) {
    //     if (!bytes) return 'Unknown';
    //     const gb = bytes / (1024 ** 3);
    //     return gb >= 1 ? `${gb.toFixed(1)}GB` : `${(bytes / (1024 ** 2)).toFixed(0)}MB`;
    // }
}

export class OpenAIProvider extends AIProvider {
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
