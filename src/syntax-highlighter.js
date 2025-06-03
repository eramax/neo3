import Prism from "prismjs"
import "prismjs/components/prism-markup-templating"
import "prismjs/components/prism-clike"
import "prismjs/components/prism-c"
import "prismjs/components/prism-cpp"
import "prismjs/components/prism-java"
import "prismjs/components/prism-csharp"
import "prismjs/components/prism-python"
import "prismjs/components/prism-go"
import "prismjs/components/prism-rust"
import "prismjs/components/prism-php"
import "prismjs/components/prism-ruby"
import "prismjs/components/prism-swift"
import "prismjs/components/prism-kotlin"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-tsx"
import "prismjs/components/prism-css"
import "prismjs/components/prism-scss"
import "prismjs/components/prism-less"
import "prismjs/components/prism-json"
import "prismjs/components/prism-yaml"
import "prismjs/components/prism-markup"
import "prismjs/components/prism-markdown"
import "prismjs/components/prism-bash"
import "prismjs/components/prism-sql"
import "prismjs/components/prism-dart"
import "prismjs/components/prism-julia"
import "prismjs/components/prism-elixir"
import "prismjs/components/prism-haskell"
import "prismjs/components/prism-r"
import "prismjs/components/prism-perl"
import "prismjs/components/prism-lua"
import "prismjs/components/prism-fsharp"
import "prismjs/components/prism-scala"
import { visit } from "unist-util-visit"

const LANG_MAP = {
    'html': 'markup',
    'xml': 'markup',
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'sh': 'bash',
    'golang': 'go'
}

export const remarkSyntaxHighlight = () => (tree) => {
    visit(tree, 'code', (node) => {
        const lang = node.lang?.toLowerCase()

        // Skip highlighting for Mermaid diagrams
        if (lang === 'mermaid') {
            node.highlighted = null;
            return;
        }

        const actualLang = LANG_MAP[lang] || lang

        if (actualLang && Prism.languages[actualLang]) {
            try {
                node.highlighted = Prism.highlight(node.value, Prism.languages[actualLang], actualLang)
            } catch (err) {
                node.highlighted = node.value
            }
        } else {
            node.highlighted = node.value
        }
    })
}
