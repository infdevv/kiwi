/**
 * Settings Service - Handles API, generation, and LLM settings management
 */

const SettingsService = {
  /**
   * Save API configuration
   */
  saveApiConfig(inferenceManagerClass) {
    let endpoint = document.getElementById("apiEndpoint").value;
    const apiKey = document.getElementById("apiKey").value;
    const model = document.getElementById("apiModel").value;
    const streaming = document.getElementById("streamingToggle").checked;

    if (!endpoint || !apiKey || !model) {
      alert("Please fill in all API fields");
      return null;
    }

    const apiConfig = {
      api: endpoint,
      api_key: apiKey,
      model: model,
      streaming: streaming,
    };

    localStorage.setItem("kiwi_api_config", JSON.stringify(apiConfig));

    // Save generation settings
    this.saveGenerationSettings();

    // Save LLM/preset settings
    this.saveLlmSettings();

    alert("API configuration saved!");
    if (window.toggleRightSidebar) {
      toggleRightSidebar();
    }

    // Always return a fresh InferenceManager with the new config
    return new inferenceManagerClass(apiConfig);
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
      topK: document.getElementById("topK")?.value ?? "0",
      minP: document.getElementById("minP")?.value ?? "0",
      frequencyPenalty: document.getElementById("frequencyPenalty").value,
      presencePenalty: document.getElementById("presencePenalty").value,
      arrangement: document.getElementById("arrangement")?.value ?? "0",
      htmlRendering: document.getElementById("htmlRenderingToggle")?.checked ?? false,
      showThinking: document.getElementById("showThinkingToggle")?.checked ?? false,
    };

    localStorage.setItem(
      "kiwi_generation_settings",
      JSON.stringify(generationSettings),
    );
  },

  /**
   * Save LLM/preset settings to localStorage
   */
  saveLlmSettings() {
    const streaming = document.getElementById("presetStreamingToggle")?.checked ?? false;
    const prompt = document.getElementById("prompt").value;
    const promptLocation = document.getElementById("promptLocation").value;
    const currentPreset = localStorage.getItem("currentPreset");
    
    // ALWAYS read preset name from localStorage, not from DOM
    // The DOM might still say "No Preset" when loading
    let presetName = localStorage.getItem("currentPresetName");
    if (!presetName) {
      // Fallback to DOM only if nothing in localStorage
      presetName = document.getElementById("presetName").textContent;
      if (presetName === "No Preset") {
        presetName = null;
      }
    }

    const llmSettings = {
      streaming: streaming,
      prompt: prompt,
      promptLocation: promptLocation,
      preset: currentPreset,
      presetName: presetName,
      // Save the actual preset prompts from the UI
      presetPrompts: {},
    };

    // Save preset prompt toggles and values if they exist
    const presetTogglesContainer = document.getElementById("presetToggles");
    if (presetTogglesContainer) {
      const toggleInputs = presetTogglesContainer.querySelectorAll("input[type='checkbox']");
      toggleInputs.forEach(input => {
        if (input.id && input.dataset.promptIndex !== undefined) {
          llmSettings.presetPrompts[input.id] = input.checked;
        }
      });
    }

    localStorage.setItem("kiwi_llm_settings", JSON.stringify(llmSettings));
    
    // Also save preset name separately for easy access
    if (presetName) {
      localStorage.setItem("currentPresetName", presetName);
    }
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
      if (settings.topK && document.getElementById("topK"))
        document.getElementById("topK").value = settings.topK;
      if (settings.minP && document.getElementById("minP"))
        document.getElementById("minP").value = settings.minP;
      if (settings.frequencyPenalty)
        document.getElementById("frequencyPenalty").value =
          settings.frequencyPenalty;
      if (settings.presencePenalty)
        document.getElementById("presencePenalty").value =
          settings.presencePenalty;
      if (settings.arrangement && document.getElementById("arrangement"))
        document.getElementById("arrangement").value = settings.arrangement;
      const htmlToggle = document.getElementById("htmlRenderingToggle");
      if (htmlToggle && settings.htmlRendering !== undefined)
        htmlToggle.checked = settings.htmlRendering;
      const thinkingToggle = document.getElementById("showThinkingToggle");
      if (thinkingToggle && settings.showThinking !== undefined)
        thinkingToggle.checked = settings.showThinking;
    }
  },

  /**
   * Load LLM settings from localStorage
   */
  loadLlmSettings() {
    console.log('[SettingsService] Loading LLM settings...');
    const savedSettings = localStorage.getItem("kiwi_llm_settings");
    
    // ALWAYS check localStorage for preset name first
    const savedPresetName = localStorage.getItem("currentPresetName");
    const presetNameEl = document.getElementById("presetName");
    
    if (savedPresetName && presetNameEl) {
      presetNameEl.textContent = savedPresetName;
      console.log('[SettingsService] Restored preset name from localStorage:', savedPresetName);
    }
    
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      console.log('[SettingsService] Found saved LLM settings, presetName:', settings.presetName);
      if (settings.streaming !== undefined) {
        document.getElementById("presetStreamingToggle").checked =
          settings.streaming;
      }
      if (settings.prompt)
        document.getElementById("prompt").value = settings.prompt;
      if (settings.promptLocation)
        document.getElementById("promptLocation").value =
          settings.promptLocation;
      if (settings.preset) {
        localStorage.setItem("currentPreset", settings.preset);
      }
      // Don't overwrite presetName from settings if we already have one in localStorage
      if (settings.presetName && !savedPresetName) {
        if (presetNameEl) {
          presetNameEl.textContent = settings.presetName;
          console.log('[SettingsService] Restored preset name from LLM settings:', settings.presetName);
        }
        localStorage.setItem("currentPresetName", settings.presetName);
      }
      // Restore preset prompt toggles and values
      if (settings.presetPrompts) {
        Object.keys(settings.presetPrompts).forEach(key => {
          const input = document.getElementById(key);
          if (input && input.dataset.promptIndex !== undefined) {
            input.checked = settings.presetPrompts[key];
            // Trigger change event to update content visibility
            input.dispatchEvent(new Event('change'));
          }
        });
      }
    } else {
      console.log('[SettingsService] No saved LLM settings found');
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
      "topK",
      "minP",
      "frequencyPenalty",
      "presencePenalty",
      "arrangement",
    ];
    generationInputs.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", () => this.saveGenerationSettings());
        input.addEventListener("change", () => this.saveGenerationSettings());
      }
    });
    const htmlRenderingToggle = document.getElementById("htmlRenderingToggle");
    if (htmlRenderingToggle) {
      htmlRenderingToggle.addEventListener("change", () => this.saveGenerationSettings());
    }
    const showThinkingToggle = document.getElementById("showThinkingToggle");
    if (showThinkingToggle) {
      showThinkingToggle.addEventListener("change", () => this.saveGenerationSettings());
    }

    // LLM settings auto-save
    const promptInput = document.getElementById("prompt");
    const promptLocationSelect = document.getElementById("promptLocation");
    const presetStreamingToggle = document.getElementById(
      "presetStreamingToggle",
    );
    const streamingToggle = document.getElementById("streamingToggle");

    if (promptInput) {
      promptInput.addEventListener("input", () => this.saveLlmSettings());
      promptInput.addEventListener("change", () => this.saveLlmSettings());
    }
    if (promptLocationSelect) {
      promptLocationSelect.addEventListener("change", () =>
        this.saveLlmSettings(),
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

    backgroundInput.addEventListener(
      "change",
      function (e) {
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
      }.bind(this),
    );
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
  },

  /**
   * Apply a quick generation preset to all generation setting fields
   * @param {string} presetName - 'deterministic' | 'balanced' | 'creative'
   */
  applyGenerationPreset(presetName) {
    const presets = {
      deterministic: {
        contextLength: 0, maxTokens: 4000, temperature: 0.3,
        topP: 0.85, topK: 20, minP: 0.1,
        frequencyPenalty: 0.5, presencePenalty: 0.2, arrangement: 0
      },
      balanced: {
        contextLength: 0, maxTokens: 4000, temperature: 0.7,
        topP: 0.95, topK: 0, minP: 0,
        frequencyPenalty: 0, presencePenalty: 0, arrangement: 0
      },
      creative: {
        contextLength: 0, maxTokens: 4000, temperature: 1.3,
        topP: 0.98, topK: 100, minP: 0.05,
        frequencyPenalty: -0.2, presencePenalty: 0.1, arrangement: 0
      }
    };

    const preset = presets[presetName];
    if (!preset) return;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    set('contextLength', preset.contextLength);
    set('maxTokens', preset.maxTokens);
    set('temperature', preset.temperature);
    set('topP', preset.topP);
    set('topK', preset.topK);
    set('minP', preset.minP);
    set('frequencyPenalty', preset.frequencyPenalty);
    set('presencePenalty', preset.presencePenalty);
    set('arrangement', preset.arrangement);

    this.saveGenerationSettings();
  },
};

export { SettingsService };
