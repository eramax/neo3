// Utility functions for the application
export const Utils = {
    // Toggle boolean state
    toggle: (obj, prop) => obj[prop] = !obj[prop],

    // Set property value
    set: (obj, prop, value) => obj[prop] = value,

    // Merge objects
    merge: (target, source) => Object.assign(target, source),

    // Generate unique ID
    generateId: () => Date.now().toString(),

    // Format time
    formatTime: () => new Date().toLocaleTimeString(),

    // Debounce function
    debounce: (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    // Deep clone object
    clone: (obj) => JSON.parse(JSON.stringify(obj)),

    // Check if object is empty
    isEmpty: (obj) => !obj || Object.keys(obj).length === 0,

    // Array unique values
    unique: (arr) => [...new Set(arr)],

    // Scroll to bottom of element
    scrollToBottom: (element) => {
        if (element) {
            requestAnimationFrame(() => element.scrollTop = element.scrollHeight);
        }
    }
};
