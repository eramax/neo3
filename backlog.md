# Neo3 Chat Application Backlog

- User wants to refactor Neo3 chat application to remove worker dependency and run directly
- User wants to clean up project structure and implement storage providers
- User wants to create global state management for currentAIProvider, currentModel, currentChat, currentStorageProvider
- User wants to make components encapsulated with their own state management and callback functions
- User wants to implement storage providers similar to AIProvider pattern
- User wants to create generic utility functions for common operations like toggles
- User wants to enable async AI message streaming that continues in background when user switches chats with toast notifications
- User wants to remove saveNewModel method and related new model functionality from chat components
- User wants to remove unused neo-worker.js file and cleanup worker references
- User wants to test refactored application for proper functionality