console.log('[chatRenderer.js] Module loaded!');

export class ChatRenderer {
  constructor() {
    console.log('[ChatRenderer] Constructor called');
    this.mdParser = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    if (!window.marked) {
      console.warn('[ChatRenderer] marked not loaded yet, will retry on render');
      return;
    }

    this.mdParser = window.marked;

    this.mdParser.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false
    });

    const renderer = new this.mdParser.Renderer();

    renderer.link = (href, title, text) => {
      return `<a href="${this.escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="message-link">${text}</a>`;
    };

    renderer.code = (code, lang) => {
      const highlighted = this.highlightCode(code, lang);
      return `<div class="code-block" data-lang="${lang || 'text'}">
        <div class="code-header">
          <span class="code-lang">${this.escapeHtml(lang || 'text')}</span>
          <button class="code-copy-btn" type="button">
            <span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>
          </button>
        </div>
        <pre><code class="language-${this.escapeHtml(lang || 'text')}">${highlighted}</code></pre>
      </div>`;
    };

    renderer.codespan = (code) => {
      return `<code class="inline-code">${this.escapeHtml(code)}</code>`;
    };

    this.mdParser.use({ renderer });
    this.initialized = true;
    console.log('[ChatRenderer] Initialized successfully');
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  highlightCode(code, lang) {
    if (!lang) return this.escapeHtml(code);

    const escaped = this.escapeHtml(code);

    const patterns = {
      javascript: [
        { regex: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this)\b/g, color: '#c678dd' },
        { regex: /\b(true|false|null|undefined|NaN|Infinity)\b/g, color: '#d19a66' },
        { regex: /(['"`])(?:(?!\1)[^\\]|\\.)*?\1/g, color: '#98c379' },
        { regex: /\b\d+\.?\d*\b/g, color: '#d19a66' },
        { regex: /\/\/.*$/gm, color: '#5c6370' }
      ],
      python: [
        { regex: /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|lambda|yield|global|nonlocal|pass|break|continue|and|or|not|in|is|None|True|False)\b/g, color: '#c678dd' },
        { regex: /(['"])(?:(?!\1)[^\\]|\\.)*?\1/g, color: '#98c379' },
        { regex: /\b\d+\.?\d*\b/g, color: '#d19a66' },
        { regex: /#.*$/gm, color: '#5c6370' }
      ]
    };

    if (patterns[lang?.toLowerCase()]) {
      let highlighted = escaped;
      patterns[lang.toLowerCase()].forEach(({ regex, color }) => {
        highlighted = highlighted.replace(regex, (match) =>
          `<span style="color: ${color}">${match}</span>`
        );
      });
      return highlighted;
    }

    return escaped;
  }

  renderMarkdown(text) {
    if (!this.initialized) {
      this.initialize();
      if (!this.initialized) {
        return this.escapeHtml(text);
      }
    }

    try {
      return this.mdParser.parse(text);
    } catch (error) {
      console.error('[ChatRenderer] Markdown parsing error:', error);
      return this.escapeHtml(text);
    }
  }

  renderMessage(container, text, isStreaming = false) {
    if (!container) return;

    const html = this.renderMarkdown(text);
    container.innerHTML = html;

    if (!isStreaming) {
      this.attachCopyButtonListeners(container);
    }
  }

  attachCopyButtonListeners(container) {
    const copyBtns = container.querySelectorAll('.code-copy-btn');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.parentElement.nextElementSibling.textContent;
        navigator.clipboard.writeText(code);

        const originalContent = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">check</span>';
        btn.style.color = '#22c55e';

        setTimeout(() => {
          btn.innerHTML = originalContent;
          btn.style.color = '';
        }, 2000);
      });
    });
  }

  createEditInterface(messageElement, currentText, role, messageIndex) {
    const contentDiv = messageElement.querySelector('.message-content');
    if (!contentDiv) return;

    const textSpan = contentDiv.querySelector('.message-text');
    const actionsDiv = contentDiv.querySelector('.message-actions');

    // Hide original content and actions
    if (textSpan) textSpan.style.display = 'none';
    if (actionsDiv) actionsDiv.style.display = 'none';

    // Hide version nav if exists
    const versionNav = contentDiv.querySelector('.message-version-nav');
    if (versionNav) versionNav.style.display = 'none';

    // Create textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'message-edit-textarea';
    textarea.value = currentText;

    // Create action buttons
    const editActionsDiv = document.createElement('div');
    editActionsDiv.className = 'message-edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'message-edit-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.saveEditedMessage(messageIndex, role, textarea.value);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'message-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.cancelEditMessage(messageElement, currentText, role, messageIndex);
    });

    editActionsDiv.appendChild(saveBtn);
    editActionsDiv.appendChild(cancelBtn);

    contentDiv.appendChild(textarea);
    contentDiv.appendChild(editActionsDiv);

    // Focus and select all text
    textarea.focus();
    textarea.select();
  }

  removeEditInterface(messageElement, textSpan) {
    const contentDiv = messageElement.querySelector('.message-content');
    if (!contentDiv) return;

    // Remove textarea and edit actions
    const textarea = contentDiv.querySelector('.message-edit-textarea');
    const editActions = contentDiv.querySelector('.message-edit-actions');

    if (textarea) textarea.remove();
    if (editActions) editActions.remove();

    // Show original content and actions
    if (textSpan) textSpan.style.display = '';
    const actionsDiv = contentDiv.querySelector('.message-actions');
    if (actionsDiv) actionsDiv.style.display = '';
    const versionNav = contentDiv.querySelector('.message-version-nav');
    if (versionNav) versionNav.style.display = '';
  }

  updateMessageContent(messageElement, newText) {
    const textSpan = messageElement.querySelector('.message-text');
    if (textSpan) {
      this.renderMessage(textSpan, newText, false);
      this.attachCopyButtonListeners(textSpan);
    }
  }

  updateVersionNavigation(messageElement, versions, currentIndex) {
    const contentDiv = messageElement.querySelector('.message-content');
    if (!contentDiv) return;

    let versionNav = contentDiv.querySelector('.message-version-nav');

    if (versions && versions.length > 1) {
      if (!versionNav) {
        // Create new version nav
        const messageIndex = messageElement.dataset.messageIndex;
        versionNav = this.createVersionNavigation(versions, currentIndex, messageIndex);
        contentDiv.appendChild(versionNav);
      } else {
        // Update existing version nav
        const indicator = versionNav.querySelector('.message-version-indicator');
        const prevBtn = versionNav.querySelector('.message-version-nav-btn:first-child');
        const nextBtn = versionNav.querySelector('.message-version-nav-btn:last-child');

        if (indicator) {
          indicator.textContent = `${currentIndex + 1} / ${versions.length}`;
        }
        if (prevBtn) {
          prevBtn.disabled = currentIndex === 0;
        }
        if (nextBtn) {
          nextBtn.disabled = currentIndex === versions.length - 1;
        }
      }
    } else if (versionNav) {
      // Remove version nav if only one version
      versionNav.remove();
    }
  }

  updateStreamingMessage(messageElement, text) {
    const textSpan = messageElement.querySelector('.message-text');
    if (textSpan) {
      this.renderMessage(textSpan, text, true);
    }
  }

  finalizeStreamingMessage(messageElement, text) {
    const textSpan = messageElement.querySelector('.message-text');
    if (textSpan) {
      this.renderMessage(textSpan, text, false);
      this.attachCopyButtonListeners(textSpan);
    }
  }
}

export const chatRenderer = new ChatRenderer();
console.log('[chatRenderer.js] Exported chatRenderer instance:', chatRenderer);
