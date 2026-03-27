/**
 * Message Service - Handles message sending, editing, and regeneration
 */

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
      return;
    }

    if (!window.currentChatId || !window.currentBotData) {
      alert("Please select a bot to chat with first!");
      return;
    }

    const message = input.value.trim();

    if (!message) {
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

    // Get current messages to calculate storage index
    const chat = await storageManager.getChat(window.currentChatId);
    let messages = chat.messages || [];

    // Calculate storage indices (actual array positions)
    const userMessageIndex = messages.length;

    // Display user message with storage index
    window.chatService.appendMessage("user", message, "https://cataas.com/cat", "You", null, userMessageIndex, null, null);

    // Add user message
    messages.push({
      role: "user",
      content: message,
    });

    // Assistant message will be at the next index
    const assistantMessageIndex = messages.length;

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

    if (customPrompt) {
      // Apply template variable replacement to custom prompt
      const processedPrompt = ChatService.replaceTemplateVars(customPrompt, character);

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
    const contextLength = parseInt(document.getElementById("contextLength").value) || 0;

    // Preprocess messages
    const processedMessages = inferenceManager.preprocessChat(
      messages,
      0, // arrangement
      preset,
      contextLength // context length (0 = no limit)
    );

    // Create placeholder for streaming response
    const aiMessageDiv = window.chatService.appendMessage("assistant", "...", avatar, botName, null, assistantMessageIndex, null, null);

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
                window.chatRenderer.updateStreamingMessage(aiMessageDiv, responseText);
                chatContainer.scrollTop = chatContainer.scrollHeight;
              } catch (e) {}
            }
          }
        );

        // Finalize the streaming message with full markdown rendering
        window.chatRenderer.finalizeStreamingMessage(aiMessageDiv, responseText);
      } else {
        const response = await inferenceManager.generateResponse(
          processedMessages,
          config,
          false
        );

        responseText = response.choices?.[0]?.message?.content || "No response";
        window.chatRenderer.finalizeStreamingMessage(aiMessageDiv, responseText);
      }

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
    } catch (error) {
      console.error("Error generating response:", error);
      window.chatRenderer.updateStreamingMessage(
        aiMessageDiv,
        `[Error: ${error.message}]`
      );
    } finally {
      window.isGenerating = false;
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

    // If this is an assistant message, regenerate all subsequent messages
    if (role === 'assistant') {
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
    const character = window.currentBotData.character;

    if (customPrompt) {
      const processedPrompt = ChatService.replaceTemplateVars(customPrompt, character);
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
      contextLength
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
      if (textSpan) {
        textSpan.textContent = `[Error: ${error.message}]`;
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
    ChatService.reindexMessages();

    window.botService.updateChatTimestamp(window.currentChatId);
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
  }
};

export { MessageService };
