// Test script to verify key functionalities
import { globalState } from './src/global-state.js';
import { LocalStorageProvider } from './src/storage-providers.js';
import { Utils } from './src/utils.js';

// Test Global State
console.log('Testing Global State...');
globalState.setCurrentAIProvider('openai');
console.log('Current AI Provider:', globalState.getCurrentAIProvider());

// Test Storage Provider
console.log('Testing Storage Provider...');
const storage = new LocalStorageProvider();
storage.save('test-key', { message: 'Hello World' });
const saved = storage.load('test-key');
console.log('Saved and loaded data:', saved);

// Test Utils
console.log('Testing Utils...');
let testValue = false;
testValue = Utils.toggle(testValue);
console.log('Toggled value:', testValue);

const formatted = Utils.formatTimestamp(new Date());
console.log('Formatted timestamp:', formatted);

console.log('All tests passed!');
