/**
 * Main Application Entry Point
 * Initializes and coordinates all services
 */

import { StorageManager } from "../storageManager.js";
import { InferenceManager } from "../inferenceManager.js";
import { DialogService } from "./dialogService.js";
import { SidebarManager } from "./sidebarManager.js";
import { BotService } from "./botService.js";
import { ChatService } from "./chatService.js";
import { SettingsService } from "./settingsService.js";
import { MessageService } from "./messageService.js";
import { PersonaService } from "./personaService.js";

// Initialize managers
const storageManager = new StorageManager();
let inferenceManager = null;

// Make services available globally for callbacks
window.storageManager = storageManager;
window.dialogService = DialogService;
window.sidebarManager = SidebarManager;
window.botService = BotService;
window.chatService = ChatService;
window.settingsService = SettingsService;
window.messageService = MessageService;

// Application state
window.currentChatId = null;
window.currentBotId = null;
window.currentBotData = null;
window.isGenerating = false;

/**
 * Initialize the application
 */
function init() {
  console.log('[index.js] Initializing application...');
  console.log('[index.js] Using window.chatRenderer:', chatRenderer);

  // Load saved configurations
  inferenceManager = SettingsService.loadSavedApiConfig(InferenceManager);
  SettingsService.loadSavedBackground();
  SettingsService.setupBackgroundUpload();

  // Setup UI
  SidebarManager.init(() => DialogService.openUploadDialog(), () => DialogService.openPersonaDialog());
  DialogService.setupDialogListeners(
    () => SettingsService.saveApiConfig(inferenceManager),
    () => SettingsService.clearBackground()
  );

  // Setup chat controls
  setupChatListeners();
  setupAddBotButton();

  // Load saved data
  BotService.loadSavedBots(storageManager);
  BotService.loadSavedChats(storageManager);
  PersonaService.loadPersonas(storageManager);

  // Setup avatar preview listener
  PersonaService.setupAvatarPreviewListener();

  // Setup auto-save for settings
  SettingsService.setupSettingsAutoSave();

  // Setup global callbacks
  setupGlobalCallbacks();

  console.log('[index.js] Application initialized successfully');
}

/**
 * Setup global callbacks for services that need cross-module access
 */
function setupGlobalCallbacks() {
  // Dialog service needs confirmUploadBot callback
  window.confirmUploadBotCallback = async () => {
    const fileInput = document.getElementById("botImageInput");
    const file = fileInput.files[0];

    if (!file) {
      alert("Please select an image file");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async function (e) {
        const imgData = e.target.result;
        const botId = await storageManager.saveBot(imgData);
        const botData = await storageManager.loadBot(botId);
        BotService.addBotToUI(botId, botData);
        DialogService.closeUploadDialog();
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading bot:", error);
      alert("Error uploading bot. Make sure the image contains character metadata.");
    }
  };

  // Make startChat available globally
  window.startChat = (botId, botData) => {
    ChatService.startChat(botId, botData, storageManager);
  };

  // Make loadChat available globally
  window.loadChat = (chatId, botData, botId) => {
    ChatService.loadChat(chatId, botData, botId, storageManager);
  };

  // Make deleteChat available globally
  window.deleteChat = (event, chatId) => {
    ChatService.deleteChat(event, chatId, storageManager);
  };

  // Make deleteBotFromUI available globally
  window.deleteBotFromUI = (btn, botId) => {
    BotService.deleteBotFromUI(btn, botId);
  };

  // Make showChatChoiceDialog available globally
  window.showChatChoiceDialog = (botName) => {
    return DialogService.showChatChoiceDialog(botName);
  };

  // Make showConfirmDialog available globally
  window.showConfirmDialog = (title, message) => {
    return DialogService.showConfirmDialog(title, message);
  };

  // Make deletePersona available globally
  window.deletePersona = (event, personaId) => {
    PersonaService.deletePersona(event, personaId, storageManager);
  };

  // Make confirmCreatePersonaCallback available globally
  window.confirmCreatePersonaCallback = () => {
    PersonaService.createPersona(storageManager);
  };

  // Sidebar tab switching
  window.switchSidebarTab = (tabId) => {
    SidebarManager.switchSidebarTab(tabId);
  };

  window.switchLeftSidebarTab = (tabId) => {
    SidebarManager.switchLeftSidebarTab(tabId);
  };

  // Message actions
  window.editMessage = (messageIndex, role) => {
    MessageService.editMessage(messageIndex, role, storageManager);
  };

  window.saveEditedMessage = (messageIndex, role, newText) => {
    MessageService.saveEditedMessage(messageIndex, role, newText, storageManager);
  };

  window.cancelEditMessage = (messageElement, currentText) => {
    MessageService.cancelEditMessage(messageElement, currentText);
  };

  window.rerollMessage = (messageIndex) => {
    MessageService.rerollMessage(messageIndex, storageManager, inferenceManager);
  };

  window.navigateMessageVersion = (messageIndex, newVersionIndex) => {
    MessageService.navigateMessageVersion(messageIndex, newVersionIndex, storageManager);
  };

  window.deleteMessage = (messageIndex) => {
    MessageService.deleteMessage(messageIndex, storageManager);
  };

  // Settings functions
  window.saveApiConfig = () => SettingsService.saveApiConfig(inferenceManager);
  window.saveGenerationSettings = () => SettingsService.saveGenerationSettings();
  window.saveLlmSettings = () => SettingsService.saveLlmSettings();
}

/**
 * Setup chat input listeners
 */
function setupChatListeners() {
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");

  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      MessageService.sendMessage(storageManager, inferenceManager);
    });
  }

  if (messageInput) {
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        MessageService.sendMessage(storageManager, inferenceManager);
      }
    });
  }
}

/**
 * Setup add bot button
 */
function setupAddBotButton() {
  const addBotBtn = document.getElementById("addBotBtn");
  if (addBotBtn) {
    addBotBtn.addEventListener("click", () => DialogService.openUploadDialog());
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
