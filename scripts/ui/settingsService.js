/**
 * Settings Service - Handles API, generation, and LLM settings management
 */

const SettingsService = {
  /**
   * Save API configuration
   */
  saveApiConfig(inferenceManagerInstance) {
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

    // Update inference manager
    if (inferenceManagerInstance) {
      inferenceManagerInstance.api = apiConfig;
    }

    localStorage.setItem("kiwi_api_config", JSON.stringify(apiConfig));

    // Save generation settings
    this.saveGenerationSettings();

    // Save LLM/preset settings
    this.saveLlmSettings();

    alert("API configuration saved!");
    if (window.toggleRightSidebar) {
      toggleRightSidebar();
    }
  },

  /**
   * Save generation settings to localStorage
   */
  saveGenerationSettings() {
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
      JSON.stringify(generationSettings)
    );
  },

  /**
   * Save LLM/preset settings to localStorage
   */
  saveLlmSettings() {
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
  },

  /**
   * Load saved API configuration
   * @param {InferenceManager} inferenceManagerClass - InferenceManager class constructor
   * @returns {InferenceManager|null} InferenceManager instance or null
   */
  loadSavedApiConfig(inferenceManagerClass) {
    const savedConfig = localStorage.getItem("kiwi_api_config");
    let inferenceManager = null;

    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      document.getElementById("apiEndpoint").value = config.api;
      document.getElementById("apiKey").value = config.api_key;
      document.getElementById("apiModel").value = config.model;
      if (config.streaming !== undefined) {
        document.getElementById("streamingToggle").checked = config.streaming;
      }
      inferenceManager = new inferenceManagerClass(config);
    }

    // Load generation settings
    this.loadGenerationSettings();

    // Load LLM settings
    this.loadLlmSettings();

    return inferenceManager;
  },

  /**
   * Load generation settings from localStorage
   */
  loadGenerationSettings() {
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
  },

  /**
   * Load LLM settings from localStorage
   */
  loadLlmSettings() {
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
  },

  /**
   * Setup auto-save for generation and LLM settings
   */
  setupSettingsAutoSave() {
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
        input.addEventListener("input", () => this.saveGenerationSettings());
        input.addEventListener("change", () => this.saveGenerationSettings());
      }
    });

    // LLM settings auto-save
    const promptInput = document.getElementById("prompt");
    const promptLocationSelect = document.getElementById("promptLocation");
    const presetStreamingToggle = document.getElementById(
      "presetStreamingToggle"
    );
    const streamingToggle = document.getElementById("streamingToggle");

    if (promptInput) {
      promptInput.addEventListener("input", () => this.saveLlmSettings());
      promptInput.addEventListener("change", () => this.saveLlmSettings());
    }
    if (promptLocationSelect) {
      promptLocationSelect.addEventListener("change", () =>
        this.saveLlmSettings()
      );
    }
    if (presetStreamingToggle) {
      presetStreamingToggle.addEventListener("change", () => {
        // Sync with API tab streaming toggle
        if (streamingToggle) {
          streamingToggle.checked = presetStreamingToggle.checked;
        }
        this.saveLlmSettings();
      });
    }
    if (streamingToggle) {
      streamingToggle.addEventListener("change", () => {
        // Sync with preset tab streaming toggle
        if (presetStreamingToggle) {
          presetStreamingToggle.checked = streamingToggle.checked;
        }
        this.saveLlmSettings();
      });
    }
  },

  /**
   * Setup background upload handler
   */
  setupBackgroundUpload() {
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
          this.applyBackground();
          alert("Background saved!");
        } catch (error) {
          if (error.name === "QuotaExceededError") {
            alert("Image too large for storage. Please use a smaller image.");
          } else {
            alert("Error saving background: " + error.message);
          }
        }
      }.bind(this);
      reader.readAsDataURL(file);
    }.bind(this));
  },

  /**
   * Apply saved background
   */
  applyBackground() {
    const bgData = localStorage.getItem("kiwi_background");
    if (bgData) {
      document.body.style.backgroundImage = `url(${bgData})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundAttachment = "fixed";
    }
  },

  /**
   * Load saved background
   */
  loadSavedBackground() {
    this.applyBackground();
  },

  /**
   * Clear background
   */
  clearBackground() {
    localStorage.removeItem("kiwi_background");
    document.body.style.backgroundImage = "none";
  }
};

export { SettingsService };
