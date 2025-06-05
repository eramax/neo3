import './chat-page.js';
import './CodeBlock.js';

// Global error handler and copy functionality
window.addEventListener('error', e => console.error('App error:', e.error));
window.copyCodeToClipboard = (btn, code) => {
    navigator.clipboard?.writeText(code).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        setTimeout(() => btn.innerHTML = orig, 2000);
    }).catch(() => {
        const ta = Object.assign(document.createElement("textarea"), {
            value: code,
            style: "position:fixed;left:-999999px;top:-999999px"
        });
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        const orig = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        setTimeout(() => btn.innerHTML = orig, 2000);
    });
};
