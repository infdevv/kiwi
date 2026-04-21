/**
 * Chat Service - Handles chat operations and message management
 */

const ChatService = {
  /**
   * Replace template variables in text
   * @param {string} text - Text to process
   * @param {Object} character - Character data
   * @param {Object} persona - Optional persona data
   * @returns {string} Processed text with replacements
   */
  replaceTemplateVars(text, character, persona = null) {
    if (!text) return text;

    const charName = character.name || "{{char}}";
    const userName = persona ? persona.name || "You" : "You"; // Use persona name if available

    // Use split/join instead of replaceAll to avoid issues with special characters
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
      .join(persona ? (persona.description || persona.persona || "") : (character.personality || ""))
      .split("{{scenario}}")
      .join(character.scenario || "")
      .split("{{description}}")
      .join(character.description || "");
  },

  /**
   * Build system prompt from character data
   * @param {Object} character - Character data
   * @param {Object} persona - Optional persona data
   * @returns {string} System prompt
   */
  buildSystemPrompt(character, persona = null) {
    const parts = [];

    // Add persona context if available
    if (persona && (persona.persona || persona.description)) {
      const personaText = persona.persona || persona.description;
      parts.push(`[User Persona: ${this.replaceTemplateVars(personaText, character, persona)}]`);
    }

    // Add scenario if exists
    if (character.scenario) {
      parts.push(this.replaceTemplateVars(character.scenario, character, persona));
    }

    // Add personality
    if (character.personality) {
      parts.push(
        `[Personality: ${this.replaceTemplateVars(character.personality, character, persona)}]`
      );
    }

    // Add description
    if (character.description) {
      parts.push(
        `[Description: ${this.replaceTemplateVars(character.description, character, persona)}]`
      );
    }

    // Add system prompt if exists
    if (character.system_prompt) {
      parts.push(this.replaceTemplateVars(character.system_prompt, character, persona));
    }

    // Add example messages if exists
    if (character.mes_example) {
      parts.push(
        `[Example Messages: ${this.replaceTemplateVars(character.mes_example, character, persona)}]`
      );
    }

    return parts.join("\n\n");
  },

  async getChatsForBot(storageManager, botId) {
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
  },

  /**
   * Start a new chat with a bot
   * @param {string} botId - Bot ID
   * @param {Object} botData - Bot data
   * @param {StorageManager} storageManager - Storage manager instance
   */
  async startChat(botId, botData, storageManager) {
    // Check for existing chats with this bot
    const existingChats = await this.getChatsForBot(storageManager, botId);

    if (existingChats.length > 0) {
      // Show dialog to choose between new chat or existing
      const character = botData.character || {};
      const botName = character.name || "this bot";
      const choice = await window.showChatChoiceDialog(botName);

      if (choice === "cancel") {
        return; // User cancelled
      } else if (choice === "recent") {
        // Load the most recent chat
        const mostRecentChat = existingChats[0];
        await window.loadChat(
          mostRecentChat.id,
          mostRecentChat.bot || botData,
          mostRecentChat.botId || botId
        );
        return;
      }
      // If choice === 'new', continue with creating a new chat
    }

    window.currentBotId = botId;
    window.currentBotData = botData;

    // Get selected persona
    const selectedPersona = window.personaService.getSelectedPersona();
    window.currentPersonaId = selectedPersona ? selectedPersona.id : null;

    // Create new chat
    window.currentChatId = await storageManager.createChat(botData);

    // Clear chat container
    const chatContainer = document.querySelector(".chat-container");
    chatContainer.innerHTML = "";

    // Get character data
    const character = botData.character;
    const firstMes = this.replaceTemplateVars(
      character.first_mes || "Hello!",
      character,
      selectedPersona
    );
    const avatar = character.avatar || botData.bot;

    // Store first message as user message with "." to avoid templating issues
    const messages = [
      {
        role: "user",
        content: ".",
      },
    ];

    // Build system prompt with persona
    const systemPrompt = this.buildSystemPrompt(character, selectedPersona);
    if (systemPrompt) {
      messages.unshift({
        role: "system",
        content: systemPrompt,
      });
    }

    // Save initial chat state with bot ID and persona ID
    await storageManager.saveChat(window.currentChatId, {
      bot: botData,
      botId: botId,
      personaId: window.currentPersonaId,
      timestamp: new Date().getTime(),
      messages: messages,
    });

    // Display first message from assistant
    this.appendMessage("assistant", firstMes, avatar, character.name || "Bot");

    // Add assistant's first message to chat history
    messages.push({
      role: "assistant",
      content: firstMes,
    });

    // Update chat storage with bot ID and persona ID
    await storageManager.saveChat(window.currentChatId, {
      bot: botData,
      botId: window.currentBotId,
      personaId: window.currentPersonaId,
      timestamp: new Date().getTime(),
      messages: messages,
    });

    // Update UI to show chat name
    document.querySelector(".chat-name").textContent = character.name || "Bot";

    // Add the new chat to the chat tab UI immediately
    const dateStr = window.botService.formatChatDate(new Date().getTime());
    window.botService.addChatToUI(window.currentChatId, botId, botData, dateStr);

    // Close left sidebar on mobile
    if (window.innerWidth < 768) {
      window.toggleLeftSidebar();
    }
  },

  /**
   * Append a message to the chat UI
   * @param {string} role - Message role ('user' or 'assistant')
   * @param {string} text - Message text
   * @param {string} avatarUrl - Avatar URL
   * @param {string} name - Display name
   * @param {string} messageId - Message ID
   * @param {number} messageIndex - Message index in storage
   * @param {Array} versions - Message versions
   * @param {number} currentVersionIndex - Current version index
   * @returns {HTMLElement} Message element
   */
  appendMessage(role, text, avatarUrl, name, messageId = null, messageIndex = null, versions = null, currentVersionIndex = null) {
    const chatContainer = document.querySelector(".chat-container");
    // Use persona avatar for user messages if available
    if (role === 'user') {
      const selectedPersona = window.personaService.getSelectedPersona();
      if (selectedPersona && selectedPersona.avatar) {
        avatarUrl = selectedPersona.avatar;
      }
    }
    const messageDiv = window.chatRenderer.createMessageElement(
      role,
      text,
      avatarUrl,
      name,
      messageId,
      messageIndex,
      versions,
      currentVersionIndex
    );
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return messageDiv;
  },

  /**
   * Load an existing chat
   * @param {string} chatId - Chat ID
   * @param {Object} botData - Bot data
   * @param {string} botId - Bot ID
   * @param {StorageManager} storageManager - Storage manager instance
   */
  async loadChat(chatId, botData, botId, storageManager) {
    window.currentChatId = chatId;
    window.currentBotId = botId;
    window.currentBotData = botData;

    // Get the chat data
    const chat = await storageManager.getChat(chatId);
    if (!chat) {
      console.error("Chat not found:", chatId);
      return;
    }

    // Get selected persona for avatar
    const selectedPersona = window.personaService.getSelectedPersona();
    const userAvatar = (selectedPersona && selectedPersona.avatar) ? selectedPersona.avatar : "https://cataas.com/cat";

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
        continue; // the first user message is system-added
      }

      const role = msg.role === "user" ? "user" : "assistant";
      const name = msg.role === "user" ? "You" : botName;
      const msgAvatar = msg.role === "user" ? userAvatar : avatar;

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
      this.appendMessage(role, content, msgAvatar, name, msg.id, i, versions, currentVersionIndex);
      displayIndex++;
    }

    // Update UI to show chat name
    document.querySelector(".chat-name").textContent = botName;

    // Close left sidebar on mobile
    if (window.innerWidth < 768) {
      window.toggleLeftSidebar();
    }
  },

  /**
   * Delete a chat
   * @param {Event} event - Click event
   * @param {string} chatId - Chat ID
   * @param {StorageManager} storageManager - Storage manager instance
   */
  async deleteChat(event, chatId, storageManager) {
    event.stopPropagation();

    const confirmed = await window.showConfirmDialog(
      "Delete Chat",
      "Are you sure you want to delete this chat?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await storageManager.deleteChat(chatId);

      const chatEntry = document.querySelector(
        `#chats-tab-content [data-chat-id="${chatId}"]`
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
  },

  /**
   * Re-index all message elements after deletion
   */
  reindexMessages() {
    const messages = document.querySelectorAll('.chat-container .message');
    messages.forEach((msg, index) => {
      msg.dataset.messageIndex = index;
    });
  }
};

export { ChatService };
