/**
 * Bot Service - Handles bot management operations
 */

const BotService = {
  /**
   * Add a bot to the UI
   * @param {string} botId - Bot ID
   * @param {Object} botData - Bot data
   */
  addBotToUI(botId, botData) {
    const sidebarContent = document.querySelector(
      "#leftSidebar .sidebar-content"
    );

    // Check if bot already exists in UI
    const existingBot = sidebarContent.querySelector(`[data-bot-id="${botId}"]`);
    if (existingBot) {
      return; // Bot already exists, don't add duplicate
    }

    const botDiv = document.createElement("div");
    botDiv.className = "bot";
    botDiv.dataset.botId = botId;

    const character = botData.character || {};
    const avatar = character.avatar || botData.bot;
    const botName = character.name || "Unknown Bot";

    botDiv.innerHTML = `
      <img src="${avatar}" alt="${botName}">
      <p class="bot-name">${botName}</p>
      <span class="material-symbols-outlined options-btn" onclick="window.openBotOptions('${botId}')">more_vert</span>
    `;

    botDiv.addEventListener("click", (e) => {
      if (!e.target.classList.contains("options-btn")) {
        if (window.startChat) {
          window.startChat(botId, botData);
        }
      }
    });

    sidebarContent.appendChild(botDiv);
  },

  /**
   * Delete a bot from UI and storage
   * @param {HTMLElement} btn - Delete button element
   * @param {string} botId - Bot ID to delete
   */
  async deleteBotFromUI(btn, botId) {
    // Use custom confirm dialog if available, otherwise use native confirm
    let confirmed = false;

    if (window.showConfirmDialog) {
      confirmed = await window.showConfirmDialog(
        "Delete Bot",
        "Are you sure you want to delete this bot?",
      );
    } else {
      confirmed = confirm("Are you sure you want to delete this bot?");
    }

    if (!confirmed) {
      return;
    }

    try {
      const result = await window.storageManager.deleteBot(botId);
      const bot = btn.closest(".bot");
      bot.remove();

      // Remove associated chats from the UI
      if (result && result.deletedChats) {
        result.deletedChats.forEach((chatId) => {
          const chatEntry = document.querySelector(
            `#chats-tab-content [data-chat-id="${chatId}"]`
          );
          if (chatEntry) {
            chatEntry.remove();
          }
        });

        // Show "no chats" message if no chats left
        this.showNoChatsMessageIfNeeded();
      }
    } catch (error) {
      console.error("Error deleting bot:", error);
      alert("Error deleting bot");
    }
  },

  /**
   * Show "no chats" message if no chats exist
   */
  showNoChatsMessageIfNeeded() {
    const chatsTabContent = document.querySelector("#chats-tab-content");
    const noChatsMsg = chatsTabContent?.querySelector(".no-chats");
    const remainingChats = chatsTabContent?.querySelectorAll(".chat-item");

    if (remainingChats?.length === 0 && noChatsMsg) {
      noChatsMsg.style.display = "flex";
    }
  },

  /**
   * Load and display all saved bots
   * @param {StorageManager} storageManager - Storage manager instance
   */
  async loadSavedBots(storageManager) {
    try {
      const botIds = await storageManager.getBotList();
      for (const botId of botIds) {
        try {
          const botData = await storageManager.loadBot(botId);
          this.addBotToUI(botId, botData);
        } catch (error) {
          console.error("Error loading bot:", botId, error);
        }
      }
    } catch (error) {
      console.error("Error loading bot list:", error);
    }
  },

  /**
   * Format timestamp for chat display
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} Formatted date string
   */
  formatChatDate(timestamp) {
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
  },

  /**
   * Add a chat entry to the UI under a bot
   * @param {string} chatId - Chat ID
   * @param {string} botId - Bot ID
   * @param {Object} botData - Bot data
   * @param {string} dateStr - Formatted date string
   */
  addChatToUI(chatId, botId, botData, dateStr) {
    const character = botData.character || {};
    const avatar = character.avatar || botData.bot || "https://cataas.com/cat";
    const botName = character.name || "Bot";

    // Find or create the bot entry in Bots tab
    let botEntry = document.querySelector(
      `#bots-tab-content .bot[data-bot-id="${botId}"]`
    );

    if (!botEntry) {
      // Bot doesn't exist in UI, create it
      botEntry = document.createElement("div");
      botEntry.className = "bot";
      botEntry.dataset.botId = botId;

      botEntry.innerHTML = `
        <img src="${avatar}" alt="${botName}">
        <p class="bot-name">${botName}</p>
        <span class="material-symbols-outlined options-btn" onclick="window.openBotOptions('${botId}')">more_vert</span>
      `;

      botEntry.addEventListener("click", (e) => {
        if (!e.target.classList.contains("options-btn")) {
          if (window.startChat) {
            window.startChat(botId, botData);
          }
        }
      });

      const botsTabContent = document.querySelector("#bots-tab-content");
      botsTabContent.appendChild(botEntry);
    }

    // Add the chat entry to Chats tab
    const chatsTabContent = document.querySelector("#chats-tab-content");
    const noChatsMsg = chatsTabContent?.querySelector(".no-chats");

    // Hide "no chats" message
    if (noChatsMsg) {
      noChatsMsg.style.display = "none";
    }

    // Check if this chat already exists
    const existingChat = chatsTabContent.querySelector(
      `[data-chat-id="${chatId}"]`
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
      <div style="flex: 1; overflow: hidden; margin-left: 58px; margin-right: 40px; min-width: 0;">
        <p class="bot-name" style="margin: 0; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${botName}</p>
        <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${dateStr}</p>
      </div>
      <span class="material-symbols-outlined delete-btn">
        delete
      </span>
    `;

    // Add click listener for the delete button
    const deleteBtn = chatEntry.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.deleteChat) {
        window.deleteChat(e, chatId);
      }
    });

    chatEntry.addEventListener("click", (e) => {
      e.stopPropagation();
      if (
        e.target.classList.contains("delete-btn") ||
        e.target.closest(".delete-btn")
      ) {
        return;
      }
      if (window.loadChat) {
        window.loadChat(chatId, botData, botId);
      }
    });

    chatsTabContent.appendChild(chatEntry);
  },

  /**
   * Load and display all saved chats
   * @param {StorageManager} storageManager - Storage manager instance
   */
  async loadSavedChats(storageManager) {
    try {
      const chatIds = await storageManager.getChatList();

      for (const chatId of chatIds) {
        try {
          const chat = await storageManager.getChat(chatId);
          if (!chat || !chat.bot) continue;

          const botData = chat.bot;
          const botId = chat.botId || botData.id || chatId;
          const dateStr = this.formatChatDate(chat.timestamp || new Date().getTime());

          this.addChatToUI(chatId, botId, botData, dateStr);
        } catch (error) {
          console.error("Error loading chat:", chatId, error);
        }
      }
    } catch (error) {
      console.error("Error loading chat list:", error);
    }
  },

  /**
   * Update the timestamp of a chat entry in the UI
   * @param {string} chatId - Chat ID
   */
  updateChatTimestamp(chatId) {
    const chatEntry = document.querySelector(
      `#chats-tab-content [data-chat-id="${chatId}"]`
    );
    if (chatEntry) {
      const dateStr = this.formatChatDate(new Date().getTime());
      const datePara = chatEntry.querySelector('p[style*="color: #888"]');
      if (datePara) {
        datePara.textContent = dateStr;
      }

      // Move to bottom of chats list (most recent first)
      const chatsTabContent = document.querySelector("#chats-tab-content");
      chatsTabContent.appendChild(chatEntry);
    }
  }
};

export { BotService };
