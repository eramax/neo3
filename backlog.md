## [June 3, 2025] - Provider-Specific Model Loading States

- **Changed:** Enhanced model selector to show loading state for specific provider being expanded
- **Reason:** User wanted models to load when opening provider accordion and show loading for that specific provider
- **Impact:**
  - Added `loadingProviders` Set to track which providers are currently loading models
  - Modified loading display to show spinner for specific provider being loaded, not just selected provider
  - Updated `toggleProvider()` to only load models if provider has no models yet
  - Added `onModelsLoaded()` method to clear loading state when provider models finish loading
  - Improved retry button to work for any provider and show loading state
  - Better UX with accurate loading indicators per provider

## [June 3, 2025] - Lazy Model Loading for Providers

- **Changed:** Implemented lazy loading for provider models to improve performance
- **Reason:** User requested models only load when provider is opened, not on page load
- **Impact:**
  - Modified `toggleProvider()` to trigger model loading when expanding a provider
  - Updated `loadModels()` to accept provider parameter for targeted loading
  - Changed initial page load to only load selected provider models
  - Added provider-specific model loading in worker with `loadModels(provider)` parameter
  - Optimized model loading by avoiding unnecessary API calls for unopened providers
  - Improved app startup performance by reducing initial network requests
  - Maintained backward compatibility for existing model loading patterns

## [June 3, 2025] - Enhanced Model Selector UX

- **Changed:** Improved model selector behavior for better user experience
- **Reason:** User requested more intuitive provider/model selection workflow
- **Impact:**
  - Fixed modal width to 450px for consistent sizing
  - When clicking provider, only expands/shows models without switching provider
  - Provider and model selection only happens when clicking specific model
  - Closes other providers when expanding one for better focus
  - Added status icons beside models instead of text for configured providers
  - Models take full width for better readability
  - Added overflow with max 70% screen height for large model lists
  - Removed "Select Provider" button - direct model selection workflow

## [June 2, 2025] - Multi-Provider Model Selector

- **Changed:** Complete rewrite of model-selector.js to support multiple AI providers with individual configurations
- **Reason:** Enable users to connect to different AI services (Ollama, OpenAI, OpenRouter, DeepSeek, Anthropic, Google AI) with provider-specific settings
- **Impact:**
  - Added provider tabs with configuration buttons for each service
  - Implemented modal configuration for API keys and server URLs
  - Added provider-specific connection status indicators
  - Maintained Ollama-specific features (model pulling) only for Ollama provider
  - Enhanced UI with provider badges and improved visual hierarchy
  - Optimized performance with minimal code patterns and arrow functions

## [June 2, 2025] - Performance Optimization & Code Refactoring

- **Changed:** Complete app refactoring with minimal code approach
- **Reason:** Optimize performance and reduce codebase size for better maintainability
- **Impact:**
  - Reduced main.js from 13 to 18 lines with integrated copy functionality
  - Optimized core.js from 289 to 144 lines (50% reduction) with streamlined state management
  - Compressed chat-page.js from 360 to 160 lines (55% reduction) using Object.assign and inline handlers
  - Minimized sidebar.js from 66 to 44 lines (33% reduction) with compact property definitions
  - Reduced model-selector.js from 232 to 74 lines (68% reduction) using optional chaining and ternary operators
  - Optimized neo-worker.js from 222 to 115 lines (48% reduction) with arrow functions and streamlined logic
  - Replaced complex MDRender.js (470 lines) with minimal version (131 lines, 72% reduction)
  - Enhanced performance through efficient DOM operations, reduced function calls, and streamlined event handling
  - Improved memory usage with cached elements and reduced state mutations
  - Better code readability with consistent patterns and modern JavaScript features

## [2024] - Code Refactor

- **Changed:** Extracted ollama.chat call into separate chatWithOllama function
- **Reason:** Improve code modularity and reusability for chat functionality
- **Impact:** Better code organization, easier testing and maintenance

## [2024] - Code Copy Refactor

- **Changed:** Updated MDRender.js to use global copyCodeToClipboard function
- **Reason:** Consolidate copy functionality to single implementation in main.js
- **Impact:** Reduced code duplication, improved maintainability, consistent copy behavior across app

## [June 2, 2025] - Final Code Splitting & Bundle Optimization

- **Changed:**

  - Implemented lazy loading for highlight.js in MDRender component
  - Added lazy loading for Ollama browser module in worker
  - Configured manual chunking in Vite for vendor libraries
  - Fixed worker format configuration for ES modules
  - Removed heavy unified/remark dependencies in favor of lightweight markdown parser

- **Reason:**

  - Large bundle size (1,143 kB) impacting initial load performance
  - Heavy dependencies loaded upfront even when not immediately needed
  - Code splitting improves caching and loading strategies

- **Impact:**

  - **Bundle size reduced by 15%**: From 1,143.22 kB to 969.32 kB
  - **Gzipped size reduced by 13.5%**: From 360.81 kB to 311.93 kB
  - **Better code splitting**: Vendor (16.13 kB), Ollama (16.03 kB), Worker (3.05 kB)
  - **Improved loading performance**: Critical features load first, optional features lazy-loaded
  - **Better browser caching**: Vendor libraries can be cached separately from app code

- **Technical Details:**
  - Replaced synchronous imports with dynamic import() for non-critical dependencies
  - Configured Vite manual chunking for optimal cache strategies
  - Maintained all original functionality with zero breaking changes
  - Build time improved from 1.57s to 1.04s (33% faster)

## [June 2, 2025] - MDRender.js Reversion to Original Implementation

- **Changed:** Reverted MDRender.js from optimized lightweight version back to original remark-based implementation
- **Reason:** Ensure compatibility and maintain full markdown parsing capabilities with unified/remark ecosystem
- **Impact:**
  - Restored full incremental markdown rendering with AST-based updates
  - Re-enabled advanced markdown features including GFM (GitHub Flavored Markdown)
  - Better handling of complex markdown structures and edge cases
  - Maintained copy functionality and think block processing
  - File size increased from 150 to 470 lines but with superior markdown parsing accuracy
  - Better performance for incremental updates during streaming content

## [2024-12-19] - Move SCSS Import to HTML

- **Changed:** Removed style injection from ChatPage component and added direct SCSS import to HTML
- **Reason:** User requested direct style import in HTML instead of component-level injection
- **Impact:** Cleaner component code, styles loaded once globally, better performance and simpler architecture

## [June 3, 2025] - Accordion Interface Conversion

- **Changed:** Converted model selector from tab interface to accordion interface with collapsible provider sections
- **Reason:** Improve UX by allowing users to browse models from different AI providers in an expandable/collapsible format that saves vertical space
- **Impact:**
  - Replaced tab-based navigation with accordion items that can expand/collapse independently
  - Added `expandedProviders` Set to track which provider sections are open
  - Implemented `toggleProvider()` method for expand/collapse behavior with smooth animations
  - Updated `selectProvider()` to auto-expand sections when selecting a provider
  - Added chevron indicators with rotation animations for visual feedback
  - Enhanced accordion styling with hover effects, selection states, and smooth transitions
  - Maintained all existing functionality while improving space efficiency and visual organization
  - Fixed SCSS syntax errors during implementation for successful build process

## [June 3, 2025] - Model Selector UI Improvements

- **Changed:** Enhanced model selector with fixed 450px width, auto-provider selection, status icons, and overflow handling
- **Reason:** Improve user experience with streamlined provider/model selection and better visual feedback
- **Impact:**
  - Fixed model selector width to 450px for consistent sizing
  - Auto-collapse other providers when selecting a new one
  - Removed separate "Select Provider" button - clicking provider directly shows models and selects it
  - Added status icons beside models instead of text for configured providers
  - Model rows now take full width for better space utilization
  - Added 70vh max height with overflow scroll for many models
  - Improved responsive behavior and visual hierarchy

## [January 6, 2025] - Fixed Corrupted Model Selector

- **Changed:** Restored corrupted model-selector.js file with proper lazy loading implementation
- **Reason:** File became corrupted during previous edits with duplicate class declarations and syntax errors
- **Impact:**
  - Completely rewrote model-selector.js with clean implementation
  - Preserved all lazy loading functionality including `toggleProvider()` with model loading trigger
  - Fixed `updated()` lifecycle method to properly expand selected provider on initialization
  - Maintained proper expandedProviders Set management for UI state
  - Ensured all event handlers and rendering methods work correctly
  - Application now starts without errors and lazy loading works as intended

## [2024-12-19] - Single Provider Accordion

- **Changed:** Modified model selector to show only one expanded provider at a time
- **Reason:** Improved UX by preventing multiple expanded providers and confusion about which provider's models are shown
- **Impact:** Cleaner interface, better model organization, reduced visual clutter

## [2024-12-19] - Provider-Specific Model Loading Fix

- **Changed:** Fixed worker loadModels to use provider-specific configuration instead of initialized instance
- **Reason:** Models were loading with wrong provider URL when expanding different providers
- **Impact:** Each provider now correctly loads models using its own configuration URL

## [2024-12-19] - Model Selector Code Cleanup

- **Changed:** Removed duplicated provider definitions and simplified status indicator logic
- **Reason:** Code duplication maintenance issues and cleaner component structure
- **Impact:** Reduced code complexity, single source of truth for provider configurations

## [2024-12-19] - Core and Worker Code Cleanup

- **Changed:** Consolidated provider definitions and removed duplicated model mapping code
- **Reason:** Reduced code duplication and improved maintainability across core and worker files
- **Impact:** Single source of truth for provider configs, cleaner model loading logic

## [2024-12-19] - Fix Provider Switching for Chat

- **Changed:** Added proper worker reinitialization when switching providers and fixed syntax error
- **Reason:** Chat was using wrong provider URL when model selection changed providers
- **Impact:** Chat now correctly uses selected provider configuration for streaming

## [2024-12-19] - AI Provider System Implementation

- **Changed:** Created abstract AIProvider system with concrete implementations for all LLM providers
- **Reason:** Centralize provider logic, improve maintainability, and enable dynamic model loading per provider
- **Impact:**
  - Cleaner separation of concerns
  - Dynamic model loading when expanding providers
  - Unified interface for all AI providers
  - Better error handling and abort functionality
  - Reduced code duplication across providers

## [2024-12-19] - AI Provider System Simplification

- **Changed:** Unified all providers to use OpenAI client with provider-specific model formatting
- **Reason:** Most AI providers are OpenAI-compatible, reducing complexity and dependencies
- **Impact:**
  - Simplified codebase with single client pattern
  - Reduced bundle size by removing multiple SDK dependencies
  - Consistent API across all providers
  - Only Ollama needs special handling for model listing and formatting
  - Better performance with unified streaming interface

## [2024-12-19] - Real Model Loading Implementation

- **Changed:** Updated all AI providers to fetch real models from their APIs instead of hardcoded values
- **Reason:** Provide accurate, up-to-date model lists from each provider's actual API
- **Impact:**
  - Dynamic model discovery from provider APIs
  - Fallback to hardcoded models if API fails
  - Better model metadata (names, sizes, links)
  - OpenRouter and Anthropic use dedicated model endpoints
  - Google uses Gemini API model listing
  - Improved user experience with real model availability

## [2024-12-19] - Remove Fallback Models

- **Changed:** Removed getFallbackModels methods from all AI providers
- **Reason:** Simplified error handling by returning empty arrays instead of hardcoded fallbacks
- **Impact:**
  - Cleaner codebase with less duplicate model definitions
  - More accurate representation when API calls fail
  - Reduced maintenance burden of keeping fallback models updated
  - Users see actual API availability rather than misleading fallbacks

## [2024-01-XX] - Fix Ollama Model Loading

- **Changed:** Fixed AIProvider initialization to use correct URL configuration
- **Reason:** Ollama was incorrectly using OpenAI's endpoint instead of its own API
- **Impact:** Proper model loading for each provider, consistent parameter naming across worker communication

## [2024-12-19] - Scrollbar Styling Fix

- **Changed:** Moved scrollbar styles from .main-content scope to global scope in app.scss
- **Reason:** Sidebar scrollbar was not inheriting dark mode styling, only main content area had proper dark scrollbars
- **Impact:** Consistent dark mode scrollbar appearance across entire application (sidebar and main content)

## [2024-01-XX] - AI Provider Title Generation API Update

- **Changed:** Switched from chat completions to responses API for title generation
- **Reason:** Use specialized responses API with instructions/input format
- **Impact:** Simplified API call structure and potentially better response handling

## [2024-12-19] - Auto Chat Creation

- **Changed:** Modified sendMessage() to automatically create and navigate to new chat when no active chat exists
- **Reason:** Improve UX by eliminating need to manually create chat before sending first message
- **Impact:** Streamlined user workflow, reduced friction in starting conversations

## [2024-12-19] - Debug Provider Name Generation

- **Changed:** Added debug logging to base formatModels method, removed redundant OllamaProvider override
- **Reason:** Generic provider name generation should work, investigating why it showed 'sa' instead of 'ollama'
- **Impact:** Simplified code by using base class functionality, added debugging to identify root cause

## [2024-12-19] - Fix Provider Names in Minified Code

- **Changed:** Added static providerName property to each provider class, use it instead of constructor.name
- **Reason:** Class names get mangled during code minification causing incorrect provider identification
- **Impact:** Fixes provider attribute showing as 'sa' or other minified names in production builds

## [2024-12-19] - Remove Legacy ollamaUrl Code

- **Changed:** Removed ollamaUrl property and related methods from core.js and chat-page.js
- **Reason:** All providers now handle their own URL configuration consistently, making special Ollama URL treatment redundant
- **Impact:** Cleaner code architecture with unified provider configuration system
