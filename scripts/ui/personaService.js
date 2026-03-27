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
      <div style="${hasAvatar ? "margin-left: 58px;" : ""}">
        <p class="persona-name">${this.escapeHtml(personaData.name)}</p>
        <p class="persona-description">${this.escapeHtml(personaData.description || "No description")}</p>
      </div>
      <span class="material-symbols-outlined delete-btn" onclick="window.deletePersona(event, '${personaId}')">delete</span>
    `;

    // Insert before the add button
    const addBtn = document.getElementById("addPersonaBtn");
    if (addBtn) {
      personasContainer.insertBefore(personaEl, addBtn);
    } else {
      personasContainer.appendChild(personaEl);
    }

    // Add click handler to open/edit persona
    personaEl.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-btn")) return;
      this.openPersonaEditor(personaId, personaData, storageManager);
    });
  },

  /**
   * Open persona editor dialog
   */
  async openPersonaEditor(personaId, personaData, storageManager) {
    // For now, just show an alert - can be expanded to full editor
    console.log("[PersonaService] Opening editor for persona:", personaId);
    // TODO: Implement full persona editor dialog
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
