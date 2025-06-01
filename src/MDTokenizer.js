import { marked } from "marked";

export default class MDTokenizer {
    constructor() {
        this.fullContent = '';
        this.tokens = [];

        // Configure marked with the think extension
        marked.use({
            gfm: true,
            breaks: false,
            tables: true,
            pedantic: false,
            sanitize: false,
            smartLists: true,
            smartypants: false,
            extensions: [{
                name: 'think',
                level: 'block',
                start(src) {
                    return src.startsWith("<think>") ? 0 : undefined;
                },
                tokenizer(src, tokens) {
                    const closedRule = /^<think>([\s\S]*?)<\/think>/;
                    const closedMatch = closedRule.exec(src);

                    if (closedMatch) {
                        return {
                            type: 'think',
                            raw: closedMatch[0],
                            text: closedMatch[1].trim()
                        };
                    } else if (src.startsWith("<think>")) {
                        // Unclosed <think> tag: take everything after <think>
                        const openTag = "<think>";
                        return {
                            type: 'think',
                            raw: src,
                            text: src.substring(openTag.length).trim()
                        };
                    }
                }
            }]
        });
    }

    tokenize(value) {
        this.fullContent = value;
        this.tokens = marked.lexer(value);
        // Serialize tokens to JSON and parse back to object
        // const json = JSON.stringify(this.tokens);
        // this.tokens = JSON.parse(json);
        // console.debug("content", [this.fullContent], "Tokens ", this.tokens);
        return this.tokens;
    }

}

