function toggleLeftSidebar() {
  const leftSidebar = document.getElementById("leftSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  leftSidebar.classList.toggle("open");
  overlay.classList.toggle("active");
}

function toggleRightSidebar() {
  const rightSidebar = document.getElementById("rightSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  rightSidebar.classList.toggle("open");
  overlay.classList.toggle("active");
}

document
  .getElementById("sidebarOverlay")
  .addEventListener("click", function () {
    document.getElementById("leftSidebar").classList.remove("open");
    document.getElementById("rightSidebar").classList.remove("open");
    this.classList.remove("active");
  });

// Confirm dialog state
let confirmResolve = null;

window.showConfirmDialog = function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    const titleEl = document.getElementById("confirmDialogTitle");
    const messageEl = document.getElementById("confirmDialogMessage");
    const dialog = document.getElementById("confirmDialog");
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (dialog) dialog.classList.add("active");
  });
};

function hideConfirmDialog() {
  const dialog = document.getElementById("confirmDialog");
  if (dialog) dialog.classList.remove("active");
}

// Setup confirm dialog listeners
const confirmCancelBtn = document.getElementById("confirmDialogCancel");
const confirmConfirmBtn = document.getElementById("confirmDialogConfirm");
const sidebarOverlayEl = document.getElementById("sidebarOverlay");

if (confirmCancelBtn) {
  confirmCancelBtn.addEventListener("click", () => {
    hideConfirmDialog();
    if (confirmResolve) confirmResolve(false);
  });
}

if (confirmConfirmBtn) {
  confirmConfirmBtn.addEventListener("click", () => {
    hideConfirmDialog();
    if (confirmResolve) confirmResolve(true);
  });
}

if (sidebarOverlayEl) {
  sidebarOverlayEl.addEventListener("click", () => {
    hideConfirmDialog();
    if (confirmResolve) confirmResolve(false);
  });
}

function deleteBot(btn) {
  const bot = btn.closest(".bot");
  bot.remove();
}

async function deleteBotFromUI(btn, botId) {
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
          `#chats-tab-content [data-chat-id="${chatId}"]`,
        );
        if (chatEntry) {
          chatEntry.remove();
        }
      });

      // Show "no chats" message if no chats left
      const chatsTabContent = document.querySelector("#chats-tab-content");
      const noChatsMsg = chatsTabContent.querySelector(".no-chats");
      const remainingChats = chatsTabContent.querySelectorAll(".chat-item");

      if (remainingChats.length === 0 && noChatsMsg) {
        noChatsMsg.style.display = "flex";
      }
    }
  } catch (error) {
    console.error("Error deleting bot:", error);
    alert("Error deleting bot");
  }
}

window.deleteBotFromUI = deleteBotFromUI;

// Preset dialog functions
function openPresetDialog() {
  document.getElementById("presetDialog").classList.add("active");
  document.getElementById("presetUploadSection").style.display = "none";
  document.getElementById("confirmPresetBtn").style.display = "none";
}

function closePresetDialog() {
  document.getElementById("presetDialog").classList.remove("active");
}

function browsePresets() {
  window.location.href = "getPreset.html";
}

function showPresetUpload() {
  document.getElementById("presetUploadSection").style.display = "block";
  document.getElementById("confirmPresetBtn").style.display = "inline-block";
}

function confirmUploadPreset() {
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
      // Store the preset in localStorage or handle it as needed
      localStorage.setItem("currentPreset", JSON.stringify(preset));
      document.getElementById("presetName").textContent = file.name.replace(
        ".json",
        "",
      );

      // Save LLM settings after loading preset
      if (window.saveLlmSettings) {
        window.saveLlmSettings();
      }

      closePresetDialog();
      alert("Preset loaded successfully!");
    } catch (error) {
      alert("Invalid JSON file: " + error.message);
    }
  };
  reader.readAsText(file);
}

function switchSidebarTab(tabId) {
  // Hide all tab contents
  document.querySelectorAll(".sidebar-tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  // Remove active class from all tabs
  document.querySelectorAll(".sidebar-tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  // Show the selected tab content
  document.getElementById(tabId).classList.add("active");

  // Add active class to the clicked tab
  document
    .querySelector(`.sidebar-tab[data-tab="${tabId}"]`)
    .classList.add("active");
}

function switchLeftSidebarTab(tabId) {
  // Hide all left sidebar content sections
  document
    .querySelectorAll("#leftSidebar .sidebar-content")
    .forEach((content) => {
      content.style.display = "none";
    });

  // Remove active class from all left sidebar tabs
  document.querySelectorAll("#leftSidebar .sidebar-tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  // Show the selected tab content
  const tabContent = document.getElementById(tabId + "-content");
  if (tabContent) {
    tabContent.style.display = "block";
  }

  // Add active class to the clicked tab
  const tab = document.querySelector(
    `#leftSidebar .sidebar-tab[data-tab="${tabId}"]`,
  );
  if (tab) {
    tab.classList.add("active");
  }
}

function browseBots() {
  window.location.href = "getBot.html";
}

function showImageUpload() {
  document.getElementById("imageUploadSection").style.display = "block";
  document.getElementById("confirmUploadBtn").style.display = "inline-block";
}

window.switchSidebarTab = switchSidebarTab;
window.switchLeftSidebarTab = switchLeftSidebarTab;
window.toggleLeftSidebar = toggleLeftSidebar;
window.toggleRightSidebar = toggleRightSidebar;
window.deleteBot = deleteBot;
window.deleteBotFromUI = deleteBotFromUI;
window.openPresetDialog = openPresetDialog;
window.closePresetDialog = closePresetDialog;
window.browsePresets = browsePresets;
window.showPresetUpload = showPresetUpload;
window.confirmUploadPreset = confirmUploadPreset;
window.browseBots = browseBots;
window.showImageUpload = showImageUpload;
