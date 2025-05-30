import './chat-page.js';

// Initialize the application
console.log('Neo3 Chat application loaded');

// Add any global initialization logic here
if (typeof window !== 'undefined') {
    // Set up any global event listeners or configurations
    window.addEventListener('error', (e) => {
        console.error('Application error:', e.error);
    });
}
