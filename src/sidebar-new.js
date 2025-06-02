import { LitElement, html } from 'lit';

export class SidebarComponent extends LitElement {
    static properties = {
        collapsed: { type: Boolean }, chats: { type: Array }, currentChatId: { type: String },
        onNewChat: { type: Function }, onNavigateToChat: { type: Function }
    };

    constructor() {
        super();
        Object.assign(this, {
            collapsed: false, chats: [], currentChatId: null,
            onNewChat: () => { }, onNavigateToChat: () => { }
        });
    }

    createRenderRoot() { return this; }

    render() {
        const chatsArray = Array.isArray(this.chats) ? this.chats : [];
        return html`
            <aside class="sidebar ${this.collapsed ? 'collapsed' : ''}">
                <div class="sidebar-header">
                    <div class="brand-section">
                        <h2 class="brand-title">Neo3</h2>
                        <button class="new-chat-btn" @click=${this.onNewChat} title="New Chat">+</button>
                    </div>
                </div>
                <div class="chats-section">
                    ${["Today", "Yesterday", "Previous 30 days"].map(category => html`
                        <div class="category">
                            <div class="category-title">${category}</div>
                            ${chatsArray.filter(c => c.category === category).map(chat => html`
                                <button class="chat-item ${this.currentChatId == chat.id ? 'active' : ''}" 
                                    @click=${() => this.onNavigateToChat(chat.id)}>
                                    ${chat.title}
                                </button>
                            `)}
                        </div>
                    `)}
                </div>
                <div class="user-settings">
                    <div class="user-profile">
                        <div class="user-avatar">👤</div>
                        <div class="user-info">
                            <div class="user-name">User</div>
                            <div class="user-status">Online</div>
                        </div>
                        <button class="settings-btn">⚙️</button>
                    </div>
                </div>
            </aside>
        `;
    }
}

customElements.define('sidebar-component', SidebarComponent);
