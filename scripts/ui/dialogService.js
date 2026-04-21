/**
 * Dialog Service - Handles all dialog/popup interactions
 */

const DialogService = {
  /**
   * Show upload dialog for adding new bots
   */
  openUploadDialog() {
    document.getElementById("uploadDialog").classList.add("active");
    if (window.toggleLeftSidebar) {
      toggleLeftSidebar();
    }
  },

  /**
   * Close upload dialog
   */
  closeUploadDialog() {
    document.getElementById("uploadDialog").classList.remove("active");
    document.getElementById("botImageInput").value = "";
    document.getElementById("imageUploadSection").style.display = "none";
    document.getElementById("confirmUploadBtn").style.display = "none";
  },

  /**
   * Show image upload section
   */
  showImageUpload() {
    document.getElementById("imageUploadSection").style.display = "block";
    document.getElementById("confirmUploadBtn").style.display = "inline-block";
    // Trigger file input click to open file picker
    setTimeout(() => {
      document.getElementById("botImageInput").click();
    }, 100);
  },

  /**
   * Navigate to bot browser page
   */
  browseBots() {
    window.location.href =
      "getBot.html?returnUrl=" + encodeURIComponent(window.location.href);
  },

  /**
   * Confirm and upload bot from image
   */
  async confirmUploadBot(storageManager, addBotToUICallback) {
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
        addBotToUICallback(botId, botData);
        this.closeUploadDialog();
      }.bind(this);
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading bot:", error);
      alert(
        "Error uploading bot. Make sure the image contains character metadata.",
      );
    }
  },

  /**
   * Show preset dialog
   */
  openPresetDialog() {
    document.getElementById("presetDialog").classList.add("active");
    document.getElementById("presetUploadSection").style.display = "none";
    document.getElementById("confirmPresetBtn").style.display = "none";
  },

  /**
   * Close preset dialog
   */
  closePresetDialog() {
    document.getElementById("presetDialog").classList.remove("active");
  },

  /**
   * Navigate to preset browser page
   */
  browsePresets() {
    window.location.href = "getPreset.html";
  },

  /**
   * Show preset upload section
   */
  showPresetUpload() {
    document.getElementById("presetUploadSection").style.display = "block";
    document.getElementById("confirmPresetBtn").style.display = "inline-block";
    // Trigger file input click to open file picker
    setTimeout(() => {
      document.getElementById("presetFileInput").click();
    }, 100);
  },

  /**
   * Confirm and load preset from JSON file
   */
  confirmUploadPreset() {
    const fileInput = document.getElementById("presetFileInput");
    const file = fileInput.files[0];

    if (!file) {
      alert("Please select a JSON file");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const preset = JSON.parse(e.target.result);
        localStorage.setItem("currentPreset", JSON.stringify(preset));
        document.getElementById("presetName").textContent = file.name.replace(
          ".json",
          "",
        );

        if (window.saveLlmSettings) {
          window.saveLlmSettings();
        }

        this.closePresetDialog();
        alert("Preset loaded successfully!");
      } catch (error) {
        alert("Invalid JSON file: " + error.message);
      }
    }.bind(this);
    reader.readAsText(file);
  },

  /**
   * Show confirmation dialog
   * @param {string} title - Dialog title
   * @param {string} message - Dialog message
   * @returns {Promise<boolean>}
   */
  showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const dialog = document.getElementById("confirmDialog");
      const titleEl = document.getElementById("confirmDialogTitle");
      const messageEl = document.getElementById("confirmDialogMessage");
      const confirmBtn = document.getElementById("confirmDialogConfirm");
      const cancelBtn = document.getElementById("confirmDialogCancel");
      const overlay = document.getElementById("sidebarOverlay");

      if (titleEl) titleEl.textContent = title;
      if (messageEl) messageEl.textContent = message;

      const cleanup = () => {
        if (confirmBtn) confirmBtn.removeEventListener("click", handleConfirm);
        if (cancelBtn) cancelBtn.removeEventListener("click", handleCancel);
        if (overlay) overlay.removeEventListener("click", handleOverlayClick);
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

      const handleOverlayClick = () => {
        cleanup();
        dialog.classList.remove("active");
        resolve(false);
      };

      if (confirmBtn) confirmBtn.addEventListener("click", handleConfirm);
      if (cancelBtn) cancelBtn.addEventListener("click", handleCancel);
      if (overlay) overlay.addEventListener("click", handleOverlayClick);

      dialog.classList.add("active");
    });
  },

  /**
   * Show chat choice dialog (new chat vs continue existing)
   * @param {string} botName - Name of the bot
   * @returns {Promise<string>} - 'new', 'recent', or 'cancel'
   */
  showChatChoiceDialog(botName) {
    return new Promise((resolve) => {
      const dialog = document.getElementById("chatChoiceDialog");
      const titleEl = document.getElementById("chatChoiceDialogTitle");
      const messageEl = document.getElementById("chatChoiceDialogMessage");
      const newBtn = document.getElementById("chatChoiceNewBtn");
      const recentBtn = document.getElementById("chatChoiceRecentBtn");
      const cancelBtn = document.getElementById("chatChoiceCancelBtn");

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
  },

  /**
   * Setup all dialog event listeners
   */
  setupDialogListeners(saveApiConfigCallback, clearBackgroundCallback) {
    // Upload dialog
    const cancelUploadBtn = document.getElementById("cancelUploadBtn");
    if (cancelUploadBtn) {
      cancelUploadBtn.addEventListener("click", () => this.closeUploadDialog());
    }

    const confirmUploadBtn = document.getElementById("confirmUploadBtn");
    if (confirmUploadBtn) {
      confirmUploadBtn.addEventListener("click", () => {
        if (window.confirmUploadBotCallback) {
          window.confirmUploadBotCallback();
        }
      });
    }

    // Preset dialog
    const cancelPresetBtn = document.getElementById("cancelPresetBtn");
    if (cancelPresetBtn) {
      cancelPresetBtn.addEventListener("click", () => this.closePresetDialog());
    }

    const confirmPresetBtn = document.getElementById("confirmPresetBtn");
    if (confirmPresetBtn) {
      confirmPresetBtn.addEventListener("click", () =>
        this.confirmUploadPreset()
      );
    }

    // Persona dialog
    const cancelPersonaBtn = document.getElementById("cancelPersonaBtn");
    if (cancelPersonaBtn) {
      cancelPersonaBtn.addEventListener("click", () => this.closePersonaDialog());
    }

    const confirmPersonaBtn = document.getElementById("confirmPersonaBtn");
    if (confirmPersonaBtn) {
      confirmPersonaBtn.addEventListener("click", () => {
        if (window.confirmCreatePersonaCallback) {
          window.confirmCreatePersonaCallback();
        }
      });
    }

    // API save button
    const saveApiBtn = document.getElementById("saveApiBtn");
    if (saveApiBtn) {
      saveApiBtn.addEventListener("click", saveApiConfigCallback);
    }

    // Clear background button
    const clearBgBtn = document.getElementById("clearBgBtn");
    if (clearBgBtn) {
      clearBgBtn.addEventListener("click", clearBackgroundCallback);
    }
  },

  /**
   * Open persona creation dialog
   */
  openPersonaDialog() {
    document.getElementById("personaDialog").classList.add("active");
    document.getElementById("personaNameInput").value = "";
    document.getElementById("personaDescriptionInput").value = "";
    document.getElementById("personaAvatarInput").value = "";
    document.getElementById("personaAvatarPreview").style.display = "none";
    if (window.toggleLeftSidebar) {
      toggleLeftSidebar();
    }
  },

  /**
   * Close persona dialog
   */
  closePersonaDialog() {
    document.getElementById("personaDialog").classList.remove("active");
    document.getElementById("personaNameInput").value = "";
    document.getElementById("personaDescriptionInput").value = "";
    document.getElementById("personaAvatarInput").value = "";
    document.getElementById("personaAvatarPreview").style.display = "none";
  },

  /**
   * Show persona avatar preview
   */
  showPersonaAvatarPreview(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const previewImg = document.getElementById("personaAvatarPreviewImg");
      previewImg.src = e.target.result;
      document.getElementById("personaAvatarPreview").style.display = "block";
    };
    reader.readAsDataURL(file);
  }
};

export { DialogService };
