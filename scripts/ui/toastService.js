/**
 * Toast Service - Handles toast notifications
 */

const ToastService = {
  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Type of toast: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in milliseconds (default: 4000)
   */
  show(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) {
      console.warn('[ToastService] toastContainer not found');
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };

    const icon = iconMap[type] || iconMap.info;

    toast.innerHTML = `
      <span class="material-symbols-outlined toast-icon">${icon}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
      <button class="toast-close" type="button">
        <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
      </button>
    `;

    container.appendChild(toast);

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.hide(toast);
    });

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        this.hide(toast);
      }, duration);
    }
  },

  /**
   * Hide a toast notification
   * @param {HTMLElement} toast - Toast element to hide
   */
  hide(toast) {
    toast.classList.add('toast-hidden');
    setTimeout(() => {
      toast.remove();
    }, 300);
  },

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Convenience methods for different toast types
   */
  success(message, duration) {
    this.show(message, 'success', duration);
  },

  error(message, duration) {
    this.show(message, 'error', duration);
  },

  warning(message, duration) {
    this.show(message, 'warning', duration);
  },

  info(message, duration) {
    this.show(message, 'info', duration);
  }
};

// Make globally available
window.showToast = (message, type = 'info') => ToastService.show(message, type);
window.showToastToast = (message, type = 'info') => ToastService.show(message, type);

export { ToastService };
