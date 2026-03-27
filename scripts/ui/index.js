import { StorageManager } from "../storageManager.js";
import { InferenceManager } from "../inferenceManager.js";

// chatRenderer is loaded via inline script in index.html with cache-busting
const chatRenderer = window.chatRenderer;

console.log('[index.js] Using window.chatRenderer:', chatRenderer);
console.log('[index.js] chatRenderer.createMessageElement:', chatRenderer?.createMessageElement);

const storageManager = new StorageManager();
let inferenceManager = null;

// Current chat state
let currentChatId = null;
let currentBotId = null;
let currentBotData = null;
let isGenerating = false;

function openUploadDialog() {
  document.getElementById("uploadDialog").classList.add("active");
  toggleLeftSidebar();
}

function closeUploadDialog() {
  document.getElementById("uploadDialog").classList.remove("active");
  document.getElementById("botImageInput").value = "";
  document.getElementById("imageUploadSection").style.display = "none";
  document.getElementById("confirmUploadBtn").style.display = "none";
}

function showImageUpload() {
  document.getElementById("imageUploadSection").style.display = "block";
  document.getElementById("confirmUploadBtn").style.display = "inline-block";
}

function browseBots() {
  window.location.href =
    "getBot.html?returnUrl=" + encodeURIComponent(window.location.href);
}

async function confirmUploadBot() {
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
      addBotToUI(botId, botData);
      closeUploadDialog();
    };
    reader.readAsDataURL(file);
  } catch (error) {
    console.error("Error uploading bot:", error);
    alert(
      "Error uploading bot. Make sure the image contains character metadata.",
    );
  }
}

function addBotToUI(botId, botData) {
  const sidebarContent = document.querySelector(
    "#leftSidebar .sidebar-content",
  );

  // Check if bot already exists in UI
  const existingBot = sidebarContent.querySelector(`[data-bot-id="${botId}"]`);
  if (existingBot) {
    return; // Bot already exists, don't add duplicate
  }

  const botDiv = document.createElement("div");
  botDiv.className = "bot";
  botDiv.dataset.botId = botId;
  botDiv.innerHTML = `
                <img src="${botData.bot}" alt="${botData.character.name || "Bot"}">
                <p class="bot-name">${botData.character.name || "Unknown Bot"}</p>
                <span class="material-symbols-outlined delete-btn" onclick="window.deleteBotFromUI(this, '${botId}')">delete</span>
            `;
  botDiv.addEventListener("click", (e) => {
    if (!e.target.classList.contains("delete-btn")) {
      startChat(botId, botData);
    }
  });
  sidebarContent.appendChild(botDiv);
}

/**
 * Replace template variables in text
 * @param {string} text - Text to process
 * @param {Object} character - Character data
 * @returns {string} Processed text with replacements
 */
function replaceTemplateVars(text, character) {
  if (!text) return text;

  const charName = character.name || "{{char}}";
  const userName = "You"; // Default user name

  // Use split/join instead of replaceAll to avoid issues with special characters
  // in the replacement string (e.g., $ characters being interpreted as special)
  return text
    .split("{{char}}")
    .join(charName)
    .split("{{user}}")
    .join(userName)
    .split("{{Char}}")
    .join(charName.charAt(0).toUpperCase() + charName.slice(1))
    .split("{{User}}")
    .join(userName.charAt(0).toUpperCase() + userName.slice(1))
    .split("{{original}}")
    .join(charName)
    .split("{{persona}}")
    .join(character.personality || "")
    .split("{{scenario}}")
    .join(character.scenario || "")
    .split("{{description}}")
    .join(character.description || "");
}

/**
 * Build system prompt from character data
 */
function buildSystemPrompt(character) {
  const parts = [];

  // Add scenario if exists
  if (character.scenario) {
    parts.push(replaceTemplateVars(character.scenario, character));
  }

  // Add personality
  if (character.personality) {
    parts.push(
      `[Personality: ${replaceTemplateVars(character.personality, character)}]`,
    );
  }

  // Add description
  if (character.description) {
    parts.push(
      `[Description: ${replaceTemplateVars(character.description, character)}]`,
    );
  }

  // Add system prompt if exists
  if (character.system_prompt) {
    parts.push(replaceTemplateVars(character.system_prompt, character));
  }

  // Add example messages if exists
  if (character.mes_example) {
    parts.push(
      `[Example Messages: ${replaceTemplateVars(character.mes_example, character)}]`,
    );
  }

  return parts.join("\n\n");
}

/**
 * Find all chats for a specific bot
 */
async function getChatsForBot(botId) {
  try {
    const chatIds = await storageManager.getChatList();
    const chats = [];

    for (const chatId of chatIds) {
      try {
        const chat = await storageManager.getChat(chatId);
        if (!chat) continue;

        // Check if chat belongs to this bot
        if (chat.botId === botId || (chat.bot && chat.bot.id === botId)) {
          chats.push({ id: chatId, ...chat });
        }
      } catch (error) {
        console.error("Error loading chat:", chatId, error);
      }
    }

    // Sort by timestamp (most recent first)
    chats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return chats;
  } catch (error) {
    console.error("Error getting chats for bot:", error);
    return [];
  }
}

/**
 * Show dialog to choose between new chat or existing chats
 */
function showChatChoiceDialog(botName) {
  return new Promise((resolve) => {
    const dialog = document.getElementById("chatChoiceDialog");
    const titleEl = document.getElementById("chatChoiceDialogTitle");
    const messageEl = document.getElementById("chatChoiceDialogMessage");
    const newBtn = document.getElementById("chatChoiceNewBtn");
    const recentBtn = document.getElementById("chatChoiceRecentBtn");
    const cancelBtn = document.getElementById("chatChoiceCancelBtn");

    // Update dialog text with bot name
    if (titleEl) titleEl.textContent = `Continue Chat with ${botName}?`;
    if (messageEl)
      messageEl.textContent = `You have existing chats with ${botName}.`;

    const cleanup = () => {
      newBtn.removeEventListener("click", handleNew);
      recentBtn.removeEventListener("click", handleRecent);
      cancelBtn.removeEventListener("click", handleCancel);
    };

    const handleNew = () => {
      cleanup();
      dialog.classList.remove("active");
      resolve("new");
    };

    const handleRecent = () => {
      cleanup();
      dialog.classList.remove("active");
      resolve("recent");
    };

    const handleCancel = () => {
      cleanup();
      dialog.classList.remove("active");
      resolve("cancel");
    };

    newBtn.addEventListener("click", handleNew);
    recentBtn.addEventListener("click", handleRecent);
    cancelBtn.addEventListener("click", handleCancel);

    dialog.classList.add("active");
  });
}

/**
 * Start a new chat with a bot
 */
async function startChat(botId, botData) {
  // Check for existing chats with this bot
  const existingChats = await getChatsForBot(botId);

  if (existingChats.length > 0) {
    // Show dialog to choose between new chat or existing
    const character = botData.character || {};
    const botName = character.name || "this bot";
    const choice = await showChatChoiceDialog(botName);

    if (choice === "cancel") {
      return; // User cancelled
    } else if (choice === "recent") {
      // Load the most recent chat
      const mostRecentChat = existingChats[0];
      await loadChat(
        mostRecentChat.id,
        mostRecentChat.bot || botData,
        mostRecentChat.botId || botId,
      );
      return;
    }
    // If choice === 'new', continue with creating a new chat
  }

  currentBotId = botId;
  currentBotData = botData;

  // Create new chat
  currentChatId = await storageManager.createChat(botData);

  // Clear chat container
  const chatContainer = document.querySelector(".chat-container");
  chatContainer.innerHTML = "";

  // Get character data
  const character = botData.character;
  const firstMes = replaceTemplateVars(
    character.first_mes || "Hello!",
    character,
  );
  const avatar = character.avatar || botData.bot;

  // Store first message as user message with "." to avoid templating issues
  const messages = [
    {
      role: "user",
      content: ".",
    },
  ];

  // Build system prompt
  const systemPrompt = buildSystemPrompt(character);
  if (systemPrompt) {
    messages.unshift({
      role: "system",
      content: systemPrompt,
    });
  }

  // Save initial chat state with bot ID
  await storageManager.saveChat(currentChatId, {
    bot: botData,
    botId: botId, // Store the bot ID separately
    timestamp: new Date().getTime(),
    messages: messages,
  });

  // Display first message from assistant
  appendMessage("assistant", firstMes, avatar, character.name || "Bot");

  // Add assistant's first message to chat history
  messages.push({
    role: "assistant",
    content: firstMes,
  });

  // Update chat storage with bot ID
  await storageManager.saveChat(currentChatId, {
    bot: botData,
    botId: currentBotId,
    timestamp: new Date().getTime(),
    messages: messages,
  });

  // Update UI to show chat name
  document.querySelector(".chat-name").textContent = character.name || "Bot";

  // Close left sidebar on mobile
  if (window.innerWidth < 768) {
    toggleLeftSidebar();
  }
}

/**
 * Append a message to the chat UI
 */
function appendMessage(role, text, avatarUrl, name, messageId = null, messageIndex = null, versions = null, currentVersionIndex = null) {
  console.log('[appendMessage] Creating message:', { role, messageIndex, versions });
  console.log('[appendMessage] chatRenderer:', chatRenderer);
  console.log('[appendMessage] chatRenderer.createMessageElement:', chatRenderer.createMessageElement);
  const chatContainer = document.querySelector(".chat-container");
  const messageDiv = chatRenderer.createMessageElement(
    role,
    text,
    avatarUrl,
    name,
    messageId,
    messageIndex,
    versions,
    currentVersionIndex,
  );
  console.log('[appendMessage] Created message element:', messageDiv);
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  return messageDiv;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Send a message and get response
 */
async function sendMessage() {
  if (isGenerating || !currentChatId || !currentBotData) {
    if (!currentChatId || !currentBotData) {
      alert("Please select a bot to chat with first!");
    }
    return;
  }

  const input = document.querySelector(".bottom-controls input");
  const sendBtn = document.getElementById("sendBtn");
  const message = input.value.trim();

  if (!message) {
    return;
  }

  isGenerating = true;
  input.value = "";
  input.disabled = true;
  sendBtn.style.opacity = "0.6";
  sendBtn.style.cursor = "not-allowed";

  // Get character data
  const character = currentBotData.character;
  const avatar = character.avatar || currentBotData.bot;
  const botName = character.name || "Bot";

  // Get current messages to calculate storage index
  const chat = await storageManager.getChat(currentChatId);
  let messages = chat.messages || [];

  // Calculate storage indices (actual array positions)
  const userMessageIndex = messages.length; // This will be the index after we push
  
  // Display user message with storage index
  appendMessage("user", message, "https://cataas.com/cat", "You", null, userMessageIndex);

  // Add user message
  messages.push({
    role: "user",
    content: message,
  });

  // Assistant message will be at the next index
  const assistantMessageIndex = messages.length;

  // Get config from UI
  const config = {
    temperature:
      parseFloat(document.getElementById("temperature").value) || 0.6,
    top_p: parseFloat(document.getElementById("topP").value) || null,
    max_tokens: parseInt(document.getElementById("maxTokens").value) || null,
    presence_penalty:
      parseFloat(document.getElementById("presencePenalty").value) || null,
    frequency_penalty:
      parseFloat(document.getElementById("frequencyPenalty").value) || null,
  };

  // Get preset
  let preset = {};
  const savedPreset = localStorage.getItem("currentPreset");
  if (savedPreset) {
    try {
      preset = JSON.parse(savedPreset);
    } catch (e) {
      console.error("Failed to parse preset:", e);
    }
  }

  // Get custom prompt
  const customPrompt = document.getElementById("prompt").value;
  const promptLocation = document.getElementById("promptLocation").value;

  if (customPrompt) {
    // Apply template variable replacement to custom prompt
    const processedPrompt = replaceTemplateVars(customPrompt, character);

    if (promptLocation === "before") {
      // Find system message and prepend
      const sysMsg = messages.find((m) => m.role === "system");
      if (sysMsg) {
        sysMsg.content = processedPrompt + "\n\n" + sysMsg.content;
      } else {
        messages.unshift({
          role: "system",
          content: processedPrompt,
        });
      }
    } else {
      // Append after system
      const sysMsg = messages.find((m) => m.role === "system");
      if (sysMsg) {
        sysMsg.content = sysMsg.content + "\n\n" + processedPrompt;
      } else {
        messages.push({
          role: "system",
          content: processedPrompt,
        });
      }
    }
  }

  // Get context length from UI
  const contextLength =
    parseInt(document.getElementById("contextLength").value) || 0;

  // Preprocess messages
  const processedMessages = inferenceManager.preprocessChat(
    messages,
    0, // arrangement
    preset,
    contextLength, // context length (0 = no limit)
  );

  console.log('[sendMessage] Creating assistant message at index:', assistantMessageIndex);

  // Create placeholder for streaming response
  const aiMessageDiv = appendMessage("assistant", "...", avatar, botName, null, assistantMessageIndex);
  console.log('[sendMessage] Created aiMessageDiv:', aiMessageDiv);
  console.log('[sendMessage] aiMessageDiv dataset:', aiMessageDiv.dataset);
  console.log('[sendMessage] Has action buttons:', aiMessageDiv.querySelector('.message-actions') !== null);

  const chatContainer = document.querySelector(".chat-container");

  let responseText = "";

  try {
    // Check if streaming is enabled
    const streamingCheckbox =
      document.querySelector("#api-tab input[type='checkbox']") ||
      document.querySelector("#preset-tab input[type='checkbox']");
    const streaming = streamingCheckbox?.checked || false;

    if (streaming) {
      await inferenceManager.generateResponse(
        processedMessages,
        config,
        true,
        (chunk) => {
          const decoder = new TextDecoder();
          const chunkText = decoder.decode(chunk);
          const lines = chunkText
            .split("\n")
            .filter((line) => line.trim() && line.startsWith("data: "));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              responseText += delta;
              chatRenderer.updateStreamingMessage(aiMessageDiv, responseText);
              chatContainer.scrollTop = chatContainer.scrollHeight;
            } catch (e) {}
          }
        },
      );

      // Finalize the streaming message with full markdown rendering
      chatRenderer.finalizeStreamingMessage(aiMessageDiv, responseText);
    } else {
      const response = await inferenceManager.generateResponse(
        processedMessages,
        config,
        false,
      );

      responseText = response.choices?.[0]?.message?.content || "No response";
      chatRenderer.finalizeStreamingMessage(aiMessageDiv, responseText);
    }

    // Add assistant response to messages
    messages.push({
      role: "assistant",
      content: responseText,
    });

    // Save chat with bot ID
    await storageManager.saveChat(currentChatId, {
      bot: currentBotData,
      botId: currentBotId,
      timestamp: new Date().getTime(),
      messages: messages,
    });

    // Update chat timestamp in UI
    updateChatTimestamp(currentChatId);
  } catch (error) {
    console.error("Error generating response:", error);
    chatRenderer.updateStreamingMessage(
      aiMessageDiv,
      `[Error: ${error.message}]`,
    );
  } finally {
    isGenerating = false;
    input.disabled = false;
    sendBtn.style.opacity = "";
    sendBtn.style.cursor = "";
    input.focus();
  }
}

function saveApiConfig() {
  const endpoint = document.getElementById("apiEndpoint").value;
  const apiKey = document.getElementById("apiKey").value;
  const model = document.getElementById("apiModel").value;
  const streaming = document.getElementById("streamingToggle").checked;

  if (!endpoint || !apiKey || !model) {
    alert("Please fill in all API fields");
    return;
  }

  const apiConfig = {
    api: endpoint,
    api_key: apiKey,
    model: model,
    streaming: streaming,
  };

  inferenceManager = new InferenceManager(apiConfig);

  localStorage.setItem("kiwi_api_config", JSON.stringify(apiConfig));

  // Save generation settings
  saveGenerationSettings();

  // Save LLM/preset settings
  saveLlmSettings();

  alert("API configuration saved!");
  toggleRightSidebar();
}

function saveGenerationSettings() {
  const generationSettings = {
    contextLength: document.getElementById("contextLength").value,
    maxTokens: document.getElementById("maxTokens").value,
    temperature: document.getElementById("temperature").value,
    topP: document.getElementById("topP").value,
    frequencyPenalty: document.getElementById("frequencyPenalty").value,
    presencePenalty: document.getElementById("presencePenalty").value,
  };

  localStorage.setItem(
    "kiwi_generation_settings",
    JSON.stringify(generationSettings),
  );
}

function saveLlmSettings() {
  const streaming = document.getElementById("presetStreamingToggle").checked;
  const prompt = document.getElementById("prompt").value;
  const promptLocation = document.getElementById("promptLocation").value;
  const currentPreset = localStorage.getItem("currentPreset");
  const presetName = document.getElementById("presetName").textContent;

  const llmSettings = {
    streaming: streaming,
    prompt: prompt,
    promptLocation: promptLocation,
    preset: currentPreset,
    presetName: presetName,
  };

  localStorage.setItem("kiwi_llm_settings", JSON.stringify(llmSettings));
}

function setupBackgroundUpload() {
  const backgroundInput = document.getElementById("background");
  if (!backgroundInput) return;

  backgroundInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const bgData = event.target.result;
      try {
        localStorage.setItem("kiwi_background", bgData);
        applyBackground();
        alert("Background saved!");
      } catch (error) {
        if (error.name === "QuotaExceededError") {
          alert("Image too large for storage. Please use a smaller image.");
        } else {
          alert("Error saving background: " + error.message);
        }
      }
    };
    reader.readAsDataURL(file);
  });
}

function applyBackground() {
  const bgData = localStorage.getItem("kiwi_background");
  if (bgData) {
    document.body.style.backgroundImage = `url(${bgData})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.backgroundAttachment = "fixed";
  }
}

function loadSavedBackground() {
  applyBackground();
}

function clearBackground() {
  localStorage.removeItem("kiwi_background");
  document.body.style.backgroundImage = "none";
}

function loadSavedApiConfig() {
  const savedConfig = localStorage.getItem("kiwi_api_config");
  if (savedConfig) {
    const config = JSON.parse(savedConfig);
    document.getElementById("apiEndpoint").value = config.api;
    document.getElementById("apiKey").value = config.api_key;
    document.getElementById("apiModel").value = config.model;
    if (config.streaming !== undefined) {
      document.getElementById("streamingToggle").checked = config.streaming;
    }
    inferenceManager = new InferenceManager(config);
  }

  // Load generation settings
  loadGenerationSettings();

  // Load LLM settings
  loadLlmSettings();
}

function loadGenerationSettings() {
  const savedSettings = localStorage.getItem("kiwi_generation_settings");
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    if (settings.contextLength)
      document.getElementById("contextLength").value = settings.contextLength;
    if (settings.maxTokens)
      document.getElementById("maxTokens").value = settings.maxTokens;
    if (settings.temperature)
      document.getElementById("temperature").value = settings.temperature;
    if (settings.topP) document.getElementById("topP").value = settings.topP;
    if (settings.frequencyPenalty)
      document.getElementById("frequencyPenalty").value =
        settings.frequencyPenalty;
    if (settings.presencePenalty)
      document.getElementById("presencePenalty").value =
        settings.presencePenalty;
  }
}

function loadLlmSettings() {
  const savedSettings = localStorage.getItem("kiwi_llm_settings");
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    if (settings.streaming !== undefined) {
      document.getElementById("presetStreamingToggle").checked =
        settings.streaming;
    }
    if (settings.prompt)
      document.getElementById("prompt").value = settings.prompt;
    if (settings.promptLocation)
      document.getElementById("promptLocation").value = settings.promptLocation;
    if (settings.preset) {
      localStorage.setItem("currentPreset", settings.preset);
    }
    if (settings.presetName) {
      document.getElementById("presetName").textContent = settings.presetName;
    }
  }
}

async function loadSavedBots() {
  try {
    const botIds = await storageManager.getBotList();
    for (const botId of botIds) {
      try {
        const botData = await storageManager.loadBot(botId);
        addBotToUI(botId, botData);
      } catch (error) {
        console.error("Error loading bot:", botId, error);
      }
    }
  } catch (error) {
    console.error("Error loading bot list:", error);
  }
}

/**
 * Load saved chats and add them to the UI under their respective bots
 */
async function loadSavedChats() {
  try {
    const chatIds = await storageManager.getChatList();

    for (const chatId of chatIds) {
      try {
        const chat = await storageManager.getChat(chatId);
        if (!chat || !chat.bot) continue;

        const botData = chat.bot;
        // Use the stored botId if available, otherwise fall back to chatId
        const botId = chat.botId || botData.id || chatId;
        const character = botData.character || {};
        const botName = character.name || "Bot";
        const timestamp = chat.timestamp || new Date().getTime();
        const dateStr = formatChatDate(timestamp);

        addChatToUI(chatId, botId, botData, dateStr);
      } catch (error) {
        console.error("Error loading chat:", chatId, error);
      }
    }
  } catch (error) {
    console.error("Error loading chat list:", error);
  }
}

/**
 * Format timestamp for display
 */
function formatChatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday =
    date.toDateString() === new Date(now - 86400000).toDateString();

  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) {
    return `Today ${timeStr}`;
  } else if (isYesterday) {
    return `Yesterday ${timeStr}`;
  } else {
    return (
      date.toLocaleDateString([], {
        month: "numeric",
        day: "numeric",
        year: "2-digit",
      }) +
      " " +
      timeStr
    );
  }
}

/**
 * Add a chat entry to the UI under a bot
 */
function addChatToUI(chatId, botId, botData, dateStr) {
  const character = botData.character || {};
  const avatar = character.avatar || botData.bot || "https://cataas.com/cat";
  const botName = character.name || "Bot";

  // Find or create the bot entry in Bots tab
  let botEntry = document.querySelector(
    `#bots-tab-content .bot[data-bot-id="${botId}"]`,
  );

  if (!botEntry) {
    // Bot doesn't exist in UI, create it
    botEntry = document.createElement("div");
    botEntry.className = "bot";
    botEntry.dataset.botId = botId;

    botEntry.innerHTML = `
      <img src="${avatar}" alt="${botName}">
      <p class="bot-name">${botName}</p>
      <span class="material-symbols-outlined delete-btn" onclick="window.deleteBotFromUI(this, '${botId}')">delete</span>
    `;

    botEntry.addEventListener("click", (e) => {
      if (!e.target.classList.contains("delete-btn")) {
        startChat(botId, botData);
      }
    });

    const botsTabContent = document.querySelector("#bots-tab-content");
    botsTabContent.appendChild(botEntry);
  }

  // Add the chat entry to Chats tab
  const chatsTabContent = document.querySelector("#chats-tab-content");
  const noChatsMsg = chatsTabContent.querySelector(".no-chats");

  // Hide "no chats" message
  if (noChatsMsg) {
    noChatsMsg.style.display = "none";
  }

  // Check if this chat already exists
  const existingChat = chatsTabContent.querySelector(
    `[data-chat-id="${chatId}"]`,
  );
  if (existingChat) return; // Already added

  // Add the chat entry
  const chatEntry = document.createElement("div");
  chatEntry.className = "bot chat-item";
  chatEntry.dataset.chatId = chatId;
  chatEntry.dataset.botId = botId;
  chatEntry.style.display = "flex";
  chatEntry.style.alignItems = "center";
  chatEntry.style.cursor = "pointer";
  chatEntry.innerHTML = `
    <img src="${avatar}" alt="${botName}">
    <div style="flex: 1; overflow: hidden; margin-left: 58px;">
      <p class="bot-name" style="margin: 0; font-size: 0.95rem;">${botName}</p>
      <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #888;">${dateStr}</p>
    </div>
    <span class="material-symbols-outlined delete-btn">
      delete
    </span>
  `;

  // Add click listener for the delete button
  const deleteBtn = chatEntry.querySelector(".delete-btn");
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteChat(e, chatId);
  });

  chatEntry.addEventListener("click", (e) => {
    e.stopPropagation();
    if (
      e.target.classList.contains("delete-btn") ||
      e.target.closest(".delete-btn")
    ) {
      return;
    }
    loadChat(chatId, botData, botId);
  });

  chatsTabContent.appendChild(chatEntry);
}

/**
 * Delete a chat
 */
async function deleteChat(event, chatId) {
  event.stopPropagation();

  const confirmed = await showConfirmDialog(
    "Delete Chat",
    "Are you sure you want to delete this chat?",
  );

  if (!confirmed) {
    return;
  }

  try {
    await storageManager.deleteChat(chatId);

    const chatEntry = document.querySelector(
      `#chats-tab-content [data-chat-id="${chatId}"]`,
    );
    if (chatEntry) {
      chatEntry.remove();
    }

    // Show "no chats" message if no chats left
    const chatsTabContent = document.querySelector("#chats-tab-content");
    const noChatsMsg = chatsTabContent.querySelector(".no-chats");
    const remainingChats = chatsTabContent.querySelectorAll(".chat-item");

    if (remainingChats.length === 0 && noChatsMsg) {
      noChatsMsg.style.display = "flex";
    }
  } catch (error) {
    console.error("Error deleting chat:", error);
    alert("Error deleting chat");
  }
}

/**
 * Update the timestamp of a chat entry in the UI
 */
function updateChatTimestamp(chatId) {
  const chatEntry = document.querySelector(
    `#chats-tab-content [data-chat-id="${chatId}"]`,
  );
  if (chatEntry) {
    const dateStr = formatChatDate(new Date().getTime());
    const datePara = chatEntry.querySelector('p[style*="color: #888"]');
    if (datePara) {
      datePara.textContent = dateStr;
    }

    // Move to bottom of chats list (most recent first)
    const chatsTabContent = document.querySelector("#chats-tab-content");
    chatsTabContent.appendChild(chatEntry);
  }
}

/**
 * Load an existing chat
 */
async function loadChat(chatId, botData, botId = null) {
  currentChatId = chatId;
  currentBotId = botId;
  currentBotData = botData;

  // Get the chat data
  const chat = await storageManager.getChat(chatId);
  if (!chat) {
    console.error("Chat not found:", chatId);
    return;
  }

  // Clear chat container
  const chatContainer = document.querySelector(".chat-container");
  chatContainer.innerHTML = "";

  // Get character data
  const character = botData.character || {};
  const avatar = character.avatar || botData.bot;
  const botName = character.name || "Bot";
  let hitFirstUserMessage = false;

  const messages = chat.messages || [];
  let displayIndex = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "system") continue;
    if (!hitFirstUserMessage && msg.role === "user") {
      hitFirstUserMessage = true;
      continue // the first user message is system-added
    }

    const role = msg.role === "user" ? "user" : "assistant";
    const name = msg.role === "user" ? "You" : botName;
    const msgAvatar = msg.role === "user" ? "https://cataas.com/cat" : avatar;

    // Handle message versions for assistant messages
    let content = msg.content;
    let versions = null;
    let currentVersionIndex = null;

    if (role === "assistant" && msg.versions && msg.versions.length > 1) {
      versions = msg.versions;
      currentVersionIndex = msg.currentVersionIndex ?? (msg.versions.length - 1);
      content = msg.versions[currentVersionIndex];
    }

    // Store the ACTUAL storage index (i), not display index
    appendMessage(role, content, msgAvatar, name, msg.id, i, versions, currentVersionIndex);
    displayIndex++;
  }

  // Update UI to show chat name
  document.querySelector(".chat-name").textContent = botName;

  // Close left sidebar on mobile
  if (window.innerWidth < 768) {
    toggleLeftSidebar();
  }
}

loadSavedApiConfig();
loadSavedBots();
loadSavedChats();
loadSavedBackground();
setupBackgroundUpload();

// Setup send button and input event listeners
function setupChatListeners() {
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  if (messageInput) {
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
}

setupChatListeners();

// Setup add bot button
function setupAddBotButton() {
  const addBotBtn = document.getElementById("addBotBtn");
  if (addBotBtn) {
    addBotBtn.addEventListener("click", openUploadDialog);
  }
}

setupAddBotButton();

// Setup dialog buttons
function setupDialogButtons() {
  // Upload dialog
  const cancelUploadBtn = document.getElementById("cancelUploadBtn");
  if (cancelUploadBtn) {
    cancelUploadBtn.addEventListener("click", closeUploadDialog);
  }

  const confirmUploadBtn = document.getElementById("confirmUploadBtn");
  if (confirmUploadBtn) {
    confirmUploadBtn.addEventListener("click", confirmUploadBot);
  }

  // Preset dialog
  const cancelPresetBtn = document.getElementById("cancelPresetBtn");
  if (cancelPresetBtn) {
    cancelPresetBtn.addEventListener("click", window.closePresetDialog);
  }

  const confirmPresetBtn = document.getElementById("confirmPresetBtn");
  if (confirmPresetBtn) {
    confirmPresetBtn.addEventListener("click", window.confirmUploadPreset);
  }

  // API save button
  const saveApiBtn = document.getElementById("saveApiBtn");
  if (saveApiBtn) {
    saveApiBtn.addEventListener("click", saveApiConfig);
  }

  // Clear background button
  const clearBgBtn = document.getElementById("clearBgBtn");
  if (clearBgBtn) {
    clearBgBtn.addEventListener("click", clearBackground);
  }
}

setupDialogButtons();

// Setup auto-save for generation and LLM settings
function setupSettingsAutoSave() {
  // Generation settings auto-save
  const generationInputs = [
    "maxTokens",
    "temperature",
    "topP",
    "frequencyPenalty",
    "presencePenalty",
  ];
  generationInputs.forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("input", saveGenerationSettings);
      input.addEventListener("change", saveGenerationSettings);
    }
  });

  // LLM settings auto-save
  const promptInput = document.getElementById("prompt");
  const promptLocationSelect = document.getElementById("promptLocation");
  const presetStreamingToggle = document.getElementById(
    "presetStreamingToggle",
  );
  const streamingToggle = document.getElementById("streamingToggle");

  if (promptInput) {
    promptInput.addEventListener("input", saveLlmSettings);
    promptInput.addEventListener("change", saveLlmSettings);
  }
  if (promptLocationSelect) {
    promptLocationSelect.addEventListener("change", saveLlmSettings);
  }
  if (presetStreamingToggle) {
    presetStreamingToggle.addEventListener("change", () => {
      // Sync with API tab streaming toggle
      if (streamingToggle) {
        streamingToggle.checked = presetStreamingToggle.checked;
      }
      saveLlmSettings();
    });
  }
  if (streamingToggle) {
    streamingToggle.addEventListener("change", () => {
      // Sync with preset tab streaming toggle
      if (presetStreamingToggle) {
        presetStreamingToggle.checked = streamingToggle.checked;
      }
      saveLlmSettings();
    });
  }
}

setupSettingsAutoSave();

/**
 * Edit a message (user or assistant)
 * @param {number} messageIndex - Index of the message in the chat (storage index)
 * @param {string} role - Role of the message ('user' or 'assistant')
 */
async function editMessage(messageIndex, role) {
  console.log('[editMessage] Called with:', { messageIndex, role });
  console.log('[editMessage] currentChatId:', currentChatId);
  
  if (!currentChatId) {
    console.error('[editMessage] Blocked: no currentChatId');
    return;
  }

  const chat = await storageManager.getChat(currentChatId);
  console.log('[editMessage] Chat loaded:', chat ? 'yes' : 'no', 'messages:', chat?.messages?.length);
  if (!chat || !chat.messages) return;

  // messageIndex is now the actual storage index
  console.log('[editMessage] storage index:', messageIndex, 'messages.length:', chat.messages.length);
  if (messageIndex >= chat.messages.length) {
    console.error('[editMessage] messageIndex out of bounds');
    return;
  }

  const message = chat.messages[messageIndex];
  console.log('[editMessage] message:', message);
  
  const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
  console.log('[editMessage] messageElement:', messageElement);
  if (!messageElement) {
    console.error('[editMessage] messageElement not found');
    return;
  }

  const currentText = message.content;
  console.log('[editMessage] Calling createEditInterface with text length:', currentText?.length);
  chatRenderer.createEditInterface(messageElement, currentText, role, messageIndex);
}

/**
 * Save an edited message
 * @param {number} messageIndex - Index of the message (storage index)
 * @param {string} role - Role of the message
 * @param {string} newText - New text content
 */
async function saveEditedMessage(messageIndex, role, newText) {
  console.log('[saveEditedMessage] Called with:', { messageIndex, role, newTextLength: newText?.length });
  
  if (!currentChatId || !newText.trim()) {
    console.error('[saveEditedMessage] Blocked: no currentChatId or empty newText');
    return;
  }

  const chat = await storageManager.getChat(currentChatId);
  if (!chat || !chat.messages) return;

  // messageIndex is now the actual storage index
  if (messageIndex >= chat.messages.length) {
    console.error('[saveEditedMessage] messageIndex out of bounds');
    return;
  }

  // Update the message
  chat.messages[messageIndex].content = newText;
  chat.messages[messageIndex].edited = true;
  chat.timestamp = new Date().getTime();

  await storageManager.saveChat(currentChatId, chat);

  // Update UI
  const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
  if (messageElement) {
    const textSpan = messageElement.querySelector('.message-text');
    chatRenderer.removeEditInterface(messageElement, textSpan);
    chatRenderer.updateMessageContent(messageElement, newText);
  }

  // If this is an assistant message, regenerate all subsequent messages
  if (role === 'assistant') {
    await regenerateSubsequentMessages(messageIndex, chat);
  }
}

/**
 * Cancel editing a message
 * @param {HTMLElement} messageElement - The message element
 * @param {string} currentText - Current text to restore
 * @param {string} role - Role of the message
 * @param {number} messageIndex - Index of the message
 */
function cancelEditMessage(messageElement, currentText, role, messageIndex) {
  const textSpan = messageElement.querySelector('.message-text');
  chatRenderer.removeEditInterface(messageElement, textSpan);
}

/**
 * Re-roll/regenerate an assistant message
 * @param {number} messageIndex - Index of the message to re-roll (storage index)
 */
async function rerollMessage(messageIndex) {
  console.log('[rerollMessage] Called with messageIndex:', messageIndex);
  console.log('[rerollMessage] State:', { isGenerating, currentChatId, hasBotData: !!currentBotData });
  
  if (isGenerating) {
    console.error('[rerollMessage] Blocked: isGenerating is true');
    return;
  }
  if (!currentChatId) {
    console.error('[rerollMessage] Blocked: no currentChatId');
    return;
  }
  if (!currentBotData) {
    console.error('[rerollMessage] Blocked: no currentBotData');
    return;
  }

  const chat = await storageManager.getChat(currentChatId);
  console.log('[rerollMessage] Chat loaded:', chat ? 'yes' : 'no', 'messages:', chat?.messages?.length);
  if (!chat || !chat.messages) return;

  // messageIndex is now the actual storage index
  console.log('[rerollMessage] storage index:', messageIndex, 'messages.length:', chat.messages.length);
  
  if (messageIndex >= chat.messages.length) {
    console.error('[rerollMessage] messageIndex out of bounds');
    return;
  }
  if (chat.messages[messageIndex].role !== 'assistant') {
    console.error('[rerollMessage] Message is not assistant:', chat.messages[messageIndex].role);
    return;
  }

  console.log('[rerollMessage] Starting reroll...');
  isGenerating = true;

  // Get the messages up to and including the user message before this assistant message
  const messagesToUse = chat.messages.slice(0, messageIndex);

  // Get config from UI
  const config = {
    temperature: parseFloat(document.getElementById("temperature").value) || 0.6,
    top_p: parseFloat(document.getElementById("topP").value) || null,
    max_tokens: parseInt(document.getElementById("maxTokens").value) || null,
    presence_penalty: parseFloat(document.getElementById("presencePenalty").value) || null,
    frequency_penalty: parseFloat(document.getElementById("frequencyPenalty").value) || null,
  };

  // Get preset
  let preset = {};
  const savedPreset = localStorage.getItem("currentPreset");
  if (savedPreset) {
    try {
      preset = JSON.parse(savedPreset);
    } catch (e) {
      console.error("Failed to parse preset:", e);
    }
  }

  // Get custom prompt
  const customPrompt = document.getElementById("prompt").value;
  const promptLocation = document.getElementById("promptLocation").value;
  const character = currentBotData.character;

  if (customPrompt) {
    const processedPrompt = replaceTemplateVars(customPrompt, character);
    const sysMsg = messagesToUse.find((m) => m.role === "system");
    if (sysMsg) {
      if (promptLocation === "before") {
        sysMsg.content = processedPrompt + "\n\n" + sysMsg.content;
      } else {
        sysMsg.content = sysMsg.content + "\n\n" + processedPrompt;
      }
    } else {
      messagesToUse.unshift({
        role: "system",
        content: processedPrompt,
      });
    }
  }

  // Get context length
  const contextLength = parseInt(document.getElementById("contextLength").value) || 0;

  // Preprocess messages
  const processedMessages = inferenceManager.preprocessChat(
    messagesToUse,
    0,
    preset,
    contextLength,
  );

  // Get the message element
  const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
  const chatContainer = document.querySelector(".chat-container");

  // Create placeholder for streaming response
  const textSpan = messageElement?.querySelector('.message-text');
  if (textSpan) {
    textSpan.textContent = '...';
  }

  let responseText = "";

  try {
    // Check if streaming is enabled
    const streamingCheckbox = document.querySelector("#api-tab input[type='checkbox']") ||
                              document.querySelector("#preset-tab input[type='checkbox']");
    const streaming = streamingCheckbox?.checked || false;

    if (streaming) {
      await inferenceManager.generateResponse(
        processedMessages,
        config,
        true,
        (chunk) => {
          const decoder = new TextDecoder();
          const chunkText = decoder.decode(chunk);
          const lines = chunkText.split("\n").filter((line) => line.trim() && line.startsWith("data: "));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              responseText += delta;
              if (textSpan) {
                chatRenderer.renderMessage(textSpan, responseText, true);
              }
              chatContainer.scrollTop = chatContainer.scrollHeight;
            } catch (e) {}
          }
        },
      );

      // Finalize the streaming message
      if (textSpan) {
        chatRenderer.renderMessage(textSpan, responseText, false);
        chatRenderer.attachCopyButtonListeners(textSpan);
      }
    } else {
      const response = await inferenceManager.generateResponse(
        processedMessages,
        config,
        false,
      );

      responseText = response.choices?.[0]?.message?.content || "No response";
      if (textSpan) {
        chatRenderer.renderMessage(textSpan, responseText, false);
        chatRenderer.attachCopyButtonListeners(textSpan);
      }
    }

    // Store the new version
    const oldMessage = chat.messages[messageIndex];
    const versions = oldMessage.versions || [oldMessage.content];
    const currentVersionIndex = oldMessage.currentVersionIndex ?? 0;

    // Add new version
    versions.push(responseText);

    // Update the message with versions
    chat.messages[messageIndex] = {
      role: 'assistant',
      content: responseText,
      versions: versions,
      currentVersionIndex: versions.length - 1,
      timestamp: new Date().getTime(),
    };

    // Remove any messages after this one (they will be regenerated if needed)
    if (messageIndex < chat.messages.length - 1) {
      chat.messages = chat.messages.slice(0, messageIndex + 1);
    }

    chat.timestamp = new Date().getTime();
    await storageManager.saveChat(currentChatId, chat);

    // Update version navigation in UI
    if (messageElement) {
      chatRenderer.updateVersionNavigation(
        messageElement,
        versions,
        versions.length - 1
      );
    }

    updateChatTimestamp(currentChatId);
  } catch (error) {
    console.error("Error re-rolling message:", error);
    if (textSpan) {
      textSpan.textContent = `[Error: ${error.message}]`;
    }
  } finally {
    isGenerating = false;
  }
}

/**
 * Navigate between message versions
 * @param {number} messageIndex - Index of the message (storage index)
 * @param {number} newVersionIndex - New version index to display
 */
async function navigateMessageVersion(messageIndex, newVersionIndex) {
  console.log('[navigateMessageVersion] Called with:', { messageIndex, newVersionIndex });
  
  if (!currentChatId) {
    console.error('[navigateMessageVersion] No currentChatId');
    return;
  }

  const chat = await storageManager.getChat(currentChatId);
  if (!chat || !chat.messages) {
    console.error('[navigateMessageVersion] No chat or messages');
    return;
  }

  // messageIndex is now the actual storage index
  console.log('[navigateMessageVersion] storage index:', messageIndex, 'messages.length:', chat.messages.length);
  
  if (messageIndex >= chat.messages.length) {
    console.error('[navigateMessageVersion] messageIndex out of bounds');
    return;
  }

  const message = chat.messages[messageIndex];
  console.log('[navigateMessageVersion] message:', message);
  console.log('[navigateMessageVersion] versions:', message?.versions);
  console.log('[navigateMessageVersion] versions.length:', message?.versions?.length);
  console.log('[navigateMessageVersion] newVersionIndex:', newVersionIndex);
  
  if (!message) {
    console.error('[navigateMessageVersion] message is null/undefined');
    return;
  }
  if (!message.versions) {
    console.error('[navigateMessageVersion] message.versions is null/undefined');
    return;
  }
  if (newVersionIndex < 0) {
    console.error('[navigateMessageVersion] newVersionIndex is negative:', newVersionIndex);
    return;
  }
  if (newVersionIndex >= message.versions.length) {
    console.error('[navigateMessageVersion] newVersionIndex >= versions.length:', newVersionIndex, '>=', message.versions.length);
    return;
  }

  // Update current version index
  message.currentVersionIndex = newVersionIndex;
  message.content = message.versions[newVersionIndex];
  chat.timestamp = new Date().getTime();

  console.log('[navigateMessageVersion] Saved new version index:', newVersionIndex);

  await storageManager.saveChat(currentChatId, chat);

  // Update UI
  const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
  console.log('[navigateMessageVersion] messageElement:', messageElement);
  if (messageElement) {
    const textSpan = messageElement.querySelector('.message-text');
    if (textSpan) {
      chatRenderer.renderMessage(textSpan, message.content, false);
      chatRenderer.attachCopyButtonListeners(textSpan);
    }
    chatRenderer.updateVersionNavigation(
      messageElement,
      message.versions,
      message.currentVersionIndex
    );
    console.log('[navigateMessageVersion] Updated UI, new currentIndex:', message.currentVersionIndex);
  }
}

/**
 * Delete a message
 * @param {number} messageIndex - Index of the message to delete (storage index)
 */
async function deleteMessage(messageIndex) {
  if (!currentChatId) {
    console.error('[deleteMessage] No currentChatId');
    return;
  }

  const confirmed = await showConfirmDialog(
    "Delete Message",
    "Are you sure you want to delete this message?",
  );

  if (!confirmed) return;

  const chat = await storageManager.getChat(currentChatId);
  if (!chat || !chat.messages) return;

  // messageIndex is now the actual storage index
  if (messageIndex >= chat.messages.length) {
    console.error('[deleteMessage] messageIndex out of bounds');
    return;
  }

  // Remove the message
  chat.messages.splice(messageIndex, 1);
  chat.timestamp = new Date().getTime();

  await storageManager.saveChat(currentChatId, chat);

  // Remove from UI
  const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
  if (messageElement) {
    messageElement.remove();
  }

  // Re-index remaining messages
  reindexMessages();

  updateChatTimestamp(currentChatId);
}

/**
 * Re-index all message elements after deletion
 */
function reindexMessages() {
  const messages = document.querySelectorAll('.chat-container .message');
  messages.forEach((msg, index) => {
    msg.dataset.messageIndex = index;
  });
}

/**
 * Show confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @returns {Promise<boolean>}
 */
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById("confirmDialog");
    const titleEl = document.getElementById("confirmDialogTitle");
    const messageEl = document.getElementById("confirmDialogMessage");
    const confirmBtn = document.getElementById("confirmDialogConfirm");
    const cancelBtn = document.getElementById("confirmDialogCancel");

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    const cleanup = () => {
      confirmBtn.removeEventListener("click", handleConfirm);
      cancelBtn.removeEventListener("click", handleCancel);
    };

    const handleConfirm = () => {
      cleanup();
      dialog.classList.remove("active");
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      dialog.classList.remove("active");
      resolve(false);
    };

    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);

    dialog.classList.add("active");
  });
}

/**
 * Regenerate all assistant messages after an edited message
 * @param {number} editedMessageIndex - Index of the edited message
 * @param {Object} chat - Chat data
 */
async function regenerateSubsequentMessages(editedMessageIndex, chat) {
  // Find the next user message after the edited assistant message
  // and regenerate all assistant messages after it
  // For now, we'll just update the stored chat
  // Full regeneration can be implemented as an enhancement
  console.log('Message edited at index:', editedMessageIndex);
  // Future: Auto-regenerate subsequent assistant responses
}

// Export functions to window
window.openUploadDialog = openUploadDialog;
window.closeUploadDialog = closeUploadDialog;
window.confirmUploadBot = confirmUploadBot;
window.saveApiConfig = saveApiConfig;
window.storageManager = storageManager;
window.browseBots = browseBots;
window.showImageUpload = showImageUpload;
window.clearBackground = clearBackground;
window.sendMessage = sendMessage;
window.loadChat = loadChat;
window.showChatChoiceDialog = showChatChoiceDialog;

// Message action functions with debug logging
window.rerollMessage = function(...args) {
  console.log('[window.rerollMessage] Called with:', args);
  return rerollMessage(...args);
};
window.editMessage = function(...args) {
  console.log('[window.editMessage] Called with:', args);
  return editMessage(...args);
};
window.deleteMessage = function(...args) {
  console.log('[window.deleteMessage] Called with:', args);
  return deleteMessage(...args);
};
window.saveEditedMessage = function(...args) {
  console.log('[window.saveEditedMessage] Called with:', args);
  return saveEditedMessage(...args);
};
window.cancelEditMessage = function(...args) {
  console.log('[window.cancelEditMessage] Called with:', args);
  return cancelEditMessage(...args);
};
window.navigateMessageVersion = function(...args) {
  console.log('[window.navigateMessageVersion] Called with:', args);
  return navigateMessageVersion(...args);
};
window.showConfirmDialog = showConfirmDialog;

console.log('[index.js] All window functions exported');
