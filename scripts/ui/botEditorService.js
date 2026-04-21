/**
 * Bot Editor Service - Handles bot creation and editing
 */

const BotEditorService = {
  currentBotId: null,
  currentBotData: null,
  avatarFile: null,

  /**
   * Initialize the bot editor service
   */
  init() {
    this.setupDialogListeners();
    this.setupAvatarPreviewListener();
  },

  /**
   * Setup dialog listeners
   */
  setupDialogListeners() {
    // Bot Options Dialog
    const cancelBotOptionsBtn = document.getElementById("cancelBotOptionsBtn");
    if (cancelBotOptionsBtn) {
      cancelBotOptionsBtn.addEventListener("click", () => {
        this.closeBotOptionsDialog();
      });
    }

    // Bot Editor Dialog
    const cancelBotEditorBtn = document.getElementById("cancelBotEditorBtn");
    if (cancelBotEditorBtn) {
      cancelBotEditorBtn.addEventListener("click", () => {
        this.closeBotEditorDialog();
      });
    }

    const confirmBotEditorBtn = document.getElementById("confirmBotEditorBtn");
    if (confirmBotEditorBtn) {
      confirmBotEditorBtn.addEventListener("click", () => {
        this.saveBot();
      });
    }

    // Sidebar overlay click
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener("click", () => {
        this.closeBotOptionsDialog();
        this.closeBotEditorDialog();
      });
    }
  },

  /**
   * Setup avatar preview listener
   */
  setupAvatarPreviewListener() {
    const avatarFileInput = document.getElementById("botEditorAvatarFile");
    const avatarUrlInput = document.getElementById("botEditorAvatarUrl");
    const avatarPreview = document.getElementById("botEditorAvatarPreview");
    const avatarPreviewImg = document.getElementById("botEditorAvatarPreviewImg");

    if (avatarFileInput) {
      avatarFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          this.avatarFile = file;
          const reader = new FileReader();
          reader.onload = (event) => {
            avatarPreviewImg.src = event.target.result;
            avatarPreview.style.display = "block";
            // Clear URL input when file is uploaded
            if (avatarUrlInput) avatarUrlInput.value = "";
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (avatarUrlInput) {
      avatarUrlInput.addEventListener("input", (e) => {
        const url = e.target.value.trim();
        if (url) {
          avatarPreviewImg.src = url;
          avatarPreview.style.display = "block";
          // Clear file input when URL is entered
          if (avatarFileInput) avatarFileInput.value = "";
          this.avatarFile = null;
        } else {
          avatarPreview.style.display = "none";
        }
      });
    }
  },

  /**
   * Open bot options dialog
   * @param {string} botId - Bot ID
   */
  openBotOptionsDialog(botId) {
    this.currentBotId = botId;
    const dialog = document.getElementById("botOptionsDialog");
    if (dialog) {
      dialog.classList.add("active");
    }
  },

  /**
   * Close bot options dialog
   */
  closeBotOptionsDialog() {
    const dialog = document.getElementById("botOptionsDialog");
    if (dialog) {
      dialog.classList.remove("active");
    }
    this.currentBotId = null;
  },

  /**
   * Open bot editor dialog for creating a new bot
   */
  openCreateBotDialog() {
    this.currentBotId = null;
    this.currentBotData = null;
    this.avatarFile = null;

    const title = document.getElementById("botEditorTitle");
    if (title) title.textContent = "Create Bot";

    // Clear all fields
    document.getElementById("botEditorName").value = "";
    document.getElementById("botEditorAvatarUrl").value = "";
    document.getElementById("botEditorAvatarFile").value = "";
    document.getElementById("botEditorDescription").value = "";
    document.getElementById("botEditorPersonality").value = "";
    document.getElementById("botEditorScenario").value = "";
    document.getElementById("botEditorFirstMes").value = "";
    document.getElementById("botEditorMesExample").value = "";
    document.getElementById("botEditorSystemPrompt").value = "";
    document.getElementById("botEditorCreator").value = "";
    document.getElementById("botEditorTags").value = "";

    // Hide avatar preview
    document.getElementById("botEditorAvatarPreview").style.display = "none";

    const dialog = document.getElementById("botEditorDialog");
    if (dialog) {
      dialog.classList.add("active");
    }
  },

  /**
   * Open bot editor dialog for editing an existing bot
   */
  async editBot() {
    if (!this.currentBotId) return;

    try {
      this.closeBotOptionsDialog();

      const botData = await window.storageManager.loadBot(this.currentBotId);
      this.currentBotData = botData;

      const character = botData.character || {};

      // Set title
      const title = document.getElementById("botEditorTitle");
      if (title) title.textContent = "Edit Bot";

      // Populate fields
      document.getElementById("botEditorName").value = character.name || "";
      document.getElementById("botEditorAvatarUrl").value = character.avatar || botData.bot || "";
      document.getElementById("botEditorDescription").value = character.description || "";
      document.getElementById("botEditorPersonality").value = character.personality || "";
      document.getElementById("botEditorScenario").value = character.scenario || "";
      document.getElementById("botEditorFirstMes").value = character.first_mes || character.firstMessage || "";
      document.getElementById("botEditorMesExample").value = character.mes_example || character.exampleMessage || "";
      document.getElementById("botEditorSystemPrompt").value = character.system_prompt || "";
      document.getElementById("botEditorCreator").value = character.creator || "";
      document.getElementById("botEditorTags").value = (character.tags || []).join(", ");

      // Show avatar preview
      const avatarPreview = document.getElementById("botEditorAvatarPreview");
      const avatarPreviewImg = document.getElementById("botEditorAvatarPreviewImg");
      const avatarUrl = character.avatar || botData.bot;
      if (avatarUrl) {
        avatarPreviewImg.src = avatarUrl;
        avatarPreview.style.display = "block";
      } else {
        avatarPreview.style.display = "none";
      }

      // Clear file input
      document.getElementById("botEditorAvatarFile").value = "";
      this.avatarFile = null;

      const dialog = document.getElementById("botEditorDialog");
      if (dialog) {
        dialog.classList.add("active");
      }
    } catch (error) {
      console.error("Error loading bot for edit:", error);
      alert("Error loading bot data: " + error.message);
    }
  },

  /**
   * Delete the current bot
   */
  async deleteBot() {
    if (!this.currentBotId) return;

    const confirmed = await window.showConfirmDialog(
      "Delete Bot",
      "Are you sure you want to delete this bot? This will also delete all associated chats."
    );

    if (!confirmed) return;

    try {
      await window.storageManager.deleteBot(this.currentBotId);

      // Remove bot from UI
      const botElement = document.querySelector(`.bot[data-bot-id="${this.currentBotId}"]`);
      if (botElement) {
        botElement.remove();
      }

      this.closeBotOptionsDialog();
    } catch (error) {
      console.error("Error deleting bot:", error);
      alert("Error deleting bot: " + error.message);
    }
  },

  /**
   * Close bot editor dialog
   */
  closeBotEditorDialog() {
    const dialog = document.getElementById("botEditorDialog");
    if (dialog) {
      dialog.classList.remove("active");
    }
    this.currentBotId = null;
    this.currentBotData = null;
    this.avatarFile = null;
  },

  /**
   * Save bot (create or update)
   */
  async saveBot() {
    const name = document.getElementById("botEditorName").value.trim();
    const avatarUrl = document.getElementById("botEditorAvatarUrl").value.trim();
    const description = document.getElementById("botEditorDescription").value.trim();
    const personality = document.getElementById("botEditorPersonality").value.trim();
    const scenario = document.getElementById("botEditorScenario").value.trim();
    const firstMes = document.getElementById("botEditorFirstMes").value.trim();
    const mesExample = document.getElementById("botEditorMesExample").value.trim();
    const systemPrompt = document.getElementById("botEditorSystemPrompt").value.trim();
    const creator = document.getElementById("botEditorCreator").value.trim();
    const tagsInput = document.getElementById("botEditorTags").value.trim();

    // Validate required fields
    if (!name) {
      alert("Please enter a bot name");
      return;
    }

    // Process tags
    const tags = tagsInput ? tagsInput.split(",").map(t => t.trim()).filter(t => t) : [];

    // Process avatar
    let avatarData = avatarUrl;
    if (this.avatarFile) {
      // Convert file to base64
      avatarData = await this.fileToBase64(this.avatarFile);
    } else if (!avatarData && this.currentBotData) {
      // Keep existing avatar if not changed
      avatarData = this.currentBotData.character?.avatar || this.currentBotData.bot;
    }

    const characterData = {
      name,
      description,
      personality,
      scenario,
      first_mes: firstMes,
      mes_example: mesExample,
      system_prompt: systemPrompt,
      creator,
      creator_notes: "",
      tags,
      extensions: {},
      alternate_greetings: [],
      avatar: avatarData || ""
    };

    try {
      if (this.currentBotId && this.currentBotData) {
        // Update existing bot
        const bot = {
          id: this.currentBotId,
          character: characterData,
          img: avatarData,
          type: "json"
        };

        await this.updateBotInIndexedDB(bot);

        // Update UI
        const botElement = document.querySelector(`.bot[data-bot-id="${this.currentBotId}"]`);
        if (botElement) {
          const img = botElement.querySelector("img");
          const nameEl = botElement.querySelector(".bot-name");
          if (img) img.src = avatarData || "https://cataas.com/cat";
          if (nameEl) nameEl.textContent = name;
        }

        alert("Bot updated successfully!");
      } else {
        // Create new bot
        const botId = await window.storageManager.saveBotFromJson(characterData, avatarData);
        const savedBot = await window.storageManager.loadBot(botId);

        // Add to UI
        window.botService.addBotToUI(botId, savedBot);

        alert("Bot created successfully!");
      }

      this.closeBotEditorDialog();
    } catch (error) {
      console.error("Error saving bot:", error);
      alert("Error saving bot: " + error.message);
    }
  },

  /**
   * Convert file to base64
   * @param {File} file - File to convert
   * @returns {Promise<string>} Base64 string
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Update bot in IndexedDB
   * @param {Object} bot - Bot data
   */
  updateBotInIndexedDB(bot) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("kiwi_storage", 2);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("bots", "readwrite");
        const store = tx.objectStore("bots");
        const updateRequest = store.put(bot);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      };
    });
  }
};

// Make available globally
window.BotEditorService = BotEditorService;

// Setup global callback for opening bot options
window.openBotOptions = (botId) => {
  BotEditorService.openBotOptionsDialog(botId);
};

export { BotEditorService };
