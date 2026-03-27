/**
 * Sidebar Manager - Handles sidebar and tab navigation
 */

const SidebarManager = {
  /**
   * Toggle left sidebar
   */
  toggleLeftSidebar() {
    const leftSidebar = document.getElementById("leftSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (leftSidebar) leftSidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("active");
  },

  /**
   * Toggle right sidebar
   */
  toggleRightSidebar() {
    const rightSidebar = document.getElementById("rightSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (rightSidebar) rightSidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("active");
  },

  /**
   * Switch right sidebar tab
   * @param {string} tabId - Tab ID to switch to
   */
  switchSidebarTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll(".sidebar-tab-content").forEach((content) => {
      content.classList.remove("active");
    });

    // Remove active class from all tabs
    document.querySelectorAll(".sidebar-tab").forEach((tab) => {
      tab.classList.remove("active");
    });

    // Show the selected tab content
    const tabContent = document.getElementById(tabId);
    if (tabContent) tabContent.classList.add("active");

    // Add active class to the clicked tab
    const tab = document.querySelector(
      `.sidebar-tab[data-tab="${tabId}"]`
    );
    if (tab) tab.classList.add("active");
  },

  /**
   * Switch left sidebar tab
   * @param {string} tabId - Tab ID to switch to
   */
  switchLeftSidebarTab(tabId) {
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
    if (tabContent) tabContent.style.display = "block";

    // Add active class to the clicked tab
    const tab = document.querySelector(
      `#leftSidebar .sidebar-tab[data-tab="${tabId}"]`
    );
    if (tab) tab.classList.add("active");
  },

  /**
   * Setup sidebar overlay click handler
   */
  setupOverlayHandler() {
    const overlay = document.getElementById("sidebarOverlay");
    if (overlay) {
      overlay.addEventListener("click", () => {
        document.getElementById("leftSidebar").classList.remove("open");
        document.getElementById("rightSidebar").classList.remove("open");
        overlay.classList.remove("active");
      });
    }
  },

  /**
   * Setup add bot button
   * @param {Function} openUploadDialogCallback - Callback to open upload dialog
   */
  setupAddBotButton(openUploadDialogCallback) {
    const addBotBtn = document.getElementById("addBotBtn");
    if (addBotBtn) {
      addBotBtn.addEventListener("click", openUploadDialogCallback);
    }
  },

  /**
   * Setup add persona button
   */
  setupAddPersonaButton(openPersonaDialogCallback) {
    const addPersonaBtn = document.getElementById("addPersonaBtn");
    if (addPersonaBtn) {
      addPersonaBtn.addEventListener("click", openPersonaDialogCallback);
    }
  },

  /**
   * Initialize all sidebar functionality
   */
  init(openUploadDialogCallback, openPersonaDialogCallback) {
    this.setupOverlayHandler();
    this.setupAddBotButton(openUploadDialogCallback);
    this.setupAddPersonaButton(openPersonaDialogCallback);
  }
};

export { SidebarManager };
