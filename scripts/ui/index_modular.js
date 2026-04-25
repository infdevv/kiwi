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
import { BotEditorService } from "./botEditorService.js";
import { ToastService } from "./toastService.js";
import { RoomService } from "./roomService.js";

// Initialize managers
const storageManager = new StorageManager();
let inferenceManager = null;

// Wrapper so closures always see the current inferenceManager value
const inferenceManagerRef = {
  get current() { return inferenceManager; },
  set current(v) { inferenceManager = v; }
};

// Make services available globally for callbacks
window.storageManager = storageManager;
window.dialogService = DialogService;
window.sidebarManager = SidebarManager;
window.botService = BotService;
window.chatService = ChatService;
window.settingsService = SettingsService;
window.messageService = MessageService;
window.personaService = PersonaService;
window.botEditorService = BotEditorService;
window.roomService = RoomService;

// Application state
window.currentChatId = null;
window.currentBotId = null;
window.currentBotData = null;
window.currentRoomData = null;
window.isGenerating = false;
window.currentPersonaId = null;

/**
 * Initialize the application
 */
function init() {
  console.log('[index.js] Initializing application...');
  console.log('[index.js] Using window.chatRenderer:', chatRenderer);

  // Initialize BotEditorService
  BotEditorService.init();

  // Load saved configurations
  inferenceManager = SettingsService.loadSavedApiConfig(InferenceManager);
  SettingsService.loadSavedBackground();
  SettingsService.setupBackgroundUpload();

  // Setup UI
  SidebarManager.init(() => DialogService.openUploadDialog(), () => DialogService.openPersonaDialog());
  DialogService.setupDialogListeners(
    () => {
      const newManager = SettingsService.saveApiConfig(InferenceManager);
      if (newManager) inferenceManager = newManager;
    },
    () => SettingsService.clearBackground()
  );

  // Setup chat controls
  setupChatListeners();
  setupAddBotButton();
  setupCreateBotButton();

  // Load saved data
  BotService.loadSavedBots(storageManager);
  BotService.loadSavedChats(storageManager);
  RoomService.loadSavedRooms(storageManager);
  PersonaService.loadPersonas(storageManager);
  PersonaService.loadSelectedPersona(storageManager);

  // Setup avatar preview listener
  PersonaService.setupAvatarPreviewListener();

  // Setup auto-save for settings
  SettingsService.setupSettingsAutoSave();

  // Setup global callbacks
  setupGlobalCallbacks();

  // Setup preset load event listener
  setupPresetLoadListener();

  // Load default assistant bot if no bots exist
  loadDefaultAssistantBot();

  console.log('[index.js] Application initialized successfully');
}

/**
 * Load a default assistant bot if no bots are saved
 */
async function loadDefaultAssistantBot() {
  try {
    const botIds = await storageManager.getBotList();
    if (botIds.length === 0) {
      // Load pipipi.png as base64 for the default character
      let avatarData = "pipipi.png";
      try {
        const response = await fetch("pipipi.png");
        const blob = await response.blob();
        avatarData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('[index.js] Could not load pipipi.png, using path fallback');
        avatarData = "pipipi.png";
      }

      const botId = await storageManager.saveBot(avatarData);
      const savedBot = await storageManager.loadBot(botId);
      BotService.addBotToUI(botId, savedBot);
      console.log('[index.js] Default Pipipi bot created:', botId);
    }
  } catch (error) {
    console.error('[index.js] Error creating default bot:', error);
  }
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

  // Make openCreateBotDialog available globally
  window.openCreateBotDialog = () => {
    DialogService.closeUploadDialog();
    BotEditorService.openCreateBotDialog();
  };

  // Room globals
  window.loadRoom = (roomId) => RoomService.loadRoom(roomId, storageManager);

  const addRoomBtn = document.getElementById('addRoomBtn');
  if (addRoomBtn) {
    addRoomBtn.addEventListener('click', () => RoomService.openCreateRoomDialog(storageManager));
  }

  const confirmRoomBtn = document.getElementById('confirmRoomBtn');
  if (confirmRoomBtn) {
    confirmRoomBtn.addEventListener('click', () => RoomService.createRoom(storageManager));
  }

  const cancelRoomBtn = document.getElementById('cancelRoomBtn');
  if (cancelRoomBtn) {
    cancelRoomBtn.addEventListener('click', () => {
      document.getElementById('roomDialog').classList.remove('active');
    });
  }

  // Make deletePersona available globally
  window.deletePersona = (event, personaId) => {
    PersonaService.deletePersona(event, personaId, storageManager);
  };

  // Make editPersona available globally
  window.editPersona = async (event, personaId) => {
    event.stopPropagation();
    try {
      const personaData = await storageManager.loadPersona(personaId);
      PersonaService.openPersonaEditor(personaId, personaData, storageManager);
    } catch (err) {
      console.error('[index.js] Error opening persona editor:', err);
    }
  };

  // Make selectPersona available globally
  window.selectPersona = (personaId) => {
    PersonaService.selectPersona(personaId, storageManager);
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
    MessageService.rerollMessage(messageIndex, storageManager, inferenceManagerRef.current);
  };

  window.navigateMessageVersion = (messageIndex, newVersionIndex) => {
    MessageService.navigateMessageVersion(messageIndex, newVersionIndex, storageManager);
  };

  window.deleteMessage = (messageIndex) => {
    MessageService.deleteMessage(messageIndex, storageManager);
  };

  // Settings functions
  window.saveApiConfig = () => {
    const newManager = SettingsService.saveApiConfig(InferenceManager);
    if (newManager) inferenceManager = newManager;
  };
  window.saveGenerationSettings = () => SettingsService.saveGenerationSettings();
  window.saveLlmSettings = () => SettingsService.saveLlmSettings();
  window.applyGenerationPreset = (name) => SettingsService.applyGenerationPreset(name);

  // Data export/import
  window.exportAllData = () => exportAllData();

  // Wire up import file input
  const importDataInput = document.getElementById('importDataInput');
  if (importDataInput) {
    importDataInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) importAllData(file);
      importDataInput.value = '';
    });
  }
}

/**
 * Setup listener for preset load events from getPreset.html
 */
function setupPresetLoadListener() {
  // Listen for localStorage changes (for cross-tab communication)
  window.addEventListener('storage', (e) => {
    if (e.key === 'presetLoadEvent' || e.key === 'currentPreset' || e.key === 'currentPresetName') {
      updatePresetUI();
    }
  });

  // Check when page becomes visible again (user returns from getPreset.html)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updatePresetUI();
    }
  });

  // Check when window regains focus
  window.addEventListener('focus', () => {
    setTimeout(() => updatePresetUI(), 100);
  });

  // Check for preset on initial load
  updatePresetUI();
}

/**
 * Update preset UI from localStorage
 */
function updatePresetUI() {
  const savedPresetName = localStorage.getItem("currentPresetName");
  const savedPreset = localStorage.getItem("currentPreset");
  const presetNameEl = document.getElementById("presetName");
  
  console.log('[Preset] updatePresetUI called. savedPresetName:', savedPresetName, 'hasPreset:', !!savedPreset);
  
  if (presetNameEl) {
    // ALWAYS prioritize localStorage over DOM
    if (savedPresetName) {
      presetNameEl.textContent = savedPresetName;
      console.log('[Preset] Updated UI with preset name from localStorage:', savedPresetName);
    } else if (savedPreset) {
      // If we have preset data but no name, extract it
      try {
        const presetData = JSON.parse(savedPreset);
        const name = presetData.name || 'Loaded Preset';
        presetNameEl.textContent = name;
        localStorage.setItem("currentPresetName", name);
        console.log('[Preset] Restored name from preset data:', name);
      } catch (e) {
        presetNameEl.textContent = "No Preset";
        console.log('[Preset] Error parsing preset data:', e);
      }
    } else {
      // No preset at all
      presetNameEl.textContent = "No Preset";
      console.log('[Preset] No preset found');
    }
  } else {
    console.log('[Preset] presetName element not found');
  }
  
  // Render preset prompts if available
  if (savedPreset) {
    try {
      const presetData = JSON.parse(savedPreset);
      renderPresetPrompts(presetData);
    } catch (e) {
      console.error('[Preset] Error parsing preset for rendering:', e);
    }
  }
  
  // Save LLM settings to capture the current state
  if (window.saveLlmSettings) {
    console.log('[Preset] Saving LLM settings');
    window.saveLlmSettings();
  }
}

/**
 * Build the streaming toggle DOM element that lives inside #presetToggles
 */
function buildStreamingToggle(checked = false) {
  const item = document.createElement('div');
  item.className = 'presetItem';
  item.innerHTML = `
    <div class="toggle-container">
      <label class="switch">
        <input type="checkbox" id="presetStreamingToggle"${checked ? ' checked' : ''}>
        <span class="slider"></span>
      </label>
      <p>Text-Streaming</p>
    </div>`;

  const checkbox = item.querySelector('#presetStreamingToggle');
  const streamingToggle = document.getElementById('streamingToggle');
  checkbox.addEventListener('change', () => {
    if (streamingToggle) streamingToggle.checked = checkbox.checked;
    if (window.saveLlmSettings) window.saveLlmSettings();
  });
  return item;
}

/**
 * Render preset prompts as toggle items in the UI
 */
function renderPresetPrompts(presetData) {
  const presetTogglesContainer = document.getElementById("presetToggles");
  if (!presetTogglesContainer) {
    console.log('[Preset] presetToggles container not found');
    return;
  }
  
  // Preserve streaming toggle state before clearing
  const streamingChecked = document.getElementById("presetStreamingToggle")?.checked ?? false;

  // Check if preset has prompts array
  if (!presetData.prompts || !Array.isArray(presetData.prompts)) {
    console.log('[Preset] No prompts array in preset data');
    presetTogglesContainer.innerHTML = '';
    presetTogglesContainer.appendChild(buildStreamingToggle(streamingChecked));
    presetTogglesContainer.appendChild(Object.assign(document.createElement('p'), {
      textContent: 'No prompts in this preset',
      style: 'color: #888; font-size: 0.9rem; padding: 10px;'
    }));
    return;
  }

  console.log('[Preset] Rendering', presetData.prompts.length, 'prompts');

  // Clear existing content
  presetTogglesContainer.innerHTML = '';
  presetTogglesContainer.appendChild(buildStreamingToggle(streamingChecked));

  // Collapsible header
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = `
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;
    border: 1px solid var(--border-default); cursor: pointer;
    margin-bottom: 8px; user-select: none;
  `;
  headerDiv.id = 'presetPromptsHeader';

  const headerLeft = document.createElement('div');
  headerLeft.style.cssText = 'display: flex; align-items: center; gap: 10px;';

  const toggleIcon = document.createElement('span');
  toggleIcon.id = 'presetPromptsIcon';
  toggleIcon.textContent = '▶';
  toggleIcon.style.cssText = `
    font-size: 0.9rem; color: #888; transition: transform 0.3s;
    display: inline-block; width: 20px; text-align: center;
  `;

  const headerText = document.createElement('span');
  headerText.textContent = `Preset Prompts (${presetData.prompts.length})`;
  headerText.style.cssText = 'font-size: 0.9rem; color: var(--text-primary); font-weight: 600;';

  headerLeft.appendChild(toggleIcon);
  headerLeft.appendChild(headerText);

  const countBadge = document.createElement('span');
  const enabledCount = presetData.prompts.filter(p => p.enabled === true || p.state === 1 || p.state === true).length;
  countBadge.textContent = `${enabledCount} enabled`;
  countBadge.style.cssText = `
    padding: 3px 8px; border-radius: 4px; font-size: 0.75rem;
    background: ${enabledCount > 0 ? '#3cd67c' : '#333'}20;
    color: ${enabledCount > 0 ? '#3cd67c' : '#888'};
    border: 1px solid ${enabledCount > 0 ? '#3cd67c' : '#333'}40;
  `;
  countBadge.id = 'presetPromptsCount';

  headerDiv.appendChild(headerLeft);
  headerDiv.appendChild(countBadge);

  // Toggle collapse/expand - STARTS COLLAPSED
  let isCollapsed = true;
  const contentDiv = document.createElement('div');
  contentDiv.id = 'presetPromptsContent';
  contentDiv.style.cssText = `
    display: none; margin-top: 8px;
  `;

  headerDiv.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    contentDiv.style.display = isCollapsed ? 'none' : 'block';
    toggleIcon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)';
    toggleIcon.textContent = isCollapsed ? '▶' : '▼';
  });

  presetTogglesContainer.appendChild(headerDiv);
  presetTogglesContainer.appendChild(contentDiv);

  // Add bulk action buttons inside collapsible content
  const bulkActionsDiv = document.createElement('div');
  bulkActionsDiv.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;';
  
  const enableAllBtn = document.createElement('button');
  enableAllBtn.textContent = 'Enable All';
  enableAllBtn.style.cssText = `
    flex: 1; min-width: 120px; padding: 8px 12px; border-radius: 4px; border: none;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    color: white; font-size: 0.85rem; cursor: pointer; font-weight: 500;
  `;
  enableAllBtn.addEventListener('click', () => {
    presetData.prompts.forEach((prompt, idx) => {
      prompt.enabled = true;
      prompt.state = 1;
    });
    localStorage.setItem("currentPreset", JSON.stringify(presetData));
    renderPresetPrompts(presetData);
    if (window.saveLlmSettings) window.saveLlmSettings();
    console.log('[Preset] All prompts enabled');
  });
  
  const disableAllBtn = document.createElement('button');
  disableAllBtn.textContent = 'Disable All';
  disableAllBtn.style.cssText = `
    flex: 1; min-width: 120px; padding: 8px 12px; border-radius: 4px; border: none;
    background: rgba(255,255,255,0.1); color: #888;
    font-size: 0.85rem; cursor: pointer; font-weight: 500;
  `;
  disableAllBtn.addEventListener('click', () => {
    presetData.prompts.forEach((prompt, idx) => {
      prompt.enabled = false;
      prompt.state = 0;
    });
    localStorage.setItem("currentPreset", JSON.stringify(presetData));
    renderPresetPrompts(presetData);
    if (window.saveLlmSettings) window.saveLlmSettings();
    console.log('[Preset] All prompts disabled');
  });
  
  bulkActionsDiv.appendChild(enableAllBtn);
  bulkActionsDiv.appendChild(disableAllBtn);
  contentDiv.appendChild(bulkActionsDiv);
  
  // Create toggle for each prompt
  presetData.prompts.forEach((prompt, index) => {
    const promptId = `preset-prompt-${index}`;
    const isEnabled = prompt.enabled === true || prompt.state === 1 || prompt.state === true;
    
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'presetItem';
    toggleContainer.style.cssText = 'margin-bottom: 8px; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-default); overflow: hidden;';
    
    // Row 1: Prompt name (full width, wraps properly)
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'margin-bottom: 8px;';
    
    const promptName = document.createElement('p');
    promptName.textContent = prompt.name || `Prompt ${index + 1}`;
    promptName.style.cssText = 'margin: 0; font-size: 0.85rem; color: var(--text-primary); font-weight: 500; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto; line-height: 1.3;';
    nameRow.appendChild(promptName);
    
    toggleContainer.appendChild(nameRow);
    
    // Row 2: Toggle switch and role badge (wraps on mobile)
    const controlsRow = document.createElement('div');
    controlsRow.style.cssText = 'display: flex; align-items: center; gap: 12px; flex-wrap: wrap;';
    
    // Toggle switch
    const toggleWrapper = document.createElement('div');
    toggleWrapper.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-shrink: 0;';
    
    const switchLabel = document.createElement('label');
    switchLabel.className = 'switch';
    switchLabel.style.cssText = 'position: relative; display: inline-block; width: 44px; height: 22px; margin: 0; flex-shrink: 0;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = promptId;
    checkbox.dataset.promptIndex = index;
    checkbox.checked = isEnabled;
    checkbox.style.cssText = 'opacity: 0; width: 0; height: 0;';
    
    // Slider with proper checked state styling
    const slider = document.createElement('span');
    slider.className = 'slider';
    const sliderBg = isEnabled ? 'var(--gradient-start, #3cd67c)' : '#333';
    const sliderLeft = isEnabled ? '23px' : '3px';
    slider.style.cssText = `
      position: absolute; cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: ${sliderBg};
      transition: .3s;
      border-radius: 22px;
    `;
    
    const sliderDot = document.createElement('span');
    sliderDot.style.cssText = `
      position: absolute; content: "";
      height: 16px; width: 16px;
      left: ${sliderLeft};
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    `;
    
    slider.appendChild(sliderDot);
    switchLabel.appendChild(checkbox);
    switchLabel.appendChild(slider);
    
    toggleWrapper.appendChild(switchLabel);
    
    controlsRow.appendChild(toggleWrapper);
    
    toggleContainer.appendChild(controlsRow);
    
    // Add event listener for toggle
    checkbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      
      // Update slider appearance
      const sliderBg = isChecked ? 'var(--gradient-start, #3cd67c)' : '#333';
      const sliderLeft = isChecked ? '23px' : '3px';
      slider.style.backgroundColor = sliderBg;
      sliderDot.style.left = sliderLeft;
      
      // Update preset data
      if (presetData.prompts[index]) {
        presetData.prompts[index].enabled = isChecked;
        presetData.prompts[index].state = isChecked ? 1 : 0;
      }
      
      // Save updated preset
      localStorage.setItem("currentPreset", JSON.stringify(presetData));
      
      // Save LLM settings
      if (window.saveLlmSettings) {
        window.saveLlmSettings();
      }
      
      console.log(`[Preset] Prompt "${prompt.name}" ${isChecked ? 'enabled' : 'disabled'}`);
    });
    
    contentDiv.appendChild(toggleContainer);
  });
}

/**
 * Setup chat input listeners
 */
function setupChatListeners() {
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");

  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      MessageService.sendMessage(storageManager, inferenceManagerRef.current);
    });
  }

  if (messageInput) {
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        MessageService.sendMessage(storageManager, inferenceManagerRef.current);
      }
    });

    // Token counter
    const tokenCounter = document.getElementById("tokenCounter");
    if (tokenCounter) {
      messageInput.addEventListener("input", () => {
        const text = messageInput.value;
        if (!text.trim()) {
          tokenCounter.style.opacity = "0";
          return;
        }
        const estimated = Math.ceil(text.length / 4);
        const maxTokens = parseInt(document.getElementById("maxTokens")?.value) || 4000;
        tokenCounter.textContent = `~${estimated} tokens`;
        tokenCounter.style.opacity = "1";
      });
      messageInput.addEventListener("blur", () => {
        tokenCounter.style.opacity = "0";
      });
      messageInput.addEventListener("focus", () => {
        if (messageInput.value.trim()) tokenCounter.style.opacity = "1";
      });
    }
  }
}

/**
 * Setup add bot button
 */
function setupAddBotButton() {
  const addBotBtn = document.getElementById("addBotBtn");
  if (addBotBtn) {
    addBotBtn.addEventListener("click", () => {
      // Show a choice: browse bots or create manually
      showAddBotChoiceDialog();
    });
  }
}

/**
 * Show dialog to choose how to add a bot
 */
function showAddBotChoiceDialog() {
  // Reuse the existing upload dialog structure but modify it
  const dialog = document.getElementById("uploadDialog");
  if (dialog) {
    dialog.classList.add("active");
  }
}

/**
 * Setup create bot button (shown when browsing bots)
 */
function setupCreateBotButton() {
  const createBotBtn = document.getElementById("createBotBtn");
  if (createBotBtn) {
    createBotBtn.addEventListener("click", () => {
      BotEditorService.openCreateBotDialog();
    });
  }
}

/**
 * Export all IndexedDB data + relevant localStorage keys as a JSON backup file
 */
async function exportAllData() {
  try {
    ToastService.info('Preparing export…');

    const [chats, bots, personas] = await Promise.all([
      storageManager.getAllChats(),
      storageManager.getAllBots(),
      storageManager.getAllPersonas()
    ]);

    const lsKeys = [
      'kiwi_api_config', 'kiwi_generation_settings', 'kiwi_llm_settings',
      'currentPreset', 'currentPresetName', 'theme_colors', 'kiwi_background'
    ];
    const localStorageData = {};
    lsKeys.forEach(k => {
      const v = localStorage.getItem(k);
      if (v !== null) localStorageData[k] = v;
    });

    const exportPayload = {
      version: 1,
      exportDate: new Date().toISOString(),
      indexedDB: { chats, bots, personas },
      localStorage: localStorageData
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiwi_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    ToastService.success(`Exported ${bots.length} bots, ${chats.length} chats, ${personas.length} personas.`);
  } catch (err) {
    console.error('[Export] Data export failed:', err);
    ToastService.error('Export failed: ' + err.message);
  }
}

/**
 * Import a previously exported JSON backup file
 * @param {File} file - The JSON backup file
 */
async function importAllData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.version || !data.indexedDB) {
      ToastService.error('Invalid backup file format.');
      return;
    }

    const confirmed = await DialogService.showConfirmDialog(
      'Import Data',
      `Import ${data.indexedDB.bots?.length ?? 0} bots, ${data.indexedDB.chats?.length ?? 0} chats, and ${data.indexedDB.personas?.length ?? 0} personas? Existing items with the same ID will be overwritten.`
    );
    if (!confirmed) return;

    const { chats = [], bots = [], personas = [] } = data.indexedDB;

    await Promise.all([
      ...bots.map(b => storageManager.putBot(b)),
      ...chats.map(c => storageManager.putChat(c)),
      ...personas.map(p => storageManager.putPersona(p))
    ]);

    if (data.localStorage) {
      Object.entries(data.localStorage).forEach(([k, v]) => {
        // Never import the background by default — it's large and optional
        if (k !== 'kiwi_background') localStorage.setItem(k, v);
      });
    }

    ToastService.success('Import complete! Reload the page to see all changes.', 6000);
  } catch (err) {
    console.error('[Import] Data import failed:', err);
    ToastService.error('Import failed: ' + err.message);
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
