/**
 * Persona Service - Handles persona UI logic
 */

import { DialogService } from "./dialogService.js";

const PersonaService = {
  /**
   * Load all personas from storage and display them
   */
  async loadPersonas(storageManager) {
    try {
      const personas = await storageManager.getAllPersonas();
      const personasContainer = document.getElementById("personas-tab-content");
      
      if (!personasContainer) return;

      // Clear existing personas (except the Add button)
      const addBtn = document.getElementById("addPersonaBtn");
      personasContainer.innerHTML = "";
      if (addBtn) personasContainer.appendChild(addBtn);

      if (personas.length === 0) {
        // Show empty state
        const emptyState = document.createElement("div");
        emptyState.style.cssText = "text-align: center; color: #888; padding: 20px;";
        emptyState.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.5;">comedy_mask</span>
          <p>No personas yet</p>
        `;
        personasContainer.appendChild(emptyState);
        return;
      }

      // Add each persona to the UI
      personas.forEach(persona => {
        this.addPersonaToUI(persona.id, persona, storageManager);
      });
    } catch (error) {
      console.error("[PersonaService] Error loading personas:", error);
    }
  },

  /**
   * Add a persona to the UI
   */
  addPersonaToUI(personaId, personaData, storageManager) {
    const personasContainer = document.getElementById("personas-tab-content");
    if (!personasContainer) return;

    // Remove empty state if it exists
    const emptyState = personasContainer.querySelector("div[style*='text-align: center']");
    if (emptyState) emptyState.remove();

    const personaEl = document.createElement("div");
    personaEl.className = "persona";
    personaEl.dataset.personaId = personaId;

    const avatarUrl = personaData.avatar || personaData.image_url || "";
    const hasAvatar = avatarUrl && avatarUrl.trim() !== "";

    personaEl.innerHTML = `
      ${hasAvatar ? `<img src="${this.escapeHtml(avatarUrl)}" alt="${this.escapeHtml(personaData.name)}">` : ""}
      <p class="persona-name">${this.escapeHtml(personaData.name)}</p>
      <span class="material-symbols-outlined edit-btn" onclick="window.editPersona(event, '${personaId}')" style="position:absolute;right:44px;top:50%;transform:translateY(-50%);font-size:20px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;color:var(--text-secondary);">edit</span>
      <span class="material-symbols-outlined delete-btn" onclick="window.deletePersona(event, '${personaId}')" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:20px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;color:var(--text-secondary);">delete</span>
    `;

    // Insert before the add button
    const addBtn = document.getElementById("addPersonaBtn");
    if (addBtn) {
      personasContainer.insertBefore(personaEl, addBtn);
    } else {
      personasContainer.appendChild(personaEl);
    }

    // Add click handler to select persona
    personaEl.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-btn")) return;
      if (e.target.classList.contains("edit-btn")) return;
      this.selectPersona(personaId, storageManager);
    });

    // Restore selected state if this persona was previously selected
    const selectedPersonaId = sessionStorage.getItem("selectedPersonaId");
    if (selectedPersonaId === personaId) {
      personaEl.classList.add("selected");
    }
  },

  /**
   * Open persona editor dialog
   */
  async openPersonaEditor(personaId, personaData, storageManager) {
    // Build modal HTML
    const existing = document.getElementById("personaEditorDialog");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "personaEditorDialog";
    overlay.className = "dialog-overlay active";
    overlay.innerHTML = `
      <div class="dialog dialog-large">
        <h3>Edit Persona</h3>
        <div class="form">
          <label>Name</label>
          <input type="text" id="peNameInput" placeholder="Persona name" value="${this.escapeHtml(personaData.name || "")}">

          <label>Description</label>
          <textarea id="peDescriptionInput" placeholder="Brief description..." style="min-height: 70px;">${this.escapeHtml(personaData.description || "")}</textarea>

          <label>Persona (how you act in chats)</label>
          <textarea id="pePersonaInput" placeholder="Describe your role and behaviour..." style="min-height: 80px;">${this.escapeHtml(personaData.persona || "")}</textarea>

          <label>Scenario (optional)</label>
          <textarea id="peScenarioInput" placeholder="Current scenario..." style="min-height: 60px;">${this.escapeHtml(personaData.scenario || "")}</textarea>

          <label>Example Messages (optional)</label>
          <textarea id="peMesExampleInput" placeholder="Example dialogue..." style="min-height: 60px;">${this.escapeHtml(personaData.mes_example || "")}</textarea>

          <label>System Prompt (optional)</label>
          <textarea id="peSystemPromptInput" placeholder="Additional system instructions..." style="min-height: 60px;">${this.escapeHtml(personaData.system_prompt || "")}</textarea>

          <label>Avatar</label>
          <input type="file" id="peAvatarFile" accept="image/*" style="display:none;">
          <button class="btn" onclick="document.getElementById('peAvatarFile').click()" style="width:100%;margin-top:8px;margin-bottom:8px;">
            <span class="material-symbols-outlined" style="vertical-align:middle;margin-right:8px;">image</span>
            Upload Avatar
          </button>
          <div id="peAvatarPreview" style="display:${personaData.avatar ? "block" : "none"};margin-top:8px;">
            <img id="peAvatarPreviewImg" src="${this.escapeHtml(personaData.avatar || "")}" alt="Avatar Preview" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border-default);">
          </div>
        </div>
        <div class="dialog-buttons" style="margin-top:16px;">
          <button class="btn" id="cancelPersonaEditorBtn">Cancel</button>
          <button class="btn" id="confirmPersonaEditorBtn" style="background:linear-gradient(135deg,var(--gradient-start),var(--gradient-end));border:none;">Save Persona</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let newAvatarData = null;

    document.getElementById("peAvatarFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      newAvatarData = await this.readFileAsDataURL(file);
      document.getElementById("peAvatarPreviewImg").src = newAvatarData;
      document.getElementById("peAvatarPreview").style.display = "block";
    });

    document.getElementById("cancelPersonaEditorBtn").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    document.getElementById("confirmPersonaEditorBtn").addEventListener("click", async () => {
      const updated = {
        ...personaData,
        name: document.getElementById("peNameInput").value.trim() || personaData.name,
        description: document.getElementById("peDescriptionInput").value.trim(),
        persona: document.getElementById("pePersonaInput").value.trim(),
        scenario: document.getElementById("peScenarioInput").value.trim(),
        mes_example: document.getElementById("peMesExampleInput").value.trim(),
        system_prompt: document.getElementById("peSystemPromptInput").value.trim(),
        avatar: newAvatarData || personaData.avatar || ""
      };

      try {
        await storageManager.updatePersona(personaId, updated);

        // Refresh selected persona in session if this one is active
        const selectedId = sessionStorage.getItem("selectedPersonaId");
        if (selectedId === personaId) {
          sessionStorage.setItem("selectedPersona", JSON.stringify({ ...updated, id: personaId }));
        }

        // Update UI card
        const el = document.querySelector(`[data-persona-id="${personaId}"]`);
        if (el) {
          const nameEl = el.querySelector(".persona-name");
          const descEl = el.querySelector(".persona-description");
          const imgEl = el.querySelector("img");
          if (nameEl) nameEl.textContent = updated.name;
          if (descEl) descEl.textContent = updated.description || "No description";
          if (imgEl && updated.avatar) imgEl.src = updated.avatar;
        }

        overlay.remove();
        console.log("[PersonaService] Persona updated:", personaId);
      } catch (err) {
        console.error("[PersonaService] Error updating persona:", err);
        alert("Error saving persona: " + err.message);
      }
    });
  },

  /**
   * Create a new persona
   */
  async createPersona(storageManager) {
    const nameInput = document.getElementById("personaNameInput");
    const descriptionInput = document.getElementById("personaDescriptionInput");
    const avatarInput = document.getElementById("personaAvatarInput");

    const name = nameInput.value.trim() || "Unnamed Persona";
    const description = descriptionInput.value.trim();

    let avatarUrl = "";
    if (avatarInput.files && avatarInput.files[0]) {
      const file = avatarInput.files[0];
      avatarUrl = await this.readFileAsDataURL(file);
    }

    const personaData = {
      name: name,
      description: description,
      avatar: avatarUrl,
      persona: "",
      scenario: "",
      mes_example: "",
      system_prompt: "",
      creator_notes: "",
      tags: []
    };

    try {
      const personaId = await storageManager.savePersona(personaData);
      personaData.id = personaId;

      this.addPersonaToUI(personaId, personaData, storageManager);
      DialogService.closePersonaDialog();

      console.log("[PersonaService] Persona created successfully:", personaId);
    } catch (error) {
      console.error("[PersonaService] Error creating persona:", error);
      alert("Error creating persona: " + error.message);
    }
  },

  /**
   * Get the currently selected persona (from sessionStorage)
   */
  getSelectedPersona() {
    const selectedPersonaId = sessionStorage.getItem("selectedPersonaId");
    if (!selectedPersonaId) return null;

    // Try to get full persona data from sessionStorage first
    const storedPersona = sessionStorage.getItem("selectedPersona");
    if (storedPersona) {
      try {
        return JSON.parse(storedPersona);
      } catch (e) {
        console.error("[PersonaService] Failed to parse stored persona:", e);
      }
    }

    // Fallback to DOM extraction
    const personaEl = document.querySelector(`[data-persona-id="${selectedPersonaId}"]`);
    if (!personaEl) return null;

    return {
      id: selectedPersonaId,
      name: personaEl.querySelector(".persona-name")?.textContent || "Unknown",
      description: personaEl.querySelector(".persona-description")?.textContent || "",
      avatar: personaEl.querySelector("img")?.src || ""
    };
  },

  /**
   * Select a persona for use in chats
   */
  async selectPersona(personaId, storageManager) {
    try {
      const persona = await storageManager.loadPersona(personaId);
      sessionStorage.setItem("selectedPersonaId", personaId);
      sessionStorage.setItem("selectedPersona", JSON.stringify(persona));

      // Update UI to show selected state
      document.querySelectorAll(".persona").forEach(el => {
        el.classList.remove("selected");
      });
      const selectedEl = document.querySelector(`[data-persona-id="${personaId}"]`);
      if (selectedEl) {
        selectedEl.classList.add("selected");
      }

      console.log("[PersonaService] Selected persona:", personaId);
    } catch (error) {
      console.error("[PersonaService] Error selecting persona:", error);
    }
  },

  /**
   * Deselect current persona
   */
  deselectPersona() {
    sessionStorage.removeItem("selectedPersonaId");
    sessionStorage.removeItem("selectedPersona");

    document.querySelectorAll(".persona").forEach(el => {
      el.classList.remove("selected");
    });

    console.log("[PersonaService] Deselected persona");
  },

  /**
   * Load selected persona from session and highlight it
   */
  async loadSelectedPersona(storageManager) {
    const selectedPersonaId = sessionStorage.getItem("selectedPersonaId");
    if (selectedPersonaId) {
      try {
        const persona = await storageManager.loadPersona(selectedPersonaId);
        sessionStorage.setItem("selectedPersona", JSON.stringify(persona));

        const selectedEl = document.querySelector(`[data-persona-id="${selectedPersonaId}"]`);
        if (selectedEl) {
          selectedEl.classList.add("selected");
        }
      } catch (error) {
        console.error("[PersonaService] Error loading selected persona:", error);
        sessionStorage.removeItem("selectedPersonaId");
        sessionStorage.removeItem("selectedPersona");
      }
    }
  },

  /**
   * Delete a persona
   */
  async deletePersona(event, personaId, storageManager) {
    event.stopPropagation();
    
    const confirmed = await DialogService.showConfirmDialog(
      "Delete Persona",
      "Are you sure you want to delete this persona?"
    );

    if (!confirmed) return;

    try {
      await storageManager.deletePersona(personaId);
      
      // Remove from UI
      const personaEl = document.querySelector(`[data-persona-id="${personaId}"]`);
      if (personaEl) {
        personaEl.remove();
      }

      // Show empty state if no personas left
      const personasContainer = document.getElementById("personas-tab-content");
      const remainingPersonas = personasContainer.querySelectorAll(".persona");
      if (remainingPersonas.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.style.cssText = "text-align: center; color: #888; padding: 20px;";
        emptyState.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.5;">comedy_mask</span>
          <p>No personas yet</p>
        `;
        personasContainer.appendChild(emptyState);
      }

      console.log("[PersonaService] Persona deleted successfully:", personaId);
    } catch (error) {
      console.error("[PersonaService] Error deleting persona:", error);
      alert("Error deleting persona: " + error.message);
    }
  },

  /**
   * Helper to escape HTML
   */
  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Helper to read file as DataURL
   */
  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Setup avatar preview listener
   */
  setupAvatarPreviewListener() {
    const avatarInput = document.getElementById("personaAvatarInput");
    if (avatarInput) {
      avatarInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          DialogService.showPersonaAvatarPreview(e.target.files[0]);
        }
      });
    }
  }
};

export { PersonaService };
