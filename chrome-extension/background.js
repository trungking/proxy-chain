/**
 * Main Background Service Worker for Proxy Chain Chrome Extension
 * 
 * This file serves as the entry point and orchestrates various modules:
 * - Storage operations
 * - Node.js API communication
 * - Proxy management
 * - Badge management
 * - Message handling
 * - Startup and periodic tasks
 */

import { setupBadgeListeners, updateBadgeForCurrentTab } from './utils/badgeManager.js';
import { setupMessageHandlers } from './handlers/messageHandlers.js';
import { setupStartupHandlers } from './handlers/startupHandler.js';

// Initialize the extension
function initializeExtension() {
  console.log("Background service worker started.");
  
  // Setup all event listeners and handlers
  setupBadgeListeners();
  setupMessageHandlers();
  setupStartupHandlers();
  
  // Update badge for current tab on initialization
  updateBadgeForCurrentTab();
}

// Start the extension
initializeExtension(); 