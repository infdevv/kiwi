/**
 * Message Service - Handles message sending, editing, and regeneration
 */

import { ToastService } from './toastService.js';

const MessageService = {
  /**
   * Send a message and get response
   * @param {StorageManager} storageManager - Storage manager instance
   * @param {InferenceManager} inferenceManager - Inference manager instance
   */
  async sendMessage(storageManager, inferenceManager) {
    const input = document.querySelector(".bottom-controls input");
    const sendBtn = document.getElementById("sendBtn");

    // Check if inferenceManager is initialized
    if (!inferenceManager) {
      alert("Inference manager not initialized. Please configure API settings first.");
      return;
    }

    // Check if currently generating - if so, stop generation
    if (window.isGenerating) {
      inferenceManager.stopGeneration();
      window.isGenerating = false;
      input.disabled = false;
      sendBtn.innerHTML = "send";
      sendBtn.style.opacity = "";
      sendBtn.style.cursor = "pointer";
      input.focus();
      return;
    }

    // Delegate to room service when in a group chat
    if (window.currentRoomData && window.roomService) {
      const message = input.value.trim();
      if (!message) return;
      await window.roomService.sendGroupMessage(message, storageManager, inferenceManager);
      return;
    }

    const message = input.value.trim();

    if (!message) {
      return;
    }

    // Handle case when no bot is selected - use default assistant
    if (!window.currentChatId || !window.currentBotData) {
      await this.startDefaultAssistant(storageManager, inferenceManager, message);
      return;
    }

    window.isGenerating = true;
    input.value = "";
    input.disabled = true;

    // Change button to stop button
    sendBtn.innerHTML = "stop";
    sendBtn.style.opacity = "";
    sendBtn.style.cursor = "pointer";

    // Get character data
    const character = window.currentBotData.character;
    const avatar = character.avatar || window.currentBotData.bot;
    const botName = character.name || "Bot";

    // Get selected persona
    const selectedPersona = window.personaService.getSelectedPersona();

    // Get current messages to calculate storage index
    const chat = await storageManager.getChat(window.currentChatId);
    let messages = chat.messages || [];

    // Calculate storage indices (actual array positions)
    const userMessageIndex = messages.length;

    // Display user message with persona name and avatar if available
    const userName = selectedPersona ? selectedPersona.name : "You";
    const userAvatar = (selectedPersona && selectedPersona.avatar) ? selectedPersona.avatar : "https://cataas.com/cat";
    window.chatService.appendMessage("user", message, userAvatar, userName, null, userMessageIndex, null, null);

    // Add user message
    messages.push({
      role: "user",
      content: message,
    });

    // Assistant message will be at the next index
    const assistantMessageIndex = messages.length;

    // Get config from UI
    const topKVal = parseInt(document.getElementById("topK")?.value) || 0;
    const minPVal = parseFloat(document.getElementById("minP")?.value) || 0;
    const config = {
      temperature: parseFloat(document.getElementById("temperature").value) || 0.6,
      top_p: parseFloat(document.getElementById("topP").value) || null,
      top_k: topKVal > 0 ? topKVal : null,
      min_p: minPVal > 0 ? minPVal : null,
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

    // Get context length from UI
    const contextLength = parseInt(document.getElementById("contextLength").value) || 0;

    // Get arrangement from UI
    const arrangement = parseInt(document.getElementById("arrangement")?.value) || 0;

    // Get custom prompt and location from UI
    const customPrompt = document.getElementById("prompt")?.value || "";
    const promptLocation = document.getElementById("promptLocation")?.value || "before";

    // Preprocess messages
    const processedMessages = inferenceManager.preprocessChat(
      messages,
      arrangement,
      preset,
      contextLength,
      customPrompt,
      promptLocation,
    );

    // Create placeholder for streaming response with animated loading indicator
    const aiMessageDiv = window.chatService.appendMessage("assistant", "...", avatar, botName, null, assistantMessageIndex, null, null);
    const aiMessageTextSpan = aiMessageDiv.querySelector('.message-text');
    if (aiMessageTextSpan) {
      aiMessageTextSpan.innerHTML = window.chatRenderer.createLoadingIndicator();
    }

    const chatContainer = document.querySelector(".chat-container");

    let responseText = "";
    let wasAborted = false;

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
                window.chatRenderer.updateStreamingMessage(aiMessageDiv, responseText);
                chatContainer.scrollTop = chatContainer.scrollHeight;
              } catch (e) {}
            }
          }
        );

        // Check if generation was aborted
        if (!inferenceManager.abortController || inferenceManager.abortController.signal.aborted) {
          wasAborted = true;
        }

        // Finalize the streaming message with full markdown rendering
        if (!wasAborted || responseText.trim()) {
          window.chatRenderer.finalizeStreamingMessage(aiMessageDiv, responseText);
        } else {
          // Remove the placeholder message if nothing was generated
          aiMessageDiv.remove();
        }
      } else {
        const response = await inferenceManager.generateResponse(
          processedMessages,
          config,
          false
        );

        responseText = response.choices?.[0]?.message?.content || "No response";
        window.chatRenderer.finalizeStreamingMessage(aiMessageDiv, responseText);
      }

      // Only save if we have content and weren't aborted
      if (!wasAborted && responseText.trim()) {
        // Add assistant response to messages
        messages.push({
          role: "assistant",
          content: responseText,
        });

        // Save chat with bot ID
        await storageManager.saveChat(window.currentChatId, {
          bot: window.currentBotData,
          botId: window.currentBotId,
          timestamp: new Date().getTime(),
          messages: messages,
        });

        // Update chat timestamp in UI
        window.botService.updateChatTimestamp(window.currentChatId);
      }
    } catch (error) {
      console.error("Error generating response:", error);
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        wasAborted = true;
        // Remove the placeholder message if nothing was generated
        if (!responseText.trim()) {
          aiMessageDiv.remove();
        }
      } else {
        // Show error as toast instead of message
        ToastService.error(`API Error: ${error.message}`);
        aiMessageDiv.remove();
      }
    } finally {
      window.isGenerating = false;
      inferenceManager.abortController = null;
      input.disabled = false;
      sendBtn.innerHTML = "send";
      sendBtn.style.opacity = "";
      sendBtn.style.cursor = "";
      input.focus();
    }
  },

  /**
   * Edit a message
   * @param {number} messageIndex - Index of the message
   * @param {string} role - Role of the message
   * @param {StorageManager} storageManager - Storage manager instance
   */
  async editMessage(messageIndex, role, storageManager) {
    if (!window.currentChatId) {
      console.error('[editMessage] Blocked: no currentChatId');
      return;
    }

    // Both single chats and rooms are supported
    if (!window.currentBotData && !window.currentRoomData) {
      console.error('[editMessage] Blocked: neither currentBotData nor currentRoomData set');
      return;
    }

    const chat = await storageManager.getChat(window.currentChatId);
    if (!chat || !chat.messages) return;

    if (messageIndex >= chat.messages.length) {
      console.error('[editMessage] messageIndex out of bounds');
      return;
    }

    const message = chat.messages[messageIndex];

    const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
    if (!messageElement) {
      console.error('[editMessage] messageElement not found');
      return;
    }

    const currentText = message.content;
    window.chatRenderer.createEditInterface(messageElement, currentText, role, messageIndex);
  },

  /**
   * Save an edited message
   * @param {number} messageIndex - Index of the message
   * @param {string} role - Role of the message
   * @param {string} newText - New text content
   * @param {StorageManager} storageManager - Storage manager instance
   */
  async saveEditedMessage(messageIndex, role, newText, storageManager) {
    if (!window.currentChatId || !newText.trim()) {
      console.error('[saveEditedMessage] Blocked: no currentChatId or empty newText');
      return;
    }

    // Both single chats and rooms are supported
    if (!window.currentBotData && !window.currentRoomData) {
      console.error('[saveEditedMessage] Blocked: neither currentBotData nor currentRoomData set');
      return;
    }

    const chat = await storageManager.getChat(window.currentChatId);
    if (!chat || !chat.messages) return;

    if (messageIndex >= chat.messages.length) {
      console.error('[saveEditedMessage] messageIndex out of bounds');
      return;
    }

    // Update the message
    chat.messages[messageIndex].content = newText;
    chat.messages[messageIndex].edited = true;
    chat.timestamp = new Date().getTime();

    await storageManager.saveChat(window.currentChatId, chat);

    // Update UI
    const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
    if (messageElement) {
      const textSpan = messageElement.querySelector('.message-text');
      window.chatRenderer.removeEditInterface(messageElement, textSpan);
      window.chatRenderer.updateMessageContent(messageElement, newText);
    }

    // If this is an assistant message in a single chat, regenerate all subsequent messages
    // For rooms, skip this since room messages don't support regeneration
    if (role === 'assistant' && !window.currentRoomData) {
      await this.regenerateSubsequentMessages(messageIndex, chat, storageManager);
    }
  },

  /**
   * Cancel editing a message
   * @param {HTMLElement} messageElement - The message element
   * @param {string} currentText - Current text to restore
   */
  cancelEditMessage(messageElement, currentText) {
    const textSpan = messageElement.querySelector('.message-text');
    window.chatRenderer.removeEditInterface(messageElement, textSpan);
  },

  /**
   * Re-roll/regenerate an assistant message
   * @param {number} messageIndex - Index of the message to re-roll
   * @param {StorageManager} storageManager - Storage manager instance
   * @param {InferenceManager} inferenceManager - Inference manager instance
   */
  async rerollMessage(messageIndex, storageManager, inferenceManager) {
    if (window.isGenerating) {
      console.error('[rerollMessage] Blocked: isGenerating is true');
      return;
    }
    if (!window.currentChatId) {
      console.error('[rerollMessage] Blocked: no currentChatId');
      return;
    }

    // Block reroll for room messages
    if (window.currentRoomData) {
      ToastService.error('Reroll is not supported in group chats');
      return;
    }

    if (!window.currentBotData) {
      console.error('[rerollMessage] Blocked: no currentBotData');
      return;
    }

    const chat = await storageManager.getChat(window.currentChatId);
    if (!chat || !chat.messages) return;

    if (messageIndex >= chat.messages.length) {
      console.error('[rerollMessage] messageIndex out of bounds');
      return;
    }
    if (chat.messages[messageIndex].role !== 'assistant') {
      console.error('[rerollMessage] Message is not assistant:', chat.messages[messageIndex].role);
      return;
    }

    window.isGenerating = true;

    // Special handling for first assistant message (index 0 after the system-added user message)
    // For the first message, we need to include the system prompt and use a special regeneration prompt
    let messagesToUse;
    const isFirstAssistantMessage = messageIndex === 0 || 
      (chat.messages.slice(0, messageIndex).filter(m => m.role === 'assistant').length === 0);

    if (isFirstAssistantMessage) {
      // For first message regeneration, include system prompt and use a prompt to regenerate the intro
      messagesToUse = chat.messages.slice(0, messageIndex + 1);
      // Add a user message to prompt regeneration if there's no user message yet
      if (!messagesToUse.some(m => m.role === 'user')) {
        messagesToUse.push({
          role: 'user',
          content: '[System: Please regenerate your introduction based on the character definition.]'
        });
      }
    } else {
      // For subsequent messages, get messages up to and including the user message before this assistant message
      messagesToUse = chat.messages.slice(0, messageIndex);
    }

    // Get config from UI
    const rerollTopK = parseInt(document.getElementById("topK")?.value) || 0;
    const rerollMinP = parseFloat(document.getElementById("minP")?.value) || 0;
    const config = {
      temperature: parseFloat(document.getElementById("temperature").value) || 0.6,
      top_p: parseFloat(document.getElementById("topP").value) || null,
      top_k: rerollTopK > 0 ? rerollTopK : null,
      min_p: rerollMinP > 0 ? rerollMinP : null,
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

    // Get context length
    const contextLength = parseInt(document.getElementById("contextLength").value) || 0;

    // Get arrangement from UI
    const rerollArrangement = parseInt(document.getElementById("arrangement")?.value) || 0;

    // Get custom prompt and location from UI
    const customPrompt = document.getElementById("prompt")?.value || "";
    const promptLocation = document.getElementById("promptLocation")?.value || "before";

    // Preprocess messages
    const processedMessages = inferenceManager.preprocessChat(
      messagesToUse,
      rerollArrangement,
      preset,
      contextLength,
      customPrompt,
      promptLocation,
    );

    // Get the message element
    const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
    const chatContainer = document.querySelector(".chat-container");

    // Create placeholder for streaming response with animated loading indicator
    const textSpan = messageElement?.querySelector('.message-text');
    if (textSpan) {
      textSpan.innerHTML = window.chatRenderer.createLoadingIndicator();
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
                  window.chatRenderer.renderMessage(textSpan, responseText, true);
                }
                chatContainer.scrollTop = chatContainer.scrollHeight;
              } catch (e) {}
            }
          }
        );

        // Finalize the streaming message
        if (textSpan) {
          window.chatRenderer.renderMessage(textSpan, responseText, false);
          window.chatRenderer.attachCopyButtonListeners(textSpan);
        }
      } else {
        const response = await inferenceManager.generateResponse(
          processedMessages,
          config,
          false
        );

        responseText = response.choices?.[0]?.message?.content || "No response";
        if (textSpan) {
          window.chatRenderer.renderMessage(textSpan, responseText, false);
          window.chatRenderer.attachCopyButtonListeners(textSpan);
        }
      }

      // Store the new version
      const oldMessage = chat.messages[messageIndex];
      const versions = oldMessage.versions || [oldMessage.content];

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

      // Remove any messages after this one
      if (messageIndex < chat.messages.length - 1) {
        chat.messages = chat.messages.slice(0, messageIndex + 1);
      }

      chat.timestamp = new Date().getTime();
      await storageManager.saveChat(window.currentChatId, chat);

      // Update version navigation in UI
      if (messageElement) {
        window.chatRenderer.updateVersionNavigation(
          messageElement,
          versions,
          versions.length - 1
        );
      }

      window.botService.updateChatTimestamp(window.currentChatId);
    } catch (error) {
      console.error("Error re-rolling message:", error);
      // Show error as toast instead of message
      ToastService.error(`Re-roll Error: ${error.message}`);
      // Restore original content if available
      const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
      if (messageElement) {
        const textSpan = messageElement?.querySelector('.message-text');
        const chat = await storageManager.getChat(window.currentChatId);
        if (chat && chat.messages && chat.messages[messageIndex]) {
          textSpan.textContent = chat.messages[messageIndex].content;
        }
      }
    } finally {
      window.isGenerating = false;
      const sendBtn = document.getElementById("sendBtn");
      if (sendBtn) {
        sendBtn.innerHTML = "send";
      }
    }
  },

  /**
   * Navigate between message versions
   * @param {number} messageIndex - Index of the message
   * @param {number} newVersionIndex - New version index to display
   * @param {StorageManager} storageManager - Storage manager instance
   */
  async navigateMessageVersion(messageIndex, newVersionIndex, storageManager) {
    if (!window.currentChatId) {
      console.error('[navigateMessageVersion] No currentChatId');
      return;
    }

    // Both single chats and rooms are supported
    if (!window.currentBotData && !window.currentRoomData) {
      console.error('[navigateMessageVersion] Blocked: neither currentBotData nor currentRoomData set');
      return;
    }

    const chat = await storageManager.getChat(window.currentChatId);
    if (!chat || !chat.messages) {
      console.error('[navigateMessageVersion] No chat or messages');
      return;
    }

    if (messageIndex >= chat.messages.length) {
      console.error('[navigateMessageVersion] messageIndex out of bounds');
      return;
    }

    const message = chat.messages[messageIndex];

    if (!message || !message.versions) {
      console.error('[navigateMessageVersion] message or versions is null/undefined');
      return;
    }
    if (newVersionIndex < 0 || newVersionIndex >= message.versions.length) {
      console.error('[navigateMessageVersion] newVersionIndex out of bounds');
      return;
    }

    // Update current version index
    message.currentVersionIndex = newVersionIndex;
    message.content = message.versions[newVersionIndex];
    chat.timestamp = new Date().getTime();

    await storageManager.saveChat(window.currentChatId, chat);

    // Update UI
    const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
    if (messageElement) {
      const textSpan = messageElement.querySelector('.message-text');
      if (textSpan) {
        window.chatRenderer.renderMessage(textSpan, message.content, false);
        window.chatRenderer.attachCopyButtonListeners(textSpan);
      }
      window.chatRenderer.updateVersionNavigation(
        messageElement,
        message.versions,
        message.currentVersionIndex
      );
    }
  },

  /**
   * Delete a message
   * @param {number} messageIndex - Index of the message to delete
   * @param {StorageManager} storageManager - Storage manager instance
   */
  async deleteMessage(messageIndex, storageManager) {
    if (!window.currentChatId) {
      console.error('[deleteMessage] No currentChatId');
      return;
    }

    // Both single chats and rooms are supported
    if (!window.currentBotData && !window.currentRoomData) {
      console.error('[deleteMessage] Blocked: neither currentBotData nor currentRoomData set');
      return;
    }

    const confirmed = await window.showConfirmDialog(
      "Delete Message",
      "Are you sure you want to delete this message?",
    );

    if (!confirmed) return;

    const chat = await storageManager.getChat(window.currentChatId);
    if (!chat || !chat.messages) return;

    if (messageIndex >= chat.messages.length) {
      console.error('[deleteMessage] messageIndex out of bounds');
      return;
    }

    // Remove the message
    chat.messages.splice(messageIndex, 1);
    chat.timestamp = new Date().getTime();

    await storageManager.saveChat(window.currentChatId, chat);

    // Remove from UI
    const messageElement = document.querySelector(`.message[data-message-index="${messageIndex}"]`);
    if (messageElement) {
      messageElement.remove();
    }

    // Re-index remaining messages
    window.chatService?.reindexMessages?.();

    // Update chat timestamp (works for both single chats and rooms)
    if (window.currentBotData) {
      window.botService.updateChatTimestamp(window.currentChatId);
    }
  },

  /**
   * Regenerate subsequent messages after an edit
   * @param {number} messageIndex - Index of the edited message
   * @param {Object} chat - Chat data
   * @param {StorageManager} storageManager - Storage manager instance
   */
  async regenerateSubsequentMessages(messageIndex, chat, storageManager) {
    // This is a placeholder for future implementation
    // Could automatically regenerate all assistant messages after the edited one
    console.log('[regenerateSubsequentMessages] Not yet implemented');
  },

  /**
   * Start a default assistant when no bot is selected
   * @param {StorageManager} storageManager - Storage manager instance
   * @param {InferenceManager} inferenceManager - Inference manager instance
   * @param {string} userMessage - The user's message
   */
  async startDefaultAssistant(storageManager, inferenceManager, userMessage) {
    // Create a default bot/character
    const defaultBotData = {
      id: 'default-assistant',
      bot: 'https://cataas.com/cat',
      character: {
        name: 'Kiwi Assistant',
        description: 'A helpful AI assistant.',
        personality: 'Helpful, friendly, and informative.',
        first_mes: 'Hello! I\'m your Kiwi Assistant. How can I help you today?',
        mes_example: '',
        scenario: '',
        system_prompt: 'You are a helpful, harmless, and honest AI assistant. You provide useful information and engage in friendly conversation.'
      }
    };

    // Check for existing default assistant chats
    const existingChats = await ChatService.getChatsForBot(storageManager, 'default-assistant');

    if (existingChats.length > 0) {
      // Load the most recent chat
      const mostRecentChat = existingChats[0];
      await window.loadChat(
        mostRecentChat.id,
        mostRecentChat.bot || defaultBotData,
        mostRecentChat.botId || 'default-assistant'
      );
      // Now send the message
      window.currentChatId = mostRecentChat.id;
      window.currentBotData = mostRecentChat.bot || defaultBotData;
      window.currentBotId = 'default-assistant';
      // Re-call sendMessage with the chat now loaded
      await this.sendMessage(storageManager, inferenceManager);
      return;
    }

    // Create a new default chat
    window.currentBotId = 'default-assistant';
    window.currentBotData = defaultBotData;

    // Get selected persona
    const selectedPersona = window.personaService.getSelectedPersona();
    window.currentPersonaId = selectedPersona ? selectedPersona.id : null;

    // Create new chat
    window.currentChatId = await storageManager.createChat(defaultBotData);

    // Clear chat container
    const chatContainer = document.querySelector(".chat-container");
    chatContainer.innerHTML = "";

    // Get character data
    const character = defaultBotData.character;
    const firstMes = ChatService.replaceTemplateVars(
      character.first_mes || "Hello!",
      character,
      selectedPersona
    );
    const avatar = character.avatar || defaultBotData.bot;

    // Store first message as user message with "." to avoid templating issues
    const messages = [
      {
        role: "user",
        content: ".",
      },
    ];

    // Build system prompt with persona
    const systemPrompt = ChatService.buildSystemPrompt(character, selectedPersona);
    if (systemPrompt) {
      messages.unshift({
        role: "system",
        content: systemPrompt,
      });
    }

    // Save initial chat state with bot ID and persona ID
    await storageManager.saveChat(window.currentChatId, {
      bot: defaultBotData,
      botId: 'default-assistant',
      personaId: window.currentPersonaId,
      timestamp: new Date().getTime(),
      messages: messages,
    });

    // Display first message from assistant
    ChatService.appendMessage("assistant", firstMes, avatar, character.name || "Kiwi Assistant");

    // Add assistant's first message to chat history
    messages.push({
      role: "assistant",
      content: firstMes,
    });

    // Update chat storage with bot ID and persona ID
    await storageManager.saveChat(window.currentChatId, {
      bot: defaultBotData,
      botId: window.currentBotId,
      personaId: window.currentPersonaId,
      timestamp: new Date().getTime(),
      messages: messages,
    });

    // Update UI to show chat name
    document.querySelector(".chat-name").textContent = character.name || "Kiwi Assistant";

    // Close left sidebar on mobile
    if (window.innerWidth < 768) {
      window.toggleLeftSidebar();
    }

    // Now send the user's message
    await this.sendMessage(storageManager, inferenceManager);
  }
};

export { MessageService };
