import { LitElement, html } from 'lit';

export class ToastNotification extends LitElement {
    static properties = {
        message: { type: String },
        type: { type: String },
        duration: { type: Number },
        onClick: { type: Function },
        visible: { type: Boolean }
    };

    constructor() {
        super();
        this.message = '';
        this.type = 'info';
        this.duration = 5000;
        this.onClick = null;
        this.visible = false;
    }

    createRenderRoot() { return this; }

    show(message, type = 'info', duration = 5000, onClick = null) {
        this.message = message;
        this.type = type;
        this.duration = duration;
        this.onClick = onClick;
        this.visible = true;
        
        if (duration > 0) {
            setTimeout(() => this.hide(), duration);
        }
    }

    hide() {
        this.visible = false;
    }

    handleClick() {
        if (this.onClick) {
            this.onClick();
        }
        this.hide();
    }

    render() {
        if (!this.visible) return '';
        
        return html`
            <div class="toast toast-${this.type} ${this.onClick ? 'clickable' : ''}" 
                 @click=${this.onClick ? this.handleClick : null}>
                <span class="toast-message">${this.message}</span>
                <button class="toast-close" @click=${this.hide}>✕</button>
            </div>
        `;
    }
}

customElements.define('toast-notification', ToastNotification);
